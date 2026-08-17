'use strict';
const express = require('express');
const Joi = require('joi');
const mongoose = require('mongoose');
const { Booking, Provider, Service, MaterialsUsed, User, WalletLedger, Notification } = require('../../models');
const { authenticate, authorize } = require('../auth/auth.routes');
const { validateBody, validateQuery } = require('../../middleware/validate');
const { AppError } = require('../../utils/errors');
const { cache } = require('../../config/redis');
const bookingService = require('./booking.service');
const { getIO } = require('../../socket');
const logger = require('../../utils/logger');
const pdfService = require('../../services/pdf.service');
const invoiceService = require('../../services/invoice.service');
const { bookingRateLimiter } = require('../../middleware/rateLimiter');

const router = express.Router();

// ── Validation Schemas ─────────────────────────────────────────────────────────
const createBookingSchema = Joi.object({
  serviceId: Joi.string().hex().length(24).required(),
  scheduledDate: Joi.date().min(new Date(Date.now() - 24 * 60 * 60 * 1000)).required(),
  timeSlot: Joi.object({
    from: Joi.string().required(),
    to: Joi.string().required(),
  }).required(),
  serviceAddress: Joi.object({
    line1: Joi.string().allow('', null).optional(),
    line2: Joi.string().allow('', null).optional(),
    city: Joi.string().allow('', null).optional(),
    state: Joi.string().allow('', null).optional(),
    pincode: Joi.string().allow('', null).optional(),
    location: Joi.object({
      coordinates: Joi.array().items(Joi.number()).optional(),
    }).optional(),
  }).optional(),
  customerNotes: Joi.string().max(500).allow('', null).optional(),
  couponCode: Joi.string().allow('', null).optional(),
});

const addMaterialsSchema = Joi.object({
  items: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    quantity: Joi.number().positive().required(),
    unit: Joi.string().default('pcs'),
    unitPrice: Joi.number().positive().required(),
    brand: Joi.string().allow('', null).optional(),
    isProviderOwned: Joi.boolean().default(true),
  })).min(0).required(),
  notes: Joi.string().max(500).allow('', null).optional(),
});

const completeBookingSchema = Joi.object({
  workPerformed: Joi.string().allow('', null).optional(),
  extraCharges: Joi.number().min(0).default(0),
  extraChargesNote: Joi.string().allow('', null).optional(),
  afterPhotos: Joi.array().items(Joi.string()).optional(),
  endOtp: Joi.alternatives().try(Joi.string(), Joi.number()).optional(),
  lat: Joi.number().optional(),
  lng: Joi.number().optional(),
});

// ── Routes ─────────────────────────────────────────────────────────────────────

/**
 * GET /bookings
 * Get bookings for authenticated user
 */
router.get('/', authenticate, async (req, res) => {
  // FIX #4: Sanitize page/limit to prevent NaN crashing DB queries
  const rawPage = parseInt(req.query.page);
  const rawLimit = parseInt(req.query.limit);
  const page = (!isNaN(rawPage) && rawPage > 0) ? rawPage : 1;
  const limit = (!isNaN(rawLimit) && rawLimit > 0 && rawLimit <= 100) ? rawLimit : 10;
  const { status, from, to } = req.query;
  const skip = (page - 1) * limit;

  let filter = {};
  if (req.userRole === 'customer') filter.customerId = req.userId;
  else if (req.userRole === 'provider') filter.providerId = req.userId;

  if (status) {
    const statusList = status.split(',').map(s => s.trim()).filter(Boolean);
    filter.status = statusList.length === 1 ? statusList[0] : { $in: statusList };
  }
  if (from || to) {
    filter.scheduledDate = {};
    if (from) filter.scheduledDate.$gte = new Date(from);
    if (to) filter.scheduledDate.$lte = new Date(to);
  }

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate('serviceId', 'name icon category')
      .populate('customerId', 'name phone avatar')
      .populate('providerId', 'name phone avatar rating')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Booking.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: bookings,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
});

/**
 * POST /bookings
 * Customer creates a new booking
 */
/**
 * POST /bookings/validate-coupon
 * Frontend can call this before submitting the booking to check coupon validity
 */
router.post('/validate-coupon', authenticate, authorize('customer'), async (req, res) => {
  const { couponCode, serviceId } = req.body;
  if (!couponCode || !serviceId) throw new AppError('couponCode and serviceId are required', 400);

  const service = await Service.findById(serviceId).lean();
  if (!service || !service.isActive) throw new AppError('Service not found', 404);

  const result = await bookingService.applyCoupon(couponCode, req.userId, service.basePrice);
  res.json({
    success: true,
    message: `Coupon valid! You save ₹${result.discountAmount}`,
    data: {
      code: result.coupon.code,
      discountAmount: result.discountAmount,
      discountType: result.coupon.discountType,
    },
  });
});

