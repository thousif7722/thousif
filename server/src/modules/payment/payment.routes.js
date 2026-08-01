'use strict';
const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { Booking, Transaction, Provider, User, WalletLedger } = require('../../models');
const { authenticate, authorize } = require('../auth/auth.routes');
const { AppError } = require('../../utils/errors');
const { cache } = require('../../config/redis');
const { getIO } = require('../../socket');
const logger = require('../../utils/logger');
const pdfService = require('../../services/pdf.service');
const { s3Service } = require('../../services/s3.service');
const { notificationQueue } = require('../../jobs');

const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

function money(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getCashCommissionCoverage(provider, platformFee) {
  const fee = money(platformFee);
  const walletBalance = money(provider?.earnings?.walletBalance);
  const securityDeposit = money(provider?.earnings?.securityDeposit);
  const availableBalance = walletBalance + securityDeposit;

  // In development, allow cash payment regardless of wallet/deposit balance to facilitate testing
  const envStr = (process.env.NODE_ENV || '').trim().toLowerCase();
  const isDev = !envStr || envStr.includes('development') || envStr.includes('dev') || envStr === 'local';
  const cashAllowed = isDev || fee <= 0 || availableBalance >= fee;

  return {
    cashAllowed,
    platformFee: fee,
    walletBalance,
    securityDeposit,
    availableBalance,
    shortfall: cashAllowed ? 0 : Math.max(0, fee - availableBalance),
  };
}

function assertCashCommissionCoverage(provider, platformFee) {
  if (!provider) throw new AppError('Provider not found for cash payment', 404);

  const coverage = getCashCommissionCoverage(provider, platformFee);
  if (!coverage.cashAllowed) {
    throw new AppError(
      `Cash payment unavailable. Provider wallet/security deposit is short by Rs.${coverage.shortfall}. Please pay online.`,
      400
    );
  }

  return coverage;
}

function deductCashCommission(provider, platformFee) {
  const fee = money(platformFee);
  if (fee === 0) {
    return { walletBalance: provider.earnings.walletBalance, pendingCommission: provider.earnings.pendingCommission, isOnHold: provider.earnings.isOnHold };
  }

  const currentWallet = money(provider?.earnings?.walletBalance);
  const newWallet = currentWallet - fee;
  provider.earnings.walletBalance = newWallet;

  if (newWallet < 0) {
    provider.earnings.pendingCommission = Math.abs(newWallet);
    if (!provider.earnings.commissionDueSince) {
      provider.earnings.commissionDueSince = new Date();
    }
  } else {
    provider.earnings.pendingCommission = 0;
    provider.earnings.commissionDueSince = null;
  }

  // Threshold check: auto-hold if unpaid commission >= 500 (wallet balance <= -500)
  if (provider.earnings.pendingCommission >= 500 || newWallet <= -500) {
    provider.earnings.isOnHold = true;
  }

  return {
    platformFee: fee,
    walletBalance: newWallet,
    pendingCommission: provider.earnings.pendingCommission,
    isOnHold: provider.earnings.isOnHold,
  };
}

async function createCashCommissionLedgerEntries(provider, booking, transaction, deduction, session) {
  const entries = [];

  if (deduction.fromWallet > 0) {
    entries.push({
      ownerId: provider._id,
      ownerType: 'provider',
      transactionId: transaction?._id,
      type: 'debit',
      account: 'wallet',
      amount: deduction.fromWallet,
      balance: provider.earnings.walletBalance,
      description: `Platform commission deducted from wallet for cash booking ${booking.bookingNumber}`,
      referenceType: 'booking',
      referenceId: booking._id,
    });
  }

  if (deduction.fromSecurityDeposit > 0) {
    entries.push({
      ownerId: provider._id,
      ownerType: 'provider',
      transactionId: transaction?._id,
      type: 'debit',
      account: 'security_deposit',
      amount: deduction.fromSecurityDeposit,
      balance: provider.earnings.securityDeposit,
      description: `Platform commission deducted from security deposit for cash booking ${booking.bookingNumber}`,
      referenceType: 'booking',
      referenceId: booking._id,
    });
  }

  if (entries.length > 0) {
    await WalletLedger.create(entries, { session });
  }
}

// ── Idempotency Middleware ─────────────────────────────────────────────────────
async function checkIdempotency(req, res, next) {
  const key = req.headers['x-idempotency-key'];
  if (!key) return next();

  const cached = await cache.get(`idempotency:${key}`);
  if (cached) {
    logger.info(`Idempotent response returned for key: ${key}`);
    return res.status(cached.status).json(cached.body);
  }

  // Store idempotency result in res.locals for later caching
  res.locals.idempotencyKey = key;
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    cache.set(`idempotency:${key}`, { status: res.statusCode, body }, 86400); // 24h
    return originalJson(body);
  };

  next();
}

