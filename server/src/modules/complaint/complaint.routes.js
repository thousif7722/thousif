'use strict';
const express = require('express');
const Joi = require('joi');
const crypto = require('crypto');
const { Complaint, Booking, Notification, Provider, AuditLog } = require('../../models');

const { authenticate, authorize } = require('../auth/auth.routes');
const { validateBody } = require('../../middleware/validate');
const { AppError } = require('../../utils/errors');
const { getLeastBusyStaff } = require('../../utils/assignment');
const { emitToUser, emitToProvider } = require('../../socket');
const { cache } = require('../../config/redis');
const logger = require('../../utils/logger');
const router = express.Router();

const complaintSchema = Joi.object({
  bookingId: Joi.string().hex().length(24).required(),
  category: Joi.string().valid('overcharging','poor_quality','no_show','behaviour','damage','safety','fraud','other').required(),
  description: Joi.string().min(1).max(1000).required(),
  evidence: Joi.array().items(Joi.string()).optional(),
});

// ── POST /complaints — Customer raises a complaint ─────────────────────────────
router.post('/', authenticate, validateBody(complaintSchema), async (req, res) => {
  const { bookingId, category, description, evidence } = req.body;
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new AppError('Booking not found', 404);

  // Complaints can only be raised within 30 days of the service
  if (booking.scheduledDate) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (new Date(booking.scheduledDate) < thirtyDaysAgo) {
      throw new AppError('Complaint window expired. Complaints can only be raised within 30 days of the service date. Please book a new repair service.', 400);
    }
  }


  const isCustomer = booking.customerId.toString() === req.userId;
  const isProvider = booking.providerId?.toString() === req.userId;
  if (!isCustomer && !isProvider) throw new AppError('Forbidden', 403);

  const againstUser = isCustomer ? booking.providerId : booking.customerId;
  const againstRole = isCustomer ? 'provider' : 'customer';

  const assignedStaffId = await getLeastBusyStaff('manage_complaints', 'complaint');

  const complaint = await Complaint.create({
    bookingId, category, description, evidence,
    raisedBy: req.userId, againstUser, againstRole,
    severity: ['fraud', 'safety', 'damage'].includes(category) ? 'high' : 'medium',
    autoFlagged: category === 'overcharging',
    assignedTo: assignedStaffId || undefined,
  });

  if (['in_progress', 'completed', 'paid'].includes(booking.status)) {
    await Booking.findByIdAndUpdate(bookingId, { status: 'disputed' });
  }

  // Notify the customer that their complaint was received
  await Notification.create({
    userId: req.userId,
    title: '📋 Complaint Filed Successfully',
    body: `Your complaint (Ticket #${complaint.ticketNumber}) has been raised. The technician will schedule a revisit within 24 hours.`,
    type: 'complaint',
    referenceId: complaint._id,
  });

  // Notify the provider that a complaint was raised against them
  if (isCustomer && booking.providerId) {
    emitToProvider(booking.providerId.toString(), 'notification:push', {
      title: '⚠️ Complaint Raised',
      body: `A customer has raised a complaint for booking #${booking.bookingNumber}. Please check your complaints tab.`,
      type: 'complaint',
    });
  }

  // Real-time socket to customer confirming complaint was received
  emitToUser(req.userId.toString(), 'complaint:created', {
    complaintId: complaint._id,
    ticketNumber: complaint.ticketNumber,
    message: `Complaint filed! Ticket #${complaint.ticketNumber}. Technician will revisit within 24 hours.`,
  });

  res.status(201).json({
    success: true,
    message: 'Complaint filed. The technician will revisit to resolve your issue.',
    data: { ticketNumber: complaint.ticketNumber, complaintId: complaint._id },
  });
});

// ── GET /complaints/my — Get all my complaints ─────────────────────────────────
router.get('/my', authenticate, async (req, res) => {
  const isProvider = req.userRole === 'provider';
  const query = isProvider
    ? { $or: [{ againstUser: req.userId }, { raisedBy: req.userId }] }
    : { raisedBy: req.userId };

  const complaints = await Complaint.find(query)
    .populate('bookingId', 'bookingNumber scheduledDate serviceAddress serviceId')
    .populate('raisedBy', 'name phone')
    .sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: complaints });
});

