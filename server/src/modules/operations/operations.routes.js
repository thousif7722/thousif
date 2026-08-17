'use strict';
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const {
  User, Provider, Booking, Complaint, Transaction,
  GeoHierarchy, OperationalRegion, GeographicAssignment, OperationsAlert,
} = require('../../models');
const { authenticate, authorize } = require('../auth/auth.routes');
const { getRedisClient, cache } = require('../../config/redis');
const { emitToAdmin } = require('../../socket');
const { AppError } = require('../../utils/errors');
const logger = require('../../utils/logger');

// All ops routes require auth
router.use(authenticate);

// ── Geographic Permission Middleware ──────────────────────────────────────────
async function geoPermission(req, res, next) {
  try {
    // Super admins and admins see everything
    if (req.userRole === 'admin') {
      req.geoScope = { scope: 'country', stateCodes: [], districtCodes: [], cityCodes: [], regionIds: [] };
      return next();
    }
    const assignment = await GeographicAssignment.findOne({ userId: req.userId, isActive: true }).lean();
    if (!assignment) return res.status(403).json({ success: false, message: 'No geographic access assigned. Contact Super Admin.' });
    req.geoScope = assignment;
    next();
  } catch (err) {
    next(err);
  }
}

// Build MongoDB geo filter from request scope
function buildGeoFilter(geoScope, cityField = 'serviceAddress.city', stateField = 'serviceAddress.state') {
  if (geoScope.scope === 'country' || (geoScope.stateCodes && geoScope.stateCodes.length === 0)) return {};
  const filter = {};
  if (geoScope.stateCodes?.length) filter[stateField] = { $in: geoScope.stateCodes };
  return filter;
}

function buildProviderGeoFilter(geoScope) {
  if (geoScope.scope === 'country' || !geoScope.stateCodes?.length) return {};
  return { state: { $in: geoScope.stateCodes } };
}

// ── INDIA STATES/UTs MASTER DATA ──────────────────────────────────────────────
const INDIA_STATES = [
  { code: 'AP', name: 'Andhra Pradesh', capital: 'Amaravati', type: 'state' },
  { code: 'AR', name: 'Arunachal Pradesh', capital: 'Itanagar', type: 'state' },
  { code: 'AS', name: 'Assam', capital: 'Dispur', type: 'state' },
  { code: 'BR', name: 'Bihar', capital: 'Patna', type: 'state' },
  { code: 'CG', name: 'Chhattisgarh', capital: 'Raipur', type: 'state' },
  { code: 'GA', name: 'Goa', capital: 'Panaji', type: 'state' },
  { code: 'GJ', name: 'Gujarat', capital: 'Gandhinagar', type: 'state' },
  { code: 'HR', name: 'Haryana', capital: 'Chandigarh', type: 'state' },
  { code: 'HP', name: 'Himachal Pradesh', capital: 'Shimla', type: 'state' },
  { code: 'JH', name: 'Jharkhand', capital: 'Ranchi', type: 'state' },
  { code: 'KA', name: 'Karnataka', capital: 'Bengaluru', type: 'state' },
  { code: 'KL', name: 'Kerala', capital: 'Thiruvananthapuram', type: 'state' },
  { code: 'MP', name: 'Madhya Pradesh', capital: 'Bhopal', type: 'state' },
  { code: 'MH', name: 'Maharashtra', capital: 'Mumbai', type: 'state' },
  { code: 'MN', name: 'Manipur', capital: 'Imphal', type: 'state' },
  { code: 'ML', name: 'Meghalaya', capital: 'Shillong', type: 'state' },
  { code: 'MZ', name: 'Mizoram', capital: 'Aizawl', type: 'state' },
  { code: 'NL', name: 'Nagaland', capital: 'Kohima', type: 'state' },
  { code: 'OD', name: 'Odisha', capital: 'Bhubaneswar', type: 'state' },
  { code: 'PB', name: 'Punjab', capital: 'Chandigarh', type: 'state' },
  { code: 'RJ', name: 'Rajasthan', capital: 'Jaipur', type: 'state' },
  { code: 'SK', name: 'Sikkim', capital: 'Gangtok', type: 'state' },
  { code: 'TN', name: 'Tamil Nadu', capital: 'Chennai', type: 'state' },
  { code: 'TG', name: 'Telangana', capital: 'Hyderabad', type: 'state' },
  { code: 'TR', name: 'Tripura', capital: 'Agartala', type: 'state' },
  { code: 'UP', name: 'Uttar Pradesh', capital: 'Lucknow', type: 'state' },
  { code: 'UK', name: 'Uttarakhand', capital: 'Dehradun', type: 'state' },
  { code: 'WB', name: 'West Bengal', capital: 'Kolkata', type: 'state' },
  // Union Territories
  { code: 'AN', name: 'Andaman & Nicobar Islands', capital: 'Port Blair', type: 'ut' },
  { code: 'CH', name: 'Chandigarh', capital: 'Chandigarh', type: 'ut' },
  { code: 'DN', name: 'Dadra & Nagar Haveli and Daman & Diu', capital: 'Daman', type: 'ut' },
  { code: 'DL', name: 'Delhi', capital: 'New Delhi', type: 'ut' },
  { code: 'JK', name: 'Jammu & Kashmir', capital: 'Srinagar / Jammu', type: 'ut' },
  { code: 'LA', name: 'Ladakh', capital: 'Leh', type: 'ut' },
  { code: 'LD', name: 'Lakshadweep', capital: 'Kavaratti', type: 'ut' },
  { code: 'PY', name: 'Puducherry', capital: 'Puducherry', type: 'ut' },
];