async function createBookingHandler(req, res, session = null) {
  const {
    serviceId, scheduledDate, timeSlot,
    serviceAddress, customerNotes, couponCode,
  } = req.body;

  const service = session
    ? await Service.findById(serviceId).session(session)
    : await Service.findById(serviceId);
  if (!service || !service.isActive) throw new AppError('Service not available', 404);

  // Fetch user to check for Plus Membership
  const user = session
    ? await User.findById(req.userId).session(session)
    : await User.findById(req.userId);
  const isPlusMember = user?.subscription?.plan === 'premium' || user?.subscription?.isPlusMember === true;

  // Validate and apply coupon
  let discountAmount = 0;
  let appliedCoupon = null;
  
  if (isPlusMember) {
    discountAmount += Math.round(service.basePrice * 0.1); // 10% off for Plus members
  }

  if (couponCode) {
    const couponResult = await bookingService.applyCoupon(
      couponCode, req.userId, service.basePrice
    );
    discountAmount += couponResult.discountAmount;
    appliedCoupon = couponResult.coupon;
  }

  // Create booking
  const booking = new Booking({
    customerId: req.userId,
    serviceId,
    scheduledDate,
    timeSlot,
    serviceAddress: {
      ...serviceAddress,
      location: {
        type: 'Point',
        coordinates: serviceAddress.location.coordinates,
      },
    },
    basePrice: service.basePrice,
    discountAmount,
    couponCode: appliedCoupon?.code,
    customerNotes,
    commissionRate: parseInt(process.env.DEFAULT_COMMISSION_PERCENT || '20'),
    status: 'pending',
  });

  // Smart surge pricing (Free for Plus Members) — wrapped in try/catch to prevent geo-index crash
  let surgeMultiplier = 1.0;
  if (!isPlusMember) {
    try {
      surgeMultiplier = await bookingService.calculateSurgePricing(
        serviceId, scheduledDate, serviceAddress.location.coordinates
      );
    } catch (surgeErr) {
      logger.warn('Surge pricing calculation failed, defaulting to 1.0x:', surgeErr.message);
      surgeMultiplier = 1.0;
    }
  }
  booking.surgeMultiplier = surgeMultiplier;

  if (session) {
    await booking.save({ session });
  } else {
    await booking.save();
  }

  // Update coupon usage within the same transaction
  if (appliedCoupon) {
    await bookingService.recordCouponUsage(appliedCoupon._id, req.userId, session);
  }

  // Queue provider matching (async — don't block response)
  const { bookingQueue } = require('../../jobs');
  await bookingQueue.add('match_provider', {
    bookingId: booking._id.toString(),
    coordinates: serviceAddress.location.coordinates,
    serviceId,
    attempt: 1,
  }, { delay: 0, attempts: 5, backoff: { type: 'exponential', delay: 10000 } });

  // Fallback: Trigger direct provider match immediately so matching works seamlessly
  setImmediate(async () => {
    try {
      await bookingService.assignProviderToBooking(booking, 1);
    } catch (e) {
      logger.warn(`Immediate provider assignment fallback error for booking ${booking._id}:`, e.message);
    }
  });

  logger.info(`Booking ${booking.bookingNumber} created, queued for matching`);

  const bookingData = booking.toObject({ virtuals: true });
  
  res.status(201).json({
    success: true,
    message: 'Booking created. Finding the best provider for you...',
    data: {
      bookingId: bookingData._id.toString(),
      bookingNumber: bookingData.bookingNumber,
      status: bookingData.status,
      estimatedTotal: bookingData.totalAmount,
      surgeMultiplier,
    },
  });
}

router.post('/', authenticate, authorize('customer'), bookingRateLimiter, validateBody(createBookingSchema), async (req, res) => {
  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    await createBookingHandler(req, res, session);
    await session.commitTransaction();
    session.endSession();
  } catch (err) {
    if (session) {
      try {
        if (session.inTransaction()) await session.abortTransaction();
        await session.endSession();
      } catch (sErr) {}
    }

    // Auto-fallback if MongoDB is running standalone without replica set
    if (err?.message && err.message.includes('Transaction numbers are only allowed')) {
      logger.info('Standalone MongoDB detected (transactions unsupported). Creating booking without transaction session.');
      return await createBookingHandler(req, res, null);
    }

    // Safely extract error details to prevent circular JSON issues
    const errorMessage = typeof err === 'string' ? err : (err?.message || 'Unknown booking error');
    const dbErrorCode = err?.code || err?.errorCode;
    logger.error(`[Booking creation failed] ${err?.name || 'Error'}: ${errorMessage}`);
    
    throw new AppError(errorMessage, err?.status || 500, dbErrorCode || 'BOOKING_ERROR');
  }
});

