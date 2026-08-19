'use strict';
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Joi = require('joi');
const { User, Provider } = require('../../models');
const { cache } = require('../../config/redis');
const { AppError } = require('../../utils/errors');
const { validateBody } = require('../../middleware/validate');
const { getFirebaseAdmin } = require('../../services/firebase.service');
const logger = require('../../utils/logger');

const router = express.Router();

// ── Validation Schemas ─────────────────────────────────────────────────────────
const firebaseLoginSchema = Joi.object({
  idToken: Joi.string().required(),
  role: Joi.string().valid('customer', 'provider').default('customer'),
  name: Joi.string().min(2).max(100).optional(),
  referralCode: Joi.string().optional(),
});

const googleAuthSchema = Joi.object({
  idToken: Joi.string().required(),
});

const completeRegSchema = Joi.object({
  idToken: Joi.string().required(),
  phone: Joi.string().required(),
  role: Joi.string().valid('customer', 'provider').optional(),
  name: Joi.string().min(2).max(100).optional(),
  referralCode: Joi.string().optional(),
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

// ── Helpers ────────────────────────────────────────────────────────────────────
function normalizeAndValidateIndianPhone(phoneNumber) {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    throw new AppError('Enter a valid 10-digit Indian mobile number.', 400);
  }
  const str = phoneNumber.trim();
  if (/[a-zA-Z]/.test(str)) {
    throw new AppError('Enter a valid 10-digit Indian mobile number.', 400);
  }
  const digitsOnly = str.replace(/\D/g, '');
  let normalized = digitsOnly;
  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    normalized = digitsOnly.slice(2);
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    normalized = digitsOnly.slice(1);
  }

  if (!/^[6-9]\d{9}$/.test(normalized)) {
    throw new AppError('Enter a valid 10-digit Indian mobile number.', 400);
  }
  return normalized;
}

