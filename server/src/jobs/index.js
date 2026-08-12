'use strict';
const { Queue, Worker, QueueEvents } = require('bullmq');
const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

// ── Queue instances ────────────────────────────────────────────────────────────
let bookingQueue, paymentQueue, notificationQueue, invoiceQueue;
let workers = [];

const isTls = process.env.REDIS_URL?.startsWith('rediss://');
let redisHost;
try {
  if (process.env.REDIS_URL) redisHost = new URL(process.env.REDIS_URL).hostname;
} catch {}

const QUEUE_OPTIONS = {
  connection: {
    url: process.env.REDIS_URL,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    ...(isTls && {
      tls: {
        rejectUnauthorized: false,
        servername: redisHost,
        checkServerIdentity: () => undefined,
      },
    }),
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
};

// SCALE FIX: Priority levels — higher number = higher priority
// booking:match_provider (10) must never be blocked by invoice PDF (1)
const JOB_PRIORITIES = {
  match_provider: 10,     // Booking matching — customer is waiting
  booking_timeout: 9,     // Provider timeout handling
  send_otp: 8,            // OTP delivery
  process_payment: 7,     // Payment processing
  process_refund: 6,      // Refund processing
  booking_update: 3,      // Notification
  provider_payout: 2,     // Payout notification
  generate_invoice: 1,    // PDF generation — lowest priority
  check_commission_dues: 1,
};

const createMockQueue = (name) => ({
  name,
  add: async (jobName, data, opts) => {
    logger.warn(`[MockQueue:${name}] Job '${jobName}' called but ignored (Redis is offline).`);
    return { id: `mock_${Date.now()}` };
  },
  on: () => {},
});

function initQueues() {
  const redisClient = getRedisClient();
  if (!redisClient) {
    logger.warn('⚠️  Redis is down/offline. BullMQ background queues and workers will not be initialized. Using mock queues.');
    bookingQueue = createMockQueue('booking');
    paymentQueue = createMockQueue('payment');
    notificationQueue = createMockQueue('notification');
    invoiceQueue = createMockQueue('invoice');
    return;
  }

  try {
    // ── Create Queues ────────────────────────────────────────────────────────────
    bookingQueue = new Queue('booking', QUEUE_OPTIONS);
    paymentQueue = new Queue('payment', QUEUE_OPTIONS);
    notificationQueue = new Queue('notification', QUEUE_OPTIONS);
    invoiceQueue = new Queue('invoice', QUEUE_OPTIONS);

    bookingQueue.on('error', (err) => logger.warn('BullMQ bookingQueue error:', err.message));
    paymentQueue.on('error', (err) => logger.warn('BullMQ paymentQueue error:', err.message));
    notificationQueue.on('error', (err) => logger.warn('BullMQ notificationQueue error:', err.message));
    invoiceQueue.on('error', (err) => logger.warn('BullMQ invoiceQueue error:', err.message));

    // ── Create Workers ───────────────────────────────────────────────────────────
    const bookingWorker = createBookingWorker();
    const paymentWorker = createPaymentWorker();
    const notificationWorker = createNotificationWorker();
    const invoiceWorker = createInvoiceWorker();

    workers = [bookingWorker, paymentWorker, notificationWorker, invoiceWorker];

    // ── Queue Event Monitoring ───────────────────────────────────────────────────
    for (const queue of [bookingQueue, paymentQueue, notificationQueue]) {
      const events = new QueueEvents(queue.name, { connection: QUEUE_OPTIONS.connection });
      events.on('error', (err) => logger.warn(`QueueEvents ${queue.name} error:`, err.message));
      events.on('failed', ({ jobId, failedReason }) => {
        logger.error(`Job ${jobId} failed in queue ${queue.name}: ${failedReason}`);
      });
      events.on('completed', ({ jobId }) => {
        logger.debug(`Job ${jobId} completed in queue ${queue.name}`);
      });
    }

    // ── Scheduled Jobs (recurring) ───────────────────────────────────────────────
    scheduleRecurringJobs();

    // Universal 15-second fast pending job match fallback
    setInterval(() => {
      try {
        const { matchAllUnassignedBookings } = require('../modules/booking/booking.service');
        matchAllUnassignedBookings().catch(() => {});
      } catch {}
    }, 15000);

    logger.info('✅ BullMQ queues and workers initialized');
  } catch (error) {
    logger.warn('⚠️ BullMQ queue initialization failed (Redis might be down). Application will continue without background jobs.');
    logger.debug('Queue error detail:', error);
  }
}

// ── Booking Worker ─────────────────────────────────────────────────────────────
function createBookingWorker() {
  const worker = new Worker('booking', async (job) => {
    const { name, data } = job;
    logger.debug(`Processing booking job: ${name}`, data);

    // SCALE FIX: Per-job try/catch — unhandled error in one job must NOT crash the entire worker
    try {
      switch (name) {
        case 'match_provider':
          return await processProviderMatching(job);
        case 'match_unassigned_pending':
          const { matchAllUnassignedBookings } = require('../modules/booking/booking.service');
          return await matchAllUnassignedBookings();
        case 'booking_timeout':
          return await processBookingTimeout(job);
        case 'check_timeouts':
          return await processCheckTimeouts();
        case 'send_otp':
          return await processSendOTP(job);
        case 'check_commission_dues':
          return await processCommissionDuesCheck();
        case 'check_complaint_escalations':
          return await processComplaintEscalations();

        default:
          logger.warn(`Unknown booking job: ${name}`);
      }
    } catch (err) {
      logger.error(`[BookingWorker] Job '${name}' (id:${job.id}) failed:`, {
        message: err.message,
        jobData: data,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      });
      // Re-throw so BullMQ marks it as failed and retries with backoff
      throw err;
    }
  }, {
    ...QUEUE_OPTIONS,
    concurrency: 20,
  });
  worker.on('error', (err) => logger.warn('Worker booking error:', err.message));
  return worker;
}

async function processProviderMatching(job) {
  const { bookingId, coordinates, serviceId, attempt, excludeProviders = [] } = job.data;
  const { Booking } = require('../models');
  const { assignProviderToBooking } = require('../modules/booking/booking.service');

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    logger.warn(`Booking ${bookingId} not found for provider matching`);
    return;
  }

  if (booking.status !== 'pending') {
    logger.info(`Booking ${bookingId} is no longer pending (${booking.status}), skipping match`);
    return;
  }

  // ── 24-HOUR BOOKING LIFETIME ENFORCEMENT ────────────────────────────────────
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  const createdAtTime = booking.createdAt ? new Date(booking.createdAt).getTime() : Date.now();
  const bookingAgeMs = Date.now() - createdAtTime;

  if (bookingAgeMs > TWENTY_FOUR_HOURS_MS) {
    logger.warn(`Booking ${bookingId}: exceeded 24-hour lifetime window. Auto-cancelling.`);
    booking.status = 'cancelled';
    booking.cancellation = {
      cancelledBy: 'system',
      reason: 'No provider available/accepted within 24 hours window',
      cancelledAt: new Date(),
    };
    await booking.save();

    const { emitToUser } = require('../socket');
    emitToUser(booking.customerId.toString(), 'booking:expired', {
      bookingId,
      message: 'Your booking has expired after 24 hours of no provider assignment.',
    });
    return;
  }

  const provider = await assignProviderToBooking(booking, attempt);

  if (!provider) {
    if (attempt === 1) {
      const { emitToUser } = require('../socket');
      emitToUser(booking.customerId.toString(), 'booking:searching_providers', {
        bookingId,
        message: 'Searching for available technicians nearby. Your request will stay active for 24 hours.',
      });
    }

    // Continuously retry matching every 60s as long as booking is under 24 hours old
    await bookingQueue.add('match_provider', {
      ...job.data,
      attempt: attempt + 1,
    }, { delay: 60000 });
  }
}