/**
 * GET /bookings/:id
 * Get booking details
 */
router.get('/:id', authenticate, async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new AppError('Booking not found', 404);
  }
  const booking = await Booking.findById(req.params.id)
    .populate('serviceId')
    .populate('customerId', 'name phone avatar')
    .populate('providerId', 'name phone avatar rating currentLocation')
    .lean();

  if (!booking) throw new AppError('Booking not found', 404);

  // Authorization check
  const customerIdStr = booking.customerId?._id ? booking.customerId._id.toString() : booking.customerId?.toString();
  const providerIdStr = booking.providerId?._id ? booking.providerId._id.toString() : booking.providerId?.toString();
  const isOwner = customerIdStr === req.userId || providerIdStr === req.userId;
  if (!isOwner && !['admin', 'staff', 'manager'].includes(req.userRole)) {
    throw new AppError('Not authorized to view this booking', 403);
  }

  // If status is pending, check active online provider count
  if (booking.status === 'pending') {
    try {
      const onlineProvidersCount = await Provider.countDocuments({
        services: booking.serviceId?._id || booking.serviceId,
        approvalStatus: 'approved',
        isOnline: true,
        isBlocked: false,
        'earnings.isOnHold': { $ne: true },
      });
      booking.nearbyProvidersCount = onlineProvidersCount;
      if (onlineProvidersCount === 0) {
        booking.noProvidersAvailable = true;
      }
    } catch (e) {
      logger.warn('Failed to check nearby provider count:', e.message);
    }
  }

  // Include materials if they exist
  const materials = await MaterialsUsed.findOne({ bookingId: booking._id }).lean();

  res.json({ success: true, data: { booking, materials } });
});

/**
 * POST /bookings/:id/retry-match
 * Manually retry finding a provider for a pending booking
 */
router.post('/:id/retry-match', authenticate, authorize('customer'), async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.customerId?.toString() !== req.userId) throw new AppError('Forbidden', 403);
  if (booking.status !== 'pending') throw new AppError('Can only retry matching for pending bookings', 400);

  const provider = await bookingService.assignProviderToBooking(booking, 1);
  if (provider) {
    res.json({
      success: true,
      message: `Matched with provider ${provider.name}!`,
      data: { providerAssigned: true, providerName: provider.name },
    });
  } else {
    res.json({
      success: true,
      message: `No service providers currently available in your location. We will keep searching.`,
      data: { providerAssigned: false },
    });
  }
});

/**
 * PUT /bookings/:id/accept
 * Provider accepts a booking
 */
router.put('/:id/accept', authenticate, authorize('provider'), async (req, res) => {
  const booking = await Booking.findById(req.params.id).populate('serviceId');
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.providerId?.toString() !== req.userId) {
    throw new AppError('This booking was not assigned to you', 403);
  }
  if (booking.status !== 'assigned') {
    throw new AppError(`Cannot accept booking with status: ${booking.status}`, 400);
  }

  // 🛡️ Provider Debt & Job Freeze Lockout Check
  const provider = await Provider.findById(req.userId);
  if (provider?.jobAccessStatus === 'frozen') {
    return res.status(403).json({
      success: false,
      code: 'PROVIDER_JOB_ACCESS_FROZEN',
      error: 'New job access is temporarily frozen due to an unresolved complaint. Please submit a resolution to restore job access.',
      message: 'New job access is temporarily frozen due to an unresolved complaint. Please submit a resolution to restore job access.',
    });
  }
  if (provider?.earnings?.isOnHold || (provider?.earnings?.pendingCommission >= 500) || (provider?.earnings?.walletBalance <= -500)) {
    throw new AppError('Account suspended due to outstanding debt limit. Please clear your dues to unlock job dispatch.', 400);
  }

  // Check active jobs limit (max 5 open/uncompleted jobs at a time)
  const activeJobsCount = await Booking.countDocuments({
    providerId: req.userId,
    status: { $in: ['assigned', 'accepted', 'in_progress'] },
  });

  if (activeJobsCount >= 5) {
    throw new AppError('Cannot accept: You have reached the maximum limit of 5 active jobs at a time. Please complete a job first.', 400);
  }

  booking.status = 'accepted';
  booking.timeline.push({ status: 'accepted', note: 'Provider accepted the booking' });
  await booking.save();

  // ── Set active booking cache so live GPS tracking works ──────────────────
  await cache.set(`active_booking:provider:${req.userId}`, {
    bookingId: booking._id.toString(),
    customerId: booking.customerId.toString(),
    serviceAddress: booking.serviceAddress,
  }, 4 * 60 * 60); // 4 hour TTL

  // ── Mark provider as busy ONLY if they reach max capacity (5 active jobs) ─
  if (activeJobsCount + 1 >= 5) {
    await cache.set(`provider:busy:${req.userId}`, '1', 12 * 60 * 60);
  }

  // Notify customer
  const io = getIO();
  io.to(`user:${booking.customerId}`).emit('booking:accepted', {
    bookingId: booking._id,
    bookingNumber: booking.bookingNumber,
    providerId: req.userId,
    message: 'Your service provider has accepted the booking!',
  });

  res.json({ success: true, message: 'Booking accepted', data: { status: booking.status } });
});