async function verifyFirebaseToken(idToken) {
  // Support local dev testing bypass token when not running in strict production
  if (idToken && typeof idToken === 'string' && idToken.startsWith('dev-bypass-login-') && process.env.NODE_ENV !== 'production') {
    const raw = idToken.replace('dev-bypass-login-', '');
    const isGoogle = raw.startsWith('G-');
    return {
      firebaseUid: `dev-uid-${raw}`,
      phone: isGoogle ? null : (raw.length === 10 ? raw : null),
      email: isGoogle ? `${raw.toLowerCase()}@dev.local` : null,
      name: isGoogle ? 'Dev Google User' : 'Dev User',
      avatar: isGoogle ? 'https://lh3.googleusercontent.com/a/default-user' : null,
    };
  }

  const admin = getFirebaseAdmin();
  if (!admin) {
    throw new AppError('Firebase authentication is not configured on the server', 503);
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return {
      firebaseUid: decoded.uid,
      phone: decoded.phone_number ? normalizeAndValidateIndianPhone(decoded.phone_number) : null,
      email: decoded.email || null,
      name: decoded.name || decoded.displayName || null,
      avatar: decoded.picture || decoded.photoURL || null,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.warn('Firebase ID token verification failed:', err.message);
    throw new AppError('Your Google session has expired. Please sign in again.', 401);
  }
}

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

async function formatUserResponse(user) {
  let providerStatus = user.providerApplicationStatus || 'none';
  let providerId = null;

  const provider = await Provider.findOne({ userId: user._id }).select('_id approvalStatus kyc.rejectionReason').lean();
  if (provider) {
    providerId = provider._id.toString();
    if (user.role === 'provider') {
      providerStatus = provider.approvalStatus;
    } else {
      providerStatus = user.providerApplicationStatus || provider.approvalStatus || 'none';
    }
  }

  return {
    id: user._id,
    firebaseUid: user.firebaseUid,
    phone: user.phone || null,
    name: user.name || '',
    email: user.email || '',
    avatar: user.avatar || '',
    photoURL: user.avatar || '',
    role: user.role, // 'customer' or 'provider' or 'admin' / 'staff'
    status: user.status || 'active',
    providerApplicationStatus: user.providerApplicationStatus || providerStatus,
    providerStatus: providerStatus,
    providerId: providerId,
    rejectionReason: user.rejectionReason || provider?.kyc?.rejectionReason || null,
    permissions: user.permissions || [],
    walletBalance: user.walletBalance || 0,
    isPlusMember: Boolean(user.subscription?.isPlusMember),
    subscription: user.subscription,
  };
}

// ── Routes ─────────────────────────────────────────────────────────────────────

/**
 * GET /auth/check-phone
 * Checks whether a given Indian mobile number is available or already registered.
 */
router.get('/check-phone', async (req, res) => {
  const { phone } = req.query;
  if (!phone || typeof phone !== 'string') {
    throw new AppError('Enter a valid 10-digit Indian mobile number.', 400);
  }
  const normalizedPhone = normalizeAndValidateIndianPhone(phone);
  const existingPhoneUser = await User.findOne({ phone: normalizedPhone });
  if (existingPhoneUser) {
    return res.status(409).json({
      success: false,
      available: false,
      code: 'PHONE_ALREADY_EXISTS',
      error: 'This mobile number is already registered with another OneWayFix account.',
      message: 'This mobile number is already registered with another OneWayFix account.'
    });
  }
  return res.json({
    success: true,
    available: true,
    message: 'Mobile number is available.'
  });
});

/**
 * POST /auth/google-authenticate
 * Authenticates Firebase Google OAuth Token.
 * Existing user with phone -> returns user info & tokens immediately.
 * Existing user without phone -> returns needsPhone: true.
 * New user -> returns isNewUser: true & needsPhone: true.
 */
router.post('/google-authenticate', validateBody(googleAuthSchema), async (req, res) => {
  const { idToken } = req.body;
  const fbUser = await verifyFirebaseToken(idToken);
  const { firebaseUid, email, name, avatar } = fbUser;

  // Search existing user by firebaseUid OR email
  let user = await User.findOne({
    $or: [
      { firebaseUid },
      ...(email ? [{ email }] : [])
    ]
  });

  if (!user) {
    return res.json({
      success: true,
      isNewUser: true,
      needsPhone: true,
      firebaseUser: {
        firebaseUid,
        email: email || '',
        name: name || '',
        avatar: avatar || '',
      }
    });
  }

  if (user.isBlocked || user.status === 'blocked') {
    throw new AppError('Your account has been blocked. Contact support.', 403);
  }

  // Auto-link Google credentials to existing account if missing
  let updated = false;
  if (!user.firebaseUid) { user.firebaseUid = firebaseUid; updated = true; }
  if (!user.email && email) { user.email = email; updated = true; }
  if (!user.name && name) { user.name = name; updated = true; }
  if (!user.avatar && avatar) { user.avatar = avatar; updated = true; }
  if (updated) await user.save();

  const formattedUser = await formatUserResponse(user);

  // Existing user missing phone number
  if (!user.phone) {
    // Staff and Admin roles hired via email do not require mandatory phone collection
    if (['staff', 'manager', 'team_leader', 'executive', 'technician', 'admin', 'intern'].includes(user.role)) {
      const targetId = user._id;
      const tokens = generateTokens(targetId, user.role);
      await storeRefreshToken(targetId, tokens.sessionId, tokens.refreshToken);

      return res.json({
        success: true,
        isNewUser: false,
        needsPhone: false,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: formattedUser,
      });
    }

    return res.json({
      success: true,
      isNewUser: false,
      needsPhone: true,
      user: formattedUser,
      firebaseUser: {
        firebaseUid,
        email: user.email || email || '',
        name: user.name || name || '',
        avatar: user.avatar || avatar || '',
      }
    });
  }

  const targetId = user.role === 'provider' && formattedUser.providerId ? formattedUser.providerId : user._id;
  const tokens = generateTokens(targetId, user.role);
  await storeRefreshToken(targetId, tokens.sessionId, tokens.refreshToken);

  return res.json({
    success: true,
    isNewUser: false,
    needsPhone: false,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: formattedUser,
  });
});

/**
 * POST /auth/complete-registration
 * Completes registration for new user or saves missing phone number for existing user.
 */
router.post('/complete-registration', validateBody(completeRegSchema), async (req, res) => {
  const { idToken, phone, role, name, referralCode } = req.body;
  const fbUser = await verifyFirebaseToken(idToken);
  const { firebaseUid, email, avatar } = fbUser;
  const displayName = name?.trim() || fbUser.name || '';

  // 1. Validate & Normalize Indian Mobile Number
  const normalizedPhone = normalizeAndValidateIndianPhone(phone);

  // 2. Search existing user by firebaseUid OR email
  let user = await User.findOne({
    $or: [
      { firebaseUid },
      ...(email ? [{ email }] : [])
    ]
  });

  // 3. Check for Duplicate Mobile Number across all registered users
  const existingPhoneUser = await User.findOne({
    phone: normalizedPhone,
    ...(user ? { _id: { $ne: user._id } } : {})
  });

  if (existingPhoneUser) {
    return res.status(409).json({
      success: false,
      code: 'PHONE_ALREADY_EXISTS',
      error: 'This mobile number is already registered with another OneWayFix account.',
      message: 'This mobile number is already registered with another OneWayFix account.'
    });
  }

  let isNewUser = false;
  if (!user) {
    // New registration: strictly validate role
    if (!role || !['customer', 'provider'].includes(role)) {
      throw new AppError('Public registration only permits Customer or Provider account selection.', 400);
    }
    isNewUser = true;
    user = new User({
      phone: normalizedPhone,
      firebaseUid,
      email: email || undefined,
      name: displayName,
      avatar: avatar || undefined,
      role: role,
      status: 'active',
      referralCode: `REF${normalizedPhone.slice(-4)}${Date.now().toString(36).toUpperCase()}`
    });
    await user.save();
  } else {
    // Existing user saving missing phone number
    user.phone = normalizedPhone;
    if (role && ['customer', 'provider'].includes(role)) {
      user.role = role;
    }
    if (!user.firebaseUid) user.firebaseUid = firebaseUid;
    if (displayName && !user.name) user.name = displayName;
    await user.save();
  }

  let providerRecord = null;
  const targetRole = user.role;

  if (targetRole === 'provider') {
    providerRecord = await Provider.findOne({ userId: user._id });
    if (!providerRecord) {
      providerRecord = await Provider.create({
        userId: user._id,
        phone: normalizedPhone,
        email: email || undefined,
        name: displayName || 'Service Provider',
        avatar: avatar || undefined,
        approvalStatus: 'pending',
        currentLocation: { type: 'Point', coordinates: [0, 0] }
      });
    } else {
      let updatedProvider = false;
      if (!providerRecord.phone) { providerRecord.phone = normalizedPhone; updatedProvider = true; }
      if (!providerRecord.email && email) { providerRecord.email = email; updatedProvider = true; }
      if (updatedProvider) await providerRecord.save();
    }
  }

  // Handle referral reward for new customer
  if (referralCode && isNewUser && targetRole === 'customer') {
    const referrer = await User.findOne({ referralCode });
    if (referrer && referrer._id.toString() !== user._id.toString()) {
      user.referredBy = referrer._id;
      await user.save();
      try {
        const { notificationQueue } = require('../../jobs');
        notificationQueue.add('referral_reward', { referrerId: referrer._id, newUserId: user._id });
      } catch (e) {
        logger.warn('Failed to queue referral reward:', e.message);
      }
    }
  }

  const formattedUser = await formatUserResponse(user);
  const targetId = targetRole === 'provider' && providerRecord ? providerRecord._id : user._id;
  const tokens = generateTokens(targetId, targetRole);
  await storeRefreshToken(targetId, tokens.sessionId, tokens.refreshToken);

  return res.json({
    success: true,
    isNewUser,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: formattedUser,
  });
});

/**
 * POST /auth/firebase-login (Backward Compatible Phone OTP / General Firebase Login)
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

  // Search existing account by phone, email, OR firebaseUid
  let user = await User.findOne({
    $or: [
      ...(phone ? [{ phone }] : []),
      ...(email ? [{ email }] : []),
      { firebaseUid }
    ]
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
      role: role || 'customer',
      referralCode: `REF${phone ? phone.slice(-4) : Date.now().toString(36).toUpperCase()}`
    });
  } else {
    if (!user.firebaseUid) user.firebaseUid = firebaseUid;
    if (!user.name && displayName) user.name = displayName;
    if (!user.email && email) user.email = email;
    if (!user.avatar && avatar) user.avatar = avatar;
    if (user.phone && user.phone.startsWith('G-') && phone && !phone.startsWith('G-')) {
      user.phone = phone;
    }
  }

  if (user.isBlocked) {
    throw new AppError('Your account has been blocked. Contact support.', 403);
  }

  await user.save();

  let provider = null;
  if (role === 'provider' || user.role === 'provider') {
    provider = await Provider.findOne({ userId: user._id });
    if (!provider) {
      provider = await Provider.create({
        userId: user._id,
        phone,
        email,
        avatar,
        name: displayName || `Provider_${phone ? phone.slice(-4) : 'User'}`,
        approvalStatus: 'pending',
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
  }

  if (referralCode && isNewUser && user.role === 'customer') {
    const referrer = await User.findOne({ referralCode });
    if (referrer && referrer._id.toString() !== user._id.toString()) {
      user.referredBy = referrer._id;
      await user.save();
      const { notificationQueue } = require('../../jobs');
      notificationQueue.add('referral_reward', { referrerId: referrer._id, newUserId: user._id });
    }
  }

  const formattedUser = await formatUserResponse(user);
  const targetId = user.role === 'provider' && provider ? provider._id : user._id;
  const tokens = generateTokens(targetId, user.role);
  await storeRefreshToken(targetId, tokens.sessionId, tokens.refreshToken);

  res.json({
    success: true,
    isNewUser,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: formattedUser,
  });
});

/**
 * POST /auth/link-google-account
 * Allows an existing phone user to securely link their Google account.
 */
router.post('/link-google-account', authenticate, async (req, res) => {
  const { googleIdToken } = req.body;
  if (!googleIdToken) throw new AppError('Google ID token is required', 400);

  const googleUser = await verifyFirebaseToken(googleIdToken);
  const user = await User.findById(req.userId);
  if (!user) throw new AppError('User not found', 404);

  // Check if Google account is linked to another user
  const existingGoogleUser = await User.findOne({
    _id: { $ne: user._id },
    $or: [
      { firebaseUid: googleUser.firebaseUid },
      ...(googleUser.email ? [{ email: googleUser.email }] : [])
    ]
  });

  if (existingGoogleUser) {
    throw new AppError('This Google account is already linked to another OneWayFix user account.', 400);
  }

  user.firebaseUid = googleUser.firebaseUid;
  if (googleUser.email && !user.email) user.email = googleUser.email;
  if (googleUser.avatar && !user.avatar) user.avatar = googleUser.avatar;
  if (googleUser.name && !user.name) user.name = googleUser.name;
  await user.save();

  if (user.role === 'provider' || req.isProvider) {
    await Provider.findOneAndUpdate(
      { userId: user._id },
      { email: user.email, avatar: user.avatar, name: user.name }
    );
  }

  const formattedUser = await formatUserResponse(user);
  res.json({
    success: true,
    message: 'Google account linked successfully!',
    user: formattedUser,
  });
});

/**
 * GET /auth/me
 * Returns current authenticated user profile with latest role & providerApplicationStatus.
 */
router.get('/me', authenticate, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw new AppError('User not found', 404);
  const formattedUser = await formatUserResponse(user);
  res.json({ success: true, data: formattedUser, user: formattedUser });
});

