'use strict';
const express = require('express');
const multer = require('multer');
const { Provider, Booking, Payout, WalletLedger, Notification } = require('../../models');
const { authenticate, authorize } = require('../auth/auth.routes');
const { AppError } = require('../../utils/errors');
const { s3Service } = require('../../services/s3.service');
const { cache } = require('../../config/redis');
const { getLeastBusyStaff } = require('../../utils/assignment');
const { getIO } = require('../../socket');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ── Provider Profile ────────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  const provider = await Provider.findOne({ $or: [{ userId: req.userId }, { _id: req.userId }] })
    .populate('services', 'name category icon')
    .lean();
  if (!provider) throw new AppError('Provider profile not found', 404);
  res.json({ success: true, data: provider });
});

router.put('/me', authenticate, async (req, res) => {
  const allowed = ['name', 'email', 'avatar', 'specializations', 'experience', 'serviceRadius', 'city', 'state', 'availability', 'fcmToken'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  const provider = await Provider.findOneAndUpdate({ $or: [{ userId: req.userId }, { _id: req.userId }] }, updates, { new: true, runValidators: true });
  if (!provider) throw new AppError('Provider profile not found', 404);
  res.json({ success: true, data: provider });
});

// ── KYC Upload ─────────────────────────────────────────────────────────────────
router.post('/me/kyc', authenticate,
  upload.fields([
    { name: 'aadhaarDoc', maxCount: 1 },
    { name: 'panDoc', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
  ]),
  async (req, res) => {
    let provider = await Provider.findOne({ $or: [{ userId: req.userId }, { _id: req.userId }] });
    if (!provider) {
      const user = await User.findById(req.userId);
      if (!user) throw new AppError('User not found', 404);
      provider = await Provider.create({
        userId: user._id,
        phone: user.phone,
        email: user.email,
        name: user.name || 'Service Provider',
        avatar: user.avatar,
        approvalStatus: 'pending',
        currentLocation: { type: 'Point', coordinates: [0, 0] }
      });
    }

    const kycUpdate = {
      status: 'submitted',
      rejectionReason: undefined,
    };
    if (req.body.aadhaarNumber) kycUpdate.aadhaarNumber = req.body.aadhaarNumber;
    if (req.body.panNumber) kycUpdate.panNumber = req.body.panNumber;

    const uploadFile = async (field) => {
      if (!req.files?.[field]?.[0]) return provider.kyc?.[field];
      const file = req.files[field][0];
      return s3Service.upload(
        `kyc/${provider._id}/${field}_${Date.now()}`,
        file.buffer,
        file.mimetype
      );
    };

    const aadhaarDoc = await uploadFile('aadhaarDoc');
    const panDoc = await uploadFile('panDoc');
    const selfie = await uploadFile('selfie');

    if (aadhaarDoc) kycUpdate.aadhaarDoc = aadhaarDoc;
    if (panDoc) kycUpdate.panDoc = panDoc;
    if (selfie) kycUpdate.selfie = selfie;

    // Auto-assign to KYC staff
    const assignedStaffId = await getLeastBusyStaff('manage_providers', 'kyc');
    if (assignedStaffId) {
      kycUpdate.assignedTo = assignedStaffId;
    }

    provider.kyc = { ...provider.kyc, ...kycUpdate };
    provider.approvalStatus = 'pending';
    await provider.save();

    // Set User providerApplicationStatus back to pending
    const user = await User.findById(provider.userId);
    if (user) {
      user.providerApplicationStatus = 'pending';
      user.providerApplicationId = provider._id;
      user.rejectionReason = null;
      await user.save();
    }

    res.json({ success: true, message: 'KYC documents submitted for review.' });
  }
);

// ── Location + Service Radius Update ──────────────────────────────────────────
router.put('/me/location', authenticate, authorize('provider'), async (req, res) => {
  const { lat, lng, serviceRadius } = req.body;
  const update = { 'currentLocation.updatedAt': new Date() };

  if (lat !== undefined && lng !== undefined) {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (isNaN(latNum) || isNaN(lngNum) || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      throw new AppError('Invalid coordinates', 400);
    }
    update['currentLocation.coordinates'] = [lngNum, latNum];
    update['currentLocation.type'] = 'Point';
  }

  if (serviceRadius !== undefined) {
    const radius = parseInt(serviceRadius);
    if (isNaN(radius) || radius < 1 || radius > 100) {
      throw new AppError('Service radius must be between 1 and 100 km', 400);
    }
    update.serviceRadius = radius;
  }

  const provider = await Provider.findByIdAndUpdate(req.userId, update, { new: true })
    .select('currentLocation serviceRadius isOnline');
  if (!provider) throw new AppError('Provider not found', 404);

  if (provider.isOnline) {
    const { matchPendingBookingsForOnlineProvider } = require('../booking/booking.service');
    matchPendingBookingsForOnlineProvider(req.userId).catch(() => {});
  }

  res.json({ success: true, data: provider });
});

// ── Availability Toggle ────────────────────────────────────────────────────────
router.put('/me/availability', authenticate, authorize('provider'), async (req, res) => {
  const { isOnline, isAvailable } = req.body;
  
  if (isOnline) {
    const provider = await Provider.findById(req.userId).select('earnings isBlocked approvalStatus').lean();
    if (!provider) throw new AppError('Provider not found', 404);
    if (provider.isBlocked) {
      throw new AppError('Your account is currently suspended by Admin. You cannot go online.', 400);
    }
    if (provider.approvalStatus !== 'approved') {
      throw new AppError('Your account KYC is not approved yet. Please wait for staff verification.', 400);
    }

    const pendingCommission = Number(provider?.earnings?.pendingCommission || 0);
    const walletBal = Number(provider?.earnings?.walletBalance || 0);
    const isOnHold = !!provider?.earnings?.isOnHold;

    if (pendingCommission >= 500 || walletBal <= -500 || isOnHold) {
      throw new AppError(
        `Cannot go online. Unpaid platform commission is ₹${pendingCommission || Math.abs(walletBal)} (wallet balance -₹${Math.abs(walletBal)}). Please add money to clear minus balance to resume accepting jobs.`,
        400
      );
    }
  }

  const update = {};
  if (isOnline !== undefined) update.isOnline = isOnline;
  if (isAvailable !== undefined) update.isAvailable = isAvailable;
  await Provider.findByIdAndUpdate(req.userId, update);

  if (isOnline) {
    const { matchPendingBookingsForOnlineProvider } = require('../booking/booking.service');
    matchPendingBookingsForOnlineProvider(req.userId).catch(() => {});
  }

  res.json({ success: true, message: `Status updated`, data: update });
});

// ── Services Selection ─────────────────────────────────────────────────────────
router.put('/me/services', authenticate, async (req, res) => {
  const { serviceIds } = req.body;
  if (!Array.isArray(serviceIds)) throw new AppError('serviceIds must be an array', 400);
  const provider = await Provider.findOneAndUpdate({ $or: [{ userId: req.userId }, { _id: req.userId }] }, { services: serviceIds }, { new: true })
    .populate('services', 'name category');
  if (!provider) throw new AppError('Provider profile not found', 404);
  res.json({ success: true, data: { services: provider.services } });
});

// ── Bank Account ───────────────────────────────────────────────────────────────
router.put('/me/bank', authenticate, async (req, res) => {
  const { accountNumber, ifscCode, bankName, accountHolder } = req.body;
  if (!accountNumber || !ifscCode || !bankName || !accountHolder) {
    throw new AppError('All bank fields required', 400);
  }
  const provider = await Provider.findOneAndUpdate({ $or: [{ userId: req.userId }, { _id: req.userId }] }, {
    'earnings.bankAccount': { accountNumber, ifscCode, bankName, accountHolder, verified: false },
  }, { new: true });
  if (!provider) throw new AppError('Provider profile not found', 404);
  res.json({ success: true, message: 'Bank account saved. Will be verified in 1-2 business days.' });
});

// ── Schedule View ──────────────────────────────────────────────────────────────
router.get('/me/schedule', authenticate, authorize('provider'), async (req, res) => {
  const { date } = req.query;
  const targetDate = date ? new Date(date) : new Date();
  const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
  const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

  const bookings = await Booking.find({
    providerId: req.userId,
    scheduledDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $nin: ['cancelled'] },
  }).populate('serviceId', 'name').populate('customerId', 'name phone').sort({ scheduledDate: 1 }).lean();

  res.json({ success: true, data: bookings });
});

// ── Earnings Dashboard ─────────────────────────────────────────────────────────
router.get('/me/earnings', authenticate, authorize('provider'), async (req, res) => {
  const { period = '30d' } = req.query;
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const provider = await Provider.findById(req.userId).select('earnings tier rating completedJobs').lean();
  const summary = provider?.earnings || {};
  summary.walletBalance = summary.walletBalance || 0;
  summary.securityDeposit = summary.securityDeposit || 0;
  summary.cashCommissionBalance = summary.walletBalance + summary.securityDeposit;

  const [weeklyEarnings, jobBreakdown] = await Promise.all([
    require('../../models').Transaction.aggregate([
      { $match: { providerId: require('mongoose').Types.ObjectId.createFromHexString(req.userId), type: 'wallet_credit', createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, amount: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
    ]),
    Booking.aggregate([
      { $match: { providerId: require('mongoose').Types.ObjectId.createFromHexString(req.userId), status: 'paid', createdAt: { $gte: since } } },
      { $group: { _id: '$serviceId', count: { $sum: 1 }, earnings: { $sum: '$providerEarnings' } } },
      { $lookup: { from: 'services', localField: '_id', foreignField: '_id', as: 'service' } },
      { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      summary,
      tier: provider.tier,
      rating: provider.rating,
      completedJobs: provider.completedJobs,
      weeklyEarnings,
      jobBreakdown,
    },
  });
});

// ── Public Profile ─────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const cached = await cache.get(`provider:public:${req.params.id}`);
  if (cached) return res.json({ success: true, data: cached });

  const provider = await Provider.findById(req.params.id)
    .select('name avatar rating ratingCount completedJobs tier services specializations experience city')
    .populate('services', 'name category icon')
    .lean();
  res.json({ success: true, data: provider });
});

// ── Provider Withdrawal Request (Method A) ──────────────────────────────────
router.post('/me/withdraw', authenticate, authorize('provider'), async (req, res) => {
  const { amount } = req.body;
  const numAmt = Number(amount);
  if (!numAmt || numAmt < 100) throw new AppError('Minimum withdrawal amount is ₹100', 400);

  const provider = await Provider.findById(req.userId);
  if (!provider) throw new AppError('Provider not found', 404);

  if (provider.isBlocked || provider.earnings?.isOnHold) {
    throw new AppError('Withdrawals are temporarily disabled for your account due to an active administrative hold.', 400);
  }

  if (!provider.earnings?.bankAccount?.verified) {
    throw new AppError('Bank account is not verified yet. Please update and verify your bank details before requesting payouts.', 400);
  }

  const currentWallet = Number(provider.earnings?.walletBalance || 0);
  if (currentWallet < numAmt) {
    throw new AppError(`Insufficient wallet balance. Available for withdrawal: ₹${Math.max(0, currentWallet)}`, 400);
  }

  // Deduct from wallet and track pending payout
  provider.earnings.walletBalance = currentWallet - numAmt;
  await provider.save();

  // Create Payout Record
  const payout = await Payout.create({
    providerId: provider._id,
    amount: numAmt,
    status: 'pending',
    bankDetails: provider.bankDetails || {},
    notes: `Withdrawal request of ₹${numAmt} submitted on ${new Date().toLocaleDateString()}`,
  });

  // Audit Ledger Entry
  await WalletLedger.create([{
    ownerId: provider._id,
    ownerType: 'provider',
    type: 'debit',
    account: 'wallet',
    amount: numAmt,
    balance: provider.earnings.walletBalance,
    description: `Payout withdrawal request of ₹${numAmt} submitted (Payout ID: ${payout._id})`,
  }]);

  // Real-time Notification to Provider
  await Notification.create({
    userId: provider._id,
    title: '⏳ Payout Request Submitted',
    body: `Withdrawal request for ₹${numAmt} is under review by Admin. Processing time: 1-2 business days.`,
    type: 'payout_update',
    referenceId: payout._id,
  }).catch(() => {});

  const io = getIO();
  io.to(`provider:${provider._id}`).emit('notification:push', {
    title: '⏳ Payout Request Submitted',
    body: `Withdrawal request for ₹${numAmt} is submitted. Available wallet balance: ₹${provider.earnings.walletBalance}`,
    walletBalance: provider.earnings.walletBalance,
  });

  res.json({
    success: true,
    message: `Withdrawal request for ₹${numAmt} submitted successfully. Admin approval in 1-2 business days.`,
    data: {
      payoutId: payout._id,
      amount: numAmt,
      remainingWalletBalance: provider.earnings.walletBalance,
    },
  });
});

module.exports = router;
