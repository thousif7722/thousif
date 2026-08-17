'use strict';
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const {
  User, Provider, Booking, Transaction,
  Review, Complaint, Service, WalletLedger, SystemSettings, Notification,
  InvoiceSettings, Invoice, AuditLog
} = require('../../models');
const { authenticate, authorize, requirePermission } = require('../auth/auth.routes');
const { AppError } = require('../../utils/errors');
const { cache } = require('../../config/redis');
const { emitToAdmin, getIO } = require('../../socket');
const logger = require('../../utils/logger');
const { s3Service, extractKeyFromUrl } = require('../../services/s3.service');
const invoiceService = require('../../services/invoice.service');
const pdfService = require('../../services/pdf.service');

const router = express.Router();

// ── Branding Upload Middleware ─────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = [
  'image/png', 'image/jpeg', 'image/jpg',
  'image/webp', 'image/svg+xml', 'image/x-icon',
  'image/vnd.microsoft.icon',
];
const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico'];

const BRANDING_SIZE_LIMITS = {
  logo:        5 * 1024 * 1024, // 5 MB
  favicon:     2 * 1024 * 1024, // 2 MB
  darkLogo:    5 * 1024 * 1024,
  appIcon:     5 * 1024 * 1024,
  loginLogo:   5 * 1024 * 1024,
  invoiceLogo: 5 * 1024 * 1024,
};

const VALID_BRANDING_TYPES = Object.keys(BRANDING_SIZE_LIMITS);

// S3 folder mapping
const BRANDING_S3_FOLDER = {
  logo:        'onewayfix/branding/logo',
  favicon:     'onewayfix/branding/favicon',
  darkLogo:    'onewayfix/branding/dark-logo',
  appIcon:     'onewayfix/branding/app-icon',
  loginLogo:   'onewayfix/branding/login-logo',
  invoiceLogo: 'onewayfix/branding/invoice-logo',
};

// Multer memory storage — files never touch disk, streamed directly to S3
const brandingUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }, // max-limit guard; per-type enforced in route
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeOk = ALLOWED_MIME_TYPES.includes(file.mimetype);
    const extOk  = ALLOWED_EXTENSIONS.includes(ext);
    if (!mimeOk || !extOk) {
      return cb(new AppError(`Invalid file type. Allowed: PNG, JPG, WEBP, SVG, ICO (got ${file.mimetype})`, 400));
    }
    cb(null, true);
  },
});

// All admin routes require authentication and admin/staff role
router.use(authenticate, authorize('admin', 'staff'));

// ── Team Management (Super Admin Only) ─────────────────────────────────────────
router.post('/team', authorize('admin'), async (req, res) => {
  const { phone, name, email, permissions } = req.body;
  if (!phone || !name || !permissions) throw new AppError('Phone, name, and permissions required', 400);

  const existing = await User.findOne({ phone });
  if (existing) throw new AppError('User with this phone already exists', 400);

  const staff = await User.create({
    phone,
    name,
    email: email || undefined,
    role: 'staff',
    permissions: Array.isArray(permissions) ? permissions : [],
  });

  res.status(201).json({ success: true, message: 'Team member added', data: staff });
});

/**
 * GET /admin/fraud-alerts
 * Anomaly Detection Engine: Detects providers with high visit counts but suspicious 0% quote rates (Off-Platform Deal Suspects)
 */
router.get('/fraud-alerts', async (req, res) => {
  // Anomaly 1: Low Quote Conversion (Completed visits with zero quotes)
  const lowQuoteProviders = await Booking.aggregate([
    { $match: { status: 'completed' } },
    {
      $group: {
        _id: '$providerId',
        totalCompleted: { $sum: 1 },
        totalQuotesSubmitted: {
          $sum: { $cond: [{ $and: [{ $ifNull: ['$quotation', false] }, { $ne: ['$quotation.status', 'none'] }] }, 1, 0] }
        }
      }
    },
    {
      $project: {
        providerId: '$_id',
        totalCompleted: 1,
        totalQuotesSubmitted: 1,
        quoteConversionRate: {
          $cond: [{ $gt: ['$totalCompleted', 0] }, { $multiply: [{ $divide: ['$totalQuotesSubmitted', '$totalCompleted'] }, 100] }, 0]
        }
      }
    },
    { $match: { totalCompleted: { $gte: 3 }, quoteConversionRate: { $lte: 20 } } }
  ]);

  // Anomaly 2: High Post-Visit Cancellation Rate (Customer cancels after technician arrives)
  const highPostVisitCancelProviders = await Booking.aggregate([
    { $match: { status: { $in: ['completed', 'cancelled'] } } },
    {
      $group: {
        _id: '$providerId',
        totalAssigned: { $sum: 1 },
        cancelledAfterVisit: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$status', 'cancelled'] }, { $in: ['$cancellation.cancelledBy', ['customer', 'provider']] }] },
              1,
              0
            ]
          }
        }
      }
    },
    {
      $project: {
        providerId: '$_id',
        totalAssigned: 1,
        cancelledAfterVisit: 1,
        postVisitCancelRate: {
          $cond: [{ $gt: ['$totalAssigned', 0] }, { $multiply: [{ $divide: ['$cancelledAfterVisit', '$totalAssigned'] }, 100] }, 0]
        }
      }
    },
    { $match: { cancelledAfterVisit: { $gte: 2 }, postVisitCancelRate: { $gte: 30 } } }
  ]);

  const populatedQuotes = await Provider.populate(lowQuoteProviders, { path: 'providerId', select: 'name phone avatar rating earnings riskScore' });
  const populatedCancels = await Provider.populate(highPostVisitCancelProviders, { path: 'providerId', select: 'name phone avatar rating earnings riskScore' });

  res.json({
    success: true,
    message: 'Providers flagged for off-platform trading & post-visit cancellation anomalies',
    data: {
      lowQuoteConversion: populatedQuotes,
      highPostVisitCancellations: populatedCancels,
    }
  });
});

/**
 * GET /admin/team/workload
 * Real-time Staff Workload & Productivity Monitoring (for 10,000+ technician KYC distribution)
 */
router.get('/team/workload', authorize('admin'), async (req, res) => {
  const staffList = await User.find({ role: 'staff', isBlocked: false })
    .select('_id name phone email permissions')
    .lean();

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const staffIds = staffList.map(s => s._id);

  // 1. Pending KYC per staff
  const pendingKycCounts = await Provider.aggregate([
    { $match: { approvalStatus: 'pending', 'kyc.status': 'submitted', 'kyc.assignedTo': { $in: staffIds } } },
    { $group: { _id: '$kyc.assignedTo', count: { $sum: 1 } } }
  ]);

  // 2. Verified today per staff
  const verifiedTodayCounts = await Provider.aggregate([
    { $match: { 'kyc.verifiedAt': { $gte: startOfDay }, 'kyc.verifiedBy': { $in: staffIds } } },
    { $group: { _id: '$kyc.verifiedBy', count: { $sum: 1 } } }
  ]);

  // 3. Open complaints per staff
  const openComplaintsCounts = await Complaint.aggregate([
    { $match: { status: { $in: ['open', 'in_review'] }, assignedTo: { $in: staffIds } } },
    { $group: { _id: '$assignedTo', count: { $sum: 1 } } }
  ]);

  // Unassigned total
  const unassignedCount = await Provider.countDocuments({
    approvalStatus: 'pending',
    'kyc.status': 'submitted',
    $or: [{ 'kyc.assignedTo': { $exists: false } }, { 'kyc.assignedTo': null }]
  });

  const pendingMap = pendingKycCounts.reduce((acc, c) => ({ ...acc, [c._id.toString()]: c.count }), {});
  const verifiedTodayMap = verifiedTodayCounts.reduce((acc, c) => ({ ...acc, [c._id.toString()]: c.count }), {});
  const complaintMap = openComplaintsCounts.reduce((acc, c) => ({ ...acc, [c._id.toString()]: c.count }), {});

  const totalPending = Object.values(pendingMap).reduce((a, b) => a + b, 0) + unassignedCount;
  const avgPendingPerStaff = staffList.length > 0 ? Math.round(totalPending / staffList.length) : 0;

  const workloadData = staffList.map(s => {
    const pCount = pendingMap[s._id.toString()] || 0;
    return {
      _id: s._id,
      name: s.name,
      phone: s.phone,
      email: s.email,
      permissions: s.permissions || [],
      pendingKyc: pCount,
      verifiedToday: verifiedTodayMap[s._id.toString()] || 0,
      openComplaints: complaintMap[s._id.toString()] || 0,
      status: pCount > avgPendingPerStaff * 1.5 ? 'Heavy' : pCount < avgPendingPerStaff * 0.5 ? 'Light' : 'Balanced',
    };
  });

  res.json({
    success: true,
    data: {
      staffWorkload: workloadData,
      summary: {
        totalStaff: staffList.length,
        totalPendingKyc: totalPending,
        unassignedKyc: unassignedCount,
        avgPendingPerStaff,
      }
    }
  });
});

router.get('/team', authorize('admin', 'staff', 'manager'), async (req, res) => {
  const team = await User.find({
    role: { $in: ['staff', 'manager', 'team_leader', 'executive', 'technician', 'intern', 'admin'] }
  }).select('-__v -password').sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: team });
});

/**
 * POST /admin/team
 * Add a new staff member or update an existing employee by Email (Required) or Phone (Optional).
 */
router.post('/team', authorize('admin', 'staff', 'manager'), async (req, res) => {
  const { name, email, phone, role, department, designation, permissions } = req.body;
  if (!name || !name.trim()) throw new AppError('Employee full name is required', 400);
  if (!email || !email.trim()) throw new AppError('Employee login email is required', 400);

  const cleanEmail = email.trim().toLowerCase();
  const cleanPhone = phone && typeof phone === 'string' && phone.trim() !== '' ? phone.trim() : undefined;
  const staffRole = role || 'staff';

  let user = await User.findOne({
    $or: [
      { email: cleanEmail },
      ...(cleanPhone ? [{ phone: cleanPhone }] : [])
    ]
  });

  if (user) {
    user.name = name.trim();
    user.email = cleanEmail;
    if (cleanPhone) user.phone = cleanPhone;
    user.role = staffRole;
    if (department) user.department = department;
    if (designation) user.designation = designation;
    if (Array.isArray(permissions)) user.permissions = permissions;
    user.status = 'active';
    user.isBlocked = false;
    user.blockReason = undefined;
    await user.save();
    logger.info(`Updated staff member ${user.name} (${cleanEmail})`);
    return res.json({ success: true, message: `Staff member ${user.name} saved successfully!`, data: user });
  }

  const userData = {
    name: name.trim(),
    email: cleanEmail,
    role: staffRole,
    permissions: Array.isArray(permissions) ? permissions : [],
    department: department || 'Operations',
    designation: designation || 'Staff Associate',
    status: 'active',
  };
  if (cleanPhone) userData.phone = cleanPhone;

  user = await User.create(userData);

  logger.info(`Added new staff member ${user.name} (${cleanEmail})`);
  res.status(201).json({ success: true, message: `Staff member ${user.name} added successfully!`, data: user });
});

router.put('/team/:id', authorize('admin', 'staff', 'manager'), async (req, res) => {
  const { name, email, phone, role, department, designation, permissions, isBlocked } = req.body;
  const updates = {};
  if (name) updates.name = name.trim();
  if (email) updates.email = email.trim().toLowerCase();
  if (phone !== undefined) updates.phone = phone ? phone.trim() : undefined;
  if (role) updates.role = role;
  if (department) updates.department = department;
  if (designation) updates.designation = designation;
  if (Array.isArray(permissions)) updates.permissions = permissions;
  if (isBlocked !== undefined) updates.isBlocked = isBlocked;

  const staff = await User.findByIdAndUpdate(req.params.id, updates, { new: true });
  if (!staff) throw new AppError('Staff member not found', 404);
  res.json({ success: true, message: 'Team member updated successfully', data: staff });
});