/**
 * POST /auth/become-provider (Provider Application Submission)
 * Customer applies to become a Service Provider.
 * Account REMAINS 'customer' until Admin approves! Status becomes 'pending'.
 */
router.post('/become-provider', authenticate, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw new AppError('User not found', 404);

  if (user.role === 'provider' && user.providerApplicationStatus === 'approved') {
    throw new AppError('Account is already an approved Service Provider profile.', 400);
  }

  const { name, experience, serviceRadius, services, city, bankAccount, aadhaarNumber, panNumber } = req.body || {};

  let provider = await Provider.findOne({ userId: user._id });
  if (!provider) {
    provider = await Provider.create({
      userId: user._id,
      phone: user.phone,
      email: user.email,
      name: name || user.name || 'Service Provider',
      avatar: user.avatar,
      experience: Number(experience) || 0,
      serviceRadius: Number(serviceRadius) || 10,
      city: city || user.city,
      approvalStatus: 'pending',
      kyc: {
        status: 'submitted',
        aadhaarNumber: aadhaarNumber || undefined,
        panNumber: panNumber || undefined,
      },
      currentLocation: { type: 'Point', coordinates: [0, 0] }
    });
  } else {
    provider.approvalStatus = 'pending';
    if (!provider.kyc) provider.kyc = {};
    provider.kyc.status = 'submitted';
    provider.kyc.rejectionReason = undefined;
    if (name) provider.name = name;
    if (experience !== undefined) provider.experience = Number(experience);
    if (serviceRadius !== undefined) provider.serviceRadius = Number(serviceRadius);
    if (city) provider.city = city;
    if (services && Array.isArray(services)) provider.services = services;
    if (bankAccount) {
      provider.earnings = provider.earnings || {};
      provider.earnings.bankAccount = { ...provider.earnings.bankAccount, ...bankAccount };
    }
    if (aadhaarNumber) provider.kyc.aadhaarNumber = aadhaarNumber;
    if (panNumber) provider.kyc.panNumber = panNumber;
    await provider.save();
  }

  // Preserve user account as CUSTOMER until admin approval!
  user.providerApplicationStatus = 'pending';
  user.providerApplicationId = provider._id;
  user.rejectionReason = null;
  await user.save();

  const formattedUser = await formatUserResponse(user);

  res.json({
    success: true,
    message: 'Application submitted successfully. Our verification team will review your profile.',
    user: formattedUser,
  });
});