/**
 * PUT /bookings/:id/reject
 * Provider rejects — triggers auto-reassignment
 */
router.put('/:id/reject', authenticate, authorize('provider'), async (req, res) => {
  const { reason } = req.body;
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.providerId?.toString() !== req.userId) {
    throw new AppError('This booking was not assigned to you', 403);
  }
  if (!['assigned', 'accepted'].includes(booking.status)) {
    throw new AppError('Cannot reject this booking', 400);
  }

  booking.rejectedProviders.push(req.userId);
  booking.status = 'pending';
  booking.providerId = undefined;
  booking.timeline.push({ status: 'pending', note: `Provider rejected: ${reason || 'No reason given'}` });
  await booking.save();

  // Auto-offline penalty for rejections
  const provider = await Provider.findById(req.userId);
  if (provider) {
    const missedCount = parseInt(await cache.get(`provider_missed:${provider._id}`) || 0) + 1;
    if (missedCount >= 2) {
      provider.isOnline = false;
      await provider.save();
      await cache.del(`provider_missed:${provider._id}`);
      
      const io = getIO();
      // Notify them their status has changed
      io.to(`user:${provider._id}`).emit('notification:push', { 
        title: 'Status Changed', 
        body: 'You have been taken Offline after rejecting multiple requests.' 
      });
    } else {
      await cache.set(`provider_missed:${provider._id}`, missedCount, 3600);
    }
  }

  // Re-queue for matching with excluded providers
  const { bookingQueue } = require('../../jobs');
  await bookingQueue.add('match_provider', {
    bookingId: booking._id.toString(),
    coordinates: booking.serviceAddress.location.coordinates,
    serviceId: booking.serviceId.toString(),
    attempt: booking.assignmentAttempts + 1,
    excludeProviders: booking.rejectedProviders.map(String),
  }, { delay: 2000 });

  res.json({ success: true, message: 'Booking rejected. Finding another provider.' });
});

// Helper for Geo-fencing
function haversineDistance(coord1, coord2) {
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;
  const R = 6371; // Earth ratio in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * PUT /bookings/:id/start
 * Provider starts the job (OTP + Geo-fence)
 */
router.put('/:id/start', authenticate, authorize('provider'), async (req, res) => {
  const { otp, lat, lng } = req.body;
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.providerId?.toString() !== req.userId) throw new AppError('Forbidden', 403);
  if (booking.status !== 'accepted') throw new AppError('Cannot start job at this stage', 400);

  // FIX #9: Always enforce startOtp — no silent skip if booking has no OTP set
  if (!otp) {
    throw new AppError('Start OTP is required. Please ask the customer for the OTP sent to their phone.', 400);
  }
  if (booking.startOtp && booking.startOtp !== otp) {
    throw new AppError('Invalid OTP', 400);
  }


  // [Geofencing coordinates check removed as per client preferences]


  // Generate a 4-digit PIN the customer will read to the provider
  const endOtp = Math.floor(1000 + Math.random() * 9000).toString();

  booking.status = 'in_progress';
  booking.workDetails.startedAt = new Date();
  booking.endOtp = endOtp;  // stored for verification at completion
  booking.timeline.push({ status: 'in_progress', note: 'Job started' });
  await booking.save();

  const io = getIO();
  io.to(`user:${booking.customerId}`).emit('booking:status_update', {
    bookingId: booking._id,
    status: 'in_progress',
    endOtp,                     // customer sees the PIN in real-time
    message: `Service started! Your completion PIN is ${endOtp} — share it with the provider when done.`,
  });

  res.json({
    success: true,
    message: 'Job started',
    data: { startedAt: booking.workDetails.startedAt },
  });
});

/**
 * POST /bookings/:id/quote
 * Provider submits detected issues/add-on services during inspection
 */
