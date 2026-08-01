'use strict';
const express = require('express');
const jwt = require('jsonwebtoken');
const { User, Provider } = require('../../models');
const { cache } = require('../../config/redis');
const { AppError } = require('../../utils/errors');
const { validateBody } = require('../../middleware/validate');
const { getFirebaseAdmin } = require('../../services/firebase.service');
const logger = require('../../utils/logger');
const Joi = require('joi');

const router = express.Router();

// ── Validation Schemas ─────────────────────────────────────────────────────────
const firebaseLoginSchema = Joi.object({
  idToken: Joi.string().required(),
  role: Joi.string().valid('customer', 'provider').default('customer'),
  name: Joi.string().min(2).max(100).optional(),
  referralCode: Joi.string().optional(),
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

// ── OTP Helpers ────────────────────────────────────────────────────────────────
function normalizeIndianPhone(phoneNumber) {
  const digits = String(phoneNumber || '').replace(/\D/g, '');
  const phone = digits.length === 12 && digits.startsWith('91')
    ? digits.slice(2)
    : digits.slice(-10);

  if (!/^[6-9]\d{9}$/.test(phone)) {
    throw new AppError('Firebase phone number must be a valid 10-digit Indian mobile number', 400);
  }
  return phone;
}
async function verifyFirebaseToken(idToken) {
  // Support local dev testing bypass token when not running in strict production
  if (idToken && typeof idToken === 'string' && idToken.startsWith('dev-bypass-login-') && process.env.NODE_ENV !== 'production') {
    const rawPhone = idToken.replace('dev-bypass-login-', '');
    const isGoogle = rawPhone.startsWith('G-');
    const phone = isGoogle ? rawPhone : (rawPhone.length === 10 ? rawPhone : normalizeIndianPhone(rawPhone));
    return {
      firebaseUid: `dev-uid-${phone}`,
      phone: phone,
      email: isGoogle ? `${phone.toLowerCase()}@dev.local` : undefined,
      name: isGoogle ? 'Dev User' : undefined,
    };
  }

  const admin = getFirebaseAdmin();
  if (!admin) {
    throw new AppError('Firebase authentication is not configured on the server', 503);
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    if (!decoded.phone_number && !decoded.email) {
      throw new AppError('Firebase token does not include phone or email', 400);
    }
    
    let phone;
    if (decoded.phone_number) {
      phone = normalizeIndianPhone(decoded.phone_number);
    } else {
      phone = `G-${decoded.uid.substring(0, 8)}`;
    }

    return {
      firebaseUid: decoded.uid,
      phone: phone,
      email: decoded.email,
      name: decoded.name,
      avatar: decoded.picture,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.warn('Firebase ID token verification failed:', err.message);
    throw new AppError('Invalid or expired Firebase authentication token', 401);
  }
}

// ── JWT Helpers ────────────────────────────────────────────────────────────────
const crypto = require('crypto');

function generateTokens(userId, role, sessionId = crypto.randomUUID()) {
  const accessToken = jwt.sign(
    { userId, role, sessionId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
  const refreshToken = jwt.sign(
    { userId, role, type: 'refresh', sessionId },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh',
    { expiresIn: '30d' }
  );
  return { accessToken, refreshToken, sessionId };
}

async function storeRefreshToken(userId, sessionId, refreshToken) {
  await cache.set(`refresh:${userId}:${sessionId}`, refreshToken, 30 * 24 * 60 * 60);
}

// ── Routes ─────────────────────────────────────────────────────────────────────

/**
 * POST /auth/firebase-login
 */
router.post('/firebase-login', validateBody(firebaseLoginSchema), async (req, res) => {
  const { idToken, role, name, referralCode } = req.body;
  let phone, firebaseUid, email, avatar, displayName;

  if (idToken.startsWith('dev-bypass-login-')) {
    if (process.env.NODE_ENV === 'production') {
      throw new AppError('Development bypass authentication is disabled in production', 403);
    }
    phone = idToken.replace('dev-bypass-login-', '');
    firebaseUid = `dev-uid-${phone}`;
    email = `dev-${phone}@servicehub.local`;
    avatar = null;
    displayName = name || `Dev_${phone.slice(-4)}`;
  } else {
    const firebaseUser = await verifyFirebaseToken(idToken);
    phone = firebaseUser.phone;
    firebaseUid = firebaseUser.firebaseUid;
    email = firebaseUser.email;
    avatar = firebaseUser.avatar;
    displayName = name || firebaseUser.name;
  }

  if (role === 'provider' && phone.startsWith('G-')) {
    throw new AppError('Providers must sign up using phone number authentication, not just Google.', 400);
  }

  // Cross-Identity Linking logic: search by phone, email, OR firebaseUid
  let user = await User.findOne({ 
    $or: [{ phone }, ...(email ? [{ email }] : []), { firebaseUid }] 
  });

  let isNewUser = false;
  
  if (!user) {
    isNewUser = true;
    user = new User({
      phone,
      firebaseUid,
      email,
      avatar,
      name: displayName || '',
      role: 'customer',
      referralCode: `REF${phone.slice(-4)}${Date.now().toString(36).toUpperCase()}`
    });
  } else {
    // Check if we need to link data
    if (!user.firebaseUid) user.firebaseUid = firebaseUid;
    if (!user.name && displayName) user.name = displayName;
    if (!user.email && email) user.email = email;
    if (!user.avatar && avatar) user.avatar = avatar;
    // Upgrade mock Google phone if user is linking to a real Phone Auth identity
    if (user.phone && user.phone.startsWith('G-') && !phone.startsWith('G-')) {
      user.phone = phone;
    }
  }

  if (user.isBlocked) {
    throw new AppError('Your account has been blocked. Contact support.', 403);
  }

  // Only does ONE save representing the entire unified profile update
  await user.save();

  if (role === 'provider') {
    let provider = await Provider.findOne({ userId: user._id });
    if (!provider) {
      provider = await Provider.create({
        userId: user._id,
        phone,
        email,
        avatar,
        name: displayName || `Provider_${phone.slice(-4)}`,
        currentLocation: { type: 'Point', coordinates: [0, 0] }
      });
      isNewUser = true;
    } else {
      let shouldSaveProvider = false;
      if (!provider.email && email) { provider.email = email; shouldSaveProvider = true; }
      if (!provider.avatar && avatar) { provider.avatar = avatar; shouldSaveProvider = true; }
      if (shouldSaveProvider) await provider.save();
    }
    
    if (provider.isBlocked) {
      throw new AppError('Your provider account is blocked. Contact support.', 403);
    }
    
    const tokens = generateTokens(provider._id, 'provider');
    await storeRefreshToken(provider._id, tokens.sessionId, tokens.refreshToken);
    
    return res.json({
      success: true,
      isNewUser,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: provider._id,
        phone: provider.phone,
        name: provider.name,
        role: 'provider',
        approvalStatus: provider.approvalStatus,
        avatar: provider.avatar,
      },
    });
  }

  // Handle referral reward for customers
  if (referralCode && isNewUser) {
    const referrer = await User.findOne({ referralCode });
    if (referrer && referrer._id.toString() !== user._id.toString()) {
      user.referredBy = referrer._id;
      await user.save();
      const { notificationQueue } = require('../../jobs');
      notificationQueue.add('referral_reward', { referrerId: referrer._id, newUserId: user._id });
    }
  }

  const tokens = generateTokens(user._id, user.role);
  await storeRefreshToken(user._id, tokens.sessionId, tokens.refreshToken);

  res.json({
    success: true,
    isNewUser,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: {
      id: user._id,
      phone: user.phone,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions || [],
      avatar: user.avatar,
      walletBalance: user.walletBalance,
      isPlusMember: user.subscription?.plan === 'premium',
    },
  });
});

router.post('/send-otp', (req, res) => {
  res.status(410).json({
    success: false,
    error: 'Server OTP SMS has been removed. Use Firebase phone authentication.',
  });
});

router.post('/verify-otp', (req, res) => {
  res.status(410).json({
    success: false,
    error: 'Server OTP verification has been removed. Use /auth/firebase-login with a Firebase ID token.',
  });
});

/**
 * POST /auth/refresh
 * Rotate refresh tokens for security
 */
router.post('/refresh', validateBody(refreshSchema), async (req, res) => {
  const { refreshToken } = req.body;
  try {
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh'
    );
    if (decoded.type !== 'refresh') throw new Error('Invalid token type');

    const sessionId = decoded.sessionId || 'legacy';
    const stored = await cache.get(`refresh:${decoded.userId}:${sessionId}`) || await cache.get(`refresh:${decoded.userId}`);
    if (stored !== refreshToken) {
      throw new AppError('Refresh token is invalid or has been revoked', 401);
    }

    const tokens = generateTokens(decoded.userId, decoded.role, sessionId);
    await storeRefreshToken(decoded.userId, sessionId, tokens.refreshToken);

    res.json({ success: true, ...tokens });
  } catch (err) {
    throw new AppError('Invalid or expired refresh token', 401);
  }
});

/**
 * POST /auth/plus
 * Activate ServiceHub Plus Membership
 * Checks system settings toggle, handles Razorpay / Wallet / UPI payment, and saves to DB.
 */
router.post('/plus', authenticate, async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, planMonths = 6, paymentMethod = 'online' } = req.body;

  // 1. Check System Settings toggle
  const SystemSettingsModel = require('../../models').SystemSettings || mongoose.model('SystemSettings');
  const globalSettings = await SystemSettingsModel.findOne({ key: 'global' });
  if (globalSettings && globalSettings.subscriptionModelActive === false) {
    throw new AppError('Subscriptions are currently disabled by the Administrator.', 400);
  }

  const user = await User.findById(req.userId);
  if (!user) throw new AppError('User not found', 404);

  const months = Math.min(Math.max(parseInt(planMonths) || 6, 1), 12);
  const planPrice = months === 12 ? (globalSettings?.plusPrice1Year || 499) : (globalSettings?.plusPrice6Months || 299);

  // 2. Handle Payment Verification
  if (paymentMethod === 'wallet') {
    if ((user.walletBalance || 0) < planPrice) {
      throw new AppError(`Insufficient wallet balance (₹${user.walletBalance || 0}). Plan price is ₹${planPrice}. Please add money to wallet.`, 400);
    }
    user.walletBalance = (user.walletBalance || 0) - planPrice;
  } else if (razorpayOrderId && razorpayPaymentId && razorpaySignature) {
    const crypto = require('crypto');
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (secret) {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      if (expectedSignature !== razorpaySignature) {
        logger.warn(`Plus activation: invalid signature for user ${req.userId}`);
        throw new AppError('Payment verification failed. Please contact support.', 400);
      }
    }
  }

  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + months);

  const planCode = months === 12 ? 'plus_12m' : 'plus_6m';
  user.subscription = {
    isPlusMember: true,
    plan: planCode,
    expiresAt,
    purchasedAt: new Date(),
    activatedVia: paymentMethod || razorpayPaymentId || 'online',
  };
  await user.save();

  logger.info(`ServiceHub Plus activated for user ${req.userId} (${months} months)`);

  res.json({
    success: true,
    message: `Welcome to ServiceHub Plus! Active for ${months} months.`,
    user: {
      id: user._id,
      phone: user.phone,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions || [],
      avatar: user.avatar,
      walletBalance: user.walletBalance,
      isPlusMember: true,
      subscription: user.subscription,
    }
  });
});