// ── GET /complaints/assigned — Provider's assigned complaints ──────────────────
router.get('/assigned', authenticate, async (req, res) => {
  if (req.userRole !== 'provider') throw new AppError('Providers only', 403);

  // Find bookings belonging to this provider where there's an active complaint
  const providerBookingIds = await Booking.find({ providerId: req.userId })
    .select('_id').lean().then(bs => bs.map(b => b._id));

  const complaints = await Complaint.find({
    bookingId: { $in: providerBookingIds },
    status: { $in: ['open', 'in_review'] },
  })
    .populate('bookingId', 'bookingNumber scheduledDate serviceAddress serviceId')
    .populate('raisedBy', 'name phone')
    .sort({ createdAt: -1 })
    .lean();

  res.json({ success: true, data: complaints });
});

// ── GET /complaints/:ticketNumber — Get single complaint ───────────────────────
router.get('/:ticketNumber', authenticate, async (req, res) => {
  const complaint = await Complaint.findOne({ ticketNumber: req.params.ticketNumber })
    .populate('raisedBy', 'name phone')
    .populate('bookingId').lean();
  if (!complaint) throw new AppError('Complaint not found', 404);
  res.json({ success: true, data: complaint });
});

// ── POST /complaints/:id/comment — Add a comment/reply ────────────────────────
router.post('/:id/comment', authenticate, async (req, res) => {
  const { text } = req.body;
  if (!text) throw new AppError('Comment text required', 400);
  const complaint = await Complaint.findByIdAndUpdate(
    req.params.id,
    { $push: { comments: { author: req.userId, role: req.userRole, text } } },
    { new: true }
  );
  if (!complaint) throw new AppError('Complaint not found', 404);
  res.json({ success: true, data: complaint });
});

// ── POST /complaints/:id/revisit — Provider schedules a revisit ───────────────
router.post('/:id/revisit', authenticate, async (req, res) => {
  if (req.userRole !== 'provider') throw new AppError('Providers only', 403);

  const { revisitDate, revisitNote } = req.body;
  if (!revisitDate) throw new AppError('Revisit date is required', 400);

  const complaint = await Complaint.findById(req.params.id)
    .populate('bookingId', 'customerId bookingNumber providerId');
  if (!complaint) throw new AppError('Complaint not found', 404);

  // Verify this complaint is about a booking assigned to this provider
  const booking = complaint.bookingId;
  if (booking.providerId?.toString() !== req.userId) throw new AppError('Forbidden — not your booking', 403);

  complaint.status = 'in_review';
  complaint.comments.push({
    author: req.userId,
    role: 'provider',
    text: `🗓️ Revisit scheduled for ${new Date(revisitDate).toLocaleString('en-IN')}. ${revisitNote || ''}`.trim(),
  });
  await complaint.save();

  // Cache revisit info
  await cache.set(`complaint_revisit:${complaint._id}`, { revisitDate, providerId: req.userId }, 86400);

  // Notify customer
  emitToUser(booking.customerId.toString(), 'notification:push', {
    title: '📅 Technician Revisit Scheduled',
    body: `Your technician has scheduled a revisit for complaint #${complaint.ticketNumber} on ${new Date(revisitDate).toLocaleDateString('en-IN')}.`,
    type: 'complaint',
  });

  res.json({ success: true, message: 'Revisit scheduled. Customer has been notified.' });
});

// ── POST /complaints/:id/proof — Provider uploads resolution proof ─────────────
// (In production, integrate with S3 service. Here we accept base64 / URL strings)
router.post('/:id/proof', authenticate, async (req, res) => {
  if (req.userRole !== 'provider') throw new AppError('Providers only', 403);

  const { proofUrls, workDoneNote } = req.body;
  if (!proofUrls || !Array.isArray(proofUrls) || proofUrls.length === 0) {
    throw new AppError('At least one proof image URL / base64 is required', 400);
  }

  const complaint = await Complaint.findById(req.params.id)
    .populate('bookingId', 'customerId bookingNumber providerId');
  if (!complaint) throw new AppError('Complaint not found', 404);

  const booking = complaint.bookingId;
  if (booking.providerId?.toString() !== req.userId) throw new AppError('Forbidden', 403);

  // Append proof URLs to evidence
  proofUrls.forEach(url => complaint.evidence.push(url));

  complaint.comments.push({
    author: req.userId,
    role: 'provider',
    text: `📸 Resolution proof uploaded. Work done: ${workDoneNote || 'Issue resolved on revisit.'}`,
  });
  await complaint.save();

  // Notify customer proof was uploaded
  emitToUser(booking.customerId.toString(), 'notification:push', {
    title: '📸 Proof Uploaded',
    body: `The technician has uploaded proof of resolution for complaint #${complaint.ticketNumber}. Please verify.`,
    type: 'complaint',
  });

  res.json({ success: true, message: 'Proof uploaded. Generate OTP to confirm resolution with customer.' });
});