// ══════════════════════════════════════════════════════════════════════════════
// 1. INDIA OVERVIEW — Master Dashboard
// ══════════════════════════════════════════════════════════════════════════════
router.get('/overview', geoPermission, async (req, res) => {
  const cacheKey = 'ops:overview:india';
  const cached = await cache.get(cacheKey);
  if (cached) return res.json({ success: true, data: cached, source: 'cache' });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const geoFilter = buildGeoFilter(req.geoScope);
  const providerGeoFilter = buildProviderGeoFilter(req.geoScope);

  const [
    totalProviders, approvedProviders, onlineProviders, pendingApplications,
    totalCustomers, activeBookings, unassignedBookings,
    todayCompleted, openComplaints, activeAlerts,
    todayRevenueAgg, activeRegions,
  ] = await Promise.all([
    Provider.countDocuments({ ...providerGeoFilter }),
    Provider.countDocuments({ ...providerGeoFilter, approvalStatus: 'approved' }),
    Provider.countDocuments({ ...providerGeoFilter, isOnline: true }),
    Provider.countDocuments({ ...providerGeoFilter, approvalStatus: 'pending' }),
    User.countDocuments({ role: 'customer' }),
    Booking.countDocuments({ ...geoFilter, status: { $in: ['pending', 'assigned', 'accepted', 'in_progress'] } }),
    Booking.countDocuments({ ...geoFilter, status: 'pending' }),
    Booking.countDocuments({ ...geoFilter, status: { $in: ['completed', 'paid'] }, createdAt: { $gte: today } }),
    Complaint.countDocuments({ status: { $in: ['open', 'in_review'] } }),
    OperationsAlert.countDocuments({ isResolved: false, isRead: false }),
    Transaction.aggregate([
      { $match: { status: 'success', createdAt: { $gte: today }, type: 'payment' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    OperationalRegion.countDocuments({ status: 'active' }),
  ]);

  const todayRevenue = todayRevenueAgg[0]?.total || 0;

  // State-level rollup (booking count per state)
  const stateBookings = await Booking.aggregate([
    { $match: { status: { $in: ['pending', 'assigned', 'accepted', 'in_progress', 'completed', 'paid'] }, createdAt: { $gte: today } } },
    { $group: { _id: '$serviceAddress.state', count: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  const overview = {
    totalProviders, approvedProviders, onlineProviders, pendingApplications,
    totalCustomers, activeBookings, unassignedBookings,
    todayCompleted, openComplaints, activeAlerts,
    todayRevenue, activeRegions,
    operationalStates: INDIA_STATES.length,
    topStates: stateBookings,
    timestamp: new Date().toISOString(),
  };

  await cache.set(cacheKey, overview, 60); // 60s cache
  res.json({ success: true, data: overview });
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. STATES LIST WITH LIVE STATS
// ══════════════════════════════════════════════════════════════════════════════
router.get('/geo/states', geoPermission, async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Aggregate booking data by state
  const [bookingsByState, providersByState, revenueByState, complaintsByState] = await Promise.all([
    Booking.aggregate([
      { $match: { createdAt: { $gte: today } } },
      { $group: {
        _id: '$serviceAddress.state',
        totalBookings: { $sum: 1 },
        activeBookings: { $sum: { $cond: [{ $in: ['$status', ['pending', 'assigned', 'accepted', 'in_progress']] }, 1, 0] } },
        completedBookings: { $sum: { $cond: [{ $in: ['$status', ['completed', 'paid']] }, 1, 0] } },
        unassigned: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
      }},
    ]),
    Provider.aggregate([
      { $group: {
        _id: '$state',
        total: { $sum: 1 },
        approved: { $sum: { $cond: [{ $eq: ['$approvalStatus', 'approved'] }, 1, 0] } },
        online: { $sum: { $cond: ['$isOnline', 1, 0] } },
      }},
    ]),
    Transaction.aggregate([
      { $match: { status: 'success', type: 'payment', createdAt: { $gte: today } } },
      { $lookup: { from: 'bookings', localField: 'bookingId', foreignField: '_id', as: 'booking' } },
      { $unwind: { path: '$booking', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$booking.serviceAddress.state', revenue: { $sum: '$amount' } } },
    ]),
    Complaint.aggregate([
      { $match: { status: { $in: ['open', 'in_review'] } } },
      { $lookup: { from: 'bookings', localField: 'bookingId', foreignField: '_id', as: 'booking' } },
      { $unwind: { path: '$booking', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$booking.serviceAddress.state', count: { $sum: 1 } } },
    ]),
  ]);

  // Merge all data into state objects
  const bMap = Object.fromEntries(bookingsByState.map(b => [b._id, b]));
  const pMap = Object.fromEntries(providersByState.map(p => [p._id, p]));
  const rMap = Object.fromEntries(revenueByState.map(r => [r._id, r]));
  const cMap = Object.fromEntries(complaintsByState.map(c => [c._id, c]));

  const statesData = INDIA_STATES.map(state => {
    const b = bMap[state.name] || {};
    const p = pMap[state.name] || {};
    const r = rMap[state.name] || {};
    const c = cMap[state.name] || {};
    const demand = b.activeBookings || 0;
    const supply = p.online || 0;
    const ratio = supply > 0 ? Math.round((demand / supply) * 100) / 100 : demand > 0 ? 99 : 0;
    const coverageScore = supply > 0 ? Math.min(Math.round((supply / Math.max(demand, 1)) * 100), 100) : 0;

    return {
      ...state,
      providers: p.total || 0,
      approvedProviders: p.approved || 0,
      onlineProviders: supply,
      totalBookings: b.totalBookings || 0,
      activeBookings: demand,
      completedBookings: b.completedBookings || 0,
      unassignedBookings: b.unassigned || 0,
      revenue: r.revenue || 0,
      complaints: c.count || 0,
      demandSupplyRatio: ratio,
      coverageScore,
      coverageLevel: coverageScore >= 80 ? 'full_coverage' : coverageScore >= 50 ? 'active' : coverageScore >= 20 ? 'limited' : 'launching',
    };
  });

  res.json({ success: true, data: statesData, total: statesData.length });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. STATE ANALYTICS DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
router.get('/analytics/state/:stateCode', geoPermission, async (req, res) => {
  const { stateCode } = req.params;
  const stateInfo = INDIA_STATES.find(s => s.code === stateCode.toUpperCase());
  if (!stateInfo) throw new AppError('State not found', 404);

  // Enforce geo permission
  if (req.geoScope.scope !== 'country' && req.geoScope.stateCodes?.length) {
    if (!req.geoScope.stateCodes.includes(stateCode.toUpperCase())) {
      return res.status(403).json({ success: false, message: 'Access denied to this state' });
    }
  }

  const stateName = stateInfo.name;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const last7days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    providers, approvedProviders, onlineProviders, pendingProviders,
    totalBookings, activeBookings, completedToday, cancelledToday,
    openComplaints, regions, todayRevAgg,
    bookingTrend, topServices,
  ] = await Promise.all([
    Provider.countDocuments({ state: stateName }),
    Provider.countDocuments({ state: stateName, approvalStatus: 'approved' }),
    Provider.countDocuments({ state: stateName, isOnline: true }),
    Provider.countDocuments({ state: stateName, approvalStatus: 'pending' }),
    Booking.countDocuments({ 'serviceAddress.state': stateName }),
    Booking.countDocuments({ 'serviceAddress.state': stateName, status: { $in: ['pending', 'assigned', 'accepted', 'in_progress'] } }),
    Booking.countDocuments({ 'serviceAddress.state': stateName, status: { $in: ['completed', 'paid'] }, createdAt: { $gte: today } }),
    Booking.countDocuments({ 'serviceAddress.state': stateName, status: 'cancelled', createdAt: { $gte: today } }),
    Complaint.countDocuments({ status: { $in: ['open', 'in_review'] } }),
    OperationalRegion.find({ stateCode: stateCode.toUpperCase(), status: 'active' }).select('name code coverageLevel status metrics').lean(),
    Transaction.aggregate([
      { $match: { status: 'success', type: 'payment', createdAt: { $gte: today } } },
      { $lookup: { from: 'bookings', localField: 'bookingId', foreignField: '_id', as: 'bk' } },
      { $unwind: { path: '$bk', preserveNullAndEmptyArrays: true } },
      { $match: { 'bk.serviceAddress.state': stateName } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    // 7-day booking trend
    Booking.aggregate([
      { $match: { 'serviceAddress.state': stateName, createdAt: { $gte: last7days } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
        revenue: { $sum: '$totalAmount' },
      }},
      { $sort: { _id: 1 } },
    ]),
    // Top services
    Booking.aggregate([
      { $match: { 'serviceAddress.state': stateName, createdAt: { $gte: last7days } } },
      { $lookup: { from: 'services', localField: 'serviceId', foreignField: '_id', as: 'service' } },
      { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$service.category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      state: stateInfo,
      providers: { total: providers, approved: approvedProviders, online: onlineProviders, pending: pendingProviders },
      bookings: { total: totalBookings, active: activeBookings, completedToday, cancelledToday, unassigned: activeBookings },
      revenue: todayRevAgg[0]?.total || 0,
      openComplaints,
      demandSupplyRatio: onlineProviders > 0 ? Math.round((activeBookings / onlineProviders) * 100) / 100 : 0,
      regions,
      bookingTrend,
      topServices,
    },
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. LIVE BOOKING HEATMAP
// ══════════════════════════════════════════════════════════════════════════════
router.get('/heatmap/bookings', geoPermission, async (req, res) => {
  const { timeRange = 'today', status = 'all', category } = req.query;

  const now = new Date();
  let dateFilter = {};
  if (timeRange === 'live') dateFilter = { createdAt: { $gte: new Date(now.getTime() - 60 * 60 * 1000) } };
  else if (timeRange === '1h') dateFilter = { createdAt: { $gte: new Date(now.getTime() - 60 * 60 * 1000) } };
  else if (timeRange === '6h') dateFilter = { createdAt: { $gte: new Date(now.getTime() - 6 * 60 * 60 * 1000) } };
  else if (timeRange === 'today') { const t = new Date(); t.setHours(0,0,0,0); dateFilter = { createdAt: { $gte: t } }; }
  else if (timeRange === 'yesterday') { const t = new Date(); t.setDate(t.getDate()-1); t.setHours(0,0,0,0); const e = new Date(t); e.setHours(23,59,59,999); dateFilter = { createdAt: { $gte: t, $lte: e } }; }
  else if (timeRange === '7d') dateFilter = { createdAt: { $gte: new Date(now.getTime() - 7*24*60*60*1000) } };

  const statusFilter = status !== 'all' ? { status } : { status: { $in: ['pending', 'assigned', 'accepted', 'in_progress', 'completed', 'paid', 'cancelled'] } };
  const geoFilter = buildGeoFilter(req.geoScope);

  const matchStage = { ...dateFilter, ...statusFilter, ...geoFilter, 'serviceAddress.location.coordinates': { $exists: true, $ne: [] } };
  if (category) {
    // Join via service for category filter
  }

  // Returns aggregated grid points — not raw booking coords
  const heatmapData = await Booking.aggregate([
    { $match: matchStage },
    { $project: {
      lat: { $arrayElemAt: ['$serviceAddress.location.coordinates', 1] },
      lng: { $arrayElemAt: ['$serviceAddress.location.coordinates', 0] },
      status: 1, city: '$serviceAddress.city', state: '$serviceAddress.state', totalAmount: 1,
    }},
    { $group: {
      _id: {
        // 2-decimal precision grid (≈1.1km cell)
        lat: { $round: [{ $toDecimal: '$lat' }, 2] },
        lng: { $round: [{ $toDecimal: '$lng' }, 2] },
      },
      count: { $sum: 1 },
      totalRevenue: { $sum: '$totalAmount' },
      city: { $first: '$city' },
      state: { $first: '$state' },
      statuses: { $push: '$status' },
    }},
    { $project: {
      lat: { $toDouble: '$_id.lat' },
      lng: { $toDouble: '$_id.lng' },
      count: 1, totalRevenue: 1, city: 1, state: 1, statuses: 1,
      intensity: { $min: [{ $multiply: ['$count', 0.1] }, 1] },
    }},
    { $limit: 2000 },
  ]);

  // Add demand level labeling
  const maxCount = Math.max(...heatmapData.map(d => d.count), 1);
  const labeled = heatmapData.map(d => ({
    ...d,
    lat: d.lat || 0,
    lng: d.lng || 0,
    demandLevel: d.count >= maxCount * 0.8 ? 'critical' : d.count >= maxCount * 0.5 ? 'high' : d.count >= maxCount * 0.25 ? 'medium' : 'low',
  }));

  // City-level summary
  const cityAgg = await Booking.aggregate([
    { $match: matchStage },
    { $group: {
      _id: { city: '$serviceAddress.city', state: '$serviceAddress.state' },
      count: { $sum: 1 },
    }},
    { $sort: { count: -1 } },
    { $limit: 20 },
  ]);

  res.json({ success: true, data: { points: labeled, cityBreakdown: cityAgg, total: heatmapData.reduce((s, d) => s + d.count, 0), timeRange } });
});

// ══════════════════════════════════════════════════════════════════════════════
// 5. LIVE PROVIDER HEATMAP (from Redis GEO index)
// ══════════════════════════════════════════════════════════════════════════════
router.get('/heatmap/providers', geoPermission, async (req, res) => {
  const { lat = 20.5937, lng = 78.9629, radiusKm = 500 } = req.query; // Default: center of India

  const client = getRedisClient();
  if (!client) {
    // Fallback: MongoDB providers (no real-time location)
    const providers = await Provider.find({ isOnline: true, 'currentLocation.coordinates': { $exists: true } })
      .select('name city state isOnline rating currentLocation earnings.walletBalance')
      .limit(200).lean();
    return res.json({ success: true, data: { providers, source: 'mongodb', realtime: false } });
  }

  try {
    // Read from Redis GEO index — all providers who sent GPS ping in last 15s
    const geoResults = await client.geoSearch(
      'providers_online',
      { longitude: parseFloat(lng), latitude: parseFloat(lat) },
      { radius: Math.min(parseFloat(radiusKm), 1000), unit: 'km' },
      { SORT: 'ASC', COUNT: 500, WITHDIST: true, WITHCOORD: true }
    );

    const liveProviders = [];
    for (const r of geoResults) {
      try {
        const isOnline = await client.exists(`provider_online:${r.member}`);
        if (!isOnline) continue;
        const isBusy = await client.exists(`provider:busy:${r.member}`);
        const cachedLoc = await cache.get(`provider_location:${r.member}`);
        liveProviders.push({
          id: r.member,
          lat: r.coordinates?.latitude || cachedLoc?.lat,
          lng: r.coordinates?.longitude || cachedLoc?.lng,
          distanceKm: parseFloat(parseFloat(r.distance).toFixed(1)),
          busy: isBusy > 0,
          status: isBusy > 0 ? 'busy' : 'available',
        });
      } catch (e) { /* skip */ }
    }

    // Enrich with DB data for display (batch lookup)
    let enriched = liveProviders;
    if (liveProviders.length > 0) {
      const ids = liveProviders.map(p => p.id);
      const dbProviders = await Provider.find({ _id: { $in: ids } })
        .select('name phone city state rating completedJobs services tier')
        .populate('services', 'category name')
        .lean();
      const dbMap = Object.fromEntries(dbProviders.map(p => [p._id.toString(), p]));
      enriched = liveProviders.map(p => ({ ...p, ...(dbMap[p.id] || {}), _id: p.id }));
    }

    res.json({ success: true, data: { providers: enriched, total: enriched.length, source: 'redis_geo', realtime: true } });
  } catch (err) {
    logger.warn('[OpsHeatmap] Redis GEOSEARCH failed:', err.message);
    res.json({ success: true, data: { providers: [], source: 'error', realtime: false } });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 6. LIVE BOOKING MAP (individual booking markers)
// ══════════════════════════════════════════════════════════════════════════════
router.get('/live/bookings', geoPermission, async (req, res) => {
  const { stateCode, city, status = 'active' } = req.query;
  const geoFilter = buildGeoFilter(req.geoScope);

  const statusMap = {
    active: { $in: ['pending', 'assigned', 'accepted', 'in_progress'] },
    pending: 'pending',
    assigned: { $in: ['assigned', 'accepted'] },
    in_progress: 'in_progress',
    completed: { $in: ['completed', 'paid'] },
    all: { $in: ['pending', 'assigned', 'accepted', 'in_progress', 'completed', 'paid', 'cancelled'] },
  };

  const filter = {
    ...geoFilter,
    status: statusMap[status] || statusMap.active,
    'serviceAddress.location.coordinates': { $exists: true },
  };
  if (stateCode) filter['serviceAddress.state'] = INDIA_STATES.find(s => s.code === stateCode)?.name || stateCode;
  if (city) filter['serviceAddress.city'] = new RegExp(city, 'i');

  const bookings = await Booking.find(filter)
    .select('bookingNumber status serviceAddress scheduledDate timeSlot totalAmount customerId providerId serviceId createdAt')
    .populate('serviceId', 'name category icon')
    .populate('customerId', 'name phone')
    .populate({ path: 'providerId', select: 'name phone', populate: { path: 'userId', select: 'phone' } })
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();

  const markers = bookings.map(b => ({
    id: b._id,
    bookingNumber: b.bookingNumber,
    lat: b.serviceAddress?.location?.coordinates?.[1],
    lng: b.serviceAddress?.location?.coordinates?.[0],
    status: b.status,
    city: b.serviceAddress?.city,
    state: b.serviceAddress?.state,
    service: b.serviceId?.name,
    category: b.serviceId?.category,
    amount: b.totalAmount,
    scheduledDate: b.scheduledDate,
    timeSlot: b.timeSlot,
    customer: { name: b.customerId?.name },
    provider: b.providerId ? { name: b.providerId.name, phone: b.providerId.phone || b.providerId.userId?.phone } : null,
    createdAt: b.createdAt,
  })).filter(m => m.lat && m.lng);

  res.json({ success: true, data: { markers, total: markers.length } });
});

// ══════════════════════════════════════════════════════════════════════════════
// 7. OPERATIONAL REGIONS — CRUD
// ══════════════════════════════════════════════════════════════════════════════
router.get('/regions', geoPermission, async (req, res) => {
  const { stateCode, status, page = 1, limit = 50 } = req.query;
  const filter = {};
  if (stateCode) filter.stateCode = stateCode.toUpperCase();
  if (status) filter.status = status;
  // Scope filter
  if (req.geoScope.scope !== 'country' && req.geoScope.stateCodes?.length) {
    filter.stateCode = { $in: req.geoScope.stateCodes };
  }

  const [regions, total] = await Promise.all([
    OperationalRegion.find(filter)
      .populate('managerId', 'name phone email')
      .sort({ stateCode: 1, name: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean(),
    OperationalRegion.countDocuments(filter),
  ]);

  res.json({ success: true, data: regions, total, page: parseInt(page), pages: Math.ceil(total / limit) });
});

router.post('/regions', authorize('admin', 'manager'), async (req, res) => {
  const { name, code, stateCode, stateName, districtCode, districtName, cityCode, cityName, description, managerId, serviceCategories, targetProviders, status, launchDate, notes } = req.body;
  if (!name || !code || !stateCode) throw new AppError('Name, code, and stateCode are required', 400);

  const existing = await OperationalRegion.findOne({ code: code.toUpperCase() });
  if (existing) throw new AppError(`Region code "${code.toUpperCase()}" already exists`, 400);

  const region = await OperationalRegion.create({
    name, code: code.toUpperCase(), stateCode: stateCode.toUpperCase(), stateName,
    districtCode, districtName, cityCode, cityName, description,
    managerId, serviceCategories: serviceCategories || [], targetProviders: targetProviders || 10,
    status: status || 'planned', launchDate, notes,
  });

  res.status(201).json({ success: true, message: 'Operational region created', data: region });
});

router.put('/regions/:id', authorize('admin', 'manager'), async (req, res) => {
  const region = await OperationalRegion.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
  if (!region) throw new AppError('Region not found', 404);
  res.json({ success: true, message: 'Region updated', data: region });
});

router.delete('/regions/:id', authorize('admin'), async (req, res) => {
  const region = await OperationalRegion.findById(req.params.id);
  if (!region) throw new AppError('Region not found', 404);
  if (region.metrics?.activeBookings > 0) throw new AppError('Cannot delete region with active bookings', 400);
  await region.deleteOne();
  res.json({ success: true, message: 'Region removed' });
});

// ══════════════════════════════════════════════════════════════════════════════
// 8. STAFF ACCOUNTS WITH GEO ASSIGNMENTS
// ══════════════════════════════════════════════════════════════════════════════
router.get('/staff', geoPermission, async (req, res) => {
  const { page = 1, limit = 50, role, stateCode, status = 'all' } = req.query;
  const staffRoles = ['admin', 'manager', 'staff', 'team_leader', 'executive', 'technician', 'intern'];
  const filter = { role: { $in: staffRoles } };
  if (role) filter.role = role;
  if (status !== 'all') filter.status = status;

  const [staff, total] = await Promise.all([
    User.find(filter)
      .select('name email phone role status isOnline lastActiveAt department branch employeeId')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean(),
    User.countDocuments(filter),
  ]);

  // Attach geographic assignments
  const staffIds = staff.map(s => s._id);
  const assignments = await GeographicAssignment.find({ userId: { $in: staffIds }, isActive: true }).lean();
  const assignMap = Object.fromEntries(assignments.map(a => [a.userId.toString(), a]));
  const enriched = staff.map(s => ({ ...s, geoAssignment: assignMap[s._id.toString()] || null }));

  res.json({ success: true, data: enriched, total, page: parseInt(page), pages: Math.ceil(total / limit) });
});

router.post('/staff', authorize('admin', 'manager'), async (req, res) => {
  const { name, email, phone, role, department, branch, geoRole, geoScope, stateCodes, districtCodes, cityCodes, regionIds } = req.body;
  if (!name || !email || !role) throw new AppError('Name, email, and role are required', 400);

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw new AppError('Email already registered', 400);

  const user = await User.create({
    name, email: email.toLowerCase(), phone, role: role || 'staff',
    department, branch, status: 'active',
  });

  // Create geographic assignment if scope provided
  let assignment = null;
  if (geoRole && geoScope) {
    assignment = await GeographicAssignment.create({
      userId: user._id, role: geoRole, scope: geoScope,
      stateCodes: stateCodes || [], districtCodes: districtCodes || [],
      cityCodes: cityCodes || [], regionIds: regionIds || [],
      assignedBy: req.userId, isActive: true,
    });
  }

  res.status(201).json({ success: true, message: 'Staff account created', data: { user, assignment } });
});

router.put('/staff/:id/assign', authorize('admin', 'manager'), async (req, res) => {
  const { geoRole, geoScope, stateCodes, districtCodes, cityCodes, regionIds } = req.body;
  const userId = req.params.id;

  // Deactivate old assignment
  await GeographicAssignment.updateMany({ userId, isActive: true }, { isActive: false });

  // Create new assignment
  const assignment = await GeographicAssignment.create({
    userId, role: geoRole, scope: geoScope,
    stateCodes: stateCodes || [], districtCodes: districtCodes || [],
    cityCodes: cityCodes || [], regionIds: regionIds || [],
    assignedBy: req.userId, isActive: true,
  });

  res.json({ success: true, message: 'Geographic assignment updated', data: assignment });
});

router.put('/staff/:id/status', authorize('admin', 'manager'), async (req, res) => {
  const { status } = req.body;
  const user = await User.findByIdAndUpdate(req.params.id, { status }, { new: true }).select('name email role status');
  if (!user) throw new AppError('Staff not found', 404);
  res.json({ success: true, message: 'Staff status updated', data: user });
});

// ══════════════════════════════════════════════════════════════════════════════
// 9. PROVIDER COVERAGE ANALYSIS (Demand/Supply)
// ══════════════════════════════════════════════════════════════════════════════
router.get('/coverage', geoPermission, async (req, res) => {
  const cacheKey = 'ops:coverage:national';
  const cached = await cache.get(cacheKey);
  if (cached) return res.json({ success: true, data: cached, source: 'cache' });

  const [bookingsByCity, providersByCity] = await Promise.all([
    Booking.aggregate([
      { $match: { status: { $in: ['pending', 'assigned', 'accepted', 'in_progress'] } } },
      { $group: { _id: { city: '$serviceAddress.city', state: '$serviceAddress.state' }, demand: { $sum: 1 } } },
      { $sort: { demand: -1 } },
      { $limit: 100 },
    ]),
    Provider.aggregate([
      { $match: { approvalStatus: 'approved' } },
      { $group: { _id: { city: '$city', state: '$state' }, total: { $sum: 1 }, online: { $sum: { $cond: ['$isOnline', 1, 0] } } } },
    ]),
  ]);

  const supplyMap = Object.fromEntries(providersByCity.map(p => [`${p._id.city}|${p._id.state}`, p]));

  const coverage = bookingsByCity.map(b => {
    const key = `${b._id.city}|${b._id.state}`;
    const sup = supplyMap[key] || { total: 0, online: 0 };
    const ratio = sup.online > 0 ? Math.round((b.demand / sup.online) * 100) / 100 : b.demand > 0 ? 99 : 0;
    return {
      city: b._id.city,
      state: b._id.state,
      demand: b.demand,
      totalProviders: sup.total,
      onlineProviders: sup.online,
      demandSupplyRatio: ratio,
      status: ratio >= 5 ? 'critical' : ratio >= 3 ? 'high_demand' : ratio >= 1.5 ? 'moderate' : ratio > 0 ? 'healthy' : 'oversupply',
      coverageScore: Math.min(Math.round((sup.online / Math.max(b.demand, 1)) * 100), 100),
    };
  });

  await cache.set(cacheKey, coverage, 300); // 5 min cache
  res.json({ success: true, data: coverage });
});

// ══════════════════════════════════════════════════════════════════════════════
// 10. SMART ALERTS
// ══════════════════════════════════════════════════════════════════════════════
router.get('/alerts', geoPermission, async (req, res) => {
  const { resolved = 'false', severity, limit = 50 } = req.query;
  const filter = { isResolved: resolved === 'true' };
  if (severity) filter.severity = severity;

  const alerts = await OperationsAlert.find(filter)
    .populate('regionId', 'name code stateCode')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .lean();

  res.json({ success: true, data: alerts, total: alerts.length });
});

router.post('/alerts/:id/read', authenticate, async (req, res) => {
  await OperationsAlert.findByIdAndUpdate(req.params.id, { isRead: true });
  res.json({ success: true });
});

router.post('/alerts/:id/resolve', authorize('admin', 'manager'), async (req, res) => {
  const alert = await OperationsAlert.findByIdAndUpdate(
    req.params.id,
    { isResolved: true, resolvedBy: req.userId, resolvedAt: new Date() },
    { new: true }
  );
  if (!alert) throw new AppError('Alert not found', 404);
  res.json({ success: true, message: 'Alert resolved', data: alert });
});

// Manual alert creation (Super Admin)
router.post('/alerts', authorize('admin'), async (req, res) => {
  const { type, severity, stateCode, title, message, data } = req.body;
  if (!title || !message) throw new AppError('Title and message required', 400);

  const stateInfo = stateCode ? INDIA_STATES.find(s => s.code === stateCode.toUpperCase()) : null;
  const alert = await OperationsAlert.create({
    type: type || 'system', severity: severity || 'info',
    stateCode: stateCode?.toUpperCase(), stateName: stateInfo?.name,
    title, message, data,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  // Push real-time to admin ops room
  emitToAdmin('ops:alert', alert);
  res.status(201).json({ success: true, data: alert });
});

// ══════════════════════════════════════════════════════════════════════════════
// 11. GENERATE SMART ALERTS (called by BullMQ or manually)
// ══════════════════════════════════════════════════════════════════════════════
router.post('/alerts/generate', authorize('admin'), async (req, res) => {
  const generated = await generateSmartAlerts();
  res.json({ success: true, message: `Generated ${generated.length} alerts`, data: generated });
});

async function generateSmartAlerts() {
  const alerts = [];
  try {
    // Unassigned spike
    const unassigned = await Booking.countDocuments({ status: 'pending' });
    if (unassigned >= 10) {
      const exists = await OperationsAlert.findOne({ type: 'unassigned_spike', isResolved: false, createdAt: { $gte: new Date(Date.now() - 30*60*1000) } });
      if (!exists) {
        const a = await OperationsAlert.create({
          type: 'unassigned_spike', severity: unassigned >= 20 ? 'critical' : 'warning',
          title: '⚠️ Unassigned Booking Spike',
          message: `${unassigned} bookings are waiting for provider assignment. Immediate action required.`,
          data: { count: unassigned },
          expiresAt: new Date(Date.now() + 2*60*60*1000),
        });
        alerts.push(a);
        emitToAdmin('ops:alert', a);
      }
    }

    // Provider shortage by city
    const cityDemand = await Booking.aggregate([
      { $match: { status: { $in: ['pending', 'assigned'] } } },
      { $group: { _id: { city: '$serviceAddress.city', state: '$serviceAddress.state' }, demand: { $sum: 1 } } },
      { $match: { demand: { $gte: 5 } } },
    ]);

    for (const cd of cityDemand) {
      const supply = await Provider.countDocuments({ city: cd._id.city, isOnline: true, approvalStatus: 'approved' });
      const ratio = supply > 0 ? cd.demand / supply : 99;
      if (ratio >= 4) {
        const stateInfo = INDIA_STATES.find(s => s.name === cd._id.state);
        const exists = await OperationsAlert.findOne({ type: 'provider_shortage', 'data.city': cd._id.city, isResolved: false, createdAt: { $gte: new Date(Date.now() - 60*60*1000) } });
        if (!exists) {
          const a = await OperationsAlert.create({
            type: 'provider_shortage', severity: ratio >= 8 ? 'critical' : 'warning',
            stateCode: stateInfo?.code, stateName: cd._id.state,
            title: `🔴 Provider Shortage — ${cd._id.city}`,
            message: `${cd.demand} active bookings but only ${supply} providers online in ${cd._id.city}. Demand/Supply ratio: ${ratio.toFixed(1)}x`,
            data: { city: cd._id.city, demand: cd.demand, supply, ratio },
            expiresAt: new Date(Date.now() + 2*60*60*1000),
          });
          alerts.push(a);
          emitToAdmin('ops:alert', a);
        }
      }
    }
  } catch (err) {
    logger.warn('[OpsAlerts] Alert generation error:', err.message);
  }
  return alerts;
}

// Export the function for BullMQ job usage
router.generateSmartAlerts = generateSmartAlerts;

// ══════════════════════════════════════════════════════════════════════════════
// 12. STATE COMPARISON TABLE
// ══════════════════════════════════════════════════════════════════════════════
router.get('/analytics/compare', geoPermission, async (req, res) => {
  const { sort = 'revenue', order = 'desc' } = req.query;
  const today = new Date(); today.setHours(0,0,0,0);

  const [bByState, pByState, tByState] = await Promise.all([
    Booking.aggregate([
      { $match: { createdAt: { $gte: today } } },
      { $group: { _id: '$serviceAddress.state',
        total: { $sum: 1 },
        completed: { $sum: { $cond: [{ $in: ['$status', ['completed','paid']] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $eq: ['$status','cancelled'] }, 1, 0] } },
        revenue: { $sum: '$totalAmount' },
      }},
    ]),
    Provider.aggregate([
      { $group: { _id: '$state',
        total: { $sum: 1 },
        online: { $sum: { $cond: ['$isOnline', 1, 0] } },
        approved: { $sum: { $cond: [{ $eq: ['$approvalStatus','approved'] }, 1, 0] } },
      }},
    ]),
    Transaction.aggregate([
      { $match: { status: 'success', type: 'payment', createdAt: { $gte: today } } },
      { $lookup: { from: 'bookings', localField: 'bookingId', foreignField: '_id', as: 'bk' } },
      { $unwind: { path: '$bk', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$bk.serviceAddress.state', revenue: { $sum: '$amount' } } },
    ]),
  ]);

  const bMap = Object.fromEntries(bByState.map(b => [b._id, b]));
  const pMap = Object.fromEntries(pByState.map(p => [p._id, p]));
  const tMap = Object.fromEntries(tByState.map(t => [t._id, t]));

  const comparison = INDIA_STATES.map(state => {
    const b = bMap[state.name] || {};
    const p = pMap[state.name] || {};
    const t = tMap[state.name] || {};
    return {
      stateCode: state.code, stateName: state.name, type: state.type,
      providers: p.total || 0, onlineProviders: p.online || 0, approvedProviders: p.approved || 0,
      bookings: b.total || 0, completed: b.completed || 0, cancelled: b.cancelled || 0,
      revenue: t.revenue || b.revenue || 0,
      demandSupplyRatio: p.online > 0 ? Math.round(((b.total || 0) / p.online) * 10) / 10 : 0,
    };
  });

  const sorted = comparison.sort((a, b) => order === 'asc' ? a[sort] - b[sort] : b[sort] - a[sort]);
  res.json({ success: true, data: sorted });
});

// ══════════════════════════════════════════════════════════════════════════════
// 13. GEO HIERARCHY ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════════
router.get('/geo/hierarchy', geoPermission, async (req, res) => {
  // Return static India hierarchy
  res.json({ success: true, data: { states: INDIA_STATES } });
});

router.get('/geo/districts/:stateCode', geoPermission, async (req, res) => {
  const { stateCode } = req.params;
  const districts = await GeoHierarchy.find({ type: 'district', stateCode: stateCode.toUpperCase() })
    .select('name code districtCode isOperational coverageLevel')
    .sort({ name: 1 }).lean();
  res.json({ success: true, data: districts });
});

router.get('/geo/cities/:districtCode', geoPermission, async (req, res) => {
  const { districtCode } = req.params;
  const cities = await GeoHierarchy.find({ type: 'city', districtCode: districtCode.toUpperCase() })
    .select('name code isOperational coverageLevel').sort({ name: 1 }).lean();
  res.json({ success: true, data: cities });
});

// Seed geo hierarchy from data
router.post('/geo/seed', authorize('admin'), async (req, res) => {
  const { states } = req.body;
  if (!states || !Array.isArray(states)) throw new AppError('States array required', 400);
  const ops = states.map(s => ({
    updateOne: {
      filter: { code: s.code.toUpperCase() },
      update: { $set: { type: 'state', name: s.name, code: s.code.toUpperCase(), stateCode: s.code.toUpperCase(), isOperational: s.isOperational || false, coverageLevel: s.coverageLevel || 'not_available' } },
      upsert: true,
    },
  }));
  const result = await GeoHierarchy.bulkWrite(ops);
  res.json({ success: true, message: `Seeded ${result.upsertedCount} states, updated ${result.modifiedCount}` });
});

module.exports = router;
