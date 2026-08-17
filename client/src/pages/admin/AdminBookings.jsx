import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiService } from '@/services/api';
import Header from '@/components/common/Header';
import { StatusBadge } from '@/components/common/UI';
import {
  Search, X, UserCheck, RefreshCw, ChevronLeft, ChevronRight,
  Phone, Star, MapPin, Clock, Calendar, Filter,
} from 'lucide-react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

const STATUSES = ['', 'pending', 'assigned', 'accepted', 'in_progress', 'disputed', 'completed', 'paid', 'resolved', 'cancelled'];

// Helper: Haversine Formula for distance in KM
function getHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// ── Location-Aware Assign Provider Modal ───────────────────────────────────────
function AssignModal({ booking, onClose, onAssigned }) {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [assigning, setAssigning] = useState(null);
  const [maxRadiusKm, setMaxRadiusKm] = useState(30); // Default 30 km radius filter
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'online' | 'offline'

  // Extract booking coordinates
  const bCoords = booking.serviceAddress?.location?.coordinates;
  const bLng = bCoords?.[0];
  const bLat = bCoords?.[1];
  const bCity = booking.serviceAddress?.city || '';
  const bookingCategory = booking.serviceId?.category || '';

  useEffect(() => {
    apiService.getAdminProviders({ approvalStatus: 'approved', limit: 200 })
      .then(res => setProviders(res.data.data || []))
      .catch(() => toast.error('Failed to load providers'))
      .finally(() => setLoading(false));
  }, []);

  // Compute distance and sort by proximity (nearest first)
  const processedProviders = useMemo(() => {
    return providers.map(p => {
      const pCoords = p.currentLocation?.coordinates;
      const pLng = pCoords?.[0];
      const pLat = pCoords?.[1];

      let dist = getHaversineDistanceKm(bLat, bLng, pLat, pLng);
      if (dist === null) {
        // Fallback city matching heuristic
        if (p.city && bCity && p.city.toLowerCase() === bCity.toLowerCase()) {
          dist = 8.5; // Same city estimated distance
        } else {
          dist = 45; // Different city estimated distance
        }
      }

      // Category matching check
      const matchesCategory = p.services?.some(s => 
        s.category?.toLowerCase() === bookingCategory.toLowerCase() ||
        s.name?.toLowerCase().includes(bookingCategory.toLowerCase())
      ) || true; // Allow all approved providers

      return { ...p, calculatedDistanceKm: dist, matchesCategory };
    }).sort((a, b) => a.calculatedDistanceKm - b.calculatedDistanceKm);
  }, [providers, bLat, bLng, bCity, bookingCategory]);

  const filtered = processedProviders.filter(p => {
    const q = search.toLowerCase();
    const matchesSearch = !q || p.name?.toLowerCase().includes(q) || p.phone?.includes(q) || p.city?.toLowerCase().includes(q);
    const matchesRadius = maxRadiusKm === 0 || p.calculatedDistanceKm <= maxRadiusKm;
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'online' ? p.isOnline : !p.isOnline);
    return matchesSearch && matchesRadius && matchesStatus;
  });

  async function assign(provider) {
    setAssigning(provider._id);
    try {
      await apiService.assignBooking(booking._id, provider._id);
      toast.success(`✅ Booking assigned to ${provider.name}!`);
      onAssigned();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Assignment failed');
    }
    setAssigning(null);
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-start justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Manual Dispatch</span>
              <h2 className="text-lg font-bold">Assign Nearby Technician</h2>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Booking <span className="font-mono font-semibold text-blue-300">#{booking.bookingNumber}</span>
              {' · '}<strong className="text-white">{booking.serviceId?.name}</strong> ({booking.serviceId?.category})
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 transition">
            <X size={18} />
          </button>
        </div>

        {/* Booking summary & Location */}
        <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 shrink-0">
          <div className="flex items-center justify-between text-xs text-slate-700">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 font-medium"><Calendar size={12} className="text-blue-600" /> {dayjs(booking.scheduledDate).format('D MMM YYYY')}</span>
              <span className="flex items-center gap-1 font-medium"><Clock size={12} className="text-amber-600" /> {booking.timeSlot?.from}–{booking.timeSlot?.to}</span>
            </div>
            <span className="flex items-center gap-1 font-bold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-blue-200 shadow-xs">
              <MapPin size={12} className="text-red-500" /> {booking.serviceAddress?.area || booking.serviceAddress?.city || 'Customer Location'}
            </span>
          </div>
          {booking.providerId && (
            <p className="mt-1.5 text-xs text-amber-700 font-semibold bg-amber-100/80 px-2.5 py-1 rounded-md">
              ⚠️ Currently assigned to: {booking.providerId.name} — Reassigning will transfer job.
            </p>
          )}
        </div>

        {/* Proximity Radius & Filters */}
        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50 space-y-2 shrink-0">
          {/* Radius selector */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
              📍 Technician Proximity Radius
            </span>
            <div className="flex gap-1.5">
              {[10, 30, 50, 0].map(radius => (
                <button
                  key={radius}
                  onClick={() => setMaxRadiusKm(radius)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    maxRadiusKm === radius
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {radius === 0 ? 'All Distance' : `< ${radius} km`}
                </button>
              ))}
            </div>
          </div>

          {/* Search & Online/Offline filter */}
          <div className="flex gap-2">
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 flex-1">
              <Search size={14} className="text-slate-400" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search name, phone, city..."
                className="flex-1 bg-transparent text-xs outline-none text-slate-800 placeholder:text-slate-400"
              />
              {search && <button onClick={() => setSearch('')}><X size={12} className="text-slate-400" /></button>}
            </div>

            <div className="flex bg-white border border-slate-200 rounded-xl p-0.5 text-xs font-semibold">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg ${statusFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('online')}
                className={`px-2.5 py-1 rounded-lg ${statusFilter === 'online' ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}
              >
                Online
              </button>
              <button
                onClick={() => setStatusFilter('offline')}
                className={`px-2.5 py-1 rounded-lg ${statusFilter === 'offline' ? 'bg-amber-600 text-white' : 'text-slate-500'}`}
              >
                Offline
              </button>
            </div>
          </div>
        </div>

        {/* Provider List (Sorted by nearest proximity) */}
        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2.5">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
            ))
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
              <p className="text-sm font-semibold text-slate-600">No technicians found within {maxRadiusKm ? `${maxRadiusKm} km` : 'this filter'}</p>
              <p className="text-xs text-slate-400 mt-1">Try switching to "50 km" or "All Distance" to view all available technicians.</p>
              <button onClick={() => setMaxRadiusKm(0)} className="mt-3 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                View All Technicians →
              </button>
            </div>
          ) : (
            filtered.map(provider => (
              <div
                key={provider._id}
                className="flex items-center justify-between bg-slate-50 hover:bg-blue-50/80 border border-slate-200 hover:border-blue-300 rounded-2xl p-3.5 transition-all shadow-xs"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="relative">
                    <div className="w-11 h-11 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center font-black text-base shrink-0 border border-blue-200">
                      {provider.name?.[0]?.toUpperCase()}
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${provider.isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-900 text-sm truncate">{provider.name}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        provider.calculatedDistanceKm <= 15 ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                        provider.calculatedDistanceKm <= 35 ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-slate-100 text-slate-600'
                      }`}>
                        📍 {provider.calculatedDistanceKm} km away
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                      <span className="flex items-center gap-0.5 text-amber-600 font-bold">
                        <Star size={11} fill="currentColor" /> {provider.rating?.toFixed(1) || '4.8'}
                      </span>
                      <span className={`font-semibold ${provider.isOnline ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {provider.isOnline ? '● Online' : '○ Offline'}
                      </span>
                      {provider.city && (
                        <span className="text-slate-400 font-medium">🏙️ {provider.city}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions: Call offline technician + Assign button */}
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {!provider.isOnline && (
                    <a
                      href={`tel:${provider.phone}`}
                      title={`Call ${provider.name} (${provider.phone})`}
                      className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-bold flex items-center gap-1 transition-colors"
                    >
                      <Phone size={14} /> Call
                    </a>
                  )}

                  <button
                    onClick={() => assign(provider)}
                    disabled={assigning === provider._id}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-200 transition-all disabled:opacity-60"
                  >
                    {assigning === provider._id ? (
                      <span className="animate-spin">↻</span>
                    ) : (
                      <><UserCheck size={14} /> Assign</>
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}


// Helper: Compute SLA Completion Delay Status (Day 1, Day 2, Day 3, Day 3+ OVERDUE)
// Returns null for any booking that is already in a terminal state (completed/paid/cancelled)
function getSlaStatus(booking, slaThresholdDays = 3) {
  if (!booking) return null;
  const terminalStatuses = ['completed', 'paid', 'resolved', 'cancelled', 'canceled'];
  // KEY FIX: If the job reached a terminal status, SLA counter is done — show completed
  if (terminalStatuses.includes((booking.status || '').toLowerCase())) return null;

  const startDate = dayjs(booking.createdAt || booking.scheduledDate);
  const elapsedHours = dayjs().diff(startDate, 'hour');
  const elapsedDays = Math.floor(elapsedHours / 24);

  if (elapsedDays >= slaThresholdDays) {
    return {
      isOverdue: true,
      days: elapsedDays,
      label: `🚨 DAY ${elapsedDays + 1} OVERDUE (>${slaThresholdDays} Days)`,
      bgClass: 'bg-red-100 text-red-800 border-red-300 font-extrabold animate-pulse',
      badgeText: `🚨 Day ${elapsedDays + 1} OVERDUE (${elapsedDays} days elapsed)`
    };
  } else if (elapsedDays === slaThresholdDays - 1) {
    return {
      isOverdue: false,
      days: elapsedDays,
      label: `⚠️ Day ${elapsedDays + 1} (SLA Warning)`,
      bgClass: 'bg-amber-100 text-amber-800 border-amber-300 font-bold',
      badgeText: `⚠️ Day ${elapsedDays + 1} (2 days elapsed)`
    };
  } else {
    return {
      isOverdue: false,
      days: elapsedDays,
      label: `🟢 Day ${elapsedDays + 1}`,
      bgClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold',
      badgeText: `🟢 Day ${elapsedDays + 1}`
    };
  }
}

// ── Main AdminBookings Page ────────────────────────────────────────────────────
export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [slaDaysThreshold, setSlaDaysThreshold] = useState(3); // Default 3 days SLA limit
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [assignTarget, setAssignTarget] = useState(null); // booking to assign
  const [forcingComplete, setForcingComplete] = useState(null); // bookingId being force-completed

  async function handleForceComplete(booking) {
    const reason = window.prompt(
      `Force-complete booking #${booking.bookingNumber}?\n\nThis was assigned ${dayjs().diff(dayjs(booking.createdAt), 'day')} days ago and is stuck at "${booking.status}".\n\nEnter reason (optional):`,
      'SLA overdue — admin completing on behalf of provider'
    );
    if (reason === null) return; // cancelled
    setForcingComplete(booking._id);
    try {
      await apiService.forceCompleteBooking(booking._id, reason || 'SLA override by admin');
      toast.success(`✅ Booking #${booking.bookingNumber} marked as Completed!`);
      load(); // Refresh table
    } catch (err) {
      toast.error(err.response?.data?.error || 'Force complete failed');
    }
    setForcingComplete(null);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getAdminBookings({
        page, limit: 20,
        ...(statusFilter && statusFilter !== 'overdue_3days' ? { status: statusFilter } : {}),
      });
      setBookings(res.data.data || []);
      setPagination(res.data.pagination || {});
    } catch { toast.error('Failed to load bookings'); }
    setLoading(false);
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // Compute overdue count (> 3 days uncompleted)
  const overdueBookingsCount = useMemo(() => {
    return bookings.filter(b => {
      const st = (b.status || '').toLowerCase();
      if (['completed', 'paid', 'resolved', 'cancelled', 'canceled'].includes(st)) return false;
      const days = Math.floor(dayjs().diff(dayjs(b.createdAt || b.scheduledDate), 'hour') / 24);
      return days >= slaDaysThreshold;
    }).length;
  }, [bookings, slaDaysThreshold]);

  // Compute unassigned count (only active/pending bookings without provider)
  const unassignedCount = useMemo(() => {
    return bookings.filter(b => {
      const st = (b.status || '').toLowerCase();
      return !b.providerId && !['completed', 'paid', 'resolved', 'cancelled', 'canceled'].includes(st);
    }).length;
  }, [bookings]);

  // Client-side search & SLA / Unassigned filter
  const filtered = useMemo(() => {
    return bookings.filter(b => {
      const st = (b.status || '').toLowerCase();

      // Overdue filter check
      if (statusFilter === 'overdue_3days') {
        if (['completed', 'paid', 'resolved', 'cancelled', 'canceled'].includes(st)) return false;
        const days = Math.floor(dayjs().diff(dayjs(b.createdAt || b.scheduledDate), 'hour') / 24);
        if (days < slaDaysThreshold) return false;
      }

      // Unassigned filter check
      if (statusFilter === 'unassigned') {
        if (b.providerId || ['completed', 'paid', 'resolved', 'cancelled', 'canceled'].includes(st)) return false;
      }

      if (!search) return true;
      const q = search.toLowerCase();
      return (
        b.bookingNumber?.toLowerCase().includes(q) ||
        b.customerId?.name?.toLowerCase().includes(q) ||
        b.customerId?.phone?.includes(q) ||
        b.serviceId?.name?.toLowerCase().includes(q) ||
        b.providerId?.name?.toLowerCase().includes(q)
      );
    });
  }, [bookings, search, statusFilter, slaDaysThreshold]);

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Bookings & SLA Control</h1>
            <p className="text-slate-500 text-sm mt-0.5">{pagination.total || 0} total · Monitor technician job completion SLA (Day 1, Day 2, Day 3+ Overdue)</p>
          </div>

          <div className="flex items-center gap-3">
            {/* SLA Threshold Selector */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs">
              <span>SLA Limit:</span>
              <select 
                value={slaDaysThreshold} 
                onChange={e => setSlaDaysThreshold(Number(e.target.value))}
                className="bg-transparent font-extrabold text-blue-600 outline-none cursor-pointer"
              >
                <option value={1}>1 Day SLA</option>
                <option value={2}>2 Days SLA</option>
                <option value={3}>3 Days SLA (Default)</option>
                <option value={5}>5 Days SLA</option>
              </select>
            </div>

            <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition shadow-sm">
              <RefreshCw size={15} /> Refresh
            </button>
          </div>
        </div>

        {/* 🚨 SLA Overdue Banner */}
        {overdueBookingsCount > 0 && (
          <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 mb-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center text-xl font-bold shrink-0 shadow-md">
                🚨
              </div>
              <div>
                <h3 className="font-extrabold text-red-950 text-sm">
                  {overdueBookingsCount} Job{overdueBookingsCount > 1 ? 's' : ''} Exceeded {slaDaysThreshold}-Day Completion Limit!
                </h3>
                <p className="text-red-700 text-xs mt-0.5">
                  Technicians have not completed these jobs within {slaDaysThreshold} days. Call technician directly or reassign.
                </p>
              </div>
            </div>
            <button
              onClick={() => setStatusFilter('overdue_3days')}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold px-4 py-2 rounded-xl shadow-md transition-all shrink-0"
            >
              Filter Overdue (&gt;{slaDaysThreshold} Days) Jobs →
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 flex-1 shadow-sm">
            <Search size={15} className="text-slate-400 shrink-0" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by booking #, customer, service, provider…"
              className="flex-1 outline-none text-sm text-slate-800 bg-transparent placeholder:text-slate-400"
            />
            {search && <button onClick={() => setSearch('')}><X size={14} className="text-slate-400" /></button>}
          </div>
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
            <Filter size={14} className="text-slate-400" />
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              className="outline-none text-sm text-slate-700 bg-transparent cursor-pointer font-medium"
            >
              <option value="">All Statuses</option>
              <option value="unassigned" className="font-bold text-red-600">🚨 Unassigned ({unassignedCount} Pending Assign)</option>
              <option value="overdue_3days" className="font-bold text-red-600">🚨 Overdue (&gt; {slaDaysThreshold} Days)</option>
              {STATUSES.filter(Boolean).map(s => (
                <option key={s} value={s}>{s.replace('_', ' ').replace(/^\w/, c => c.toUpperCase())}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 📌 Pending Unassigned Alert Banner */}
        {unassignedCount > 0 && statusFilter !== 'unassigned' && (
          <div className="mb-4 bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-300 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center text-xl font-bold animate-bounce shadow-md">
                📌
              </div>
              <div>
                <h3 className="font-extrabold text-red-900 text-sm">
                  🚨 {unassignedCount} Pending Bookings Need Immediate Staff Assignment!
                </h3>
                <p className="text-xs text-red-700 mt-0.5">
                  Customers are waiting. Assign qualified technicians immediately to prevent delays.
                </p>
              </div>
            </div>
            <button
              onClick={() => { setStatusFilter('unassigned'); setPage(1); }}
              className="bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs px-4 py-2 rounded-xl transition-all shadow-md shadow-red-200 shrink-0"
            >
              View Pending Unassigned ({unassignedCount}) →
            </button>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="divide-y divide-slate-100">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse bg-slate-50 mx-4 my-2 rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-3">📋</div>
              <p className="text-slate-500 font-medium">No bookings found for selected filter</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[750px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Booking</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Customer</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Service</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">SLA Completion Counter</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Technician</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(b => {
                    const sla = getSlaStatus(b, slaDaysThreshold);

                    return (
                      <tr key={b._id} className={`hover:bg-slate-50/70 transition-colors ${sla?.isOverdue ? 'bg-red-50/40' : ''}`}>
                        <td className="px-5 py-3.5">
                          <p className="font-mono text-xs font-bold text-primary-700">#{b.bookingNumber}</p>
                          <p className="text-xs text-slate-400 mt-0.5">₹{b.totalAmount?.toLocaleString('en-IN') || b.basePrice}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-sm font-semibold text-slate-800">{b.customerId?.name || '—'}</p>
                          <p className="text-xs text-slate-400">{b.customerId?.phone}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-sm font-medium text-slate-700">{b.serviceId?.name || '—'}</p>
                          <p className="text-xs text-slate-400">{b.serviceId?.category}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          {sla ? (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border ${sla.bgClass}`}>
                              {sla.badgeText}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium">✓ Completed</span>
                          )}
                          <p className="text-[11px] text-slate-400 mt-0.5">Sched: {dayjs(b.scheduledDate).format('D MMM')}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          {b.status === 'paid' ? (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold whitespace-nowrap ${b.paymentMethod === 'cash' ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-emerald-900 border border-emerald-300'}`}>
                              {b.paymentMethod === 'cash' ? '💵 Paid Cash' : '💳 Paid Online'}
                            </span>
                          ) : (
                            <StatusBadge status={b.status} />
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {b.providerId ? (
                            <div>
                              <p className="text-sm font-semibold text-emerald-700 flex items-center gap-1">
                                {b.providerId.name}
                                {b.status === 'disputed' && (
                                  <span className="text-[10px] text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded font-extrabold border border-amber-300">
                                    ⚠️ Disputed
                                  </span>
                                )}
                                {sla?.isOverdue && (
                                  <a href={`tel:${b.providerId.phone}`} title="Call technician regarding SLA delay" className="text-[10px] text-red-700 bg-red-100 hover:bg-red-200 px-1.5 py-0.5 rounded font-extrabold border border-red-200">
                                    📞 Call
                                  </a>
                                )}
                              </p>
                              <p className="text-xs text-slate-400 flex items-center gap-1">
                                <Star size={9} fill="currentColor" className="text-amber-400" />
                                {b.providerId.rating?.toFixed(1) || '4.8'} · {b.providerId.phone}
                              </p>
                            </div>
                          ) : ['completed', 'paid', 'resolved', 'cancelled', 'canceled'].includes((b.status || '').toLowerCase()) ? (
                            <span className="text-xs text-slate-400 font-medium">—</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-red-700 font-extrabold bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
                              <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                              🚨 Needs Assign
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            {/* Override Complete — shown for overdue stuck bookings */}
                            {sla?.isOverdue && !['completed', 'paid', 'resolved', 'cancelled', 'canceled'].includes((b.status || '').toLowerCase()) && (
                              <button
                                onClick={() => handleForceComplete(b)}
                                disabled={forcingComplete === b._id}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all disabled:opacity-60"
                                title="Admin override: mark this stuck job as completed"
                              >
                                {forcingComplete === b._id ? '⏳' : '✅'} Override Complete
                              </button>
                            )}
                            {/* Reassign button — shown only for active non-terminal bookings */}
                            {!['completed', 'paid', 'resolved', 'cancelled', 'canceled'].includes((b.status || '').toLowerCase()) ? (
                              <button
                                onClick={() => setAssignTarget(b)}
                                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                                  !b.providerId
                                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-200 animate-pulse border border-red-500 ring-2 ring-red-300'
                                    : sla?.isOverdue
                                      ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-200'
                                      : 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm hover:shadow-md'
                                }`}
                              >
                                <UserCheck size={13} />
                                {b.providerId ? 'Reassign' : '🚨 Assign'}
                              </button>
                            ) : (
                              <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg inline-flex items-center gap-1">
                                ✓ Done
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between mt-5">
            <p className="text-sm text-slate-500">
              Page {pagination.page} of {pagination.pages} ({pagination.total} bookings)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition"
              >
                <ChevronLeft size={15} /> Prev
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition"
              >
                Next <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Assign Modal */}
      {assignTarget && (
        <AssignModal
          booking={assignTarget}
          onClose={() => setAssignTarget(null)}
          onAssigned={load}
        />
      )}
    </div>
  );
}