router.post('/send-otp', (req, res) => {
  res.status(410).json({
    success: false,
    error: 'Server OTP SMS has been removed. Use Firebase authentication.',
  });
});

router.post('/verify-otp', (req, res) => {
  res.status(410).json({
    success: false,
    error: 'Server OTP verification has been removed. Use /auth/google-authenticate or /auth/firebase-login.',
  });
});

/**
 * POST /auth/refresh
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
 */
router.post('/plus', authenticate, async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, planMonths = 6, paymentMethod = 'online' } = req.body;

  const SystemSettingsModel = require('../../models').SystemSettings || mongoose.model('SystemSettings');
  const globalSettings = await SystemSettingsModel.findOne({ key: 'global' });
  if (globalSettings && globalSettings.subscriptionModelActive === false) {
    throw new AppError('Subscriptions are currently disabled by the Administrator.', 400);
  }

  const user = await User.findById(req.userId);
  if (!user) throw new AppError('User not found', 404);

  const months = Math.min(Math.max(parseInt(planMonths) || 6, 1), 12);
  const planPrice = months === 12 ? (globalSettings?.plusPrice1Year || 499) : (globalSettings?.plusPrice6Months || 299);

  if (paymentMethod === 'wallet') {
    if ((user.walletBalance || 0) < planPrice) {
      throw new AppError(`Insufficient wallet balance (₹${user.walletBalance || 0}). Plan price is ₹${planPrice}.`, 400);
    }
    user.walletBalance = (user.walletBalance || 0) - planPrice;
  } else if (razorpayOrderId && razorpayPaymentId && razorpaySignature) {
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
  const formattedUser = await formatUserResponse(user);

  res.json({
    success: true,
    message: `Welcome to ServiceHub Plus! Active for ${months} months.`,
    user: formattedUser,
  });
});