async function processBookingTimeout(job) {
  const { bookingId, providerId } = job.data;
  const { Booking, Provider } = require('../models');
  const { emitToProvider } = require('../socket');

  const booking = await Booking.findById(bookingId);
  if (!booking || booking.status !== 'assigned') return; // Already handled

  const cachedTimeout = await require('../config/redis').cache.get(`booking_timeout:${bookingId}`);
  if (!cachedTimeout) return; // Timeout was cleared (provider accepted)

  logger.info(`Booking ${bookingId}: provider ${providerId} timed out`);

  // Add provider to rejected list
  booking.rejectedProviders.push(providerId);
  booking.status = 'pending';
  booking.providerId = undefined;
  booking.timeline.push({ status: 'pending', note: 'Provider timeout — reassigning' });
  await booking.save();

  // Auto-offline penalty
  const provider = await Provider.findById(providerId);
  if (provider) {
    const { cache } = require('../config/redis');
    const missedCount = parseInt(await cache.get(`provider_missed:${provider._id}`) || 0) + 1;
    if (missedCount >= 2) {
      provider.isOnline = false;
      await provider.save();
      await cache.del(`provider_missed:${provider._id}`);
      emitToProvider(providerId, 'notification:push', { title: 'Status Changed', body: 'You have been taken Offline after missing multiple requests.' });
    } else {
      await cache.set(`provider_missed:${provider._id}`, missedCount, 3600); // 1 hr expiry
    }
  }

  emitToProvider(providerId, 'booking:expired', { bookingId });

  // Re-queue matching
  await bookingQueue.add('match_provider', {
    bookingId,
    coordinates: booking.serviceAddress.location.coordinates,
    serviceId: booking.serviceId.toString(),
    attempt: booking.assignmentAttempts + 1,
    excludeProviders: booking.rejectedProviders.map(String),
  }, { delay: 1000 });
}