// ── Create Payment Order ───────────────────────────────────────────────────────
router.get('/bookings/:id/options', authenticate, async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .select('customerId providerId status totalAmount platformFee providerEarnings bookingNumber')
    .lean();
  if (!booking) throw new AppError('Booking not found', 404);

  const isCustomer = req.userRole === 'customer' && booking.customerId?.toString() === req.userId;
  const isProvider = req.userRole === 'provider' && booking.providerId?.toString() === req.userId;
  const isAdmin = req.userRole === 'admin';
  if (!isCustomer && !isProvider && !isAdmin) throw new AppError('Forbidden', 403);

  const existingTxn = await Transaction.findOne({
    bookingId: booking._id,
    type: 'payment',
    status: 'success',
  }).select('paymentMethod createdAt').lean();

  const provider = booking.providerId
    ? await Provider.findById(booking.providerId).select('earnings').lean()
    : null;
  const coverage = getCashCommissionCoverage(provider, booking.platformFee);
  const paymentOpen = booking.status === 'completed' && !existingTxn;
  const canSeeBalances = isProvider || isAdmin;

  res.json({
    success: true,
    data: {
      paymentOpen,
      alreadyPaid: !!existingTxn,
      paidMethod: existingTxn?.paymentMethod || null,
      online: {
        available: paymentOpen,
        recommended: true,
      },
      cash: {
        available: paymentOpen && coverage.cashAllowed,
        platformFee: coverage.platformFee,
        shortfall: coverage.shortfall,
        message: coverage.cashAllowed
          ? 'Cash is allowed. Platform commission will be deducted from provider wallet/security deposit.'
          : 'Cash is unavailable because provider wallet/security deposit cannot cover platform commission. Please pay online.',
        ...(canSeeBalances ? {
          walletBalance: coverage.walletBalance,
          securityDeposit: coverage.securityDeposit,
          availableBalance: coverage.availableBalance,
        } : {}),
      },
    },
  });
});

router.post('/create-order', authenticate, authorize('customer'), checkIdempotency, async (req, res) => {
  const { bookingId, paymentMethod = 'online' } = req.body;
  if (!bookingId) throw new AppError('Booking ID required', 400);

  const booking = await Booking.findById(bookingId);
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.customerId.toString() !== req.userId) throw new AppError('Forbidden', 403);
  if (booking.status !== 'completed') throw new AppError('Payment only for completed bookings', 400);

  // Check if already paid
  const existingTxn = await Transaction.findOne({
    bookingId, type: 'payment', status: 'success',
  });
  if (existingTxn) throw new AppError('Booking already paid', 400);

  if (paymentMethod === 'cash') {
    const provider = booking.providerId ? await Provider.findById(booking.providerId) : null;
    assertCashCommissionCoverage(provider, booking.platformFee);
    return handleCashPayment(req, res, booking);
  }

  // Create Razorpay order
  const amountPaise = Math.round(booking.totalAmount * 100); // Convert to paise
  const rzpOrder = await razorpay.orders.create({
    amount: amountPaise,
    currency: 'INR',
    receipt: booking.bookingNumber,
    notes: {
      bookingId: booking._id.toString(),
      customerId: req.userId,
    },
  });

  // Create pending transaction
  const transaction = await Transaction.create({
    bookingId: booking._id,
    userId: req.userId,
    providerId: booking.providerId,
    type: 'payment',
    amount: booking.totalAmount,
    status: 'pending',
    razorpayOrderId: rzpOrder.id,
    paymentMethod: 'online',
    idempotencyKey: res.locals.idempotencyKey,
  });

  const customer = await User.findById(req.userId).select('name phone').lean();

  res.json({
    success: true,
    data: {
      orderId: rzpOrder.id,
      transactionId: transaction.transactionId,
      amount: amountPaise,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID,
      bookingNumber: booking.bookingNumber,
      prefill: {
        name: customer?.name || '',
        contact: customer?.phone ? `+91${customer.phone}` : '',
      },
    },
  });
});