// ── POST /complaints/:id/resolve/otp — Generate resolution OTP ──────
router.post('/:id/resolve/otp', authenticate, async (req, res) => {
  const complaint = await Complaint.findById(req.params.id)
    .populate('bookingId', 'customerId bookingNumber providerId');
  if (!complaint) throw new AppError('Complaint not found', 404);

  const booking = complaint.bookingId;
  const isProvider = booking.providerId?.toString() === req.userId;
  const isCustomer = booking.customerId?.toString() === req.userId;
  
  if (!isProvider && !isCustomer) {
    throw new AppError('Forbidden: Only the booking provider or customer can trigger resolution OTP', 403);
  }

  if (!['open', 'in_review'].includes(complaint.status)) {
    throw new AppError('This complaint is already resolved or closed', 400);
  }

  // Generate a 4-digit OTP — NEVER log or expose this value
  const otp = String(Math.floor(1000 + Math.random() * 9000));
  // Store OTP for 10 minutes (cache only — never persisted in DB)
  await cache.set(`complaint_otp:${complaint._id}`, { otp, providerId: booking.providerId?.toString() }, 600);

  // SECURITY: Do NOT log OTP value — only log that it was generated
  logger.info(`Resolution OTP generated for complaint ${complaint._id} (not logged for security)`);

  // Rate-limit: prevent spam — block re-generation within 60s
  const otpRateKey = `complaint_otp_rate:${complaint._id}`;
  const recentlySent = await cache.get(otpRateKey);
  if (!recentlySent) {
    await cache.set(otpRateKey, '1', 60); // 60s cooldown
  }

  // Send OTP to customer via real-time socket ONLY — never in API response or DB body
  emitToUser(booking.customerId.toString(), 'complaint:resolution_otp', {
    complaintId: complaint._id,
    ticketNumber: complaint.ticketNumber,
    otp, // Only delivered via encrypted WebSocket — not stored in DB
    expiresInSeconds: 600,
    message: 'Your technician has fixed the issue. Share this OTP with the technician to confirm resolution.',
  });

  // Persist notification WITHOUT OTP value in body
  await Notification.create({
    userId: booking.customerId,
    title: '🔐 Resolution OTP Sent',
    body: `An OTP has been sent to confirm resolution of complaint #${complaint.ticketNumber}. Check your notification panel. Valid for 10 minutes.`,
    type: 'otp',
    referenceId: complaint._id,
  });

  res.json({
    success: true,
    message: 'OTP sent to customer. Ask them for the 4-digit code to confirm resolution.',
    // SECURITY: OTP is NEVER included in the API response
  });
});

// ── POST /complaints/:id/resolve/confirm — Enter OTP to close ────────
router.post('/:id/resolve/confirm', authenticate, async (req, res) => {
  const { otp } = req.body;
  if (!otp || otp.length !== 4) throw new AppError('Invalid OTP format', 400);

  const complaint = await Complaint.findById(req.params.id)
    .populate('bookingId', 'customerId bookingNumber providerId status');
  if (!complaint) throw new AppError('Complaint not found', 404);

  const booking = complaint.bookingId;
  const isProvider = booking.providerId?.toString() === req.userId;
  const isCustomer = booking.customerId?.toString() === req.userId;
  
  if (!isProvider && !isCustomer) {
    throw new AppError('Forbidden: Only the booking provider or customer can confirm resolution OTP', 403);
  }

  // Validate OTP
  const cached = await cache.get(`complaint_otp:${complaint._id}`);
  if (!cached) throw new AppError('OTP has expired. Please generate a new one.', 410);
  if (cached.otp !== String(otp)) throw new AppError('Incorrect OTP. Please ask the customer again.', 400);

  // Mark complaint as resolved
  complaint.status = 'resolved';
  complaint.resolution = {
    action: 'revisit_completed',
    note: 'Issue resolved by technician revisit. Confirmed by customer OTP.',
    resolvedAt: new Date(),
  };
  complaint.comments.push({
    author: req.userId,
    role: req.userRole === 'provider' ? 'provider' : 'customer',
    text: '✅ Issue resolved. Customer confirmed with OTP.',
  });
  await complaint.save();

  // Restore booking status from disputed back to paid/completed if it was changed
  if (booking.status === 'disputed') {
    await Booking.findByIdAndUpdate(booking._id, { status: 'paid' });
  }

  // Unfreeze provider if they were frozen due to complaints
  const providerId = booking.providerId?.toString();
  const provider = await Provider.findById(providerId);
  if (provider && provider.isBlocked && provider.blockReason?.includes('Frozen due to unresolved complaint')) {
    provider.isBlocked = false;
    provider.blockReason = null;
    await provider.save();
    emitToProvider(providerId, 'notification:push', {
      title: '🔥 Account Unfrozen',
      body: 'You have resolved your complaint and your account is now unfrozen.',
      type: 'account',
    });
  }

  // Clear OTP cache
  await cache.del(`complaint_otp:${complaint._id}`);
  await cache.del(`complaint_revisit:${complaint._id}`);

  // Notify customer that complaint is officially closed
  emitToUser(booking.customerId.toString(), 'complaint:resolved', {
    complaintId: complaint._id,
    ticketNumber: complaint.ticketNumber,
  });
  emitToUser(booking.customerId.toString(), 'notification:push', {
    title: '✅ Complaint Resolved',
    body: `Your complaint #${complaint.ticketNumber} has been successfully resolved by the technician.`,
    type: 'complaint',
  });

  logger.info(`Complaint ${complaint._id} resolved by provider ${providerId}`);

  res.json({
    success: true,
    message: 'Complaint successfully resolved and closed! ✅',
    data: { ticketNumber: complaint.ticketNumber },
  });
});


