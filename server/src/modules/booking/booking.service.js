'use strict';
const { Provider, Service, Coupon } = require('../../models');
const { cache, getRedisClient } = require('../../config/redis');
const { AppError } = require('../../utils/errors');
const logger = require('../../utils/logger');
const { getIO } = require('../../socket');

// ── Haversine Distance Formula ─────────────────────────────────────────────────
function haversineDistance(coord1, coord2) {
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;
  const R = 6371; // Earth's radius in km

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

// ── Smart Provider Matching ────────────────────────────────────────────────────
/**
 * Find and rank best providers for a booking.
 *
 * FIX 1: Busy providers (currently on a job) are filtered BEFORE scoring using
 *         a Redis key `provider:busy:{id}` set at accept-time and cleared at completion.
 *
 * FIX 2: Redis GEOSEARCH (in-memory, ~1ms) is tried first for live locations.
 *         Falls back to MongoDB $near (disk) when Redis GEO data is unavailable.
 *
 * Scoring weights: Distance 40% | Rating 30% | Tier 20% | Completion 10%
 */
async function findBestProviders(serviceId, coordinates, excludeProviders = [], limit = 10, attempt = 1) {
  const dynamicRadiusKm = 20 + (attempt - 1) * 10; // grows: 20→30→40→50→60
  const dynamicRadiusMeters = dynamicRadiusKm * 1000;
  const [lng, lat] = coordinates;

  const baseFilter = {
    services: serviceId,
    isBlocked: false,
    jobAccessStatus: { $ne: 'frozen' },
    approvalStatus: 'approved',
    _id: { $nin: excludeProviders },
    'earnings.isOnHold': { $ne: true },
    'earnings.pendingCommission': { $lt: 500 }, // Commission debt must be under ₹500
    'earnings.walletBalance': { $gt: -500 },     // Wallet balance must be strictly > -500
  };

  // ── FIX 2: Try Redis GEOSEARCH first (fast in-memory path) ─────────────────
  let providers = [];
  let providerDistanceMap = {}; // id → distanceKm from Redis GEO
  let usedRedisGeo = false;

  try {
    const redisClient = getRedisClient();
    if (redisClient) {
      const geoResults = await redisClient.geoSearch(
        'providers_online',
        { longitude: lng, latitude: lat },
        { radius: dynamicRadiusKm, unit: 'km' },
        { SORT: 'ASC', COUNT: 100, WITHDIST: true }
      );

      if (geoResults && geoResults.length > 0) {
        const eligibleIds = geoResults
          .filter((r) => !excludeProviders.includes(r.member))
          .map((r) => {
            providerDistanceMap[r.member] = parseFloat(r.distance);
            return r.member;
          });

        if (eligibleIds.length > 0) {
          providers = await Provider.find({
            ...baseFilter,
            _id: { $in: eligibleIds, $nin: excludeProviders },
          })
            .select('_id name phone rating ratingCount tier completedJobs cancelledJobs currentLocation isOnline serviceRadius')
            .limit(50)
            .lean();
          usedRedisGeo = true;
          logger.debug(`[GeoSearch] Redis GEOSEARCH found ${providers.length} candidates (attempt ${attempt})`);
        }
      }
    }
  } catch (geoErr) {
    logger.warn('[GeoSearch] Redis GEOSEARCH failed, falling back to MongoDB:', geoErr.message);
  }

  // ── FIX 2 Fallback: MongoDB $near when Redis GEO unavailable ───────────────
  if (!usedRedisGeo || providers.length === 0) {
    try {
      providers = await Provider.find({
        ...baseFilter,
        currentLocation: {
          $near: {
            $geometry: { type: 'Point', coordinates },
            $maxDistance: dynamicRadiusMeters,
          },
        },
      })
        .select('_id name phone rating ratingCount tier completedJobs cancelledJobs currentLocation isOnline serviceRadius')
        .limit(50)
        .lean();
      logger.debug(`[GeoSearch] MongoDB $near found ${providers.length} candidates (attempt ${attempt})`);
    } catch (dbGeoErr) {
      logger.warn('[GeoSearch] MongoDB $near also failed, using non-geo query:', dbGeoErr.message);
    }

    // Final non-geo fallback
    if (providers.length === 0) {
      providers = await Provider.find(baseFilter)
        .select('_id name phone rating ratingCount tier completedJobs cancelledJobs currentLocation isOnline serviceRadius')
        .limit(50)
        .lean();
    }
  }

  if (providers.length === 0) return [];

  // ── Dynamic Capacity Check: Max 5 active uncompleted jobs at any time ──
  try {
    const candidateIds = providers.map((p) => p._id);
    const { Booking } = require('../../models');

    const MAX_ACTIVE_JOBS = 5;

    const activeJobStats = await Booking.aggregate([
      {
        $match: {
          providerId: { $in: candidateIds },
          status: { $in: ['assigned', 'accepted', 'in_progress'] },
        },
      },
      {
        $group: {
          _id: '$providerId',
          totalActive: { $sum: 1 },
          hasUnacceptedAssignment: {
            $sum: { $cond: [{ $eq: ['$status', 'assigned'] }, 1, 0] },
          },
        },
      },
    ]);

    const countMap = {};
    const unacceptedMap = {};
    activeJobStats.forEach((c) => {
      const idStr = c._id.toString();
      countMap[idStr] = c.totalActive;
      unacceptedMap[idStr] = c.hasUnacceptedAssignment > 0;
    });

    providers = providers.filter((p) => {
      const idStr = p._id.toString();
      const currentActive = countMap[idStr] || 0;
      const isAwaitingResponse = unacceptedMap[idStr] || false;
      return currentActive < MAX_ACTIVE_JOBS && !isAwaitingResponse;
    });
  } catch (capacityErr) {
    logger.warn('[GeoSearch] Provider capacity check failed, proceeding with candidate list:', capacityErr.message);
  }

  if (providers.length === 0) return [];

  const TIER_SCORE = { verified_pro: 1.2, platinum: 1.1, gold: 1.0, silver: 0.7, bronze: 0.4 };

  const scored = providers
    .map((provider) => {
      // Use Redis GEO distance if available (more accurate), else compute from DB coords
      let distanceKm;
      if (usedRedisGeo && providerDistanceMap[provider._id.toString()] !== undefined) {
        distanceKm = providerDistanceMap[provider._id.toString()];
      } else {
        const coords = provider.currentLocation?.coordinates;
        if (!coords || coords.length < 2) return null;
        distanceKm = haversineDistance(coordinates, coords);
      }

      if (distanceKm > dynamicRadiusKm) return null; // Outside search radius

      // Respect each provider's personal service radius
      const providerRadius = provider.serviceRadius || 30;
      if (distanceKm > providerRadius) return null;

      const distanceScore = Math.max(0, 1 - distanceKm / dynamicRadiusKm);
      const ratingScore = (provider.rating || 0) / 5;
      const tierScore = TIER_SCORE[provider.tier] || 0;
      const totalJobs = (provider.completedJobs || 0) + (provider.cancelledJobs || 0);
      const completionRate = totalJobs > 0 ? provider.completedJobs / totalJobs : 0.5;

      const score =
        distanceScore * 0.4 +
        ratingScore * 0.3 +
        tierScore * 0.2 +
        completionRate * 0.1;

      return { ...provider, score, distanceKm: Math.round(distanceKm * 10) / 10 };
    })
    .filter(Boolean);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

// ── Auto-Assign Provider ───────────────────────────────────────────────────────
async function assignProviderToBooking(booking, attempt = 1) {
  const MAX_ATTEMPTS = 5;
  const ACCEPT_TIMEOUT_SECONDS = 120; // 2 minutes to accept

  if (attempt > MAX_ATTEMPTS) {
    logger.warn(`Booking ${booking.bookingNumber}: Max assignment attempts reached`);

    // ── FIX 3: Cross-city / scheduling fallback instead of hard cancel ────────
    const isAdvanceBooking =
      new Date(booking.scheduledDate) > new Date(Date.now() + 6 * 60 * 60 * 1000); // > 6 hours away

    if (isAdvanceBooking) {
      // Keep alive for admin manual assignment — do NOT cancel
      booking.status = 'pending';
      booking.timeline.push({
        status: 'pending',
        note: 'Auto-match exhausted. Queued for admin manual assignment.',
      });
      await booking.save();

      const io = getIO();
      // Alert customer that it's queued for manual assignment
      io.to(`user:${booking.customerId}`).emit('booking:queued_manual', {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        message: 'No providers available immediately. Your booking is scheduled — our team will assign a provider before your service time.',
      });

      // Notify admin room
      io.to('admin').emit('admin:unmatched_booking', {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        city: booking.serviceAddress?.city,
        scheduledDate: booking.scheduledDate,
        serviceId: booking.serviceId,
        message: `Manual assignment required — no providers found in ${booking.serviceAddress?.city}`,
      });

      logger.warn(`Booking ${booking.bookingNumber}: forwarded to admin for manual assignment (advance booking, city: ${booking.serviceAddress?.city})`);
      return null;
    }

    // Same-day booking — soft cancel with reschedule suggestion
    booking.status = 'cancelled';
    booking.cancellation = {
      cancelledBy: 'system',
      reason: 'No providers available in your area right now',
      cancelledAt: new Date(),
      refundAmount: 0,
      cancellationCharge: 0,
    };
    await booking.save();

    const io = getIO();
    io.to(`user:${booking.customerId}`).emit('booking:failed', {
      bookingId: booking._id,
      message: 'Sorry, no providers are available right now in your area. Please try scheduling for a later time or tomorrow.',
      canReschedule: true, // Frontend can show a reschedule button
    });
    return null;
  }

  const providers = await findBestProviders(
    booking.serviceId,
    booking.serviceAddress.location.coordinates,
    booking.rejectedProviders.map(String),
    10,
    attempt
  );

  if (providers.length === 0) {
    logger.info(`Booking ${booking.bookingNumber}: No providers found on attempt ${attempt}`);
    if (attempt === 1) {
      try {
        const io = getIO();
        if (io) {
          io.to(`user:${booking.customerId}`).emit('booking:no_providers', {
            bookingId: booking._id,
            city: booking.serviceAddress?.city,
            message: `No service providers currently available near ${booking.serviceAddress?.city || 'your location'}.`,
          });
        }
      } catch (e) {
        logger.warn('Socket emit booking:no_providers failed:', e.message);
      }
    }
    return null; // BullMQ or retry logic handles further attempts
  }

  const selectedProvider = providers[0];

  booking.providerId = selectedProvider._id;
  booking.status = 'assigned';
  booking.assignmentAttempts = attempt;
  booking.assignmentTimeout = new Date(Date.now() + ACCEPT_TIMEOUT_SECONDS * 1000);
  booking.timeline.push({
    status: 'assigned',
    note: `Auto-assigned to ${selectedProvider.name} (attempt ${attempt})`,
  });
  await booking.save();

  // Notify provider via Socket.io
  const io = getIO();
  const bookingRequest = {
    bookingId: booking._id,
    bookingNumber: booking.bookingNumber,
    service: booking.serviceId,
    scheduledDate: booking.scheduledDate,
    timeSlot: booking.timeSlot,
    address: {
      city: booking.serviceAddress.city,
      area: booking.serviceAddress.line1,
    },
    distanceKm: selectedProvider.distanceKm,
    estimatedEarnings: booking.providerEarnings,
    acceptTimeoutSeconds: ACCEPT_TIMEOUT_SECONDS,
  };

  io.to(`provider:${selectedProvider._id}`).emit('booking:new_request', bookingRequest);
  logger.info(`Booking ${booking.bookingNumber} assigned to provider ${selectedProvider.name}`);

  // Notify customer
  io.to(`user:${booking.customerId}`).emit('booking:assigned', {
    bookingId: booking._id,
    provider: {
      name: selectedProvider.name,
      rating: selectedProvider.rating,
      distanceKm: selectedProvider.distanceKm,
    },
    message: 'A provider has been found! Waiting for confirmation...',
  });

  // Store timeout job to handle non-response
  await cache.set(
    `booking_timeout:${booking._id}`,
    { bookingId: booking._id.toString(), providerId: selectedProvider._id.toString(), attempt },
    ACCEPT_TIMEOUT_SECONDS + 10
  );

  return selectedProvider;
}

// ── Surge Pricing ──────────────────────────────────────────────────────────────
async function calculateSurgePricing(serviceId, scheduledDate, coordinates) {
  try {
    const cacheKey = `surge:${serviceId}:${new Date(scheduledDate).getHours()}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const hour = new Date(scheduledDate).getHours();
    let multiplier = 1.0;

    // Time-based surge
    if (hour >= 7 && hour <= 9) multiplier *= 1.2;   // Morning rush
    if (hour >= 18 && hour <= 21) multiplier *= 1.3;  // Evening rush
    if (hour >= 22 || hour <= 6) multiplier *= 1.5;   // Night hours

    // Demand-based surge: check active bookings in area
    const { Booking } = require('../../models');
    const [lng, lat] = coordinates;
    const activeBookings = await Booking.countDocuments({
      status: { $in: ['pending', 'assigned', 'accepted', 'in_progress'] },
      scheduledDate: {
        $gte: new Date(scheduledDate).setHours(0, 0, 0, 0),
        $lte: new Date(scheduledDate).setHours(23, 59, 59, 999),
      },
      'serviceAddress.location': {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: 5000, // 5km radius
        },
      },
    });

    if (activeBookings > 20) multiplier *= 1.2;
    if (activeBookings > 50) multiplier *= 1.4;

    // Clamp to max
    const MAX_SURGE = parseFloat(process.env.SURGE_MULTIPLIER_MAX || '2.5');
    multiplier = Math.min(multiplier, MAX_SURGE);
    multiplier = Math.round(multiplier * 10) / 10;

    await cache.set(cacheKey, multiplier, 300); // Cache 5 minutes
    return multiplier;
  } catch (err) {
    logger.error('Surge pricing calculation failed:', err);
    return 1.0; // Safe default
  }
}

// ── Coupon Application ─────────────────────────────────────────────────────────
async function applyCoupon(code, userId, orderAmount) {
  const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
  if (!coupon) throw new AppError('Invalid coupon code', 400);

  const now = new Date();
  if (now < coupon.validFrom || now > coupon.validTo) {
    throw new AppError('Coupon has expired', 400);
  }
  if (orderAmount < coupon.minOrderValue) {
    throw new AppError(`Minimum order value of ₹${coupon.minOrderValue} required`, 400);
  }
  if (coupon.usedCount >= coupon.usageLimit) {
    throw new AppError('Coupon usage limit reached', 400);
  }

  const userUsage = coupon.usedBy.filter((u) => u.userId.toString() === userId.toString()).length;
  if (userUsage >= coupon.userLimit) {
    throw new AppError('You have already used this coupon', 400);
  }

  let discountAmount;
  if (coupon.discountType === 'flat') {
    discountAmount = coupon.discountValue;
  } else {
    discountAmount = (orderAmount * coupon.discountValue) / 100;
    if (coupon.maxDiscount) discountAmount = Math.min(discountAmount, coupon.maxDiscount);
  }
  discountAmount = Math.min(discountAmount, orderAmount); // Cannot exceed order amount

  return { discountAmount: Math.round(discountAmount), coupon };
}

async function recordCouponUsage(couponId, userId, session = null) {
  await Coupon.findByIdAndUpdate(
    couponId,
    {
      $inc: { usedCount: 1 },
      $push: { usedBy: { userId, usedAt: new Date() } },
    },
    { session }
  );
}

// ── Cancellation Charges ───────────────────────────────────────────────────────
function calculateCancellationCharge(booking) {
  // Compulsory Visit Charge: If technician is on-site (in_progress) or quote was created, 100% base Visit Fee is compulsory
  if (booking.status === 'in_progress' || (booking.quotation && booking.quotation.status !== 'none')) {
    return booking.basePrice; // 100% compulsory Visit / Inspection Fee
  }

  const now = new Date();
  const scheduledTime = new Date(booking.scheduledDate);
  const hoursUntilService = (scheduledTime - now) / (1000 * 60 * 60);

  if (booking.status === 'pending') return 0;
  if (hoursUntilService > 24) return 0;           // Free cancellation 24h before
  if (hoursUntilService > 4) return booking.basePrice * 0.1; // 10% charge
  if (hoursUntilService > 1) return booking.basePrice * 0.25; // 25% charge
  return booking.basePrice * 0.5;                 // 50% charge within 1 hour
}

/**
 * Real-time match pending unassigned customer bookings for a provider who just came online or updated location
 */
/**
 * Real-time match pending unassigned customer bookings for a provider who just came online or updated location
 */
async function matchPendingBookingsForOnlineProvider(providerId) {
  try {
    const provider = await Provider.findById(providerId)
      .select('_id name phone rating avatar isOnline isBlocked jobAccessStatus approvalStatus services currentLocation serviceRadius earnings city')
      .lean();

    if (!provider || !provider.isOnline || provider.isBlocked || provider.jobAccessStatus === 'frozen' || provider.approvalStatus !== 'approved') {
      return null;
    }

    const pendingCommission = Number(provider.earnings?.pendingCommission || 0);
    const walletBalance = Number(provider.earnings?.walletBalance || 0);
    if (pendingCommission >= 500 || walletBalance <= -500 || provider.earnings?.isOnHold) {
      return null;
    }

    const { Booking, Service, Notification } = require('../../models');

    // Check if provider already has a manually assigned or pending job assigned to them
    const existingAssignedJob = await Booking.findOne({
      providerId: provider._id,
      status: 'assigned',
    }).populate('serviceId', 'name category icon basePrice');

    if (existingAssignedJob) {
      // Re-trigger real-time request popup & sound alert for this provider
      const [pLng, pLat] = provider.currentLocation?.coordinates || [0, 0];
      const bCoords = existingAssignedJob.serviceAddress?.location?.coordinates;
      let distanceKm = 10;
      if (bCoords && bCoords.length === 2 && (pLng !== 0 || pLat !== 0)) {
        distanceKm = haversineDistance(bCoords, [pLng, pLat]);
      }

      const bookingRequest = {
        bookingId: existingAssignedJob._id,
        bookingNumber: existingAssignedJob.bookingNumber,
        service: existingAssignedJob.serviceId,
        scheduledDate: existingAssignedJob.scheduledDate,
        timeSlot: existingAssignedJob.timeSlot,
        address: {
          city: existingAssignedJob.serviceAddress?.city,
          area: existingAssignedJob.serviceAddress?.line1 || existingAssignedJob.serviceAddress?.area,
        },
        distanceKm: Math.round(distanceKm * 10) / 10,
        estimatedEarnings: existingAssignedJob.providerEarnings,
        acceptTimeoutSeconds: 120,
      };

      await cache.set(`pending_booking:provider:${provider._id}`, bookingRequest, 120);

      const isAlreadySeen = await cache.get(`seen_booking:${provider._id}:${existingAssignedJob._id}`);
      if (!isAlreadySeen) {
        await cache.set(`seen_booking:${provider._id}:${existingAssignedJob._id}`, true, 300);
        const io = getIO();
        if (io) {
          io.to(`provider:${provider._id}`).emit('booking:new_request', bookingRequest);
        }

        Notification.create({
          userId: provider._id,
          title: '🔔 Assigned Job Waiting for You!',
          body: `You have an assigned job for ${existingAssignedJob.serviceId?.name || 'Service'}. Accept within 2 minutes!`,
          type: 'booking_update',
          referenceId: existingAssignedJob._id,
        }).catch(() => {});

        logger.info(`⚡ [OnlineMatch] Provider ${provider.name} came online with assigned job ${existingAssignedJob.bookingNumber} — popped real-time alert!`);
      } else {
        logger.info(`⚡ [OnlineMatch] Provider ${provider.name} online check — assigned job ${existingAssignedJob.bookingNumber} already popped once, suppressing duplicate alert.`);
      }
      return existingAssignedJob;
    }

    // Get categories of services provider is qualified for
    let providerCategories = [];
    if (provider.services && provider.services.length > 0) {
      const qualifiedServices = await Service.find({ _id: { $in: provider.services } }).select('category').lean();
      providerCategories = Array.from(new Set(qualifiedServices.map((s) => s.category).filter(Boolean)));
    }

    // Service matching filter: match by service ID OR category
    const serviceFilter = [];
    if (provider.services && provider.services.length > 0) {
      serviceFilter.push({ serviceId: { $in: provider.services } });
    }
    if (providerCategories.length > 0) {
      const matchingCategoryServices = await Service.find({ category: { $in: providerCategories } }).select('_id').lean();
      if (matchingCategoryServices.length > 0) {
        serviceFilter.push({ serviceId: { $in: matchingCategoryServices.map((s) => s._id) } });
      }
    }

    const queryFilter = {
      status: 'pending',
      $or: [{ providerId: { $exists: false } }, { providerId: null }],
      rejectedProviders: { $ne: provider._id },
    };

    if (serviceFilter.length > 0) {
      queryFilter.$and = [{ $or: serviceFilter }];
    }

    // Find oldest unassigned pending bookings
    const pendingBookings = await Booking.find(queryFilter)
      .populate('serviceId', 'name category icon basePrice')
      .sort({ createdAt: 1 })
      .limit(10);

    if (pendingBookings.length === 0) return null;

    const [pLng, pLat] = provider.currentLocation?.coordinates || [0, 0];
    const maxRadius = Math.max(provider.serviceRadius || 30, 50); // Default to 50km search zone

    for (const booking of pendingBookings) {
      const bCoords = booking.serviceAddress?.location?.coordinates;
      let distanceKm = 999;
      if (bCoords && bCoords.length === 2 && (pLng !== 0 || pLat !== 0)) {
        distanceKm = haversineDistance(bCoords, [pLng, pLat]);
      } else {
        // Fallback city / general proximity match
        const pCity = (provider.city || '').toLowerCase().trim();
        const bCity = (booking.serviceAddress?.city || '').toLowerCase().trim();
        if (!pCity || !bCity || pCity === bCity || pCity.includes(bCity) || bCity.includes(pCity)) {
          distanceKm = 10;
        }
      }

      if (distanceKm <= maxRadius) {
        booking.providerId = provider._id;
        booking.status = 'assigned';
        booking.assignmentAttempts = (booking.assignmentAttempts || 0) + 1;
        booking.assignmentTimeout = new Date(Date.now() + 120 * 1000); // 2 minutes to accept
        booking.timeline.push({
          status: 'assigned',
          note: `Fast auto-matched to active technician ${provider.name} (${Math.round(distanceKm * 10) / 10} km away)`,
        });
        await booking.save();

        const bookingRequest = {
          bookingId: booking._id,
          bookingNumber: booking.bookingNumber,
          service: booking.serviceId,
          scheduledDate: booking.scheduledDate,
          timeSlot: booking.timeSlot,
          address: {
            city: booking.serviceAddress?.city,
            area: booking.serviceAddress?.line1 || booking.serviceAddress?.area,
          },
          distanceKm: Math.round(distanceKm * 10) / 10,
          estimatedEarnings: booking.providerEarnings,
          acceptTimeoutSeconds: 120,
        };

        // Cache pending request so provider app shows instant request modal on refresh/reconnect
        await cache.set(`pending_booking:provider:${provider._id}`, bookingRequest, 120);

        const io = getIO();
        if (io) {
          // Send real-time alert + Rapido sound to provider
          io.to(`provider:${provider._id}`).emit('booking:new_request', bookingRequest);

          // Notify customer in real-time
          const matchPayload = {
            bookingId: booking._id,
            provider: {
              name: provider.name,
              rating: provider.rating,
              phone: provider.phone,
              avatar: provider.avatar,
              distanceKm: Math.round(distanceKm * 10) / 10,
            },
            message: `A technician (${provider.name}) is now online in your area!`,
          };
          io.to(`user:${booking.customerId}`).emit('booking:assigned', matchPayload);
          io.to(`user:${booking.customerId}`).emit('booking:status_update', {
            bookingId: booking._id,
            status: 'assigned',
          });
        }

        // Create database notification
        Notification.create({
          userId: provider._id,
          title: '🔔 New Job Request Available!',
          body: `You have a new booking for ${booking.serviceId?.name || 'Service'} (${Math.round(distanceKm * 10) / 10} km away). Accept within 2 minutes!`,
          type: 'booking_update',
          referenceId: booking._id,
        }).catch(() => {});

        logger.info(`⚡ [FastAutoMatch] Unassigned booking ${booking.bookingNumber} matched immediately to active provider ${provider.name}`);
        return booking;
      }
    }
    return null;
  } catch (err) {
    logger.error('[FastAutoMatch] Exception:', err.message);
    return null;
  }
}

/**
 * Scan all unassigned pending bookings and try finding any online providers
 */
async function matchAllUnassignedBookings() {
  try {
    const { Booking } = require('../../models');
    const pendingBookings = await Booking.find({
      status: 'pending',
      $or: [{ providerId: { $exists: false } }, { providerId: null }]
    }).limit(20);

    for (const booking of pendingBookings) {
      await assignProviderToBooking(booking, booking.assignmentAttempts || 1);
    }
  } catch (err) {
    logger.warn('[AutoMatchTask] Error in matchAllUnassignedBookings:', err.message);
  }
}

module.exports = {
  findBestProviders,
  assignProviderToBooking,
  calculateSurgePricing,
  applyCoupon,
  recordCouponUsage,
  calculateCancellationCharge,
  haversineDistance,
  matchPendingBookingsForOnlineProvider,
  matchAllUnassignedBookings,
};