router.post('/:id/quote', authenticate, authorize('provider'), async (req, res) => {
  const { addons, note } = req.body; // addons: [{ serviceId, name, price, category }]
  if (!addons || !Array.isArray(addons) || addons.length === 0) {
    throw new AppError('At least one detected issue/add-on service is required', 400);
  }

  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.providerId?.toString() !== req.userId) throw new AppError('Forbidden', 403);
  if (!['assigned', 'accepted', 'in_progress'].includes(booking.status)) {
    throw new AppError('Cannot submit quote for this booking status', 400);
  }

  const totalAddonPrice = addons.reduce((sum, item) => sum + (Number(item.price) || 0), 0);

  booking.quotation = {
    addons,
    totalAddonPrice,
    note: note || 'On-site inspection quote for detected issues.',
    status: 'pending',
    requestedAt: new Date(),
  };

  await booking.save();

  // Notify customer real-time
  const io = getIO();
  if (io) {
    io.to(`user:${booking.customerId}`).emit('booking:quote_requested', {
      bookingId: booking._id,
      quotation: booking.quotation,
      newTotalAmount: booking.basePrice + totalAddonPrice,
      message: 'Technician has inspected your service location and submitted an updated quote for additional issues detected.',
    });
  }

  logger.info(`Provider ${req.userId} submitted on-site quote for booking ${booking._id}: ₹${totalAddonPrice}`);

  res.json({
    success: true,
    message: 'Quotation sent to customer for approval.',
    data: booking.quotation,
  });
});

/**
 * PUT /bookings/:id/quote/respond
 * Customer approves or declines on-site quotation
 */
router.put('/:id/quote/respond', authenticate, authorize('customer'), async (req, res) => {
  const { action } = req.body; // 'approve' | 'decline'
  if (!['approve', 'decline'].includes(action)) {
    throw new AppError('Action must be approve or decline', 400);
  }

  const booking = await Booking.findById(req.params.id).populate('serviceId', 'name');
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.customerId?.toString() !== req.userId) throw new AppError('Forbidden', 403);
  if (!booking.quotation || booking.quotation.status !== 'pending') {
    throw new AppError('No pending quotation found for this booking', 400);
  }

  booking.quotation.status = action === 'approve' ? 'approved' : 'declined';
  booking.quotation.respondedAt = new Date();

  await booking.save(); // pre-save hook recalculates totalAmount if approved!

  // Notify provider real-time
  const io = getIO();
  if (io) {
    io.to(`provider:${booking.providerId}`).emit('booking:quote_responded', {
      bookingId: booking._id,
      action,
      totalAmount: booking.totalAmount,
      message: action === 'approve' 
        ? 'Customer APPROVED the updated quote! You may proceed with the work.' 
        : 'Customer DECLINED the updated quote.',
    });
  }

  logger.info(`Customer ${req.userId} ${action}d quotation for booking ${booking._id}`);

  res.json({
    success: true,
    message: action === 'approve' ? 'Quote approved! Total cost updated.' : 'Quote declined.',
    data: {
      status: booking.quotation.status,
      totalAmount: booking.totalAmount,
    },
  });
});

/**
 * POST /bookings/:id/materials
 * Provider adds materials used
 */
router.post('/:id/materials', authenticate, authorize('provider'), validateBody(addMaterialsSchema), async (req, res) => {
  const { items, notes } = req.body;
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.providerId?.toString() !== req.userId) throw new AppError('Forbidden', 403);
  if (booking.status !== 'in_progress') throw new AppError('Can only add materials while job is in progress', 400);

  // Upsert materials entry
  const materialsDoc = await MaterialsUsed.findOneAndUpdate(
    { bookingId: booking._id },
    {
      bookingId: booking._id,
      providerId: req.userId,
      customerId: booking.customerId,
      items,
      notes,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Update booking material cost
  booking.materialCost = materialsDoc.subtotal;
  await booking.save();

  // Notify customer to approve materials list
  const io = getIO();
  io.to(`user:${booking.customerId}`).emit('booking:materials_added', {
    bookingId: booking._id,
    materialCost: materialsDoc.subtotal,
    items,
    message: 'Please review and approve the materials used.',
  });

  res.json({
    success: true,
    message: 'Materials saved',
    data: {
      materialsId: materialsDoc._id,
      items: materialsDoc.items,
      subtotal: materialsDoc.subtotal,
    },
  });
});

/**
 * PUT /bookings/:id/materials/approve
 * Customer approves materials
 */
router.put('/:id/materials/approve', authenticate, authorize('customer'), async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.customerId?.toString() !== req.userId) throw new AppError('Forbidden', 403);

  const materials = await MaterialsUsed.findOneAndUpdate(
    { bookingId: booking._id },
    { customerApproved: true, approvedAt: new Date() },
    { new: true }
  );
  if (!materials) throw new AppError('No materials record found', 404);

  res.json({ success: true, message: 'Materials approved', data: { subtotal: materials.subtotal } });
});