function isTransactionError(err) {
  if (!err) return false;
  const msg = err.message || '';
  return (
    err.name === 'MongoServerError' ||
    err.code === 20 ||
    err.code === 263 ||
    msg.includes('replica set') ||
    msg.includes('Transaction numbers are only allowed')
  );
}

// ── Cash Payment Handler ───────────────────────────────────────────────────────
async function handleCashPayment(req, res, booking) {
  const executeOperation = async (session = null) => {
    const opts = session ? { session } : {};
    const txnPayload = {
      bookingId: booking._id,
      userId: booking.customerId,
      providerId: booking.providerId,
      type: 'payment',
      amount: booking.totalAmount,
      status: 'success',
      paymentMethod: 'cash',
      platformAmount: booking.platformFee,
      providerAmount: booking.providerEarnings,
    };

    const transaction = session
      ? await Transaction.create([txnPayload], opts)
      : [await Transaction.create(txnPayload)];

    await splitEarnings(booking, transaction[0], session);
    booking.status = 'paid';
    booking.paymentMethod = 'cash';
    booking.timeline.push({ status: 'paid', note: 'Cash payment recorded' });
    await booking.save(opts);
    await generateAndStoreInvoice(booking, transaction[0]);

    return transaction[0];
  };

  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    const txn = await executeOperation(session);
    await session.commitTransaction();
    session.endSession();

    const io = getIO();
    io.to(`user:${booking.customerId}`).emit('booking:paid', {
      bookingId: booking._id,
      message: 'Cash payment recorded. Thank you!',
    });

    return res.json({ success: true, message: 'Cash payment recorded', data: { transactionId: txn.transactionId } });
  } catch (err) {
    if (session) {
      try {
        if (session.inTransaction()) await session.abortTransaction();
        await session.endSession();
      } catch (sErr) {}
    }

    if (isTransactionError(err)) {
      try {
        const txn = await executeOperation(null);
        const io = getIO();
        io.to(`user:${booking.customerId}`).emit('booking:paid', {
          bookingId: booking._id,
          message: 'Cash payment recorded. Thank you!',
        });
        return res.json({ success: true, message: 'Cash payment recorded', data: { transactionId: txn.transactionId } });
      } catch (fallbackErr) {
        throw new AppError(fallbackErr.message, fallbackErr.status || 500);
      }
    }

    const sanitizedError = new AppError(err.message, err.status || 500);
    sanitizedError.stack = err.stack;
    throw sanitizedError;
  }
}

// ── Verify Razorpay Payment ────────────────────────────────────────────────────
router.post('/verify', authenticate, authorize('customer'), async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, bookingId } = req.body;

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw new AppError('Payment verification data incomplete', 400);
  }

  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (expectedSignature !== razorpaySignature) {
    throw new AppError('Payment signature mismatch. Possible fraud attempt.', 400);
  }

  try {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new AppError('Booking not found', 404);
    if (booking.status === 'paid') {
      return res.json({ success: true, message: 'Payment already processed' });
    }

    // Update transaction
    const transaction = await Transaction.findOneAndUpdate(
      { bookingId, razorpayOrderId },
      {
        razorpayPaymentId,
        razorpaySignature,
        status: 'success',
        platformAmount: booking.platformFee,
        providerAmount: booking.providerEarnings,
      },
      { new: true }
    );

    if (!transaction) throw new AppError('Transaction record not found', 404);

    // Split earnings
    await splitEarnings(booking, transaction);

    booking.status = 'paid';
    booking.paymentMethod = 'online';
    booking.timeline.push({ status: 'paid', note: 'Online payment successful' });
    await booking.save();

    // Async: generate invoice, notify
    setImmediate(async () => {
      try {
        await generateAndStoreInvoice(booking, transaction);
        await notificationQueue.add('payment_success', {
          bookingId: booking._id.toString(),
          userId: booking.customerId.toString(),
          amount: booking.totalAmount,
        });
      } catch (e) {
        logger.error('Post-payment async tasks failed:', e);
      }
    });

    const io = getIO();
    io.to(`user:${booking.customerId}`).emit('booking:paid', {
      bookingId: booking._id,
      amount: booking.totalAmount,
      message: 'Payment successful! Thank you.',
    });
    io.to(`provider:${booking.providerId}`).emit('payment:received', {
      bookingId: booking._id,
      earnings: booking.providerEarnings,
      message: `Payment received for booking ${booking.bookingNumber}`,
    });

    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        transactionId: transaction.transactionId,
        amount: booking.totalAmount,
        providerEarnings: booking.providerEarnings,
      },
    });
  } catch (err) {
    throw err;
  }
});