/**
 * PUT /admin/team/:id/resign
 * Mark staff member as resigned, revoke access, and redistribute their pending KYC queue.
 */
router.put('/team/:id/resign', authorize('admin'), async (req, res) => {
  const staffId = req.params.id;
  const staff = await User.findById(staffId);
  if (!staff || staff.role !== 'staff') throw new AppError('Staff member not found', 404);

  staff.status = 'resigned';
  staff.isBlocked = true;
  staff.isOnline = false;
  staff.blockReason = 'Employee Resigned';
  await staff.save();

  // Unassign KYCs assigned to this staff member
  await Provider.updateMany(
    { 'kyc.assignedTo': staffId },
    { $unset: { 'kyc.assignedTo': '' } }
  );

  // Auto-redistribute unassigned KYCs across remaining active staff
  const staffMembers = await User.find({ role: 'staff', isBlocked: false }).select('_id').lean();
  let rebalancedCount = 0;
  if (staffMembers.length > 0) {
    const unassigned = await Provider.find({ approvalStatus: 'pending', 'kyc.status': 'submitted', 'kyc.assignedTo': null }).select('_id');
    for (let i = 0; i < unassigned.length; i++) {
      const assignedStaff = staffMembers[i % staffMembers.length];
      await Provider.findByIdAndUpdate(unassigned[i]._id, { 'kyc.assignedTo': assignedStaff._id });
      rebalancedCount++;
    }
  }

  logger.info(`Staff member ${staff.name} marked as resigned. ${rebalancedCount} pending KYCs rebalanced.`);
  res.json({
    success: true,
    message: `Staff member ${staff.name} marked as resigned. ${rebalancedCount} pending applications rebalanced to remaining active staff.`,
    data: staff,
  });
});

/**
 * DELETE /admin/team/:id
 * Permanently delete a staff member and redistribute their pending workload.
 */
router.delete('/team/:id', authorize('admin'), async (req, res) => {
  const staffId = req.params.id;
  const staff = await User.findById(staffId);
  if (!staff || staff.role !== 'staff') throw new AppError('Staff member not found', 404);

  // Unassign KYCs assigned to this staff member
  await Provider.updateMany(
    { 'kyc.assignedTo': staffId },
    { $unset: { 'kyc.assignedTo': '' } }
  );

  await User.findByIdAndDelete(staffId);

  // Auto-redistribute unassigned KYCs across remaining active staff
  const staffMembers = await User.find({ role: 'staff', isBlocked: false }).select('_id').lean();
  let rebalancedCount = 0;
  if (staffMembers.length > 0) {
    const unassigned = await Provider.find({ approvalStatus: 'pending', 'kyc.status': 'submitted', 'kyc.assignedTo': null }).select('_id');
    for (let i = 0; i < unassigned.length; i++) {
      const assignedStaff = staffMembers[i % staffMembers.length];
      await Provider.findByIdAndUpdate(unassigned[i]._id, { 'kyc.assignedTo': assignedStaff._id });
      rebalancedCount++;
    }
  }

  logger.info(`Staff member ${staff.name} deleted by admin ${req.userId}. ${rebalancedCount} KYCs rebalanced.`);
  res.json({
    success: true,
    message: `Staff member ${staff.name} deleted. ${rebalancedCount} pending applications rebalanced.`,
  });
});

// ── Organization Teams & Hierarchy ───────────────────────────────────────────────
router.post('/teams', authorize('admin'), async (req, res) => {
  const { name, city, department, managerId } = req.body;
  const Team = require('../../models').Team;
  const team = await Team.create({ name, city, department, managerId });
  res.status(201).json({ success: true, message: 'Team created', data: team });
});

router.get('/teams/hierarchy', async (req, res) => {
  const Team = require('../../models').Team;
  const teams = await Team.find().populate('managerId', 'name email phone role').lean();
  res.json({ success: true, data: teams });
});

// ── Announcements & Broadcasts ─────────────────────────────────────────────────
router.post('/announcements', authorize('admin', 'staff'), async (req, res) => {
  const { title, body, targetRole, targetTeamId } = req.body;
  const Notification = require('../../models').Notification;

  const announcement = await Notification.create({
    userId: req.userId, // Sender
    title,
    body,
    type: 'announcement',
    isBroadcast: true,
    referenceType: targetRole || 'all',
    referenceId: targetTeamId || null,
  });

  // Emit socket event to targeted users
  const { getIO } = require('../../socket');
  const io = getIO();
  if (io) {
    let room = 'all_users'; // Default broad room
    if (targetRole === 'technician') room = 'providers';
    if (targetRole === 'customer') room = 'customers';
    io.to(room).emit('announcement_received', announcement);
  }

  res.status(201).json({ success: true, message: 'Announcement broadcasted successfully', data: announcement });
});

// ── Dashboard Analytics ────────────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  const role = req.userRole || req.user?.role;
  const permissions = req.user?.permissions || [];
  const hasFinancials = role === 'admin' || (Array.isArray(permissions) && permissions.includes('manage_financials'));
  const cacheKey = `admin:dashboard:metrics:${hasFinancials ? 'fin' : 'nofin'}`;
  const cached = await cache.get(cacheKey);
  if (cached) return res.json({ success: true, data: cached, cached: true });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // SCALE FIX: All queries get maxTimeMS(5000) — never block the dashboard indefinitely
  const timeout = { maxTimeMS: 5000 };

  let metrics;
  try {
    const [
      totalUsers,
      totalProviders,
      activeBookings,
      todayBookings,
      monthlyRevenue,
      todayRevenue,
      pendingKYC,
      openComplaints,
      onlineProviders,
      bookingStatusBreakdown,
      revenueByDay,
      topProviders,
      topServices,
      cancellationRate,
    ] = await Promise.all([
      User.countDocuments({ role: 'customer' }).maxTimeMS(5000),
      Provider.countDocuments({ approvalStatus: 'approved' }).maxTimeMS(5000),
      Booking.countDocuments({ status: { $in: ['pending', 'assigned', 'accepted', 'in_progress'] } }).maxTimeMS(5000),
      Booking.countDocuments({ createdAt: { $gte: today } }).maxTimeMS(5000),
      hasFinancials ? Transaction.aggregate([
        { $match: { type: 'commission', status: 'success', createdAt: { $gte: thisMonth } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]).option({ maxTimeMS: 5000 }) : Promise.resolve([]),
      hasFinancials ? Transaction.aggregate([
        { $match: { type: 'commission', status: 'success', createdAt: { $gte: today } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]).option({ maxTimeMS: 5000 }) : Promise.resolve([]),
      Provider.countDocuments({ 'kyc.status': 'submitted', approvalStatus: 'pending' }).maxTimeMS(5000),
      Complaint.countDocuments({ status: 'open' }).maxTimeMS(5000),
      Provider.countDocuments({ isOnline: true }).maxTimeMS(5000),
      Booking.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]).option({ maxTimeMS: 5000 }),
      hasFinancials ? Transaction.aggregate([
        {
          $match: {
            type: 'commission',
            status: 'success',
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            revenue: { $sum: '$amount' },
            transactions: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]).option({ maxTimeMS: 5000 }) : Promise.resolve([]),
      Provider.find({ approvalStatus: 'approved' })
        .sort({ completedJobs: -1 })
        .limit(10)
        .select(hasFinancials ? 'name rating completedJobs tier earnings.totalEarnings' : 'name rating completedJobs tier')
        .maxTimeMS(5000)
        .lean(),
      Booking.aggregate([
        { $group: { _id: '$serviceId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'services', localField: '_id', foreignField: '_id', as: 'service' } },
        { $unwind: '$service' },
        { $project: { name: '$service.name', count: 1, category: '$service.category' } },
      ]).option({ maxTimeMS: 5000 }),
      Booking.aggregate([
        { $match: { createdAt: { $gte: thisMonth } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          },
        },
      ]).option({ maxTimeMS: 5000 }),
    ]);

    metrics = {
      overview: {
        totalUsers,
        totalProviders,
        activeBookings,
        onlineProviders,
        pendingKYC,
        openComplaints,
      },
      bookings: {
        today: todayBookings,
        statusBreakdown: bookingStatusBreakdown.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        cancellationRate: cancellationRate[0]
          ? ((cancellationRate[0].cancelled / cancellationRate[0].total) * 100).toFixed(1)
          : 0,
      },
      revenue: hasFinancials ? {
        today: todayRevenue[0]?.total || 0,
        todayTransactions: todayRevenue[0]?.count || 0,
        monthly: monthlyRevenue[0]?.total || 0,
        monthlyTransactions: monthlyRevenue[0]?.count || 0,
      } : null,
      charts: {
        revenueByDay: hasFinancials ? revenueByDay : [],
        topProviders: hasFinancials ? topProviders : topProviders.map(p => {
          const { earnings, ...rest } = p;
          return rest;
        }),
        topServices,
      },
      hasFinancialsPermission: hasFinancials,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    // SCALE FIX: Dashboard timeout returns partial data instead of 500
    if (err.name === 'MongoServerError' && err.code === 50) {
      logger.warn('Admin dashboard query timed out — returning cached or empty metrics');
      return res.json({
        success: true,
        data: cached || { overview: {}, bookings: {}, revenue: null, charts: {} },
        warning: 'Some metrics timed out. Data may be incomplete.',
        cached: !!cached,
      });
    }
    throw err;
  }

  await cache.set(cacheKey, metrics, 60); // Cache 1 minute
  res.json({ success: true, data: metrics });
});

// ── User Management ────────────────────────────────────────────────────────────
router.get('/users', requirePermission('manage_users'), async (req, res) => {
  const { page = 1, limit = 20, search, isBlocked, sortBy = 'createdAt', sortOrder = -1 } = req.query;
  const filter = { role: 'customer' };
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }
  if (isBlocked !== undefined) filter.isBlocked = isBlocked === 'true';

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ [sortBy]: parseInt(sortOrder) })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v')
      .lean(),
    User.countDocuments(filter),
  ]);

  res.json({ success: true, data: users, pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
});

router.put('/users/:id/block', requirePermission('manage_users'), async (req, res) => {
  const { reason } = req.body;
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isBlocked: true, blockReason: reason },
    { new: true }
  ).select('name phone isBlocked');
  if (!user) throw new AppError('User not found', 404);
  logger.info(`Admin blocked user ${user._id}: ${reason}`);
  res.json({ success: true, message: `User ${user.name} blocked`, data: user });
});

router.put('/users/:id/unblock', requirePermission('manage_users'), async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isBlocked: false, $unset: { blockReason: '' } },
    { new: true }
  ).select('name phone isBlocked');
  if (!user) throw new AppError('User not found', 404);
  res.json({ success: true, message: `User ${user.name} unblocked`, data: user });
});

