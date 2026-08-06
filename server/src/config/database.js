'use strict';
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const config = require('./scalability.config');

let retryCount = 0;
const MAX_RETRIES = 5;

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  const isAtlas = uri.startsWith('mongodb+srv://');
  const MONGOOSE_OPTIONS = {
    maxPoolSize: config.db.maxPoolSize,
    minPoolSize: config.db.minPoolSize,
    socketTimeoutMS: 45000,
    serverSelectionTimeoutMS: 10000,
    heartbeatFrequencyMS: config.db.heartbeatFrequencyMS,
    retryWrites: true,
    ...(!isAtlas && { directConnection: true }),
  };

  mongoose.set('strictQuery', true);

  // ── Connection event handlers ──────────────────────────────────────────────
  mongoose.connection.on('connected', () => {
    retryCount = 0;
    logger.info(`MongoDB connected: ${mongoose.connection.host}`);
  });

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected — attempting reconnect...');
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });

  // ── Connect with retry ─────────────────────────────────────────────────────
  return attemptConnection(uri, MONGOOSE_OPTIONS);
}

async function attemptConnection(uri, options) {
  try {
    await mongoose.connect(uri, options);
    await ensureIndexes();
  } catch (error) {
    retryCount++;
    if (retryCount <= MAX_RETRIES) {
      const delay = Math.min(1000 * 2 ** retryCount, 30000); // Exponential backoff, max 30s
      logger.warn(`MongoDB connection failed. Retry ${retryCount}/${MAX_RETRIES} in ${delay}ms`);
      await sleep(delay);
      return attemptConnection(uri, options);
    }
    throw new Error(`MongoDB connection failed after ${MAX_RETRIES} retries: ${error.message}`);
  }
}

async function ensureIndexes() {
  try {
    // ── Critical geo indexes for provider matching (Urban Company-style location assignment)
    const { Booking, Provider } = require('../models');

    // Booking: 2dsphere index on serviceAddress.location for geo queries
    await Booking.collection.createIndex(
      { 'serviceAddress.location': '2dsphere' },
      { background: true, name: 'booking_location_2dsphere' }
    );

    // Provider: 2dsphere index on currentLocation for nearby provider queries
    await Provider.collection.createIndex(
      { currentLocation: '2dsphere' },
      { background: true, name: 'provider_location_2dsphere' }
    );

    // Booking: compound index for status+date queries (admin dashboard)
    await Booking.collection.createIndex(
      { status: 1, scheduledDate: -1 },
      { background: true, name: 'booking_status_date' }
    );

    // Provider: Pan-India State & City filtering index (28 states scale)
    await Provider.collection.createIndex(
      { state: 1, city: 1, approvalStatus: 1, isOnline: 1 },
      { background: true, name: 'provider_state_city_online' }
    );

    // Booking: Pan-India State & City analytics index
    await Booking.collection.createIndex(
      { 'serviceAddress.state': 1, 'serviceAddress.city': 1, status: 1 },
      { background: true, name: 'booking_state_city_status' }
    );

    // Booking: customer and provider lookup indexes
    await Booking.collection.createIndex({ customerId: 1, createdAt: -1 }, { background: true });
    await Booking.collection.createIndex({ providerId: 1, status: 1 }, { background: true });

    logger.info('✅ MongoDB Pan-India geo & state indexes verified/created');
  } catch (indexErr) {
    logger.warn('⚠️  Index creation warning (non-fatal):', indexErr.message);
  }

  // Enable slow query logging in development
  if (process.env.NODE_ENV === 'development') {
    mongoose.set('debug', (collectionName, method, query, doc) => {
      logger.debug(`Mongoose [${collectionName}.${method}]`, { query, doc });
    });
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getDBStatus() {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return {
    state: states[mongoose.connection.readyState] || 'unknown',
    host: mongoose.connection.host,
    name: mongoose.connection.name,
    poolSize: mongoose.connection.pool?.size,
  };
}

module.exports = { connectDB, getDBStatus };
