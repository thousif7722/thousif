'use strict';
// ═══════════════════════════ rateLimiter.js ════════════════════════════════════
const rateLimit = require('express-rate-limit');

const rateLimitHandler = (req, res) => {
  res.status(429).json({
    success: false,
    error: 'Too many requests. Please slow down.',
    errorCode: 'RATE_LIMIT_EXCEEDED',
    retryAfter: 60,
  });
};

// ⚡ Bypass rate limiting completely for all Admin Panel & Staff operations
const skipAdmin = (req) => {
  const url = req.originalUrl || req.url || req.path || '';
  if (url.includes('/admin') || url.includes('/api/admin')) return true;
  if (req.user && (req.user.role === 'admin' || req.user.role === 'staff')) return true;
  return false;
};

// ── General API: 10,000 requests per minute (Admin completely exempt) ────────
const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipAdmin,
  handler: rateLimitHandler,
  keyGenerator: (req) => req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
});

// ── Auth endpoints: 1,000 attempts per 15 minutes (Admin exempt) ───────────────
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  skip: skipAdmin,
  handler: rateLimitHandler,
  keyGenerator: (req) => req.body?.phone || req.ip,
});

// ── OTP send: 100 per 15 minutes (Admin exempt) ────────────────────────────────
const otpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: skipAdmin,
  handler: rateLimitHandler,
  keyGenerator: (req) => `otp_req:${req.body?.phone || req.ip}`,
});

// ── Payment endpoints: 1,000 per minute (Admin exempt) ─────────────────────────
const paymentRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  skip: skipAdmin,
  handler: rateLimitHandler,
});

// ── Booking creation: 1,000 per minute (Admin exempt) ─────────────────────────
const bookingRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  skip: skipAdmin,
  handler: rateLimitHandler,
  keyGenerator: (req) => req.headers.authorization?.split(' ')[1]?.slice(-12) || req.ip,
});

module.exports = { apiRateLimiter, authRateLimiter, otpRateLimiter, paymentRateLimiter, bookingRateLimiter };
