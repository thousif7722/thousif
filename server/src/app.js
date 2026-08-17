'use strict';
require('dotenv').config();
require('express-async-errors');

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

const { connectDB } = require('./config/database');
const { connectRedis } = require('./config/redis');
const { initSocket } = require('./socket');
const { initQueues } = require('./jobs');
const logger = require('./utils/logger');
const { globalErrorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { apiRateLimiter, authRateLimiter } = require('./middleware/rateLimiter');

const Sentry = require('./config/sentry');

// ── Route Modules ──────────────────────────────────────────────────────────────
const authRoutes = require('./modules/auth/auth.routes');
const bookingRoutes = require('./modules/booking/booking.routes');
const paymentRoutes = require('./modules/payment/payment.routes');
const providerRoutes = require('./modules/provider/provider.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const complaintRoutes = require('./modules/complaint/complaint.routes');
const reviewRoutes = require('./modules/review/review.routes');
const notificationRoutes = require('./modules/notification/notification.routes');
const serviceRoutes = require('./modules/service/service.routes');
const attendanceRoutes = require('./modules/attendance/attendance.routes');
const hiringRoutes = require('./modules/hiring/hiring.routes');
const companyRoutes = require('./modules/company/company.routes');
const operationsRoutes = require('./modules/operations/operations.routes');

const app = express();
const httpServer = http.createServer(app);

// ── Sentry (must be first) ─────────────────────────────────────────────────────
Sentry.initRequestHandler(app);

// ── Security Middleware ────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'checkout.razorpay.com'],
      connectSrc: ["'self'", 'api.razorpay.com'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: (origin, callback) => {
    // Allow mobile apps, local web dev ports (3000, 5173, etc.) and cross-origin PWA requests
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key'],
}));

app.use(mongoSanitize());   // Prevent NoSQL injection
app.use(hpp());             // Prevent HTTP parameter pollution
app.use(compression());

// FIX #8: Apply global API rate limiter (was imported but never used)
app.use(apiRateLimiter);

// Add X-Request-ID for distributed tracing
app.use((req, res, next) => {
  const { randomUUID } = require('crypto');
  req.requestId = req.headers['x-request-id'] || randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

// ── Body Parsing ───────────────────────────────────────────────────────────────
// Raw body for Razorpay webhooks (must be before express.json())
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Logging ────────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', { stream: logger.stream }));
}

// ── Health Check ───────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({
  status: 'ok',
  timestamp: new Date().toISOString(),
  version: process.env.npm_package_version,
  uptime: process.uptime(),
}));

// ── SEO: robots.txt & Dynamic sitemap.xml ──────────────────────────────────────
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(
`User-agent: *
Allow: /
Disallow: /admin/
Disallow: /provider/
Disallow: /book/
Disallow: /bookings/
Disallow: /profile/
Disallow: /login
Disallow: /notifications/
Disallow: /api/

Sitemap: https://onewayfix.com/sitemap.xml`
  );
});

app.get('/sitemap.xml', async (req, res) => {
  try {
    const { Service } = require('./models');
    const services = await Service.find({ isActive: true }).select('slug updatedAt').lean();
    const baseUrl = 'https://onewayfix.com';

    const staticUrls = [
      { url: '/', priority: '1.0', changefreq: 'daily' },
      { url: '/privacy', priority: '0.3', changefreq: 'monthly' },
      { url: '/terms', priority: '0.3', changefreq: 'monthly' },
      { url: '/careers', priority: '0.5', changefreq: 'weekly' },
      { url: '/instructions', priority: '0.4', changefreq: 'monthly' },
    ];

    const serviceUrls = services.map(s => ({
      url: `/service/${s.slug || s._id}`,
      priority: '0.8',
      changefreq: 'weekly',
      lastmod: s.updatedAt ? new Date(s.updatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    }));

    const allUrls = [...staticUrls, ...serviceUrls];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    allUrls.forEach(item => {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}${item.url}</loc>\n`;
      if (item.lastmod) xml += `    <lastmod>${item.lastmod}</lastmod>\n`;
      xml += `    <changefreq>${item.changefreq}</changefreq>\n`;
      xml += `    <priority>${item.priority}</priority>\n`;
      xml += `  </url>\n`;
    });

    xml += `</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    logger.error('Error generating sitemap.xml:', err);
    res.status(500).send('Error generating sitemap');
  }
});

// ── Swagger Docs ───────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  try {
    const swaggerDoc = YAML.load('./src/docs/swagger.yaml');
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));
  } catch (e) {
    logger.warn('Swagger docs not loaded');
  }
}