// ── Razorpay Webhook (raw body) ────────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  // Verify webhook signature
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(req.body) // raw body buffer
    .digest('hex');

  if (signature !== expectedSig) {
    logger.warn('Invalid Razorpay webhook signature');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const event = JSON.parse(req.body.toString());
  logger.info(`Razorpay webhook: ${event.event}`);

  // Idempotency: skip duplicate webhooks
  const webhookKey = `webhook:${event.payload?.payment?.entity?.id || event.event}`;
  const alreadyProcessed = await cache.setNX(webhookKey, '1', 86400);
  if (!alreadyProcessed) {
    return res.json({ received: true, skipped: 'duplicate' });
  }

  switch (event.event) {
    case 'payment.captured': {
      const payment = event.payload.payment.entity;
      await Transaction.findOneAndUpdate(
        { razorpayOrderId: payment.order_id },
        { razorpayPaymentId: payment.id, status: 'success' }
      );
      break;
    }
    case 'payment.failed': {
      const payment = event.payload.payment.entity;
      await Transaction.findOneAndUpdate(
        { razorpayOrderId: payment.order_id },
        { status: 'failed', failureReason: payment.error_description }
      );
      break;
    }
    case 'refund.processed': {
      const refund = event.payload.refund.entity;
      await Transaction.findOneAndUpdate(
        { razorpayPaymentId: refund.payment_id, type: 'refund' },
        { status: 'success', razorpayRefundId: refund.id }
      );
      break;
    }
  }

  res.json({ received: true });
});

// ── Refund ─────────────────────────────────────────────────────────────────────
router.post('/refund', authenticate, authorize('admin'), async (req, res) => {
  const { bookingId, amount, reason } = req.body;

  const booking = await Booking.findById(bookingId);
  if (!booking) throw new AppError('Booking not found', 404);

  const originalTxn = await Transaction.findOne({
    bookingId, type: 'payment', status: 'success',
  });
  if (!originalTxn) throw new AppError('No successful payment found', 404);
  if (!originalTxn.razorpayPaymentId) throw new AppError('Cash payments must be manually refunded', 400);

  const refundAmount = amount || originalTxn.amount;
  const refundAmountPaise = Math.round(refundAmount * 100);

  const rzpRefund = await razorpay.payments.refund(originalTxn.razorpayPaymentId, {
    amount: refundAmountPaise,
    notes: { reason, bookingId: bookingId.toString() },
  });

  await Transaction.create({
    bookingId: booking._id,
    userId: booking.customerId,
    type: 'refund',
    amount: refundAmount,
    status: 'processing',
    razorpayPaymentId: originalTxn.razorpayPaymentId,
    razorpayRefundId: rzpRefund.id,
    paymentMethod: 'online',
    metadata: { reason, initiatedBy: req.userId },
  });

  logger.info(`Refund initiated: ₹${refundAmount} for booking ${booking.bookingNumber}`);
  res.json({ success: true, message: `Refund of ₹${refundAmount} initiated`, data: { refundId: rzpRefund.id } });
});