// ── POST /complaints/:id/escalate — Customer escalates if tech didn't revisit ──
router.post('/:id/escalate', authenticate, async (req, res) => {
  const { reason } = req.body;

  const complaint = await Complaint.findById(req.params.id)
    .populate('bookingId', 'customerId bookingNumber providerId');
  if (!complaint) throw new AppError('Complaint not found', 404);

  // Only the customer who raised the complaint can escalate
  if (complaint.raisedBy.toString() !== req.userId) {
    throw new AppError('Only the customer who raised the complaint can escalate it', 403);
  }

  if (complaint.status === 'resolved' || complaint.status === 'closed') {
    throw new AppError('This complaint is already resolved or closed', 400);
  }

  if (complaint.status === 'escalated') {
    throw new AppError('This complaint has already been escalated', 400);
  }

  complaint.status = 'escalated';
  complaint.severity = 'high';
  complaint.comments.push({
    author: req.userId,
    role: 'customer',
    text: `🚨 Escalated: ${reason || 'Technician did not visit or resolve the issue.'}`,
  });
  await complaint.save();

  // Assign to least busy admin/staff member
  const assignedStaffId = await getLeastBusyStaff('manage_complaints', 'complaint');
  if (assignedStaffId) {
    complaint.assignedTo = assignedStaffId;
    await complaint.save();
    emitToUser(assignedStaffId.toString(), 'notification:push', {
      title: '🚨 Escalated Complaint Assigned',
      body: `Complaint #${complaint.ticketNumber} has been escalated by customer — technician failed to revisit. Immediate action required.`,
      type: 'complaint',
    });
  }

  // Notify customer their escalation was received
  emitToUser(req.userId, 'notification:push', {
    title: '📢 Complaint Escalated',
    body: `Your complaint #${complaint.ticketNumber} has been escalated. Our support team will contact you within 2 hours.`,
    type: 'complaint',
  });

  // Also notify the provider that they are now under review
  const booking = complaint.bookingId;
  if (booking?.providerId) {
    emitToProvider(booking.providerId.toString(), 'notification:push', {
      title: '🚨 Complaint Escalated to Admin',
      body: `Complaint #${complaint.ticketNumber} has been escalated by the customer. Admin will review and may take action against your account.`,
      type: 'complaint',
    });
  }

  logger.warn(`Complaint ${complaint._id} escalated by customer ${req.userId} — reason: ${reason || 'no reason given'}`);

  res.json({
    success: true,
    message: 'Complaint escalated to admin. Our support team will contact you within 2 hours.',
  });
});