/**
 * PUT /auth/profile
 * Update logged-in user profile (Name, Email)
 */
router.put('/profile', authenticate, async (req, res) => {
  const { name, email } = req.body;
  if (!name || !name.trim()) throw new AppError('Name is required', 400);

  const user = await User.findById(req.userId);
  if (!user) throw new AppError('User not found', 404);

  user.name = name.trim();
  if (email !== undefined) user.email = email.trim();
  await user.save();

  if (user.role === 'provider' || req.isProvider) {
    await Provider.findOneAndUpdate({ userId: user._id }, { name: user.name, email: user.email });
  }

  res.json({
    success: true,
    message: 'Profile updated successfully',
    user: {
      id: user._id,
      phone: user.phone,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions || [],
      avatar: user.avatar,
      walletBalance: user.walletBalance,
      isPlusMember: user.subscription?.plan === 'premium',
    },
  });
});

/**
 * POST /auth/logout
 */
router.post('/logout', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded?.userId) {
        if (decoded.sessionId) {
          await cache.del(`refresh:${decoded.userId}:${decoded.sessionId}`);
        } else {
          await cache.del(`refresh:${decoded.userId}`);
        }
        
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await cache.set(`blacklist:${token}`, '1', ttl);
        }
      }
    } catch (e) {
      logger.debug('Logout with invalid/expired token — ignoring:', e.message);
    }
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