/**
 * PUT /auth/profile
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

  const formattedUser = await formatUserResponse(user);
  res.json({
    success: true,
    message: 'Profile updated successfully',
    user: formattedUser,
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
      logger.debug('Logout token check ignored:', e.message);
    }
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

// ── Auth Middleware ────────────────────────────────────────────────────────────
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('Authentication required', 401);
    }
    const token = authHeader.split(' ')[1];

    const isBlacklisted = await cache.get(`blacklist:${token}`);
    if (isBlacklisted) throw new AppError('Token has been revoked', 401);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    req.userRole = decoded.role;

    if (decoded.role === 'staff' || decoded.role === 'admin') {
      User.findByIdAndUpdate(decoded.userId, { isOnline: true, lastActiveAt: new Date() }).exec().catch(() => {});
      const staffUser = await User.findById(decoded.userId).select('role permissions name email phone').lean();
      req.user = staffUser || { role: decoded.role, permissions: [] };
    } else {
      req.user = { id: decoded.userId, role: decoded.role, permissions: [] };
    }

    if (decoded.role === 'provider') {
      req.providerId = decoded.userId;
      req.isProvider = true;
    } else {
      const provider = await Provider.findOne({ userId: decoded.userId }).select('_id approvalStatus').lean();
      if (provider) {
        req.providerId = provider._id.toString();
        req.isProvider = (provider.approvalStatus === 'approved');
      } else {
        req.isProvider = false;
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
    // Both 'customer' and 'provider' roles can access customer routes!
    const isAllowed = roles.includes(req.userRole) ||
                      (roles.includes('customer') && (req.userRole === 'provider' || req.userRole === 'customer')) ||
                      (roles.includes('provider') && (req.userRole === 'provider' || req.isProvider));
    if (!isAllowed) {
      return next(new AppError('You are not authorized to access this feature.', 403));
    }
    next();
  };
}

async function requireProviderApproval(req, res, next) {
  try {
    if (req.userRole !== 'provider' && req.userRole !== 'admin' && req.userRole !== 'staff') {
      return next(new AppError('Unauthorized: Provider account required', 403));
    }
    const provider = await Provider.findOne({ userId: req.userId }).select('approvalStatus isBlocked').lean();
    if (!provider) {
      return next(new AppError('Provider profile not found', 404));
    }
    if (provider.isBlocked) {
      return next(new AppError('Your provider account has been blocked or suspended by administrator.', 403));
    }
    if (provider.approvalStatus !== 'approved' && req.userRole !== 'admin') {
      return next(new AppError(`Provider access restricted. Account verification status: ${provider.approvalStatus}. Admin approval required.`, 403));
    }
    req.provider = provider;
    next();
  } catch (err) {
    next(err);
  }
}

function requirePermission(permission) {
  return async (req, res, next) => {
    if (req.userRole === 'admin') return next();
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
module.exports.requireProviderApproval = requireProviderApproval;
module.exports.requirePermission = requirePermission;