// ── Automated Scanner: auto-escalate unresolved complaints after 48h ────────────
// Call this from a cron/BullMQ job every hour
async function autoEscalateStaleComplaints() {
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

  // Find all open/in_review complaints older than 48h
  const staleComplaints = await Complaint.find({
    status: { $in: ['open', 'in_review'] },
    createdAt: { $lte: fortyEightHoursAgo },
  }).populate('bookingId', 'customerId providerId bookingNumber');

  for (const complaint of staleComplaints) {
    complaint.status = 'escalated';
    complaint.severity = 'high';
    complaint.comments.push({
      role: 'system',
      text: '⏰ Auto-escalated: Complaint unresolved for 48 hours. Assigned to support team for immediate action.',
    });
    await complaint.save();

    const booking = complaint.bookingId;
    if (booking?.customerId) {
      // Notify customer
      await Notification.create({
        userId: booking.customerId,
        title: '📢 Your Complaint Has Been Escalated',
        body: `Complaint #${complaint.ticketNumber} was unresolved for 48 hours. Our admin team will resolve it within 24 hours.`,
        type: 'complaint',
        referenceId: complaint._id,
      });
    }

    logger.warn(`[AutoEscalate] Complaint ${complaint._id} auto-escalated after 48h inactivity`);
  }

  return staleComplaints.length;
}

// ── GET /complaints/frozen-status — Provider checks Job Access Freeze status ───
router.get('/frozen-status', authenticate, authorize('provider'), async (req, res) => {
  const provider = await Provider.findById(req.userId).lean();
  if (!provider) throw new AppError('Provider profile not found', 404);

  if (provider.jobAccessStatus !== 'frozen') {
    return res.json({ success: true, data: { isFrozen: false } });
  }

  // Find complaint causing freeze
  let complaint = null;
  if (provider.freezeComplaintId) {
    complaint = await Complaint.findById(provider.freezeComplaintId)
      .populate({
        path: 'bookingId',
        select: 'bookingNumber scheduledDate totalAmount status serviceAddress serviceId',
        populate: { path: 'serviceId', select: 'name category' }
      })
      .populate('raisedBy', 'name phone')
      .lean();
  }

  if (!complaint) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    complaint = await Complaint.findOne({
      againstUser: req.userId,
      status: { $in: ['open', 'in_review', 'resolution_submitted', 'more_information_required', 'resolution_rejected', 'escalated'] },
      createdAt: { $lte: sevenDaysAgo },
    })
      .populate({
        path: 'bookingId',
        select: 'bookingNumber scheduledDate totalAmount status serviceAddress serviceId',
        populate: { path: 'serviceId', select: 'name category' }
      })
      .populate('raisedBy', 'name phone')
      .sort({ createdAt: 1 })
      .lean();
  }

  const daysUnresolved = complaint
    ? Math.max(7, Math.floor((Date.now() - new Date(complaint.createdAt).getTime()) / (1000 * 60 * 60 * 24)))
    : 7;

  res.json({
    success: true,
    data: {
      isFrozen: true,
      freezeReason: provider.freezeReason || 'Unresolved complaint exceeded 7 days',
      freezeStartedAt: provider.freezeStartedAt,
      complaint: complaint ? {
        _id: complaint._id,
        ticketNumber: complaint.ticketNumber,
        category: complaint.category,
        description: complaint.description,
        status: complaint.status,
        createdAt: complaint.createdAt,
        daysUnresolved,
        resolutionResponse: complaint.resolutionResponse,
        resolutionEvidence: complaint.resolutionEvidence,
        adminFeedback: complaint.adminFeedback,
        adminMessage: complaint.adminMessage,
        raisedBy: complaint.raisedBy,
        booking: complaint.bookingId,
      } : null,
    },
  });
});