async function processCheckTimeouts() {
  const { Booking } = require('../models');
  const timedOutBookings = await Booking.find({
    status: 'assigned',
    assignmentTimeout: { $lte: new Date() },
  }).select('_id providerId').lean();

  if (timedOutBookings.length === 0) return;

  logger.info(`Found ${timedOutBookings.length} timed-out booking assignments. Triggering timeout jobs...`);

  for (const booking of timedOutBookings) {
    if (booking.providerId) {
      await bookingQueue.add('booking_timeout', {
        bookingId: booking._id.toString(),
        providerId: booking.providerId.toString(),
      });
    }
  }
}

async function processSendOTP(job) {
  const { phone, otp, type } = job.data;
  const smsService = require('../services/sms.service');
  await smsService.sendOTP(phone, otp, type);
}

// ── Complaint Auto-Escalation ───────────────────────────────────────────────────
async function processComplaintEscalations() {
  const { autoEscalateStaleComplaints, autoFreezeProviders } = require('../modules/complaint/complaint.routes');
  
  const escalated = await autoEscalateStaleComplaints();
  if (escalated > 0) {
    logger.warn(`[ComplaintEscalation] Auto-escalated ${escalated} stale complaint(s) (48h unresolved)`);
  }

  const frozen = await autoFreezeProviders();
  if (frozen > 0) {
    logger.warn(`[ComplaintFreeze] Auto-frozen ${frozen} provider(s) (7 days unresolved complaint)`);
  }
}


// ── Commission Dues Enforcement (Rapido Model) ─────────────────────────────────
async function processCommissionDuesCheck() {
  const { Provider, Notification, User } = require('../models');
  const { emitToProvider } = require('../socket');
  const pushService = require('../services/push.service');

  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(Date.now() - THREE_DAYS_MS);

  // Find providers exceeding ₹500 pending commission threshold OR due > 3 days
  const overdueProviders = await Provider.find({
    $or: [
      { 'earnings.pendingCommission': { $gte: 500 } },
      {
        'earnings.pendingCommission': { $gt: 0 },
        'earnings.commissionDueSince': { $lte: cutoffDate },
      },
    ],
    'earnings.isOnHold': { $ne: true },
  });

  for (const provider of overdueProviders) {
    provider.earnings.isOnHold = true;
    await provider.save();
    logger.warn(`Provider ${provider.name} (${provider._id}) placed on HOLD — unpaid commission ₹${provider.earnings.pendingCommission}`);

    const title = '🔴 Job Dispatch Suspended (Commission Limit Exceeded)';
    const body = `You owe ₹${provider.earnings.pendingCommission} in unpaid platform commission (limit ₹500). Pay via PhonePe/UPI on the app to resume accepting jobs immediately.`;

    // 1. Save Notification document for Provider portal inbox
    await Notification.create({
      userId: provider._id,
      title,
      body,
      type: 'account_hold',
      referenceId: provider._id,
    }).catch(err => logger.error('Failed to create Notification doc:', err.message));

    // 2. Real-time Socket Event
    emitToProvider(provider._id.toString(), 'notification:push', {
      title,
      body,
      pendingCommission: provider.earnings.pendingCommission,
      isOnHold: true,
    });

    // 3. Mobile FCM Push Notification
    const user = await User.findById(provider._id).select('fcmToken').lean();
    if (user?.fcmToken) {
      pushService.send(user.fcmToken, title, body).catch(() => {});
    }
  }

  logger.info(`Rapido Commission dues check: ${overdueProviders.length} providers placed on hold.`);
}