// ── Provider Management ────────────────────────────────────────────────────────
router.get('/providers', requirePermission('manage_providers'), async (req, res) => {
  const { page = 1, limit = 20, search, approvalStatus, tier, assignedTo } = req.query;
  const filter = {};
  if (approvalStatus) {
    if (approvalStatus === 'pending_bank') {
      filter['earnings.bankAccount.accountNumber'] = { $exists: true, $ne: null };
      filter['earnings.bankAccount.verified'] = false;
    } else {
      filter.approvalStatus = approvalStatus;
    }
  }
  
  if (assignedTo === 'my' || (req.userRole === 'staff' && approvalStatus === 'pending' && !assignedTo)) {
    filter['kyc.assignedTo'] = req.userId;
  } else if (assignedTo && assignedTo !== 'all') {
    filter['kyc.assignedTo'] = assignedTo;
  }

  if (tier) filter.tier = tier;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [providers, total] = await Promise.all([
    Provider.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('services', 'name category')
      .populate('kyc.verifiedBy', 'name email phone role')
      .populate('kyc.assignedTo', 'name email phone role')
      .lean(),
    Provider.countDocuments(filter),
  ]);

  const role = req.userRole || req.user?.role;
  const permissions = req.user?.permissions || [];
  const hasFinancials = role === 'admin' || (Array.isArray(permissions) && permissions.includes('manage_financials'));
  if (!hasFinancials) {
    providers.forEach(p => {
      if (p.earnings) {
        p.earnings = {
          isOnHold: p.earnings.isOnHold,
          holdReason: p.earnings.holdReason,
          bankAccount: p.earnings.bankAccount ? { verified: p.earnings.bankAccount.verified } : undefined,
        };
      }
    });
  }

  res.json({ success: true, data: providers, pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
});

router.put('/providers/:id/approve', requirePermission('manage_providers'), async (req, res) => {
  const provider = await Provider.findById(req.params.id);
  if (!provider) throw new AppError('Provider application not found', 404);

  provider.approvalStatus = 'approved';
  if (!provider.kyc) provider.kyc = {};
  provider.kyc.status = 'verified';
  provider.kyc.verifiedAt = new Date();
  provider.kyc.verifiedBy = req.userId;
  await provider.save();

  // CONVERT THE SAME ACCOUNT: user.role = 'provider', user.providerApplicationStatus = 'approved'
  const user = await User.findById(provider.userId);
  if (user) {
    user.role = 'provider';
    user.providerApplicationStatus = 'approved';
    user.approvedAt = new Date();
    user.approvedBy = req.userId;
    user.rejectionReason = null;
    await user.save();
  }

  // Notify provider
  const { notificationQueue } = require('../../jobs');
  if (notificationQueue) {
    await notificationQueue.add('booking_update', {
      userId: provider.userId,
      title: 'Provider Application Approved! 🎉',
      body: 'Your OneWayFix Service Provider application has been approved! You can now access the Provider Dashboard and accept job requests.',
      type: 'system',
    }).catch(() => {});
  }

  logger.info(`Provider ${provider._id} (User: ${provider.userId}) approved by admin ${req.userId}`);
  res.json({ success: true, message: `Provider ${provider.name} approved successfully!` });
});

router.put('/providers/:id/reject', requirePermission('manage_providers'), async (req, res) => {
  const { reason } = req.body;
  if (!reason || !reason.trim()) throw new AppError('Rejection reason is required', 400);

  const provider = await Provider.findById(req.params.id);
  if (!provider) throw new AppError('Provider application not found', 404);

  provider.approvalStatus = 'rejected';
  if (!provider.kyc) provider.kyc = {};
  provider.kyc.status = 'rejected';
  provider.kyc.rejectionReason = reason.trim();
  await provider.save();

  // KEEP ACCOUNT AS CUSTOMER: user.role = 'customer', user.providerApplicationStatus = 'rejected'
  const user = await User.findById(provider.userId);
  if (user) {
    user.role = 'customer';
    user.providerApplicationStatus = 'rejected';
    user.rejectionReason = reason.trim();
    user.rejectedAt = new Date();
    user.rejectedBy = req.userId;
    await user.save();
  }

  // Notify customer
  const { notificationQueue } = require('../../jobs');
  if (notificationQueue) {
    await notificationQueue.add('booking_update', {
      userId: provider.userId,
      title: 'Provider Application Update ⚠️',
      body: `Your provider application requires update: ${reason.trim()}`,
      type: 'system',
    }).catch(() => {});
  }

  logger.info(`Provider ${provider._id} (User: ${provider.userId}) rejected by admin ${req.userId}: ${reason}`);
  res.json({ success: true, message: 'Provider application rejected.' });
});

router.put('/providers/:id/block', requirePermission('manage_providers'), async (req, res) => {
  const { reason } = req.body;
  const provider = await Provider.findByIdAndUpdate(
    req.params.id,
    {
      isBlocked: true,
      isOnline: false,
      isAvailable: false,
      blockReason: reason || 'Manual admin block',
    },
    { new: true }
  ).select('name phone isBlocked blockReason warningCount approvalStatus');
  if (!provider) throw new AppError('Provider not found', 404);

  logger.info(`Admin ${req.userId} blocked provider ${provider._id}: ${provider.blockReason}`);
  res.json({ success: true, message: `Provider ${provider.name} blocked`, data: provider });
});

router.put('/providers/:id/unblock', requirePermission('manage_providers'), async (req, res) => {
  const provider = await Provider.findByIdAndUpdate(
    req.params.id,
    { isBlocked: false, isAvailable: true, $unset: { blockReason: '' } },
    { new: true }
  ).select('name phone isBlocked warningCount approvalStatus');
  if (!provider) throw new AppError('Provider not found', 404);

  logger.info(`Admin ${req.userId} unblocked provider ${provider._id}`);
  res.json({ success: true, message: `Provider ${provider.name} unblocked`, data: provider });
});

router.put('/providers/:id/warn', requirePermission('manage_providers'), async (req, res) => {
  const { reason } = req.body;
  if (!reason) throw new AppError('Warning reason required', 400);

  const provider = await Provider.findById(req.params.id);
  if (!provider) throw new AppError('Provider not found', 404);

  provider.warnings.push({ reason, issuedAt: new Date(), issuedBy: req.userId });
  provider.warningCount += 1;

  // Auto-block after 3 warnings
  if (provider.warningCount >= 3) {
    provider.isBlocked = true;
    provider.isOnline = false;
    provider.isAvailable = false;
    provider.blockReason = 'Auto-blocked: 3 warnings received';
    logger.warn(`Provider ${provider._id} auto-blocked after 3 warnings`);
  }

  await provider.save();
  res.json({
    success: true,
    message: `Warning issued (${provider.warningCount}/3)`,
    data: { warningCount: provider.warningCount, isBlocked: provider.isBlocked },
  });
});

/**
 * GET /admin/providers/:id
 * Fetch full real-time provider details (earnings, jobs, commission, hold status etc.)
 * Used by admin panel detail modal for live data refresh.
 */
router.get('/providers/:id', requirePermission('manage_providers'), async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new AppError('Invalid provider ID', 400);
  }
  const provider = await Provider.findById(req.params.id)
    .populate('services', 'name category')
    .populate('kyc.verifiedBy', 'name email phone role')
    .populate('kyc.assignedTo', 'name email phone role')
    .lean();

  if (!provider) throw new AppError('Provider not found', 404);

  // Fetch live booking stats
  const [activeJobsCount, todayJobsCount, totalJobsCount] = await Promise.all([
    Booking.countDocuments({ providerId: provider._id, status: { $in: ['assigned', 'accepted', 'in_progress'] } }),
    Booking.countDocuments({ providerId: provider._id, createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) } }),
    Booking.countDocuments({ providerId: provider._id, status: { $in: ['completed', 'paid'] } }),
  ]);

  res.json({
    success: true,
    data: {
      ...provider,
      _liveStats: {
        activeJobs: activeJobsCount,
        todayJobs: todayJobsCount,
        totalCompletedJobs: totalJobsCount,
      },
    },
  });
});

/**
 * GET /admin/providers/:id/kyc-docs
 * ─────────────────────────────────────────────────────────────────────────────
 * Generate fresh AWS S3 signed URLs for a provider's KYC documents.
 *
 * WHY ON-DEMAND SIGNED URLS:
 *   - S3 bucket is PRIVATE — raw URLs return "Access Denied"
 *   - Instead of storing expiring signed URLs in the DB, we store only the
 *     permanent object key (embedded in the full URL), and generate a fresh
 *     signed URL every time an admin requests to view.
 *   - Documents are stored PERMANENTLY in S3; only the viewing link is
 *     short-lived (1 hour). A new link is generated on every admin click.
 *
 * AUDIT: Every access is logged (who viewed which provider's documents).
 */
router.get('/providers/:id/kyc-docs', requirePermission('manage_providers'), async (req, res) => {
  const provider = await Provider.findById(req.params.id)
    .select('name phone kyc')
    .lean();

  if (!provider) throw new AppError('Provider not found', 404);

  const kyc = provider.kyc || {};
  const EXPIRY_SECONDS = 604800; // 7 days (S3 max for IAM user) — regenerated each admin click

  // Generate signed URLs in parallel for all 3 KYC documents
  const [aadhaarDoc, panDoc, selfie] = await Promise.all([
    s3Service.getSignedUrlFromStoredUrl(kyc.aadhaarDoc, EXPIRY_SECONDS),
    s3Service.getSignedUrlFromStoredUrl(kyc.panDoc, EXPIRY_SECONDS),
    s3Service.getSignedUrlFromStoredUrl(kyc.selfie, EXPIRY_SECONDS),
  ]);

  // Compliance audit log: who accessed which provider's KYC documents
  logger.info(`[KYC_ACCESS] Admin/Staff ${req.userId} viewed KYC docs for provider ${provider._id} (${provider.name} | ${provider.phone})`);

  res.json({
    success: true,
    data: {
      providerId: provider._id,
      providerName: provider.name,
      kycStatus: kyc.status,
      docs: {
        aadhaarDoc: aadhaarDoc || null,
        panDoc: panDoc || null,
        selfie: selfie || null,
      },
      expiresInSeconds: EXPIRY_SECONDS,
      generatedAt: new Date().toISOString(),
      note: 'These signed URLs are valid for 7 days. Click refresh to generate a new link.',
      expiresAt: new Date(Date.now() + EXPIRY_SECONDS * 1000).toISOString(),
    },
  });
});

// ── Booking Management ─────────────────────────────────────────────────────────
router.get('/bookings', requirePermission('manage_bookings'), async (req, res) => {
  const { page = 1, limit = 20, status, from, to, providerId, customerId } = req.query;
  const filter = {};
  if (status) {
    if (status === 'unassigned') {
      filter.$or = [{ providerId: { $exists: false } }, { providerId: null }];
      filter.status = { $nin: ['completed', 'paid', 'cancelled', 'canceled'] };
    } else {
      filter.status = status;
    }
  }
  if (providerId) filter.providerId = providerId;
  if (customerId) filter.customerId = customerId;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate('customerId', 'name phone')
      .populate('providerId', 'name phone rating')
      .populate('serviceId', 'name category')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Booking.countDocuments(filter),
  ]);

  res.json({ success: true, data: bookings, pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
});

/**
 * PUT /admin/bookings/:id/assign
 * Admin manually assigns a provider to a booking
 */