// ── Commission Split Logic ─────────────────────────────────────────────────────
async function splitEarnings(booking, transaction, session = null) {
  const providerId = booking.providerId;
  const providerEarnings = booking.providerEarnings;
  const platformFee = booking.platformFee;
  const isCash = transaction?.paymentMethod === 'cash';
  let cashDeduction = null;

  // Credit or Debit provider wallet based on payment mode
  const provider = await Provider.findById(providerId).session(session);
  if (provider) {
    if (isCash) {
      // Provider collected 100% cash physically.
      // They owe the platform its commission — track as pending debt.
      const deduction = deductCashCommission(provider, platformFee);
      cashDeduction = deduction;
      provider.earnings.totalEarnings += providerEarnings;
      provider.earnings.totalCommissionPaid += platformFee;
      provider.completedJobs += 1;
      await createCashCommissionLedgerEntries(provider, booking, transaction, deduction, session);

      if (false) {
      // Start the 3-day due clock if not already running
      if (!provider.earnings.commissionDueSince) {
        provider.earnings.commissionDueSince = new Date();
      }

      // Wallet ledger: debit as "commission owed" (doesn't affect balance until settled)
      await WalletLedger.create([{
        ownerId: providerId,
        ownerType: 'provider',
        transactionId: transaction?._id,
        type: 'debit',
        amount: platformFee,
        balance: provider.earnings.walletBalance,
        description: `Platform commission due (cash) for booking ${booking.bookingNumber} — Pay within 3 days`,
        referenceType: 'booking',
        referenceId: booking._id,
      }], { session });
      }
    } else {
      // Admin collected 100% money digitally. Owe provider their earnings.
      provider.earnings.walletBalance += providerEarnings;
      provider.earnings.totalEarnings += providerEarnings;
      provider.earnings.pendingSettlement += providerEarnings;
      provider.earnings.totalCommissionPaid += platformFee; // Commission auto-captured
      provider.completedJobs += 1;

      // Wallet ledger entry (Credit)
      await WalletLedger.create([{
        ownerId: providerId,
        ownerType: 'provider',
        transactionId: transaction?._id,
        type: 'credit',
        account: 'wallet',
        amount: providerEarnings,
        balance: provider.earnings.walletBalance,
        description: `Earnings credited for online booking ${booking.bookingNumber}`,
        referenceType: 'booking',
        referenceId: booking._id,
      }], { session });
    }
    await provider.save({ session });
  }

  // Record platform commission entry
  if (transaction) {
    await Transaction.create([{
      bookingId: booking._id,
      userId: booking.customerId,
      providerId: booking.providerId,
      type: 'commission',
      amount: platformFee,
      status: 'success',
      paymentMethod: transaction.paymentMethod,
      metadata: {
        commissionRate: booking.commissionRate,
        cashDue: false,
        deductedImmediately: isCash,
        deductedFromWallet: cashDeduction?.fromWallet || 0,
        deductedFromSecurityDeposit: cashDeduction?.fromSecurityDeposit || 0,
      },
    }], { session });
  }

  // Update customer stats
  await User.findByIdAndUpdate(booking.customerId, {
    $inc: { totalBookings: 1, totalSpent: booking.totalAmount },
  }, { session });

  // Update provider tier
  if (provider) {
    await updateProviderTier(provider, session);
  }
}

async function updateProviderTier(provider, session = null) {
  let tier = 'bronze';
  if (provider.completedJobs >= 100 && provider.rating >= 4.5) tier = 'gold';
  else if (provider.completedJobs >= 30 && provider.rating >= 4.0) tier = 'silver';

  if (provider.tier !== tier) {
    provider.tier = tier;
    await provider.save({ session });
    logger.info(`Provider ${provider._id} upgraded to ${tier}`);
  }
}

// ── Generate & Store Invoice ───────────────────────────────────────────────────
async function generateAndStoreInvoice(booking, transaction) {
  try {
    const fullBooking = await Booking.findById(booking._id)
      .populate('serviceId', 'name category')
      .populate('customerId', 'name phone email')
      .populate('providerId', 'name phone')
      .lean();
    const materials = await require('../../models').MaterialsUsed.findOne({ bookingId: booking._id }).lean();
    const pdfBuffer = await pdfService.generateInvoice({ booking: fullBooking, materials, transaction });
    const key = `invoices/${booking.bookingNumber}.pdf`;
    const invoiceUrl = await s3Service.upload(key, pdfBuffer, 'application/pdf');
    await Transaction.findByIdAndUpdate(transaction._id, { invoiceUrl });
    logger.info(`Invoice generated: ${invoiceUrl}`);
    return invoiceUrl;
  } catch (err) {
    logger.error('Invoice generation failed:', err);
  }
}