// ── Payment Worker ─────────────────────────────────────────────────────────────
function createPaymentWorker() {
  const worker = new Worker('payment', async (job) => {
    const { name, data } = job;

    switch (name) {
      case 'process_refund':
        return processRefund(job);
      case 'provider_settlement':
        return processProviderSettlement(job);
      default:
        logger.warn(`Unknown payment job: ${name}`);
    }
  }, { ...QUEUE_OPTIONS, concurrency: 5 });
  worker.on('error', (err) => logger.warn('Worker payment error:', err.message));
  return worker;
}

async function processRefund(job) {
  const { bookingId, refundAmount } = job.data;
  const { Booking, Transaction } = require('../models');

  const booking = await Booking.findById(bookingId);
  if (!booking) return;

  const originalTxn = await Transaction.findOne({
    bookingId, type: 'payment', status: 'success',
    razorpayPaymentId: { $exists: true },
  });

  if (!originalTxn) {
    logger.warn(`No Razorpay payment found for booking ${bookingId} — manual refund required`);
    return;
  }

  const Razorpay = require('razorpay');
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  try {
    const refund = await razorpay.payments.refund(originalTxn.razorpayPaymentId, {
      amount: Math.round(refundAmount * 100),
    });
    await Transaction.create({
      bookingId,
      userId: booking.customerId,
      type: 'refund',
      amount: refundAmount,
      status: 'processing',
      razorpayRefundId: refund.id,
      razorpayPaymentId: originalTxn.razorpayPaymentId,
      paymentMethod: 'online',
    });
    logger.info(`Refund processed: ${refund.id} for ₹${refundAmount}`);
  } catch (err) {
    logger.error(`Refund failed for booking ${bookingId}:`, err);
    throw err; // Will retry
  }
}

async function processProviderSettlement(job) {
  const { providerId, amount } = job.data;
  // In production: integrate with bank transfer API (Razorpay X, etc.)
  logger.info(`Settlement queued: ₹${amount} for provider ${providerId}`);
}

// ── Notification Worker ────────────────────────────────────────────────────────
function createNotificationWorker() {
  const worker = new Worker('notification', async (job) => {
    const { name, data } = job;

    switch (name) {
      case 'booking_update': return sendBookingNotification(data);
      case 'payment_success': return sendPaymentNotification(data);
      case 'otp': return sendOTPNotification(data);
      case 'referral_reward': return processReferralReward(data);
      default:
        logger.warn(`Unknown notification job: ${name}`);
    }
  }, { ...QUEUE_OPTIONS, concurrency: 50 });
  worker.on('error', (err) => logger.warn('Worker notification error:', err.message));
  return worker;
}

async function sendBookingNotification(data) {
  const { userId, title, body, type, referenceId } = data;
  const { Notification } = require('../models');
  const { emitToUser } = require('../socket');
  const pushService = require('../services/push.service');

  const notification = await Notification.create({
    userId,
    title,
    body,
    type: type || 'booking_update',
    referenceId,
  });

  // Real-time
  emitToUser(userId, 'notification:push', { title, body, type });

  // Push notification
  const { User } = require('../models');
  const user = await User.findById(userId).select('fcmToken').lean();
  if (user?.fcmToken) {
    try {
      await pushService.send(user.fcmToken, title, body);
      await Notification.findByIdAndUpdate(notification._id, {
        'channels.push.sent': true,
        'channels.push.sentAt': new Date(),
      });
    } catch (err) {
      logger.warn(`Push notification failed for user ${userId}:`, err.message);
    }
  }
}