// ── Auth Middleware (exported for use in other routes) ─────────────────────────
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('Authentication required', 401);
    }
    const token = authHeader.split(' ')[1];

    // Check blacklist
    const isBlacklisted = await cache.get(`blacklist:${token}`);
    if (isBlacklisted) throw new AppError('Token has been revoked', 401);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    req.userRole = decoded.role;

    if (decoded.role === 'staff' || decoded.role === 'admin') {
      User.findByIdAndUpdate(decoded.userId, { isOnline: true, lastActiveAt: new Date() }).exec().catch(() => {});
    }

    if (decoded.role === 'provider') {
      req.providerId = decoded.userId;
      req.isProvider = true;
    } else {
      const provider = await Provider.findOne({ userId: decoded.userId }).select('_id').lean();
      if (provider) {
        req.providerId = provider._id.toString();
        req.isProvider = true;
      }
    }

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Token expired. Please refresh.', 401));
    }
    if (err.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token', 401));
    }
    next(err);
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    const hasRole = roles.includes(req.userRole) || (roles.includes('provider') && req.isProvider);
    if (!hasRole) {
      return next(new AppError('You are not authorized to perform this action', 403));
    }
    next();
  };
}

function requirePermission(permission) {
  return async (req, res, next) => {
    // Admin (Founder) has all permissions
    if (req.userRole === 'admin') return next();
    
    // Staff must have the specific permission
    if (req.userRole === 'staff') {
      const user = await User.findById(req.userId).select('permissions').lean();
      if (user && user.permissions && user.permissions.includes(permission)) {
        return next();
      }
    }
    
    return next(new AppError(`Permission denied: Requires ${permission}`, 403));
  };
}

module.exports = router;
module.exports.authenticate = authenticate;
module.exports.authorize = authorize;
module.exports.requirePermission = requirePermission;