router.put('/bookings/:id/assign', requirePermission('manage_bookings'), async (req, res) => {
  const { providerId } = req.body;
  if (!providerId) throw new AppError('providerId is required', 400);

  const [booking, provider] = await Promise.all([
    Booking.findById(req.params.id),
    Provider.findById(providerId),
  ]);

  if (!booking) throw new AppError('Booking not found', 404);
  if (!provider) throw new AppError('Provider not found', 404);
  if (provider.approvalStatus !== 'approved') throw new AppError('Provider is not approved', 400);
  if (['completed', 'paid', 'cancelled'].includes(booking.status)) {
    throw new AppError(`Cannot assign a ${booking.status} booking`, 400);
  }

  booking.providerId = provider._id;
  booking.status = 'assigned';
  booking.assignedAt = new Date();
  booking.assignedBy = req.userId; // admin who assigned
  await booking.save();

  // Invalidate booking cache
  await cache.del(`booking:${booking._id}`);

  // Notify via socket
  const io = getIO();
  if (io) {
    // Notify customer
    io.to(`user:${booking.customerId}`).emit('booking:status_update', {
      bookingId: booking._id,
      status: 'assigned',
      providerId: { _id: provider._id, name: provider.name, phone: provider.phone, rating: provider.rating },
    });
    // Notify provider
    io.to(`provider:${provider._id}`).emit('booking:new_assignment', {
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber,
    });
  }

  logger.info(`Admin ${req.userId} assigned booking ${booking._id} to provider ${provider._id}`);

  const populated = await Booking.findById(booking._id)
    .populate('customerId', 'name phone')
    .populate('providerId', 'name phone rating')
    .populate('serviceId', 'name category icon')
    .lean();

  res.json({ success: true, message: `Booking assigned to ${provider.name}`, data: populated });
});

/**
 * PUT /admin/bookings/:id/force-complete
 * Admin overrides and force-marks a stuck/overdue booking as completed.
 * Works regardless of current status (assigned, accepted, in_progress).
 */