async function sendPaymentNotification(data) {
  const { userId, amount, bookingId } = data;
  await sendBookingNotification({
    userId,
    title: 'Payment Successful',
    body: `Your payment of ₹${amount} has been received. Thank you!`,
    type: 'payment',
    referenceId: bookingId,
  });
}

async function sendOTPNotification(data) {
  const smsService = require('../services/sms.service');
  await smsService.sendOTP(data.phone, data.otp);
}

async function processReferralReward(data) {
  const { referrerId, newUserId } = data;
  const { User } = require('../models');

  // Credit referrer wallet (e.g., ₹50)
  const REFERRAL_REWARD = 50;
  await User.findByIdAndUpdate(referrerId, {
    $inc: { walletBalance: REFERRAL_REWARD },
  });
  logger.info(`Referral reward: ₹${REFERRAL_REWARD} credited to user ${referrerId}`);
}

// ── Invoice Worker ─────────────────────────────────────────────────────────────
function createInvoiceWorker() {
  const worker = new Worker('invoice', async (job) => {
    const { bookingId } = job.data;
    const { Booking, Transaction } = require('../models');
    const pdfService = require('../services/pdf.service');
    const { s3Service } = require('../services/s3.service');

    const booking = await Booking.findById(bookingId)
      .populate('serviceId customerId providerId')
      .lean();
    const transaction = await Transaction.findOne({ bookingId, type: 'payment', status: 'success' }).lean();
    const materials = await require('../models').MaterialsUsed.findOne({ bookingId }).lean();

    const pdfBuffer = await pdfService.generateInvoice({ booking, materials, transaction });
    const key = `invoices/${booking.bookingNumber}.pdf`;
    const url = await s3Service.upload(key, pdfBuffer, 'application/pdf');

    await Transaction.findByIdAndUpdate(transaction?._id, { invoiceUrl: url });
    logger.info(`Invoice stored: ${url}`);
  }, { ...QUEUE_OPTIONS, concurrency: 10 });
  worker.on('error', (err) => logger.warn('Worker invoice error:', err.message));
  return worker;
}

// ── Recurring Scheduled Jobs ───────────────────────────────────────────────────
function scheduleRecurringJobs() {
  // Rapid scan for unassigned pending bookings every 15 seconds
  bookingQueue.add('match_unassigned_pending', {}, {
    repeat: { every: 15000 }, // Every 15 seconds
    jobId: 'rapid_unassigned_pending_matcher',
  });

  // Check timed-out booking assignments every minute
  bookingQueue.add('check_timeouts', {}, {
    repeat: { every: 60000 }, // Every 1 minute
    jobId: 'check_assignment_timeouts',
  });

  // Daily commission dues enforcement — 6:00 AM IST (00:30 UTC)
  bookingQueue.add('check_commission_dues', {}, {
    repeat: { cron: '30 0 * * *' },
    jobId: 'daily_commission_dues_check',
  });

  // Daily provider settlement (2 AM IST)
  paymentQueue.add('provider_settlement_batch', {}, {
    repeat: { cron: '30 20 * * *' }, // 8:30 PM UTC = 2:00 AM IST
    jobId: 'daily_settlement',
  });

  // Hourly complaint escalation scan — auto-escalate if tech doesn't resolve in 48h
  bookingQueue.add('check_complaint_escalations', {}, {
    repeat: { every: 60 * 60 * 1000 }, // Every 1 hour
    jobId: 'hourly_complaint_escalation_scan',
  });

}

// ── Graceful shutdown ──────────────────────────────────────────────────────────
async function shutdownQueues() {
  logger.info('Closing queue workers...');
  await Promise.all(workers.map((w) => w.close()));
  logger.info('Queue workers closed');
}

process.on('SIGTERM', shutdownQueues);

// ── Exports ───────────────────────────────────────────────────────────────────
function getQueues() {
  return { bookingQueue, paymentQueue, notificationQueue, invoiceQueue };
}

module.exports = {
  initQueues,
  get bookingQueue() { return bookingQueue || createMockQueue('booking'); },
  get paymentQueue() { return paymentQueue || createMockQueue('payment'); },
  get notificationQueue() { return notificationQueue || createMockQueue('notification'); },
  get invoiceQueue() { return invoiceQueue || createMockQueue('invoice'); },
  shutdownQueues,
};