// ── Get Provider Wallet ────────────────────────────────────────────────────────
router.get('/wallet', authenticate, authorize('provider'), async (req, res) => {
  const provider = await Provider.findById(req.userId).select('earnings').lean();
  if (!provider) throw new AppError('Provider not found', 404);

  const recentTransactions = await WalletLedger.find({ ownerId: req.userId })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  res.json({ success: true, data: { earnings: provider.earnings, recentTransactions } });
});

// ── Provider Withdrawal Request ────────────────────────────────────────────────
router.post('/withdraw', authenticate, authorize('provider'), async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount < 100) throw new AppError('Minimum withdrawal is ₹100', 400);

  const provider = await Provider.findById(req.userId);
  if (!provider) throw new AppError('Provider not found', 404);
  if (!provider.earnings.bankAccount?.verified) throw new AppError('Bank account not verified', 400);
  if (provider.earnings.walletBalance < amount) throw new AppError('Insufficient wallet balance', 400);

  // Deduct from wallet, create settlement record
  provider.earnings.walletBalance -= amount;
  provider.earnings.pendingSettlement -= amount;
  await provider.save();

  await Transaction.create({
    userId: null,
    providerId: provider._id,
    type: 'settlement',
    amount,
    status: 'processing',
    paymentMethod: 'bank_transfer',
    metadata: { bankAccount: provider.earnings.bankAccount },
  });

  await WalletLedger.create({
    ownerId: provider._id,
    ownerType: 'provider',
    type: 'debit',
    amount,
    balance: provider.earnings.walletBalance,
    description: `Withdrawal request of ₹${amount}`,
    referenceType: 'settlement',
  });

  res.json({ success: true, message: `Withdrawal of ₹${amount} initiated. Will be transferred in 2-3 business days.` });
});

// ── Provider Confirms Cash Received ───────────────────────────────────────────
/**
 * PUT /payments/bookings/:id/cash-confirm
 * Technician confirms they received the cash from customer.
 * Called from provider's job card after completing the job.
 */
router.put('/bookings/:id/cash-confirm', authenticate, authorize('provider'), async (req, res) => {
  const executeCashConfirm = async (session = null) => {
    const opts = session ? { session } : {};
    const bookingQuery = Booking.findById(req.params.id);
    const booking = session ? await bookingQuery.session(session) : await bookingQuery;

    if (!booking) throw new AppError('Booking not found', 404);
    const activeProviderId = req.providerId || req.userId;
    if (booking.providerId?.toString() !== activeProviderId) throw new AppError('Forbidden', 403);
    if (booking.status !== 'completed') throw new AppError('Job must be completed before recording payment', 400);

    const existingTxnQuery = Transaction.findOne({
      bookingId: booking._id,
      type: 'payment',
      status: 'success',
    });
    const existingTxn = session ? await existingTxnQuery.session(session) : await existingTxnQuery;
    if (existingTxn) throw new AppError('Payment already recorded', 400);

    const txnPayload = {
      bookingId: booking._id,
      userId: booking.customerId,
      providerId: booking.providerId,
      type: 'payment',
      amount: booking.totalAmount,
      status: 'success',
      paymentMethod: 'cash',
      platformAmount: booking.platformFee,
      providerAmount: booking.providerEarnings,
      metadata: { confirmedByProvider: true, confirmedAt: new Date() },
    };

    const transactionDocs = session
      ? await Transaction.create([txnPayload], opts)
      : [await Transaction.create(txnPayload)];
    const transaction = transactionDocs[0];

    await splitEarnings(booking, transaction, session);

    booking.status = 'paid';
    booking.paymentMethod = 'cash';
    booking.timeline.push({ status: 'paid', note: 'Cash payment confirmed by technician' });
    await booking.save(opts);

    setImmediate(async () => {
      try {
        await generateAndStoreInvoice(booking, transaction);
      } catch (err) {
        logger.error('Cash invoice generation failed:', err);
      }
    });

    return { booking, transaction };
  };

  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    const { booking, transaction } = await executeCashConfirm(session);
    await session.commitTransaction();
    session.endSession();

    const io = getIO();
    io.to(`user:${booking.customerId}`).emit('booking:paid', {
      bookingId: booking._id,
      amount: booking.totalAmount,
      message: 'Cash payment confirmed by technician',
    });
    io.to(`provider:${booking.providerId}`).emit('payment:received', {
      bookingId: booking._id,
      earnings: booking.providerEarnings,
      message: `Cash payment confirmed for booking ${booking.bookingNumber}`,
    });

    return res.json({
      success: true,
      message: 'Cash payment confirmed',
      data: { transactionId: transaction.transactionId },
    });
  } catch (err) {
    if (session) {
      try {
        if (session.inTransaction()) await session.abortTransaction();
        await session.endSession();
      } catch (sErr) {}
    }
    throw err;
  }

  setImmediate(async () => {
    try {
      await generateAndStoreInvoice(booking, transaction);
    } catch (err) {
      logger.error('Cash invoice generation failed:', err);
    }
  });

  // Notify customer
  const io = getIO();
  io.to(`user:${booking.customerId}`).emit('booking:paid', {
    bookingId: booking._id,
    message: 'Cash payment confirmed. Thank you!',
    paymentMethod: 'cash',
  });
  // Notify provider (self) for UI update
  io.to(`provider:${req.userId}`).emit('payment:received', {
    bookingId: booking._id,
    earnings: booking.providerEarnings,
    paymentMethod: 'cash',
    message: `Cash received for booking #${booking.bookingNumber}`,
  });

  logger.info(`Provider ${req.userId} confirmed cash for booking ${booking.bookingNumber}`);

  res.json({
    success: true,
    message: 'Cash payment confirmed',
    data: {
      transactionId: transaction.transactionId,
      earnings: booking.providerEarnings,
      platformFee: booking.platformFee,
    },
  });
});

