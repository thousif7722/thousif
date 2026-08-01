'use strict';
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const jwt = require('jsonwebtoken');
const { getRedisClient, getRedisSubscriber, cache } = require('../config/redis');
const { Provider } = require('../models');
const logger = require('../utils/logger');

let io;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
    pingInterval: 10000,
    pingTimeout: 5000,
    maxHttpBufferSize: 1e6, // 1MB max message size
  });

  // ── Redis Adapter for horizontal scaling ──────────────────────────────────────
  try {
    const baseClient = getRedisClient();
    const baseSubscriber = getRedisSubscriber();
    if (baseClient && baseSubscriber) {
      const pubClient = baseClient.duplicate();
      const subClient = baseSubscriber.duplicate();
      Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
        io.adapter(createAdapter(pubClient, subClient));
        logger.info('Socket.io Redis adapter enabled');
      });
    } else {
      logger.warn('Socket.io Redis adapter not available, using in-memory');
    }
  } catch (err) {
    logger.warn('Socket.io Redis adapter not available, using in-memory');
  }

  // ── Authentication Middleware ──────────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) return next(new Error('Authentication required'));

      // Check blacklist
      const isBlacklisted = await cache.get(`blacklist:${token}`);
      if (isBlacklisted) return next(new Error('Token revoked'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  // ── Connection Handler ─────────────────────────────────────────────────────────
  io.on('connection', async (socket) => {
    const { userId, userRole } = socket;
    logger.debug(`Socket connected: ${userId} [${userRole}] - ${socket.id}`);

    // Join personal room
    socket.join(`user:${userId}`);

    if (userRole === 'provider') {
      socket.join(`provider:${userId}`);
      await handleProviderConnect(socket);
    } else if (userRole === 'admin') {
      socket.join('admin');
    }

    // ── Provider Events ──────────────────────────────────────────────────────────

    /**
     * Provider sends GPS location update
     * Data: { lat, lng, accuracy, heading, speed }
     */
    socket.on('provider:location_update', async (data) => {
      if (userRole !== 'provider') return;

      // Validate coordinates
      const lat = parseFloat(data?.lat);
      const lng = parseFloat(data?.lng);
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return;

      const locationData = {
        lat,
        lng,
        accuracy: data.accuracy,
        heading: data.heading,
        speed: data.speed,
        timestamp: new Date().toISOString(),
        providerId: userId,
      };

      // Cache provider location (30 second TTL — polling fallback)
      await cache.set(`provider_location:${userId}`, locationData, 30);

      const client = getRedisClient();
      if (client) {
        // ── FIX 2: GEOADD — puts provider into the Redis GEO index for fast GEOSEARCH ──
        // This is the key that makes booking.service.js GEOSEARCH work instead of MongoDB $near
        try {
          await client.geoAdd('providers_online', {
            longitude: lng,
            latitude: lat,
            member: userId,
          });
          // 15s TTL presence key — auto-expires if provider's GPS goes silent = auto-offline
          await client.setEx(`provider_online:${userId}`, 15, '1');
        } catch (geoErr) {
          logger.warn(`[GEO] GEOADD failed for provider ${userId}:`, geoErr.message);
        }

        // Store breadcrumb trail for customer map (last 10 points)
        const trailKey = `loc_trail:${userId}`;
        try {
          await client.rPush(trailKey, JSON.stringify({ lat, lng, ts: Date.now() }));
          await client.lTrim(trailKey, -10, -1);
          await client.expire(trailKey, 3600);
        } catch (e) { /* ignore trail errors */ }
      }

      // Update provider location in DB immediately on 1st ping and periodically every 30 pings
      const updateCount = await cache.increment(`loc_update_count:${userId}`, 60);
      if (updateCount === 1 || updateCount % 30 === 0) {
        Provider.findByIdAndUpdate(userId, {
          'currentLocation.coordinates': [lng, lat],
          'currentLocation.updatedAt': new Date(),
        }).catch(() => {});
      }

      // Broadcast to customer tracking this provider (active booking)
      const activeBooking = await cache.get(`active_booking:provider:${userId}`);
      if (activeBooking?.customerId) {
        io.to(`user:${activeBooking.customerId}`).emit('provider:location', locationData);
      }
    });

    /**
     * Provider goes online/offline
     */
    socket.on('provider:toggle_availability', async ({ isOnline }) => {
      if (userRole !== 'provider') return;
      await Provider.findByIdAndUpdate(userId, { isOnline: !!isOnline });
      socket.emit('provider:availability_updated', { isOnline });
      logger.debug(`Provider ${userId} is now ${isOnline ? 'online' : 'offline'}`);
      if (isOnline) {
        const { matchPendingBookingsForOnlineProvider } = require('../modules/booking/booking.service');
        matchPendingBookingsForOnlineProvider(userId).catch(() => {});
      }
    });

    /**
     * Provider acknowledges booking request
     */
    socket.on('booking:request_ack', async ({ bookingId }) => {
      if (userRole !== 'provider') return;
      // Record that provider saw the request (for analytics)
      await cache.set(`booking_seen:${bookingId}:${userId}`, '1', 300);
    });

    // ── FIX 4: Real-time nearby providers map (Rapido-style) ───────────────────
    /**
     * Customer requests live list of available providers nearby.
     * Reads directly from the Redis GEO index (populated by FIX 2 GEOADD).
     * Returns provider pins within 5km — no MongoDB involved, ~1ms.
     * Data: { lat, lng, radiusKm? }
     */
    socket.on('customer:get_nearby_providers', async (data) => {
      if (userRole !== 'customer') return;

      const cLat = parseFloat(data?.lat);
      const cLng = parseFloat(data?.lng);
      if (isNaN(cLat) || isNaN(cLng)) return;

      const radiusKm = Math.min(parseFloat(data?.radiusKm) || 5, 20); // max 20km cap

      const client = getRedisClient();
      if (!client) {
        return socket.emit('nearby:providers', { providers: [], source: 'unavailable' });
      }

      try {
        // GEOSEARCH from Redis GEO index — all providers who sent a GPS ping in last 15s
        const geoResults = await client.geoSearch(
          'providers_online',
          { longitude: cLng, latitude: cLat },
          { radius: radiusKm, unit: 'km' },
          { SORT: 'ASC', COUNT: 30, WITHDIST: true, WITHCOORD: true }
        );

        // Filter: only send providers who are truly online (presence key alive)
        const liveProviders = await Promise.all(
          geoResults.map(async (r) => {
            const isOnline = await client.exists(`provider_online:${r.member}`);
            const isBusy = await client.exists(`provider:busy:${r.member}`);
            if (!isOnline) return null; // GPS went silent > 15s ago
            return {
              id: r.member,
              distanceKm: parseFloat(parseFloat(r.distance).toFixed(1)),
              lat: r.coordinates?.latitude,
              lng: r.coordinates?.longitude,
              busy: isBusy > 0, // Show busy ones dimmed on map, filter in accept
            };
          })
        );

        socket.emit('nearby:providers', {
          providers: liveProviders.filter(Boolean),
          radiusKm,
          source: 'redis_geo',
        });
      } catch (err) {
        logger.warn('[NearbyProviders] Redis GEOSEARCH failed:', err.message);
        socket.emit('nearby:providers', { providers: [], source: 'error' });
      }
    });

    // ── Chat Events ──────────────────────────────────────────────────────────────

    /**
     * Send chat message
     * Data: { bookingId, message, type: 'text' | 'image' }
     */
    socket.on('chat:send', async (data) => {
      if (!data?.bookingId || !data?.message) return;

      const { Booking } = require('../models');
      const booking = await Booking.findById(data.bookingId)
        .select('customerId providerId status')
        .lean();

      if (!booking) return socket.emit('chat:error', { message: 'Booking not found' });
      if (!['accepted', 'in_progress'].includes(booking.status)) {
        return socket.emit('chat:error', { message: 'Chat not available at this stage' });
      }

      // Verify sender is part of this booking
      const isParticipant =
        booking.customerId.toString() === userId ||
        booking.providerId?.toString() === userId;
      if (!isParticipant) return;

      const message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        bookingId: data.bookingId,
        senderId: userId,
        senderRole: userRole,
        message: data.message.substring(0, 500), // Limit message length
        type: data.type || 'text',
        timestamp: new Date().toISOString(),
      };

      // Store last 50 messages in Redis
      const chatKey = `chat:${data.bookingId}`;
      const client = getRedisClient();
      if (client) {
        await client.rPush(chatKey, JSON.stringify(message));
        await client.lTrim(chatKey, -50, -1); // Keep last 50 messages
        await client.expire(chatKey, 7 * 24 * 60 * 60); // 7 day TTL
      } else {
        logger.warn(`Redis is offline, skipped storing chat message in cache`);
      }

      // Broadcast to both parties
      io.to(`user:${booking.customerId}`).emit('chat:message', message);
      if (booking.providerId) {
        io.to(`provider:${booking.providerId}`).emit('chat:message', message);
      }
    });

    /**
     * Get chat history
     */
    socket.on('chat:history', async ({ bookingId }) => {
      const chatKey = `chat:${bookingId}`;
      const client = getRedisClient();
      let messages = [];
      if (client) {
        try {
          messages = await client.lRange(chatKey, 0, -1);
        } catch (err) {
          logger.warn('Failed to retrieve chat history from Redis:', err.message);
        }
      }
      const parsed = messages.map((m) => {
        try { return JSON.parse(m); } catch { return null; }
      }).filter(Boolean);

      socket.emit('chat:history', { bookingId, messages: parsed });
    });

    // ── Typing Indicators ────────────────────────────────────────────────────────
    socket.on('chat:typing', async ({ bookingId, isTyping }) => {
      const { Booking } = require('../models');
      const booking = await Booking.findById(bookingId).select('customerId providerId').lean();
      if (!booking) return;

      const targetId = userId === booking.customerId.toString()
        ? `provider:${booking.providerId}`
        : `user:${booking.customerId}`;

      io.to(targetId).emit('chat:typing', { userId, isTyping });
    });

    // ── Admin Events ─────────────────────────────────────────────────────────────
    socket.on('admin:join_dashboard', () => {
      if (userRole !== 'admin') return;
      socket.join('admin:dashboard');
    });

    // ── Disconnect ───────────────────────────────────────────────────────────────
    socket.on('disconnect', async (reason) => {
      logger.debug(`Socket disconnected: ${userId} - ${reason}`);
      if (userRole === 'provider') {
        const client = getRedisClient();
        if (client) {
          await client.del(`provider_online:${userId}`).catch(() => {});
        }
      }
    });

    // ── Error Handler ─────────────────────────────────────────────────────────────
    socket.on('error', (err) => {
      logger.error(`Socket error for user ${userId}:`, err);
    });
  });

  // ── Admin real-time metrics (broadcast every 30s) ─────────────────────────────
  setInterval(async () => {
    const adminSockets = await io.in('admin:dashboard').fetchSockets();
    if (adminSockets.length === 0) return;

    const { Booking, Provider } = require('../models');
    const [activeBookings, onlineProviders] = await Promise.all([
      Booking.countDocuments({ status: { $in: ['pending', 'assigned', 'accepted', 'in_progress'] } }),
      Provider.countDocuments({ isOnline: true }),
    ]);

    io.to('admin:dashboard').emit('admin:metrics', {
      activeBookings,
      onlineProviders,
      timestamp: new Date().toISOString(),
    });
  }, 30000);

  logger.info('Socket.io server initialized');
  return io;
}