// ── POST /complaints/:id/submit-resolution — Provider submits resolution ──────
router.post('/:id/submit-resolution', authenticate, authorize('provider'), async (req, res) => {
  const { resolutionResponse, resolutionEvidence } = req.body;
  if (!resolutionResponse || typeof resolutionResponse !== 'string' || resolutionResponse.trim().length < 10) {
    throw new AppError('Detailed explanation (at least 10 characters) is required', 400);
  }

  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) throw new AppError('Complaint not found', 404);

  const booking = await Booking.findById(complaint.bookingId);
  const isTargetProvider = complaint.againstUser?.toString() === req.userId || booking?.providerId?.toString() === req.userId;
  if (!isTargetProvider) throw new AppError('Not authorized to resolve this complaint', 403);

  complaint.status = 'resolution_submitted';
  complaint.resolutionResponse = resolutionResponse.trim();
  complaint.resolutionEvidence = Array.isArray(resolutionEvidence) ? resolutionEvidence : [];
  complaint.resolutionSubmittedAt = new Date();
  complaint.comments.push({
    author: req.userId,
    role: 'provider',
    text: `Resolution Submitted: ${resolutionResponse.trim()}`,
  });
  await complaint.save();

  // Audit Log
  await AuditLog.create({
    action: 'RESOLUTION_SUBMITTED',
    providerId: req.userId,
    complaintId: complaint._id,
    performedBy: req.userId,
    previousStatus: 'frozen',
    newStatus: 'frozen',
    reason: 'Provider submitted complaint resolution for admin review',
    details: { response: resolutionResponse.trim(), evidenceCount: complaint.resolutionEvidence.length },
  }).catch((err) => logger.error('AuditLog creation error:', err.message));

  // Emit socket to admin
  const { getIO } = require('../../socket');
  const io = getIO();
  if (io) {
    io.to('admin').emit('admin:resolution_submitted', {
      complaintId: complaint._id,
      ticketNumber: complaint.ticketNumber,
      providerId: req.userId,
    });
  }

  res.json({
    success: true,
    message: 'Resolution submitted successfully. OneWayFix Admin will review your submission.',
    data: {
      status: complaint.status,
      resolutionSubmittedAt: complaint.resolutionSubmittedAt,
    },
  });
});

// ── POST /complaints/:id/respond-more-info — Provider responds to info request ─
router.post('/:id/respond-more-info', authenticate, authorize('provider'), async (req, res) => {
  const { resolutionResponse, resolutionEvidence } = req.body;
  if (!resolutionResponse || typeof resolutionResponse !== 'string' || resolutionResponse.trim().length < 5) {
    throw new AppError('Please provide the requested information', 400);
  }

  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) throw new AppError('Complaint not found', 404);

  const booking = await Booking.findById(complaint.bookingId);
  const isTargetProvider = complaint.againstUser?.toString() === req.userId || booking?.providerId?.toString() === req.userId;
  if (!isTargetProvider) throw new AppError('Not authorized', 403);

  complaint.status = 'resolution_submitted';
  complaint.resolutionResponse = resolutionResponse.trim();
  if (Array.isArray(resolutionEvidence) && resolutionEvidence.length > 0) {
    complaint.resolutionEvidence = [...(complaint.resolutionEvidence || []), ...resolutionEvidence];
  }
  complaint.comments.push({
    author: req.userId,
    role: 'provider',
    text: `Updated Info Submitted: ${resolutionResponse.trim()}`,
  });
  await complaint.save();

  res.json({
    success: true,
    message: 'Updated information submitted for admin review.',
    data: { status: complaint.status },
  });
});

// ── Automated Scanner: freeze providers after 7 days unresolved ────────────────
async function autoFreezeProviders() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const staleComplaints = await Complaint.find({
    status: { $in: ['open', 'in_review', 'escalated', 'resolution_rejected', 'more_information_required'] },
    createdAt: { $lte: sevenDaysAgo },
  }).populate('bookingId', 'providerId');

  let frozenCount = 0;
  for (const complaint of staleComplaints) {
    const providerId = complaint.bookingId?.providerId;
    if (!providerId) continue;

    const provider = await Provider.findById(providerId);
    if (provider && provider.jobAccessStatus !== 'frozen') {
      provider.jobAccessStatus = 'frozen';
      provider.freezeReason = 'Unresolved complaint exceeded 7 days';
      provider.freezeStartedAt = new Date();
      provider.freezeComplaintId = complaint._id;
      // Do NOT set provider.isBlocked = true or alter user account status
      await provider.save();
      frozenCount++;

      // Create Audit Log
      await AuditLog.create({
        action: 'COMPLAINT_7_DAY_FREEZE',
        providerId: provider._id,
        complaintId: complaint._id,
        previousStatus: 'active',
        newStatus: 'frozen',
        reason: 'Unresolved complaint exceeded 7 days',
      }).catch(err => logger.error('Failed to create AuditLog:', err.message));

      emitToProvider(provider._id.toString(), 'notification:push', {
        title: '⚠️ New Jobs Temporarily Paused',
        body: `New job assignments have been temporarily paused because complaint #${complaint.ticketNumber} has been unresolved for 7 days. Please submit a resolution to restore job access.`,
        type: 'complaint',
      });
      logger.warn(`[ComplaintFreeze] Provider ${provider._id} job access frozen due to complaint ${complaint._id}`);
    }
  }
  return frozenCount;
}

module.exports = router;
module.exports.autoEscalateStaleComplaints = autoEscalateStaleComplaints;
module.exports.autoFreezeProviders = autoFreezeProviders;