router.put('/bookings/:id/force-complete', requirePermission('manage_bookings'), async (req, res) => {
  const { reason } = req.body;

  const booking = await Booking.findById(req.params.id)
    .populate('customerId', 'name phone')
    .populate('providerId', 'name phone rating');

  if (!booking) throw new AppError('Booking not found', 404);

  const terminalStatuses = ['completed', 'paid', 'cancelled'];
  if (terminalStatuses.includes(booking.status)) {
    throw new AppError(`Booking is already ${booking.status} — no override needed`, 400);
  }

  const previousStatus = booking.status;

  booking.status = 'completed';
  booking.workDetails.completedAt = new Date();
  booking.timeline.push({
    status: 'completed',
    note: `Admin force-completed (was: ${previousStatus}). Reason: ${reason || 'SLA override by admin'}`,
    timestamp: new Date(),
  });

  // Issue warranty if not already set
  if (!booking.warranty?.warrantyId) {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    booking.warranty = {
      warrantyId: `SH-WRN-${ts}-${rand}`,
      issuedAt: new Date(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'active',
      terms: '30-Day Free Revisit Guarantee covering all labor & service work.',
    };
  }

  await booking.save();

  // Update provider's completed job count
  if (booking.providerId?._id) {
    await Provider.findByIdAndUpdate(booking.providerId._id, {
      $inc: { completedJobs: 1 },
    });
  }

  // Clear Redis busy and active-booking cache
  if (booking.providerId?._id) {
    await cache.del(`provider:busy:${booking.providerId._id}`);
    await cache.del(`active_booking:provider:${booking.providerId._id}`);
  }
  await cache.del(`booking:${booking._id}`);

  // Notify customer
  const io = getIO();
  if (io) {
    io.to(`user:${booking.customerId}`).emit('booking:completed', {
      bookingId: booking._id,
      totalAmount: booking.totalAmount,
      message: 'Your service has been marked as completed by admin.',
    });
  }

  logger.info(`Admin ${req.userId} force-completed booking ${booking.bookingNumber} (was: ${previousStatus}). Reason: ${reason || 'SLA override'}`);

  res.json({
    success: true,
    message: `Booking #${booking.bookingNumber} marked as completed`,
    data: {
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber,
      previousStatus,
      status: 'completed',
      completedAt: booking.workDetails.completedAt,
    },
  });
});

// ── Complaints Management ──────────────────────────────────────────────────────

router.get('/complaints', requirePermission('manage_complaints'), async (req, res) => {
  const { page = 1, limit = 20, status, severity } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (severity) filter.severity = severity;

  // Staff only see their assigned complaints (unless they want to see closed ones which might not matter, but keeping it strict)
  if (req.userRole === 'staff') {
    filter.assignedTo = req.userId;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [complaints, total] = await Promise.all([
    Complaint.find(filter)
      .populate({
        path: 'bookingId',
        select: 'bookingNumber scheduledDate totalAmount status providerId customerId serviceAddress',
        populate: [
          {
            path: 'providerId',
            select: 'name phone rating userId avatar',
            populate: { path: 'userId', select: 'name phone email avatar' }
          },
          { path: 'customerId', select: 'name phone email avatar' }
        ]
      })
      .populate('raisedBy', 'name phone role email avatar')
      .populate('assignedTo', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Complaint.countDocuments(filter),
  ]);

  res.json({ success: true, data: complaints, pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
});

router.put('/complaints/:id/reassign', requirePermission('manage_complaints'), async (req, res) => {
  const { action } = req.body; // 'reassign_provider'
  
  const complaint = await Complaint.findById(req.params.id).populate('bookingId');
  if (!complaint) throw new AppError('Complaint not found', 404);
  
  const booking = complaint.bookingId;
  if (!booking) throw new AppError('Booking not found', 404);

  if (action === 'reassign_provider') {
    // Exclude current provider
    const excluded = booking.assignmentLogs?.map(l => l.providerId.toString()) || [];
    if (booking.providerId && !excluded.includes(booking.providerId.toString())) {
      excluded.push(booking.providerId.toString());
    }

    // Reset booking state for BullMQ matching engine
    booking.status = 'pending';
    booking.providerId = null;
    booking.assignedAt = null;
    await booking.save();

    // Trigger matching engine
    const { bookingQueue } = require('../../jobs');
    await bookingQueue.add('match_provider', {
      bookingId: booking._id,
      serviceId: booking.serviceId,
      coordinates: booking.serviceAddress?.location?.coordinates || [0, 0],
      excludeProviders: excluded,
    });

    complaint.status = 'resolved';
    complaint.resolution = 'Admin initiated provider reassignment';
    await complaint.save();

    logger.info(`Complaint ${complaint._id}: Booking ${booking._id} sent for reassignment`);
    return res.json({ success: true, message: 'Booking sent for automatic reassignment' });
  }

  res.json({ success: false, message: 'Invalid action' });
});

/**
 * PUT /admin/complaints/:id/approve-unfreeze
 * Admin approves provider resolution, resolves complaint, and restores provider job access
 */
router.put('/complaints/:id/approve-unfreeze', requirePermission('manage_complaints'), async (req, res) => {
  const { note } = req.body;

  const complaint = await Complaint.findById(req.params.id).populate('bookingId');
  if (!complaint) throw new AppError('Complaint not found', 404);

  const targetProviderId = complaint.againstUser || complaint.bookingId?.providerId;

  // 1. Update Complaint Status
  complaint.status = 'resolved';
  complaint.resolution = {
    action: 'admin_approved',
    note: note || 'Admin approved provider resolution and restored job access.',
    resolvedBy: req.userId,
    resolvedAt: new Date(),
  };
  complaint.comments.push({
    author: req.userId,
    role: 'admin',
    text: `Complaint Approved & Resolved: ${note || 'Provider job access restored.'}`,
  });
  await complaint.save();

  // 2. Unfreeze Provider Job Access if frozen
  if (targetProviderId) {
    const provider = await Provider.findById(targetProviderId);
    if (provider) {
      const wasFrozen = provider.jobAccessStatus === 'frozen';
      provider.jobAccessStatus = 'active';
      provider.freezeReason = undefined;
      provider.freezeStartedAt = undefined;
      provider.freezeComplaintId = undefined;
      // Guarantee provider account status remains active and unblocked
      await provider.save();

      // Audit Log
      await AuditLog.create({
        action: 'PROVIDER_JOB_FREEZE_REMOVED',
        providerId: provider._id,
        complaintId: complaint._id,
        performedBy: req.userId,
        previousStatus: wasFrozen ? 'frozen' : 'active',
        newStatus: 'active',
        reason: note || 'Admin approved resolution and restored job access',
      }).catch((err) => logger.error('Failed to create AuditLog:', err.message));

      await AuditLog.create({
        action: 'COMPLAINT_RESOLVED',
        providerId: provider._id,
        complaintId: complaint._id,
        performedBy: req.userId,
        previousStatus: complaint.status,
        newStatus: 'resolved',
        reason: 'Admin resolution approval',
      }).catch((err) => logger.error('Failed to create AuditLog:', err.message));

      // Realtime socket & push notification to provider
      const io = getIO();
      if (io) {
        io.to(`provider:${provider._id}`).emit('notification:push', {
          title: '🎉 Job Access Restored!',
          body: 'Your complaint has been resolved by OneWayFix Admin and new job access has been restored.',
          type: 'complaint',
          isOnHold: false,
        });
        io.to(`provider:${provider._id}`).emit('provider:unfrozen', {
          jobAccessStatus: 'active',
          message: 'Job access restored',
        });
      }
    }
  }

  logger.info(`Admin ${req.userId} approved complaint ${complaint._id} and unfroze provider ${targetProviderId}`);
  res.json({
    success: true,
    message: 'Complaint resolved and provider job access restored successfully.',
    data: complaint,
  });
});

/**
 * PUT /admin/complaints/:id/reject-resolution
 * Admin rejects provider resolution submission — provider remains job frozen
 */
router.put('/complaints/:id/reject-resolution', requirePermission('manage_complaints'), async (req, res) => {
  const { adminFeedback } = req.body;
  if (!adminFeedback || typeof adminFeedback !== 'string' || adminFeedback.trim().length < 5) {
    throw new AppError('Detailed feedback is required when rejecting resolution', 400);
  }

  const complaint = await Complaint.findById(req.params.id).populate('bookingId');
  if (!complaint) throw new AppError('Complaint not found', 404);

  const targetProviderId = complaint.againstUser || complaint.bookingId?.providerId;

  complaint.status = 'resolution_rejected';
  complaint.adminFeedback = adminFeedback.trim();
  complaint.rejectedAt = new Date();
  complaint.comments.push({
    author: req.userId,
    role: 'admin',
    text: `Resolution Rejected by Admin: ${adminFeedback.trim()}`,
  });
  await complaint.save();

  // Audit Log
  if (targetProviderId) {
    await AuditLog.create({
      action: 'RESOLUTION_REJECTED',
      providerId: targetProviderId,
      complaintId: complaint._id,
      performedBy: req.userId,
      previousStatus: 'frozen',
      newStatus: 'frozen',
      reason: adminFeedback.trim(),
    }).catch((err) => logger.error('Failed to create AuditLog:', err.message));

    // Notify provider
    const io = getIO();
    if (io) {
      io.to(`provider:${targetProviderId}`).emit('notification:push', {
        title: '❌ Resolution Submission Rejected',
        body: `Your submitted resolution for complaint #${complaint.ticketNumber} was not approved. Reason: ${adminFeedback.trim()}`,
        type: 'complaint',
      });
    }
  }

  res.json({
    success: true,
    message: 'Resolution rejected. Provider remains job frozen until acceptable resolution is provided.',
    data: complaint,
  });
});

/**
 * PUT /admin/complaints/:id/request-more-info
 * Admin requests additional information / evidence from provider
 */
router.put('/complaints/:id/request-more-info', requirePermission('manage_complaints'), async (req, res) => {
  const { adminMessage } = req.body;
  if (!adminMessage || typeof adminMessage !== 'string' || adminMessage.trim().length < 5) {
    throw new AppError('Message detailing required information is required', 400);
  }

  const complaint = await Complaint.findById(req.params.id).populate('bookingId');
  if (!complaint) throw new AppError('Complaint not found', 404);

  const targetProviderId = complaint.againstUser || complaint.bookingId?.providerId;

  complaint.status = 'more_information_required';
  complaint.adminMessage = adminMessage.trim();
  complaint.infoRequestedAt = new Date();
  complaint.comments.push({
    author: req.userId,
    role: 'admin',
    text: `Additional Info Requested: ${adminMessage.trim()}`,
  });
  await complaint.save();

  // Audit Log
  if (targetProviderId) {
    await AuditLog.create({
      action: 'MORE_INFORMATION_REQUESTED',
      providerId: targetProviderId,
      complaintId: complaint._id,
      performedBy: req.userId,
      previousStatus: 'frozen',
      newStatus: 'frozen',
      reason: adminMessage.trim(),
    }).catch((err) => logger.error('Failed to create AuditLog:', err.message));

    // Notify provider
    const io = getIO();
    if (io) {
      io.to(`provider:${targetProviderId}`).emit('notification:push', {
        title: 'ℹ️ Additional Info Required',
        body: `Admin requested more information regarding complaint #${complaint.ticketNumber}: ${adminMessage.trim()}`,
        type: 'complaint',
      });
    }
  }

  res.json({
    success: true,
    message: 'Request for additional information sent to provider.',
    data: complaint,
  });
});

// ── Fraud Detection ────────────────────────────────────────────────────────────
router.get('/fraud/alerts', requirePermission('manage_complaints'), async (req, res) => {
  const [
    highRiskProviders,
    frequentComplaints,
    suspiciousOvercharging,
  ] = await Promise.all([
    Provider.find({ riskScore: { $gte: 70 } })
      .select('name phone riskScore warningCount completedJobs')
      .sort({ riskScore: -1 })
      .limit(20)
      .lean(),
    Complaint.aggregate([
      { $match: { createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
      { $group: { _id: '$againstUser', count: { $sum: 1 }, categories: { $push: '$category' } } },
      { $match: { count: { $gte: 3 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]),
    Complaint.find({ category: 'overcharging', status: 'open' })
      .populate('bookingId', 'bookingNumber totalAmount basePrice')
      .populate('raisedBy', 'name phone')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
  ]);

  res.json({
    success: true,
    data: { highRiskProviders, frequentComplaints, suspiciousOvercharging },
  });
});

// SCALE FIX: Process in batches of 100 — never load all 50M providers into memory
router.post('/fraud/recalculate-risk', requirePermission('manage_complaints'), async (req, res) => {
  const BATCH_SIZE = 100;
  let processed = 0;
  let cursor = null;

  const query = { approvalStatus: 'approved' };
  const totalCount = await Provider.countDocuments(query).maxTimeMS(5000);

  // Process in batches using cursor pagination
  let lastId = null;
  while (true) {
    const batchQuery = lastId ? { ...query, _id: { $gt: lastId } } : query;
    const batch = await Provider.find(batchQuery)
      .select('_id warningCount rating ratingCount')
      .sort({ _id: 1 })
      .limit(BATCH_SIZE)
      .lean();

    if (batch.length === 0) break;
    lastId = batch[batch.length - 1]._id;

    for (const provider of batch) {
      const [complaints30d, overchargeComplaints] = await Promise.all([
        Complaint.countDocuments({
          againstUser: provider._id,
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        }).maxTimeMS(3000),
        Complaint.countDocuments({ againstUser: provider._id, category: 'overcharging' }).maxTimeMS(3000),
      ]);

      let riskScore = 0;
      riskScore += Math.min(complaints30d * 10, 40);
      riskScore += Math.min(overchargeComplaints * 15, 30);
      riskScore += Math.min(provider.warningCount * 10, 30);
      if (provider.rating < 3.0 && provider.ratingCount > 10) riskScore += 20;
      riskScore = Math.min(riskScore, 100);

      await Provider.findByIdAndUpdate(provider._id, { riskScore });
      processed++;
    }
  }

  res.json({ success: true, message: `Risk scores recalculated for ${processed} / ${totalCount} providers` });
});

// ── Commission & Financial ─────────────────────────────────────────────────────
router.get('/financials', requirePermission('manage_financials'), async (req, res) => {
  const { from, to } = req.query;
  const dateFilter = {};
  if (from) dateFilter.$gte = new Date(from);
  if (to) dateFilter.$lte = new Date(to);

  const filter = { type: 'payment', status: 'success' };
  if (from || to) filter.createdAt = dateFilter;

  const [revenue, commissions, refunds, settlements, dailyRevenue] = await Promise.all([
    Transaction.aggregate([
      { $match: { ...filter } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Transaction.aggregate([
      { $match: { type: 'commission', status: 'success', ...(from || to ? { createdAt: dateFilter } : {}) } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Transaction.aggregate([
      { $match: { type: 'refund', status: 'success', ...(from || to ? { createdAt: dateFilter } : {}) } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Transaction.aggregate([
      { $match: { type: 'settlement', ...(from || to ? { createdAt: dateFilter } : {}) } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Transaction.aggregate([
      { $match: { ...filter } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      revenue: { amount: revenue[0]?.total || 0, transactions: revenue[0]?.count || 0 },
      commissions: { amount: commissions[0]?.total || 0, transactions: commissions[0]?.count || 0 },
      refunds: { amount: refunds[0]?.total || 0, transactions: refunds[0]?.count || 0 },
      settlements: { amount: settlements[0]?.total || 0, transactions: settlements[0]?.count || 0 },
      netRevenue: (revenue[0]?.total || 0) - (refunds[0]?.total || 0),
      dailyRevenue: dailyRevenue || [],
    },
  });
});

// ── Service Management ─────────────────────────────────────────────────────────
router.post('/services', requirePermission('manage_services'), async (req, res) => {
  const service = await Service.create(req.body);
  await cache.del('services:all'); // Invalidate cache
  res.status(201).json({ success: true, data: service });
});

router.put('/services/:id', requirePermission('manage_services'), async (req, res) => {
  const service = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!service) throw new AppError('Service not found', 404);
  await cache.delPattern('services:*');
  res.json({ success: true, data: service });
});

router.delete('/services/:id', requirePermission('manage_services'), async (req, res) => {
  await Service.findByIdAndUpdate(req.params.id, { isActive: false });
  await cache.delPattern('services:*');
  res.json({ success: true, message: 'Service deactivated' });
});

// ── Wallet & Commission Management ────────────────────────────────────────────

/**
 * GET /admin/providers/:id/dues
 * View a provider's pending commission dues
 */
router.get('/providers/:id/dues', requirePermission('manage_financials'), async (req, res) => {
  const provider = await Provider.findById(req.params.id)
    .select('name phone earnings.pendingCommission earnings.commissionDueSince earnings.isOnHold earnings.walletBalance earnings.securityDeposit')
    .lean();
  if (!provider) throw new AppError('Provider not found', 404);

  const daysOverdue = provider.earnings.commissionDueSince
    ? Math.floor((Date.now() - new Date(provider.earnings.commissionDueSince)) / (1000 * 60 * 60 * 24))
    : 0;

  // Fetch unpaid cash commission transactions
  const { Transaction } = require('../../models');
  const pendingCommissions = await Transaction.find({
    providerId: req.params.id,
    type: 'commission',
    status: 'pending',
    paymentMethod: 'cash',
  }).populate('bookingId', 'bookingNumber scheduledDate totalAmount').sort({ createdAt: -1 }).lean();

  res.json({
    success: true,
    data: {
      name: provider.name,
      phone: provider.phone,
      walletBalance: provider.earnings.walletBalance,
      securityDeposit: provider.earnings.securityDeposit || 0,
      cashCommissionBalance: (provider.earnings.walletBalance || 0) + (provider.earnings.securityDeposit || 0),
      pendingCommission: provider.earnings.pendingCommission || 0,
      commissionDueSince: provider.earnings.commissionDueSince,
      daysOverdue,
      isOnHold: provider.earnings.isOnHold || false,
      transactions: pendingCommissions,
    },
  });
});

/**
 * PUT /admin/providers/:id/wallet
 * Admin manually adjusts provider wallet or security deposit
 * Body: { amount: Number, type: 'credit'|'debit', reason: String, target?: 'wallet'|'securityDeposit' }
 */
router.put('/providers/:id/wallet', requirePermission('manage_financials'), async (req, res) => {
  const { amount, type, reason, target = 'wallet' } = req.body;
  if (!amount || amount <= 0) throw new AppError('Valid amount required', 400);
  if (!['credit', 'debit'].includes(type)) throw new AppError('type must be credit or debit', 400);
  if (!['wallet', 'securityDeposit'].includes(target)) throw new AppError('target must be wallet or securityDeposit', 400);
  if (!reason) throw new AppError('Reason is required', 400);

  const provider = await Provider.findById(req.params.id);
  if (!provider) throw new AppError('Provider not found', 404);

  const { WalletLedger } = require('../../models');
  const targetField = target === 'securityDeposit' ? 'securityDeposit' : 'walletBalance';
  const ledgerAccount = target === 'securityDeposit' ? 'security_deposit' : 'wallet';
  const targetLabel = target === 'securityDeposit' ? 'security deposit' : 'wallet';

  if (type === 'credit') {
    provider.earnings[targetField] = (provider.earnings[targetField] || 0) + amount;
    // If provider had pending commission, auto-clear if wallet covers it
    if (target === 'wallet' && provider.earnings.pendingCommission > 0 && provider.earnings.walletBalance >= provider.earnings.pendingCommission) {
      provider.earnings.totalCommissionPaid += provider.earnings.pendingCommission;
      provider.earnings.walletBalance -= provider.earnings.pendingCommission;
      provider.earnings.pendingCommission = 0;
      provider.earnings.commissionDueSince = null;
      provider.earnings.isOnHold = false;
      logger.info(`Admin auto-cleared commission dues for provider ${provider._id} after top-up`);
    }
  } else {
    if (target === 'securityDeposit' && (provider.earnings.securityDeposit || 0) < amount) {
      throw new AppError('Insufficient security deposit balance', 400);
    }
    provider.earnings[targetField] = (provider.earnings[targetField] || 0) - amount;
  }

  await provider.save();

  await WalletLedger.create({
    ownerId: provider._id,
    ownerType: 'provider',
    type,
    account: ledgerAccount,
    amount,
    balance: provider.earnings[targetField],
    description: `Admin manual ${type} on ${targetLabel}: ${reason}`,
    referenceType: 'admin_adjustment',
  });

  logger.info(`Admin ${req.userId} ${type}ed Rs.${amount} to/from provider ${provider._id} ${targetLabel}: ${reason}`);

  res.json({
    success: true,
    message: `${targetLabel} ${type === 'credit' ? 'topped up' : 'debited'} by Rs.${amount}`,
    data: {
      walletBalance: provider.earnings.walletBalance,
      securityDeposit: provider.earnings.securityDeposit || 0,
      cashCommissionBalance: (provider.earnings.walletBalance || 0) + (provider.earnings.securityDeposit || 0),
      pendingCommission: provider.earnings.pendingCommission,
      isOnHold: provider.earnings.isOnHold,
    },
  });
});

/**
 * PUT /admin/providers/:id/dues/clear
 * Admin marks commission as paid and lifts the job hold
 * Body: { amountPaid: Number, note: String }
 */
router.put('/providers/:id/dues/clear', requirePermission('manage_financials'), async (req, res) => {
  const { amountPaid, note } = req.body;
  const provider = await Provider.findById(req.params.id);
  if (!provider) throw new AppError('Provider not found', 404);

  const due = provider.earnings.pendingCommission || 0;
  if (due === 0) throw new AppError('No pending commission dues', 400);

  const paid = amountPaid || due;
  const { Transaction, WalletLedger } = require('../../models');

  // Mark commission transactions as settled
  await Transaction.updateMany(
    { providerId: req.params.id, type: 'commission', status: 'pending', paymentMethod: 'cash' },
    { status: 'success', metadata: { clearedBy: req.userId, clearedAt: new Date(), note } }
  );

  provider.earnings.totalCommissionPaid += paid;
  provider.earnings.pendingCommission = Math.max(0, due - paid);
  if (provider.earnings.pendingCommission === 0) {
    provider.earnings.commissionDueSince = null;
    provider.earnings.isOnHold = false;
  }
  await provider.save();

  await WalletLedger.create({
    ownerId: provider._id,
    ownerType: 'provider',
    type: 'debit',
    amount: paid,
    balance: provider.earnings.walletBalance,
    description: `Commission dues cleared by admin: ${note || 'Cash collected'}`,
    referenceType: 'commission_settlement',
  });

  // Notify provider
  const { emitToProvider } = require('../../socket');
  emitToProvider(req.params.id, 'notification:push', {
    title: '✅ Hold Lifted',
    body: `Your account hold has been removed. You can now accept new jobs!`,
  });

  logger.info(`Admin ${req.userId} cleared ₹${paid} commission dues for provider ${req.params.id}`);

  res.json({
    success: true,
    message: `Commission dues cleared. Hold ${provider.earnings.isOnHold ? 'partially lifted' : 'fully lifted'}.`,
    data: {
      pendingCommission: provider.earnings.pendingCommission,
      isOnHold: provider.earnings.isOnHold,
    },
  });
});

// ── Service Catalog Management (Admin CRUD) ──────────────────────────────────
router.get('/services', requirePermission('manage_services'), async (req, res) => {
  const { category, search } = req.query;
  const filter = {};
  if (category) filter.category = category;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }
  const services = await Service.find(filter).sort({ createdAt: -1 }).lean();
  res.json({ success: true, count: services.length, data: services });
});

router.post('/services', requirePermission('manage_services'), async (req, res) => {
  const { name, category, description, basePrice, duration, icon, image, includes, excludes, categoryOptions, isActive = true } = req.body;
  if (!name || !category || !basePrice) {
    throw new AppError('Name, Category and Base Price are required', 400);
  }

  const baseSlug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const slug = `${baseSlug}-${Date.now().toString(36)}`;

  const service = await Service.create({
    name: name.trim(),
    slug,
    category: category.trim(),
    description: description?.trim() || name.trim(),
    basePrice: Number(basePrice),
    duration: Number(duration) || 60,
    icon: icon || '🛠️',
    image: image || '',
    includes: Array.isArray(includes) ? includes : (includes ? String(includes).split(',').map(s => s.trim()) : []),
    excludes: Array.isArray(excludes) ? excludes : (excludes ? String(excludes).split(',').map(s => s.trim()) : []),
    categoryOptions: Array.isArray(categoryOptions) ? categoryOptions : [],
    isActive: Boolean(isActive),
  });

  // Invalidate Redis caches so frontend gets new service instantly
  await cache.delPattern('services:*');
  await cache.del('service:categories:rich');

  logger.info(`Admin created new service "${service.name}" (${service._id}) in category "${service.category}"`);
  res.status(201).json({ success: true, message: 'Service created successfully', data: service });
});

router.put('/services/:id', requirePermission('manage_services'), async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid Service ID', 400);

  const updates = { ...req.body };
  delete updates._id;
  delete updates.createdAt;
  delete updates.updatedAt;

  if (updates.name && !updates.slug) {
    const baseSlug = updates.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    updates.slug = `${baseSlug}-${Date.now().toString(36)}`;
  }

  const service = await Service.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
  if (!service) throw new AppError('Service not found', 404);

  // Invalidate Redis caches so frontend gets updated service instantly
  await cache.delPattern('services:*');
  await cache.del('service:categories:rich');

  logger.info(`Admin updated service "${service.name}" (${service._id})`);
  res.json({ success: true, message: 'Service updated successfully', data: service });
});

router.delete('/services/:id', requirePermission('manage_services'), async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid Service ID', 400);

  const service = await Service.findByIdAndDelete(id);
  if (!service) throw new AppError('Service not found', 404);

  // Invalidate Redis caches
  await cache.delPattern('services:*');
  await cache.del('service:categories:rich');

  logger.info(`Admin deleted service "${service.name}" (${service._id})`);
  res.json({ success: true, message: 'Service deleted successfully' });
});

// ── Dynamic Pricing Control ────────────────────────────────────────────────────
router.put('/pricing/surge', requirePermission('manage_services'), async (req, res) => {
  const { serviceId, hour, multiplier } = req.body;
  if (multiplier < 1 || multiplier > 3) throw new AppError('Surge multiplier must be between 1 and 3', 400);

  const key = `surge:${serviceId}:${hour}`;
  await cache.set(key, multiplier, 3600); // 1 hour override

  res.json({ success: true, message: `Surge pricing set to ${multiplier}x for service ${serviceId} at hour ${hour}` });
});

// ── Bank Account Verification ──────────────────────────────────────────────────
router.put('/providers/:id/bank/approve', requirePermission('manage_providers'), async (req, res) => {
  const provider = await Provider.findById(req.params.id);
  if (!provider) throw new AppError('Provider not found', 404);
  if (!provider.earnings?.bankAccount?.accountNumber) throw new AppError('No bank account found', 400);
  
  provider.earnings.bankAccount.verified = true;
  await provider.save();
  res.json({ success: true, message: 'Bank account verified successfully' });
});

router.put('/providers/:id/bank/reject', requirePermission('manage_providers'), async (req, res) => {
  const provider = await Provider.findById(req.params.id);
  if (!provider) throw new AppError('Provider not found', 404);
  
  // Wipe bank account if rejected so they can resubmit clearly
  provider.earnings.bankAccount = undefined;
  await provider.save();
  res.json({ success: true, message: 'Bank account rejected. Provider must resubmit.' });
});

// ── Payouts Management ─────────────────────────────────────────────────────────

router.get('/payouts', requirePermission('manage_financials'), async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Find providers who have a wallet balance > 0 (meaning we owe them money)
  const filter = { 'earnings.walletBalance': { $gt: 0 } };
  
  const [providers, total] = await Promise.all([
    Provider.find(filter)
      .sort({ 'earnings.walletBalance': -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('name phone earnings.walletBalance earnings.bankAccount')
      .lean(),
    Provider.countDocuments(filter),
  ]);

  res.json({ success: true, data: providers, pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
});

router.put('/payouts/:id/settle', requirePermission('manage_financials'), async (req, res) => {
  const { amount, reference, note } = req.body;
  const provider = await Provider.findById(req.params.id);
  if (!provider) throw new AppError('Provider not found', 404);
  
  if (provider.earnings.walletBalance < amount) {
    throw new AppError('Settlement amount exceeds wallet balance', 400);
  }

  provider.earnings.walletBalance -= amount;
  provider.earnings.totalEarnings += amount; // optional depending on logic
  await provider.save();

  const { WalletLedger } = require('../../models');
  await WalletLedger.create({
    ownerId: provider._id,
    ownerType: 'provider',
    type: 'debit',
    amount,
    balance: provider.earnings.walletBalance,
    description: `Admin settled payout (Ref: ${reference}): ${note}`,
    referenceType: 'payout',
  });

  res.json({ success: true, message: `Successfully settled ₹${amount} for ${provider.name}` });
});

// ── System & Dynamic Branding Settings (Bagisto Style) ───────────────────────────

const DEFAULT_VIDEOS = [
  {
    video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    title: 'AC Service & Repair',
    desc: 'Beat the heat — certified AC experts at your home today',
    badge: '🔥 Most Booked',
    cta: 'Book AC Service',
    category: 'AC Repair',
    active: true,
  },
  {
    video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    title: 'Home Deep Cleaning',
    desc: 'Sparkling clean homes in just 4 hours by our experts',
    badge: '⭐ Top Rated',
    cta: 'Book Cleaning',
    category: 'Cleaning',
    active: true,
  },
  {
    video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    title: 'Plumbing & Electrical',
    desc: 'Expert plumbers & electricians at your door in 60 mins',
    badge: '⚡ Express',
    cta: 'Book Now',
    category: 'Plumbing',
    active: true,
  },
];

router.get('/settings', async (req, res) => {
  try {
    let settings = await SystemSettings.findOne({ key: 'global' }).lean();
    if (!settings) {
      settings = await SystemSettings.create({
        key: 'global',
        siteName: 'OneWayFix',
        logoUrl: '/logo.png',
        faviconUrl: '/logo.svg',
        tagline: 'Premium Home Services at your Doorstep',
        videoSpotlights: DEFAULT_VIDEOS,
      });
    }
    res.json({ success: true, data: settings });
  } catch (err) {
    logger.error('Failed to load admin settings:', err);
    res.json({
      success: true,
      data: {
        key: 'global',
        siteName: 'OneWayFix',
        logoUrl: '/logo.png',
        faviconUrl: '/logo.svg',
        tagline: 'Premium Home Services at your Doorstep',
        videoSpotlights: DEFAULT_VIDEOS,
      },
    });
  }
});

router.put('/settings', authorize('admin', 'staff'), async (req, res) => {
  try {
    const { 
      siteName, logoUrl, faviconUrl, tagline, currencySymbol, timezone, defaultRadius,
      supportPhone, supportEmail, supportAddress, workingHours,
      gstRate, platformFee, plusPrice, plusPrice6Months, plusPrice1Year, subscriptionModelActive,
      announcementText, announcementActive, maintenanceMode, allowBookings,
      facebookUrl, instagramUrl, twitterUrl, youtubeUrl, whatsappNumber,
      apkDownloadUrl, playStoreUrl, appStoreUrl,
      defaultCommissionRate, minSettlementAmount, maxCommissionDebtLimit, autoApproveKyc,
      metaTitle, metaDescription, metaKeywords, googleAnalyticsId,
      termsContent, privacyContent, refundContent,
      promoBanners, categoryBanners, videoSpotlights 
    } = req.body;
    
    let settings = await SystemSettings.findOne({ key: 'global' });
    if (!settings) {
      settings = new SystemSettings({ key: 'global' });
    }

    if (siteName !== undefined) settings.siteName = siteName;
    if (logoUrl !== undefined) settings.logoUrl = logoUrl;
    if (faviconUrl !== undefined) settings.faviconUrl = faviconUrl;
    if (tagline !== undefined) settings.tagline = tagline;
    if (currencySymbol !== undefined) settings.currencySymbol = currencySymbol;
    if (timezone !== undefined) settings.timezone = timezone;
    if (defaultRadius !== undefined) settings.defaultRadius = defaultRadius;

    if (supportPhone !== undefined) settings.supportPhone = supportPhone;
    if (supportEmail !== undefined) settings.supportEmail = supportEmail;
    if (supportAddress !== undefined) settings.supportAddress = supportAddress;
    if (workingHours !== undefined) settings.workingHours = workingHours;

    if (gstRate !== undefined) settings.gstRate = gstRate;
    if (platformFee !== undefined) settings.platformFee = platformFee;
    if (plusPrice !== undefined) settings.plusPrice = plusPrice;
    if (plusPrice6Months !== undefined) settings.plusPrice6Months = plusPrice6Months;
    if (plusPrice1Year !== undefined) settings.plusPrice1Year = plusPrice1Year;
    if (subscriptionModelActive !== undefined) settings.subscriptionModelActive = subscriptionModelActive;

    if (announcementText !== undefined) settings.announcementText = announcementText;
    if (announcementActive !== undefined) settings.announcementActive = announcementActive;
    if (maintenanceMode !== undefined) settings.maintenanceMode = maintenanceMode;
    if (allowBookings !== undefined) settings.allowBookings = allowBookings;

    if (facebookUrl !== undefined) settings.facebookUrl = facebookUrl;
    if (instagramUrl !== undefined) settings.instagramUrl = instagramUrl;
    if (twitterUrl !== undefined) settings.twitterUrl = twitterUrl;
    if (youtubeUrl !== undefined) settings.youtubeUrl = youtubeUrl;
    if (whatsappNumber !== undefined) settings.whatsappNumber = whatsappNumber;

    if (apkDownloadUrl !== undefined) settings.apkDownloadUrl = apkDownloadUrl;
    if (playStoreUrl !== undefined) settings.playStoreUrl = playStoreUrl;
    if (appStoreUrl !== undefined) settings.appStoreUrl = appStoreUrl;

    if (defaultCommissionRate !== undefined) settings.defaultCommissionRate = defaultCommissionRate;
    if (minSettlementAmount !== undefined) settings.minSettlementAmount = minSettlementAmount;
    if (maxCommissionDebtLimit !== undefined) settings.maxCommissionDebtLimit = maxCommissionDebtLimit;
    if (autoApproveKyc !== undefined) settings.autoApproveKyc = autoApproveKyc;

    if (metaTitle !== undefined) settings.metaTitle = metaTitle;
    if (metaDescription !== undefined) settings.metaDescription = metaDescription;
    if (metaKeywords !== undefined) settings.metaKeywords = metaKeywords;
    if (googleAnalyticsId !== undefined) settings.googleAnalyticsId = googleAnalyticsId;

    if (termsContent !== undefined) settings.termsContent = termsContent;
    if (privacyContent !== undefined) settings.privacyContent = privacyContent;
    if (refundContent !== undefined) settings.refundContent = refundContent;

    if (Array.isArray(promoBanners)) settings.promoBanners = promoBanners;
    if (Array.isArray(categoryBanners)) settings.categoryBanners = categoryBanners;
    if (Array.isArray(videoSpotlights)) settings.videoSpotlights = videoSpotlights;

    await settings.save();
    try { await cache.del('system:settings'); } catch (e) {}

    res.json({ success: true, message: 'Website settings & store configurations saved successfully', data: settings });
  } catch (err) {
    logger.error('Failed to update admin settings:', err);
    throw new AppError(err.message || 'Failed to save system settings', 500);
  }
});

// ── Admin Financial Controls: Provider Manual Wallet Adjustment ─────────────────
router.all(['/providers/:id/wallet', '/provider/:id/wallet-adjust'], authorize('admin'), async (req, res) => {
  const { amount, type = 'credit', reason } = req.body;
  const numAmt = Number(amount);
  if (!numAmt || numAmt <= 0) throw new AppError('Valid positive adjustment amount required', 400);

  const provider = await Provider.findById(req.params.id);
  if (!provider) throw new AppError('Provider not found', 404);

  const currentWallet = Number(provider.earnings?.walletBalance || 0);
  const newWallet = type === 'credit' ? currentWallet + numAmt : currentWallet - numAmt;
  
  provider.earnings.walletBalance = newWallet;
  if (newWallet < 0) {
    provider.earnings.pendingCommission = Math.abs(newWallet);
  } else {
    provider.earnings.pendingCommission = 0;
    provider.earnings.commissionDueSince = null;
  }

  // Check if unhold is warranted (negative balance improved above -500)
  if (newWallet > -500 && provider.earnings.pendingCommission < 500) {
    provider.earnings.isOnHold = false;
  }

  await provider.save();

  // Audit Ledger Entry
  await WalletLedger.create([{
    ownerId: provider._id,
    ownerType: 'provider',
    type: type === 'credit' ? 'credit' : 'debit',
    account: 'wallet',
    amount: numAmt,
    balance: newWallet,
    description: `Admin Manual ${type.toUpperCase()}: ${reason || 'Manual financial adjustment'}`,
  }]);

  // Notify Provider
  const io = getIO();
  io.to(`provider:${provider._id}`).emit('notification:push', {
    title: `💰 Wallet ${type === 'credit' ? 'Credited' : 'Debited'} by Admin`,
    body: `₹${numAmt} was ${type === 'credit' ? 'credited to' : 'debited from'} your wallet. (${reason || 'Adjustment'}). New balance: ₹${newWallet}`,
    pendingCommission: provider.earnings.pendingCommission,
    isOnHold: provider.earnings.isOnHold,
  });

  res.json({
    success: true,
    message: `Provider wallet successfully ${type === 'credit' ? 'credited' : 'debited'} by ₹${numAmt}`,
    data: {
      providerId: provider._id,
      walletBalance: newWallet,
      pendingCommission: provider.earnings.pendingCommission,
      isOnHold: provider.earnings.isOnHold,
    },
  });
});

// ── Admin Financial Controls: Provider Hold Override ───────────────────────────
router.all(['/providers/:id/dues/clear', '/provider/:id/toggle-hold'], authorize('admin'), async (req, res) => {
  const { isOnHold, reason } = req.body;
  const isHold = typeof isOnHold === 'boolean' ? isOnHold : false;

  const provider = await Provider.findById(req.params.id);
  if (!provider) throw new AppError('Provider not found', 404);

  provider.earnings.isOnHold = isHold;
  if (!isHold) {
    provider.earnings.pendingCommission = 0;
    provider.earnings.commissionDueSince = null;
    if (provider.earnings.walletBalance < 0) {
      provider.earnings.walletBalance = 0;
    }
  }

  await provider.save();

  const title = isHold ? '🔴 Account Placed On Hold by Admin' : '✅ Account Hold Lifted by Admin';
  const body = isHold
    ? `Your account dispatch has been suspended by Admin. Reason: ${reason || 'Administrative review'}`
    : `Your account hold has been lifted by Admin. You can now accept live job requests!`;

  const io = getIO();
  io.to(`provider:${provider._id}`).emit('notification:push', {
    title,
    body,
    isOnHold: provider.earnings.isOnHold,
  });

  res.json({
    success: true,
    message: `Provider account hold status updated to ${isHold}`,
    data: {
      providerId: provider._id,
      isOnHold: provider.earnings.isOnHold,
      walletBalance: provider.earnings.walletBalance,
      pendingCommission: provider.earnings.pendingCommission,
    },
  });
});

// ── Admin Provider Tier & Verified Badge Assignment ──────────────────────────────
router.put('/providers/:id/tier', authorize('admin', 'staff'), async (req, res) => {
  const { tier } = req.body;
  const validTiers = ['bronze', 'silver', 'gold', 'verified_pro', 'platinum'];
  if (!validTiers.includes(tier)) {
    throw new AppError(`Invalid tier. Must be one of: ${validTiers.join(', ')}`, 400);
  }

  const provider = await Provider.findById(req.params.id);
  if (!provider) throw new AppError('Provider not found', 404);

  provider.tier = tier;
  if (tier === 'verified_pro' || tier === 'platinum') {
    if (!provider.badges.includes('UC Verified Pro')) {
      provider.badges.push('UC Verified Pro');
    }
  }
  await provider.save();

  logger.info(`Admin/Staff ${req.userId} updated provider ${provider._id} tier to ${tier}`);
  res.json({
    success: true,
    message: `Provider badge tier updated to ${tier.toUpperCase()}`,
    data: { providerId: provider._id, tier: provider.tier, badges: provider.badges },
  });
});

// ── Distributed Workload: Bulk Approve Providers ──────────────────────────────
router.post('/providers/bulk-approve', requirePermission('manage_providers'), async (req, res) => {
  const { providerIds } = req.body;
  if (!Array.isArray(providerIds) || providerIds.length === 0) {
    throw new AppError('Array of providerIds required', 400);
  }

  const result = await Provider.updateMany(
    { _id: { $in: providerIds }, approvalStatus: 'pending' },
    {
      $set: {
        approvalStatus: 'approved',
        'kyc.status': 'verified',
        'kyc.verifiedAt': new Date(),
        'kyc.verifiedBy': req.userId,
      },
    }
  );

  logger.info(`Admin/Staff ${req.userId} bulk-approved ${result.modifiedCount} providers`);
  res.json({
    success: true,
    message: `Successfully approved ${result.modifiedCount} providers`,
    data: { count: result.modifiedCount },
  });
});

// ── Distributed Workload: Auto-Distribute Pending KYCs across Staff Team ───────
router.post('/providers/auto-distribute-kyc', authorize('admin'), async (req, res) => {
  const staffMembers = await User.find({ role: 'staff', isBlocked: false }).select('_id name').lean();
  if (staffMembers.length === 0) {
    throw new AppError('No active staff team members found to distribute workload', 400);
  }

  const pendingProviders = await Provider.find({ approvalStatus: 'pending', 'kyc.status': 'submitted' })
    .select('_id')
    .lean();

  if (pendingProviders.length === 0) {
    return res.json({ success: true, message: 'No pending KYC applications to distribute', data: { distributed: 0 } });
  }

  let distributed = 0;
  for (let i = 0; i < pendingProviders.length; i++) {
    const assignedStaff = staffMembers[i % staffMembers.length];
    await Provider.findByIdAndUpdate(pendingProviders[i]._id, {
      'kyc.assignedTo': assignedStaff._id,
    });
    distributed++;
  }

  logger.info(`Auto-distributed ${distributed} pending KYCs across ${staffMembers.length} staff members`);
  res.json({
    success: true,
    message: `Distributed ${distributed} pending applications across ${staffMembers.length} staff team members evenly!`,
    data: { distributed, staffCount: staffMembers.length },
  });
});

// ── Admin Broadcast Announcements (Real-Time WebSockets & Database Persistence) ──
router.get('/announcements', authorize('admin', 'staff'), async (req, res) => {
  const announcements = await Notification.aggregate([
    { $match: { type: 'announcement' } },
    {
      $group: {
        _id: { title: "$title", body: "$body" },
        createdAt: { $max: "$createdAt" },
        recipientCount: { $sum: 1 }
      }
    },
    { $sort: { createdAt: -1 } },
    { $limit: 25 }
  ]);

  res.json({
    success: true,
    data: announcements.map(a => ({
      title: a._id.title,
      body: a._id.body,
      createdAt: a.createdAt,
      recipientCount: a.recipientCount,
    }))
  });
});

router.post('/announcements', authorize('admin', 'staff'), async (req, res) => {
  const { title, body, targetRole } = req.body;
  if (!title || !title.trim() || !body || !body.trim() || !targetRole) {
    throw new AppError('Title, body, and target audience role are required', 400);
  }

  const cleanTitle = title.trim();
  const cleanBody = body.trim();

  // 1. Determine target users
  let userQuery = { isBlocked: false };
  if (targetRole === 'customer') {
    userQuery.role = 'customer';
  } else if (targetRole === 'technician' || targetRole === 'provider') {
    userQuery.role = 'provider';
  } else if (targetRole === 'staff') {
    userQuery.role = 'staff';
  }

  const targetUsers = await User.find(userQuery).select('_id role').lean();

  // 2. Persist in Database for all target users
  if (targetUsers.length > 0) {
    const notificationsToInsert = targetUsers.map(u => ({
      userId: u._id,
      title: cleanTitle,
      body: cleanBody,
      type: 'announcement',
      isRead: false,
      createdAt: new Date(),
    }));
    await Notification.insertMany(notificationsToInsert);
  }

  // 3. Dispatch real-time WebSocket Push Notification
  try {
    const io = getIO();
    io.emit('notification:push', {
      title: `📢 ${cleanTitle}`,
      body: cleanBody,
      type: 'announcement',
      targetRole: targetRole,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.warn('Socket broadcast error:', err.message);
  }

  // 4. Update Public Announcement Banner if target audience is ALL
  if (targetRole === 'all') {
    try {
      const PublicSettings = require('../../models/PublicSettings');
      let settings = await PublicSettings.findOne();
      if (!settings) {
        settings = new PublicSettings({});
      }
      settings.announcementActive = true;
      settings.announcementText = `${cleanTitle}: ${cleanBody}`;
      await settings.save();
    } catch (e) {
      logger.warn('Could not update public banner settings:', e.message);
    }
  }

  logger.info(`Admin/Staff ${req.userId} broadcasted announcement to ${targetRole} (${targetUsers.length} users)`);

  res.json({
    success: true,
    message: `Broadcast successfully pushed in real-time to ${targetUsers.length} target users!`,
    data: {
      title: cleanTitle,
      body: cleanBody,
      referenceType: targetRole,
      recipientCount: targetUsers.length,
      createdAt: new Date(),
    },
  });
});

// ── Invoice & GST Settings APIs ───────────────────────────────────────────────

/**
 * GET /admin/invoice-settings
 * Fetches current invoice & GST customization configuration
 */
router.get('/invoice-settings', async (req, res) => {
  const settings = await invoiceService.getInvoiceSettings();
  res.json({ success: true, data: settings });
});

/**
 * PUT /admin/invoice-settings
 * Saves updated invoice & GST configuration (Super Admin or staff with manage_financials)
 */
router.put('/invoice-settings', async (req, res) => {
  const role = req.userRole || req.user?.role;
  const permissions = req.user?.permissions || [];
  const hasAuth = role === 'admin' || (Array.isArray(permissions) && permissions.includes('manage_financials'));
  if (!hasAuth) {
    throw new AppError('Unauthorized: Only Financials Authorized Admin/Staff can edit invoice settings', 403);
  }

  const updatedSettings = await invoiceService.updateInvoiceSettings(req.body);
  logger.info(`Admin/Staff ${req.userId} updated Invoice & GST Settings (v${updatedSettings.settingsVersion})`);

  res.json({
    success: true,
    message: 'Invoice & GST Settings saved successfully',
    data: updatedSettings,
  });
});

/**
 * POST /admin/invoice-settings/preview
 * Generates a live sample PDF using demo data and custom/unsaved settings
 */
router.post('/invoice-settings/preview', async (req, res) => {
  const customSettings = req.body || {};
  const currentSettings = (await invoiceService.getInvoiceSettings()).toObject();
  const mergedSettings = { ...currentSettings, ...customSettings };

  const demoBooking = {
    bookingNumber: 'OWF-INV-100001',
    status: 'paid',
    basePrice: 501,
    surgeMultiplier: 1.0,
    platformFee: 100,
    materialCost: 0,
    extraCharges: 0,
    discountAmount: 0,
    totalAmount: 601,
    paymentMethod: 'ONLINE / UPI',
    updatedAt: new Date(),
    serviceId: { name: 'AC Repair - Gas Charging', category: 'AC Repair' },
    customerId: { name: 'Demo Customer', phone: '+91 98765 43210', email: 'customer@onewayfix.com' },
    providerId: { name: 'Vishnu Vardhan Reddy', phone: '+91 91234 56789', rating: 4.9 },
    serviceAddress: { line1: 'Plot 42, Hitech City Main Rd', city: 'Hyderabad' },
  };

  const pdfBuffer = await pdfService.generateInvoice({
    booking: demoBooking,
    materials: null,
    transaction: { paymentMethod: 'ONLINE / UPI', razorpayPaymentId: 'pay_demo_123456' },
    settingsOverride: mergedSettings,
  });

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': 'inline; filename=invoice-preview.pdf',
    'Content-Length': pdfBuffer.length,
  });
  res.send(pdfBuffer);
});

/**
 * POST /admin/invoice-settings/reset
 * Resets settings to default OneWayFix layout
 */
router.post('/invoice-settings/reset', async (req, res) => {
  const role = req.userRole || req.user?.role;
  if (role !== 'admin') throw new AppError('Only Super Admin can reset invoice settings', 403);

  await InvoiceSettings.deleteOne({ key: 'global' });
  const defaultSettings = await invoiceService.getInvoiceSettings();

  logger.info(`Super Admin ${req.userId} reset Invoice & GST Settings to default`);
  res.json({ success: true, message: 'Invoice settings reset to default', data: defaultSettings });
});

/**
 * GET /admin/invoices
 * Lists generated historical invoices
 */
router.get('/invoices', async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const [invoices, total] = await Promise.all([
    Invoice.find().sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
    Invoice.countDocuments(),
  ]);

  res.json({
    success: true,
    data: invoices,
    pagination: { total, page: parseInt(page), limit: parseInt(limit) },
  });
});


// ── Branding Assets Management (S3-backed) ────────────────────────────────────

/**
 * GET /admin/settings/branding
 * Returns the current branding assets from the database.
 * Merges legacy logoUrl/faviconUrl as fallbacks so old URLs keep working.
 */
router.get('/settings/branding', authorize('admin'), async (req, res) => {
  let settings = await SystemSettings.findOne({ key: 'global' }).lean();
  if (!settings) {
    settings = { branding: {}, logoUrl: '/logo.png', faviconUrl: '/logo.svg' };
  }
  const branding = settings.branding || {};

  // Provide effective URL (S3 URL if present, else legacy fallback)
  const effective = {
    logo:        branding.logo?.url        || settings.logoUrl        || null,
    favicon:     branding.favicon?.url     || settings.faviconUrl     || null,
    darkLogo:    branding.darkLogo?.url    || null,
    appIcon:     branding.appIcon?.url     || null,
    loginLogo:   branding.loginLogo?.url   || null,
    invoiceLogo: branding.invoiceLogo?.url || null,
  };

  res.json({
    success: true,
    data: {
      branding: {
        logo:        branding.logo        || {},
        favicon:     branding.favicon      || {},
        darkLogo:    branding.darkLogo     || {},
        appIcon:     branding.appIcon      || {},
        loginLogo:   branding.loginLogo    || {},
        invoiceLogo: branding.invoiceLogo  || {},
      },
      effective,
    },
  });
});

/**
 * POST /admin/settings/branding/:type
 * Upload or replace a branding image.
 * Flow:
 *   1. Validate type and file
 *   2. Upload NEW file to S3
 *   3. Save new S3 key/URL to DB
 *   4. Delete OLD S3 object (only after new upload succeeds)
 *   5. Update relevant derived fields (logoUrl, faviconUrl) for backward compat
 */
router.post('/settings/branding/:type', authorize('admin'), brandingUpload.single('image'), async (req, res) => {
  const { type } = req.params;

  // Validate asset type
  if (!VALID_BRANDING_TYPES.includes(type)) {
    throw new AppError(`Invalid branding type. Must be one of: ${VALID_BRANDING_TYPES.join(', ')}`, 400);
  }

  // Validate file presence
  if (!req.file) {
    throw new AppError('No image file uploaded. Use field name "image"', 400);
  }

  // Per-type size validation
  const maxSize = BRANDING_SIZE_LIMITS[type];
  if (req.file.size > maxSize) {
    throw new AppError(`File too large. Max size for ${type}: ${Math.round(maxSize / 1024 / 1024)} MB`, 400);
  }

  // Build unique S3 key: onewayfix/branding/logo/logo-1723719283.png
  const ext = path.extname(req.file.originalname).toLowerCase() || '.png';
  const timestamp = Math.floor(Date.now() / 1000);
  const s3Key = `${BRANDING_S3_FOLDER[type]}/${type}-${timestamp}${ext}`;

  // -- Step 1: Upload new file to S3 --
  const newUrl = await s3Service.upload(s3Key, req.file.buffer, req.file.mimetype);

  // -- Step 2: Load current settings and record old key for later deletion --
  let settings = await SystemSettings.findOne({ key: 'global' });
  if (!settings) settings = new SystemSettings({ key: 'global' });

  const oldKey = settings.branding?.[type]?.key || null;

  // -- Step 3: Save new S3 key/URL to DB --
  if (!settings.branding) settings.branding = {};
  settings.branding[type] = { url: newUrl, key: s3Key, updatedAt: new Date() };
  settings.markModified(`branding.${type}`);

  // Keep legacy fields in sync for backward compatibility
  if (type === 'logo')    settings.logoUrl    = newUrl;
  if (type === 'favicon') settings.faviconUrl = newUrl;

  await settings.save();

  // Bust public-settings cache so frontend picks up new branding immediately
  try { await cache.del('system:settings'); } catch (e) {}
  try { await cache.del('public:settings'); } catch (e) {}

  // -- Step 4: Delete old S3 object ONLY after new upload + DB save succeeds --
  if (oldKey && oldKey !== s3Key) {
    try {
      await s3Service.delete(oldKey);
      logger.info(`[Branding] Deleted old ${type} asset from S3: ${oldKey}`);
    } catch (delErr) {
      // Non-fatal: old file stays in S3, but new asset is live
      logger.warn(`[Branding] Failed to delete old ${type} from S3 (${oldKey}): ${delErr.message}`);
    }
  }

  logger.info(`[Branding] Admin ${req.userId} uploaded ${type} → ${s3Key}`);
  res.status(200).json({
    success: true,
    message: `${type} uploaded successfully`,
    data: {
      type,
      url: newUrl,
      key: s3Key,
      updatedAt: new Date().toISOString(),
    },
  });
});

/**
 * DELETE /admin/settings/branding/:type
 * Remove a branding asset from S3 and clear it from the database.
 */
router.delete('/settings/branding/:type', authorize('admin'), async (req, res) => {
  const { type } = req.params;

  if (!VALID_BRANDING_TYPES.includes(type)) {
    throw new AppError(`Invalid branding type. Must be one of: ${VALID_BRANDING_TYPES.join(', ')}`, 400);
  }

  const settings = await SystemSettings.findOne({ key: 'global' });
  if (!settings) throw new AppError('Settings not found', 404);

  const existing = settings.branding?.[type];
  if (!existing?.url && !existing?.key) {
    throw new AppError(`No ${type} asset found to delete`, 404);
  }

  // Delete from S3
  if (existing.key) {
    try {
      await s3Service.delete(existing.key);
      logger.info(`[Branding] Deleted ${type} from S3: ${existing.key}`);
    } catch (delErr) {
      logger.warn(`[Branding] S3 deletion failed for ${type}: ${delErr.message}`);
    }
  }

  // Clear from DB
  settings.branding[type] = { url: null, key: null, updatedAt: new Date() };
  settings.markModified(`branding.${type}`);

  // Revert legacy fields to defaults
  if (type === 'logo')    settings.logoUrl    = '/logo.png';
  if (type === 'favicon') settings.faviconUrl = '/logo.svg';

  await settings.save();
  try { await cache.del('system:settings'); } catch (e) {}
  try { await cache.del('public:settings'); } catch (e) {}

  logger.info(`[Branding] Admin ${req.userId} removed ${type} branding asset`);
  res.json({ success: true, message: `${type} removed successfully` });
});

module.exports = router;