async function handleProviderConnect(socket) {
  // 1. Check Redis cache first for pending booking request
  let pendingBooking = await cache.get(`pending_booking:provider:${socket.userId}`);
  
  if (!pendingBooking) {
    // 2. Fallback: Check MongoDB for any assigned job awaiting acceptance
    try {
      const { Booking } = require('../models');
      const assignedJob = await Booking.findOne({
        providerId: socket.userId,
        status: 'assigned',
      }).populate('serviceId', 'name category icon basePrice').lean();

      if (assignedJob) {
        pendingBooking = {
          bookingId: assignedJob._id,
          bookingNumber: assignedJob.bookingNumber,
          service: assignedJob.serviceId,
          scheduledDate: assignedJob.scheduledDate,
          timeSlot: assignedJob.timeSlot,
          address: {
            city: assignedJob.serviceAddress?.city,
            area: assignedJob.serviceAddress?.line1 || assignedJob.serviceAddress?.area,
          },
          distanceKm: 5,
          estimatedEarnings: assignedJob.providerEarnings,
          acceptTimeoutSeconds: 120,
        };
        await cache.set(`pending_booking:provider:${socket.userId}`, pendingBooking, 120);
      }
    } catch (err) {
      logger.warn('[SocketConnect] Error checking assigned jobs for provider:', err.message);
    }
  }

  if (pendingBooking && pendingBooking.bookingId) {
    // Prevent duplicate popups & sirens if provider already saw this request during page navigation
    const isAlreadySeen = await cache.get(`seen_booking:${socket.userId}:${pendingBooking.bookingId}`);
    if (!isAlreadySeen) {
      await cache.set(`seen_booking:${socket.userId}:${pendingBooking.bookingId}`, true, 300);
      socket.emit('booking:new_request', pendingBooking);
      logger.info(`📢 Provider ${socket.userId} connected — popped initial booking ${pendingBooking.bookingNumber}`);
    } else {
      logger.info(`⏩ Provider ${socket.userId} connected — booking ${pendingBooking.bookingNumber} already seen, suppressing duplicate popup.`);
    }
  }
}

function getIO() {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

/**
 * Emit to a specific user from outside socket context
 */
function emitToUser(userId, event, data) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

function emitToProvider(providerId, event, data) {
  if (!io) return;
  io.to(`provider:${providerId}`).emit(event, data);
}

function emitToAdmin(event, data) {
  if (!io) return;
  io.to('admin').emit(event, data);
}

module.exports = { initSocket, getIO, emitToUser, emitToProvider, emitToAdmin };