/**
 * PUT /bookings/:id/complete
 * Provider marks job as complete
 */
router.put('/:id/complete', authenticate, authorize('provider'), validateBody(completeBookingSchema), async (req, res) => {
  const { workPerformed, extraCharges, extraChargesNote, afterPhotos, endOtp, lat, lng } = req.body;
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new AppError('Booking not found', 404);
  const activeProviderId = req.providerId || req.userId;
  if (booking.providerId?.toString() !== activeProviderId) throw new AppError('Forbidden', 403);
  if (booking.status !== 'in_progress') throw new AppError('Job not in progress', 400);

  // Anti-Bypass: Cannot complete job if on-site quotation is pending approval
  if (booking.quotation && booking.quotation.status === 'pending') {
    throw new AppError('Cannot complete job while on-site quotation is pending customer approval or rejection. Please ask customer to approve or decline in app.', 400);
  }


  // [Geofencing coordinates check removed as per client preferences]


  // Verify 4-digit completion PIN shared by customer
  if (booking.endOtp) {
    if (!endOtp) {
      throw new AppError('PIN is required. Please ask the customer for the 4-digit completion PIN.', 400);
    }
    if (booking.endOtp !== String(endOtp).trim()) {
      throw new AppError('Invalid PIN. Please ask the customer for the correct 4-digit PIN.', 400);
    }
  }

  booking.status = 'completed';
  booking.workDetails.workPerformed = workPerformed;
  booking.workDetails.completedAt = new Date();
  booking.workDetails.afterPhotos = afterPhotos || [];
  booking.extraCharges = extraCharges || 0;
  booking.extraChargesNote = extraChargesNote;
  booking.timeline.push({ status: 'completed', note: 'Job completed by provider' });

  // 🛡️ Auto-issue 30-Day Warranty Vault Certificate (Pillar 4)
  if (!booking.warranty || !booking.warranty.warrantyId) {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    booking.warranty = {
      warrantyId: `SH-WRN-${ts}-${rand}`,
      issuedAt: new Date(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days valid
      status: 'active',
      terms: '30-Day Free Revisit Guarantee covering all labor & service work.',
    };
  }

  await booking.save();

  // Clear active booking cache so GPS tracking stops
  await cache.del(`active_booking:provider:${req.userId}`);

  // ── FIX 1: Provider is free again — remove busy flag so they re-enter match pool
  await cache.del(`provider:busy:${req.userId}`);

  const io = getIO();
  io.to(`user:${booking.customerId}`).emit('booking:completed', {
    bookingId: booking._id,
    totalAmount: booking.totalAmount,
    message: 'Service completed! Please proceed to payment.',
  });

  res.json({
    success: true,
    message: 'Job marked as complete',
    data: {
      bookingId: booking._id,
      totalAmount: booking.totalAmount,
      breakdown: {
        basePrice: booking.basePrice,
        surgeMultiplier: booking.surgeMultiplier,
        materialCost: booking.materialCost,
        extraCharges: booking.extraCharges,
        discount: booking.discountAmount,
        total: booking.totalAmount,
      },
    },
  });
});

/**
 * PUT /bookings/:id/cancel
 * Cancel a booking
 */
router.put('/:id/cancel', authenticate, async (req, res) => {
  const { reason } = req.body;
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new AppError('Booking not found', 404);

  const cancelableStatuses = ['pending', 'assigned', 'accepted', 'in_progress'];
  if (!cancelableStatuses.includes(booking.status)) {
    throw new AppError('Booking cannot be cancelled at this stage', 400);
  }

  // Check authorization
  const isCustomer = booking.customerId?.toString() === req.userId && req.userRole === 'customer';
  const isProvider = booking.providerId?.toString() === req.userId && req.userRole === 'provider';
  const isAdmin = req.userRole === 'admin';
  if (!isCustomer && !isProvider && !isAdmin) throw new AppError('Not authorized', 403);

  let cancelledBy = isAdmin ? 'admin' : (isCustomer ? 'customer' : 'provider');

  // Strict Provider Penalties for abandoning an accepted job
  if (cancelledBy === 'provider' && ['accepted', 'in_progress'].includes(booking.status)) {
    const provider = await Provider.findById(req.userId);
    if (provider) {
      provider.cancelledJobs = (provider.cancelledJobs || 0) + 1;
      provider.riskScore = Math.min((provider.riskScore || 0) + 15, 100);
      provider.warningCount = (provider.warningCount || 0) + 1;
      provider.warnings.push({
        reason: `Abandoned accepted booking ${booking.bookingNumber}`,
        issuedAt: new Date()
      });
      await provider.save();
      
      // 1-hour auto-timeout penalty so they don't get new jobs
      await cache.set(`provider:timeout:${provider._id}`, true, 3600);
    }
  }

  // Calculate cancellation charge (only applicable if customer cancels)
  // Compulsory Visit Charge Enforcement: If technician visited or quoted, 100% Visit Fee (₹199) is compulsory
  let cancellationCharge = 0;
  if (cancelledBy === 'customer') {
    cancellationCharge = bookingService.calculateCancellationCharge(booking);
  }

  booking.status = 'cancelled';
  booking.cancellation = {
    cancelledBy,
    reason,
    cancelledAt: new Date(),
    cancellationCharge,
    refundAmount: Math.max(0, booking.totalAmount - cancellationCharge),
  };
  booking.timeline.push({ 
    status: 'cancelled', 
    note: `Cancelled by ${cancelledBy}: ${reason || 'No reason given'}${cancellationCharge > 0 ? ` (Compulsory Visit Charge: ₹${cancellationCharge})` : ''}` 
  });
  await booking.save();

  // 💰 Credit Provider Compensation if customer was charged a cancellation/visit fee (Technician Protection)
  if (cancelledBy === 'customer' && cancellationCharge > 0 && booking.providerId) {
    try {
      const provider = await Provider.findById(booking.providerId);
      if (provider) {
        const commissionRate = booking.commissionRate || 0.20; // Default 20% platform fee
        const providerCompensation = Math.round(cancellationCharge * (1 - commissionRate));

        if (providerCompensation > 0) {
          provider.earnings = provider.earnings || {};
          provider.earnings.walletBalance = (provider.earnings.walletBalance || 0) + providerCompensation;
          provider.earnings.totalEarned = (provider.earnings.totalEarned || 0) + providerCompensation;
          await provider.save();

          await WalletLedger.create({
            ownerId: provider._id,
            ownerType: 'provider',
            type: 'credit',
            account: 'wallet',
            amount: providerCompensation,
            balance: provider.earnings.walletBalance,
            description: `Compensation payout for customer cancellation on booking #${booking.bookingNumber} (₹${cancellationCharge} fee collected)`,
            referenceType: 'booking',
            referenceId: booking._id,
          });

          const io = getIO();
          if (io) {
            io.to(`provider:${provider._id}`).emit('notification:push', {
              title: '💰 Cancellation Compensation Credited!',
              body: `You received ₹${providerCompensation} compensation for customer cancellation on booking #${booking.bookingNumber}.`,
            });
          }

          Notification.create({
            userId: provider._id,
            title: '💰 Cancellation Compensation Credited!',
            body: `You received ₹${providerCompensation} compensation for customer cancellation on booking #${booking.bookingNumber}.`,
            type: 'provider_payout',
            referenceId: booking._id,
          }).catch(() => {});

          logger.info(`Credited ₹${providerCompensation} cancellation compensation to provider ${provider.name} for booking ${booking.bookingNumber}`);
        }
      }
    } catch (compErr) {
      logger.error(`Error processing provider cancellation compensation for booking ${booking._id}:`, compErr.message);
    }
  }

  // 🚨 AUTOMATED RED FLAG & ACCOUNT BLOCK (3+ Post-Start Cancellations Rule)
  if (booking.providerId) {
    const postStartCancelCount = await Booking.countDocuments({
      providerId: booking.providerId,
      status: 'cancelled',
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    });

    if (postStartCancelCount >= 3) {
      const provider = await Provider.findById(booking.providerId);
      if (provider && !provider.isBlocked) {
        provider.isBlocked = true;
        provider.blockReason = `AUTOMATED RED FLAG: ${postStartCancelCount} post-visit/start job cancellations in 7 days (Suspected off-platform deal fraud)`;
        provider.riskScore = 100;
        if (!provider.badges.includes('RED FLAG - SUSPENDED')) {
          provider.badges.push('RED FLAG - SUSPENDED');
        }
        await provider.save();

        const io = getIO();
        if (io) {
          io.to('admin').emit('admin:provider_blocked', {
            providerId: provider._id,
            providerName: provider.name,
            reason: provider.blockReason,
            postStartCancelCount,
          });
        }
        logger.warn(`Provider ${provider.name} (${provider._id}) AUTOMATICALLY BLOCKED due to ${postStartCancelCount} cancellations!`);
      }
    }
  }

  // Clear active booking cache if provider is cancelling
  if (cancelledBy === 'provider' && booking.providerId) {
    await cache.del(`active_booking:provider:${booking.providerId}`);
    // ── FIX 1: Release busy lock so provider re-enters match pool immediately
    await cache.del(`provider:busy:${booking.providerId}`);
  }

  // Socket notification
  const io = getIO();
  const notifyUser = cancelledBy === 'customer' ? booking.providerId : booking.customerId;
  const targetRoom = cancelledBy === 'customer' ? `provider:${booking.providerId}` : `user:${booking.customerId}`;
  
  if (io && notifyUser) {
    io.to(targetRoom).emit('booking:cancelled', {
      bookingId: booking._id,
      cancelledBy,
      reason,
      cancellationCharge,
      message: `Booking was cancelled by ${cancelledBy}.`,
    });
  }

  // Trigger refund if payment was made
  if (booking.cancellation.refundAmount > 0) {
    const { paymentQueue } = require('../../jobs');
    paymentQueue.add('process_refund', {
      bookingId: booking._id.toString(),
      refundAmount: booking.cancellation.refundAmount,
    });
  }

  res.json({
    success: true,
    message: 'Booking cancelled',
    data: {
      refundAmount: booking.cancellation.refundAmount,
      cancellationCharge,
    },
  });
});

/**
 * GET /bookings/:id/invoice
 * Download PDF invoice
 */
router.get('/:id/invoice', authenticate, async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('serviceId', 'name category')
    .populate('customerId', 'name phone email')
    .populate('providerId', 'name phone rating')
    .lean();

  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.status !== 'paid') throw new AppError('Invoice only available for paid bookings', 400);

  const materials = await MaterialsUsed.findOne({ bookingId: booking._id }).lean();
  const transaction = await require('../../models').Transaction.findOne({
    bookingId: booking._id, status: 'success',
  }).lean();

  // Create or retrieve immutable invoice snapshot
  const invoiceRecord = await invoiceService.getOrCreateInvoiceForBooking(booking._id);
  const settingsOverride = invoiceRecord.settingsSnapshot || await invoiceService.getInvoiceSettings();

  // Attach invoice number to booking
  booking.invoiceNumber = invoiceRecord.invoiceNumber;

  const pdfBuffer = await pdfService.generateInvoice({
    booking,
    materials,
    transaction,
    settingsOverride,
  });

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename=invoice-${invoiceRecord.invoiceNumber}.pdf`,
    'Content-Length': pdfBuffer.length,
  });
  res.send(pdfBuffer);
});

/**
 * GET /bookings/:id/track
 * Real-time provider location (polling fallback)
 */
router.get('/:id/track', authenticate, authorize('customer'), async (req, res) => {
  const booking = await Booking.findById(req.params.id).select('providerId status');
  if (!booking) throw new AppError('Booking not found', 404);
  if (!['accepted', 'in_progress'].includes(booking.status)) {
    throw new AppError('Tracking only available when provider is en route', 400);
  }

  const locationData = await cache.get(`provider_location:${booking.providerId}`);
  if (!locationData) {
    return res.json({ success: true, data: null, message: 'Provider location not available' });
  }

  res.json({ success: true, data: locationData });
});

/**
 * POST /bookings/:id/report-fraud
 * Customer Whistleblower Endpoint: Report an off-platform cash deal offer
 * Flags technician provider for trust & safety audit and acknowledges customer protection.
 */
router.post('/:id/report-fraud', authenticate, authorize('customer'), async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new AppError('Booking not found', 404);

  const { reason = 'Technician offered direct off-platform cash deal' } = req.body;

  // Flag Provider
  if (booking.providerId) {
    const provider = await Provider.findById(booking.providerId);
    if (provider) {
      provider.riskScore = Math.min((provider.riskScore || 0) + 40, 100);
      provider.warningCount = (provider.warningCount || 0) + 1;
      provider.warnings.push({
        reason: `Reported by customer for off-app cash deal on booking ${booking.bookingNumber}`,
        issuedAt: new Date(),
      });
      if (!provider.badges.includes('SUSPECTED FRAUD')) {
        provider.badges.push('SUSPECTED FRAUD');
      }
      await provider.save();
    }
  }

  // Socket Alert to Admin
  const io = getIO();
  if (io) {
    io.to('admin').emit('admin:fraud_reported', {
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber,
      providerId: booking.providerId,
      customerId: req.userId,
      reason,
    });
  }

  logger.warn(`Fraud reported by customer on booking ${booking.bookingNumber}`);

  res.json({
    success: true,
    message: 'Thank you for staying safe! 🛡️ You saved yourself from unauthorized repair fraud. Your report has been logged with our Trust & Safety team.',
  });
});

module.exports = router;