// ── Provider: Check Payment Status for a completed booking ─────────────────────
/**
 * GET /payments/bookings/:id/status
 * Provider polls this to see if customer paid online already.
 */
router.get('/bookings/:id/status', authenticate, authorize('provider'), async (req, res) => {
  const booking = await Booking.findById(req.params.id).select('status totalAmount providerEarnings bookingNumber').lean();
  if (!booking) throw new AppError('Booking not found', 404);

  const txn = await Transaction.findOne({
    bookingId: req.params.id,
    type: 'payment',
    status: 'success',
  }).select('paymentMethod amount createdAt').lean();

  res.json({
    success: true,
    data: {
      bookingStatus: booking.status,
      isPaid: !!txn,
      paymentMethod: txn?.paymentMethod || null,
      paidAt: txn?.createdAt || null,
      totalAmount: booking.totalAmount,
      providerEarnings: booking.providerEarnings,
    },
  });
});

// ── Provider: Pay Commission via Razorpay / UPI / PhonePe (Rapido Model) ───────
/**
 * POST /payments/commission/create-order
 * Provider creates a Razorpay order to clear their pending platform commission dues.
 */
router.post('/commission/create-order', authenticate, authorize('provider'), async (req, res) => {
  const provider = await Provider.findById(req.userId);
  if (!provider) throw new AppError('Provider not found', 404);

  const pendingDues = money(provider.earnings?.pendingCommission);
  const reqAmount = Number(req.body.amount);
  const amountToPay = (reqAmount && reqAmount > 0) ? reqAmount : (pendingDues > 0 ? pendingDues : 100);

  if (amountToPay <= 0) {
    throw new AppError('Amount to pay must be greater than zero', 400);
  }

  const amountPaise = Math.round(amountToPay * 100);
  const isPlaceholderKey = !process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID.includes('xxxxxxxxxxxxx') || process.env.RAZORPAY_KEY_ID.includes('placeholder');

  let orderId = `order_demo_${Date.now()}`;
  let isDemo = isPlaceholderKey;

  if (!isPlaceholderKey) {
    try {
      const rzpOrder = await razorpay.orders.create({
        amount: amountPaise,
        currency: 'INR',
        receipt: `COMM_${provider._id.toString().slice(-8)}_${Date.now()}`,
        notes: {
          providerId: provider._id.toString(),
          type: 'commission_repayment',
        },
      });
      orderId = rzpOrder.id;
    } catch (err) {
      logger.warn('Razorpay order creation fallback to demo:', err.message);
      isDemo = true;
    }
  }

  const user = await User.findById(req.userId).select('name phone email').lean();

  res.json({
    success: true,
    data: {
      orderId,
      amount: amountPaise,
      currency: 'INR',
      keyId: isDemo ? 'rzp_test_demo' : process.env.RAZORPAY_KEY_ID,
      isDemo,
      pendingCommission: pendingDues,
      amountToPay,
      prefill: {
        name: user?.name || provider.name || '',
        contact: user?.phone || provider.phone || '',
        email: user?.email || provider.email || '',
      },
    },
  });
});