// ── API Routes ─────────────────────────────────────────────────────────────────
const API = '/api/v1';
app.use(`${API}/auth/firebase-login`, authRateLimiter);
app.use(`${API}/auth`, authRoutes);
app.use(`${API}/services`, serviceRoutes);
app.use(`${API}/bookings`, bookingRoutes);
app.use(`${API}/payments`, paymentRoutes);
app.use(`${API}/providers`, providerRoutes);
app.use(`${API}/admin`, adminRoutes);
app.use(`${API}/complaints`, complaintRoutes);
app.use(`${API}/reviews`, reviewRoutes);
app.use(`${API}/notifications`, notificationRoutes);
app.use(`${API}/attendance`, attendanceRoutes);
app.use(`${API}/admin`, hiringRoutes);  // hiring: /admin/apply, /admin/candidates/*
app.use(`${API}/company`, companyRoutes);
app.use(`${API}/operations`, operationsRoutes);

// ── Sentry Error Handler ────────────────────────────────────────────────────────
Sentry.initErrorHandler(app);

// ── 404 + Global Error Handler ─────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(globalErrorHandler);

// ── Bootstrap ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

async function bootstrap() {
  // ── Security: Validate required secrets BEFORE starting ───────────────────
  if (process.env.NODE_ENV === 'production') {
    const REQUIRED_SECRETS = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'MONGODB_URI', 'RAZORPAY_KEY_SECRET'];
    const missing = REQUIRED_SECRETS.filter((key) => !process.env[key]);
    const hasFirebaseCredentials =
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
      process.env.FIREBASE_SERVICE_ACCOUNT ||
      process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!hasFirebaseCredentials) missing.push('FIREBASE_SERVICE_ACCOUNT');
    if (missing.length) {
      logger.error(`❌ FATAL: Missing required environment variables: ${missing.join(', ')}`);
      process.exit(1);
    }
    if (process.env.JWT_SECRET.length < 32) {
      logger.error('❌ FATAL: JWT_SECRET must be at least 32 characters. Generate with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
      process.exit(1);
    }
    if (process.env.JWT_REFRESH_SECRET.length < 32) {
      logger.error('❌ FATAL: JWT_REFRESH_SECRET must be at least 32 characters.');
      process.exit(1);
    }
    logger.info('✅ All required secrets present');
  }

  // ── MongoDB (non-fatal for local dev) ─────────────────────────────────────
  try {
    await connectDB();
    logger.info('✅ MongoDB connected');
  } catch (err) {
    logger.warn('⚠️  MongoDB unavailable — some features will not work:', err.message);
  }

  // ── Redis (non-fatal) ─────────────────────────────────────────────────────
  await connectRedis();

  // ── Socket.io ─────────────────────────────────────────────────────────────
  try {
    initSocket(httpServer);
    logger.info('✅ Socket.io initialized');
  } catch (err) {
    logger.warn('⚠️  Socket.io init failed:', err.message);
  }

  // ── BullMQ ────────────────────────────────────────────────────────────────
  try {
    initQueues();
    logger.info('✅ BullMQ queues initialized');
  } catch (err) {
    logger.warn('⚠️  BullMQ init failed:', err.message);
  }

  // ── Start HTTP server (always) ─────────────────────────────────────────────
  httpServer.listen(PORT, '0.0.0.0', () => {
    logger.info(`🚀 ServiceHub API running on http://0.0.0.0:${PORT} [${process.env.NODE_ENV}]`);
  });
}

// ── Graceful Shutdown ──────────────────────────────────────────────────────────
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received — shutting down gracefully...');
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
  Sentry.captureException(reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  Sentry.captureException(error);
  process.exit(1);
});

bootstrap();

module.exports = { app, httpServer };