/**
 * POST /payments/commission/verify
 * Verifies Razorpay payment signature and clears provider's pending commission.
 * If pendingCommission drops below ₹500, unholds provider account automatically!
 */
router.post('/commission/verify', authenticate, authorize('provider'), async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, amount } = req.body;
  if (!razorpayOrderId || !razorpayPaymentId) {
    throw new AppError('Missing payment verification details', 400);
  }

  const isDemo = razorpayOrderId.startsWith('order_demo_') || 
                 razorpaySignature === 'demo_signature' || 
                 !process.env.RAZORPAY_KEY_SECRET || 
                 process.env.RAZORPAY_KEY_SECRET.includes('your_razorpay');

  if (!isDemo) {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      throw new AppError('Invalid payment signature', 400);
    }
  }

  const provider = await Provider.findById(req.userId);
  if (!provider) throw new AppError('Provider not found', 404);

  const paidAmount = Number(amount) || money(provider.earnings?.pendingCommission);
  const currentWallet = money(provider.earnings?.walletBalance);
  const newWallet = currentWallet + paidAmount;

  provider.earnings.walletBalance = newWallet;
  if (newWallet < 0) {
    provider.earnings.pendingCommission = Math.abs(newWallet);
  } else {
    provider.earnings.pendingCommission = 0;
    provider.earnings.commissionDueSince = null;
  }
  provider.earnings.totalCommissionPaid = (provider.earnings.totalCommissionPaid || 0) + paidAmount;

  // Threshold check: If negative balance is now cleared above -500, unhold account!
  if (newWallet > -500 && provider.earnings.pendingCommission < 500) {
    provider.earnings.isOnHold = false;
  }

  await provider.save();

  // Create WalletLedger record
  await WalletLedger.create([{
    ownerId: provider._id,
    ownerType: 'provider',
    type: 'credit',
    account: 'wallet',
    amount: paidAmount,
    balance: newWallet,
    description: `Wallet top-up / commission payment of ₹${paidAmount} received via UPI/Razorpay (ID: ${razorpayPaymentId})`,
  }]);

  // Real-time socket & DB notification
  const newPending = provider.earnings?.pendingCommission || 0;
  const unholdTitle = newPending < 500 ? '✅ Job Dispatch Resumed!' : '✅ Commission Received';
  const unholdBody = newPending < 500
    ? `Payment of ₹${paidAmount} received. Your account is active to accept new jobs!`
    : `Payment of ₹${paidAmount} received. Remaining pending commission: ₹${newPending}`;

  await Notification.create({
    userId: provider._id,
    title: unholdTitle,
    body: unholdBody,
    type: newPending < 500 ? 'account_unhold' : 'payment_update',
    referenceId: provider._id,
  }).catch((err) => logger.error('Failed to create notification doc:', err.message));

  const io = getIO();
  io.to(`provider:${provider._id}`).emit('notification:push', {
    title: unholdTitle,
    body: unholdBody,
    pendingCommission: newPending,
    isOnHold: provider.earnings.isOnHold,
  });

  logger.info(`Provider ${provider._id} paid ₹${paidAmount} commission via Razorpay. New pending: ₹${newPending}, isOnHold: ${provider.earnings.isOnHold}`);

  res.json({
    success: true,
    message: newPending < 500
      ? 'Commission paid successfully! Your account is active to accept jobs.'
      : `Commission payment recorded. Remaining dues: ₹${newPending}`,
    data: {
      paidAmount,
      pendingCommission: newPending,
      isOnHold: provider.earnings.isOnHold,
    },
  });
});

module.exports = router;
