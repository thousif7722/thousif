import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchBookingById, selectCurrentBooking, selectBookingLoading, selectCurrentMaterials } from '@/store/slices/bookingSlice';
import { apiService } from '@/services/api';
import { getSocket } from '@/services/socket';
import Header from '@/components/common/Header';
import { StatusBadge, StarRating, ConfirmModal, PageLayout } from '@/components/common/UI';
import { MapPin, Clock, Phone, Star, AlertCircle, Download, MessageCircle, ChevronRight, AlertTriangle } from 'lucide-react';

import toast from 'react-hot-toast';
import dayjs from 'dayjs';

export default function BookingDetail() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const booking = useSelector(selectCurrentBooking);
  const materials = useSelector(selectCurrentMaterials);
  const loading = useSelector(selectBookingLoading);
  const [cancelModal, setCancelModal] = useState(false);
  const [reviewModal, setReviewModal] = useState(false);
  const [complaintModal, setComplaintModal] = useState(false);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [approvingMaterials, setApprovingMaterials] = useState(false);

  const [providerProfile, setProviderProfile] = useState(null);
  const [noProvidersFound, setNoProvidersFound] = useState(false);
  const [retryingMatch, setRetryingMatch] = useState(false);
  const [respondingQuote, setRespondingQuote] = useState(false);

  useEffect(() => {
    dispatch(fetchBookingById(id));
    // Fast 3-second evaluation polling while pending, 15s for active jobs
    const pollIntervalMs = booking?.status === 'pending' ? 3000 : 15000;
    const interval = setInterval(() => {
      if (['pending','assigned','accepted','in_progress'].includes(booking?.status)) {
        dispatch(fetchBookingById(id));
      }
    }, pollIntervalMs);
    return () => clearInterval(interval);
  }, [id, dispatch, booking?.status]);

  useEffect(() => {
    if (booking?.providerId || (booking?.status && booking?.status !== 'pending')) {
      setNoProvidersFound(false);
    } else if (booking?.noProvidersAvailable || booking?.nearbyProvidersCount === 0) {
      setNoProvidersFound(true);
    }
  }, [booking?.noProvidersAvailable, booking?.nearbyProvidersCount, booking?.providerId, booking?.status]);

  useEffect(() => {
    const socket = getSocket();
    if (socket) {
      const handleStatusUpdate = (data) => {
        if (data.bookingId === id || !data.bookingId) {
          setNoProvidersFound(false);
          dispatch(fetchBookingById(id));
          if (data.provider?.name) {
            toast.success(`🎉 Provider found: ${data.provider.name}!`, { id: 'provider_assigned_toast' });
          }
        }
      };

      const handleNoProviders = (data) => {
        if (data.bookingId === id || !data.bookingId) {
          setNoProvidersFound(true);
          toast.error(data.message || 'No service providers currently available in your location', { id: 'no_providers_toast' });
        }
      };

      const handleFailed = (data) => {
        if (data.bookingId === id) {
          setNoProvidersFound(true);
          dispatch(fetchBookingById(id));
          toast.error(data.message || 'Booking matching failed', { id: 'booking_failed_toast' });
        }
      };
      
      socket.on('booking:assigned', handleStatusUpdate);
      socket.on('booking:accepted', handleStatusUpdate);
      socket.on('booking:status_update', handleStatusUpdate);
      socket.on('booking:completed', handleStatusUpdate);
      socket.on('booking:paid', handleStatusUpdate);
      socket.on('booking:no_providers', handleNoProviders);
      socket.on('booking:failed', handleFailed);
      socket.on('booking:quote_requested', handleStatusUpdate);
      socket.on('booking:quote_responded', handleStatusUpdate);

      return () => {
        socket.off('booking:assigned', handleStatusUpdate);
        socket.off('booking:accepted', handleStatusUpdate);
        socket.off('booking:status_update', handleStatusUpdate);
        socket.off('booking:completed', handleStatusUpdate);
        socket.off('booking:paid', handleStatusUpdate);
        socket.off('booking:no_providers', handleNoProviders);
        socket.off('booking:failed', handleFailed);
        socket.off('booking:quote_requested', handleStatusUpdate);
        socket.off('booking:quote_responded', handleStatusUpdate);
      };
    }
  }, [id, dispatch]);

  async function handleRetryMatch() {
    setRetryingMatch(true);
    try {
      const res = await apiService.retryMatch(id);
      if (res.data.data?.providerAssigned) {
        toast.success(res.data.message || 'Provider assigned!');
        setNoProvidersFound(false);
        dispatch(fetchBookingById(id));
      } else {
        toast.error(res.data.message || 'No providers available in your location yet.');
        setNoProvidersFound(true);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to search for providers');
    } finally {
      setRetryingMatch(false);
    }
  }

  async function handleCancel() {
    try {
      await apiService.cancelBooking(id, 'Customer requested cancellation');
      toast.success('Booking cancelled');
      dispatch(fetchBookingById(id));
      setCancelModal(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to cancel');
    }
  }

  async function fetchProviderProfile(providerId) {
    try {
      const res = await apiService.getProviderPublic(providerId);
      setProviderProfile(res.data.data);
      setShowProviderModal(true);
    } catch {
      toast.error('Failed to load profile');
    }
  }

  async function handleApproveMaterials() {
    setApprovingMaterials(true);
    try {
      await apiService.approveMaterials(id);
      toast.success('Materials list approved!');
      dispatch(fetchBookingById(id));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to approve materials');
    } finally {
      setApprovingMaterials(false);
    }
  }

  async function handleDownloadInvoice() {
    try {
      const response = await apiService.downloadInvoice(id);
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${booking.bookingNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Invoice not available'); }
  }

  if (loading && !booking) {
    return (
      <div className="min-h-screen bg-slate-50 pt-20 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!booking) return (
    <div className="min-h-screen bg-slate-50 pt-20 flex items-center justify-center text-slate-400">
      Booking not found
    </div>
  );

  const canCancel = ['pending','assigned','accepted'].includes(booking.status);
  const canPay = booking.status === 'completed';
  const canReview = booking.status === 'paid' && !booking.isRated;
  const canTrack = false; // Customer tracking removed per configuration
  
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const complainEligibleStatus = ['completed', 'paid', 'disputed'].includes(booking.status);
  const isWithin30Days = new Date(booking.scheduledDate) >= thirtyDaysAgo;
  const canComplain = complainEligibleStatus && isWithin30Days;

  async function handleQuoteResponse(action) {
    setRespondingQuote(true);
    try {
      await apiService.respondToQuote(id, action);
      toast.success(action === 'approve' ? '✅ Quotation approved! Total cost updated.' : 'Quotation declined.');
      dispatch(fetchBookingById(id));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to respond to quote');
    } finally {
      setRespondingQuote(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <Header />
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Booking Details</h1>
            <p className="text-slate-400 text-sm mt-0.5">#{booking.bookingNumber}</p>
          </div>
          <StatusBadge status={booking.status} size="lg" />
        </div>

        {/* Status timeline */}
        <StatusTimeline booking={booking} />

        {/* ── Rapido-Style Provider Search & Spot View (Pending Status) ── */}
        {booking.status === 'pending' && (
          (noProvidersFound || booking.noProvidersAvailable || booking.nearbyProvidersCount === 0) ? (
            /* 🚫 Spot View Banner: No Service Providers Available */
            <div className="card p-6 mb-5 border-2 border-amber-400 bg-gradient-to-br from-amber-50/90 via-orange-50/50 to-amber-100/40 shadow-lg relative overflow-hidden animate-fade-in">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-2xl font-bold shadow-md shadow-amber-200 shrink-0">
                  👨‍🔧
                </div>
                <div className="flex-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100/90 text-amber-900 rounded-full text-xs font-extrabold uppercase tracking-wider mb-2 border border-amber-300">
                    <AlertTriangle size={13} className="text-amber-600" />
                    Spot View Alert
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900 leading-snug">
                    Currently no service providers available in your location
                  </h3>
                  <p className="text-slate-650 text-sm mt-1 leading-relaxed">
                    We searched near <strong className="text-slate-900">{booking.serviceAddress?.line1 || booking.serviceAddress?.city}</strong>, but all technicians are currently offline or busy with other bookings.
                  </p>
                </div>
              </div>

              {/* Information & Assistance Box */}
              <div className="mt-4 bg-white/85 backdrop-blur-sm rounded-2xl p-4 border border-amber-200 space-y-2.5">
                <div className="flex items-start gap-2.5 text-xs text-slate-700">
                  <span className="text-base shrink-0">🔔</span>
                  <span><strong>Auto-Notification:</strong> You'll receive a instant push notification the moment a provider comes online in your area.</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-slate-700">
                  <span className="text-base shrink-0">🕒</span>
                  <span><strong>Flexible Scheduling:</strong> Your request remains queued for assignment, or you can retry searching right now.</span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="mt-5 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleRetryMatch}
                  disabled={retryingMatch}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-3.5 px-4 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-amber-200 transition-all disabled:opacity-50"
                >
                  {retryingMatch ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Searching Nearby Providers…
                    </>
                  ) : (
                    <>🔄 Search Again in My Area</>
                  )}
                </button>
                <button
                  onClick={() => setCancelModal(true)}
                  className="btn-secondary py-3.5 px-4 text-xs sm:text-sm text-slate-700 border-slate-300 font-semibold"
                >
                  Cancel Booking
                </button>
              </div>
            </div>
          ) : (
            /* 📡 Live Radar Searching Card */
            <div className="card p-6 mb-5 border-2 border-primary-400 bg-gradient-to-br from-blue-50/90 via-indigo-50/50 to-slate-50 shadow-lg relative overflow-hidden animate-fade-in">
              <div className="flex flex-col sm:flex-row items-center gap-5">
                {/* Live Radar Pulse Effect */}
                <div className="relative flex items-center justify-center w-24 h-24 shrink-0">
                  <div className="absolute inset-0 rounded-full bg-primary-400/20 animate-ping" />
                  <div className="absolute inset-2 rounded-full bg-primary-500/30 animate-pulse" />
                  <div className="relative z-10 w-16 h-16 rounded-full bg-primary-600 text-white flex items-center justify-center text-3xl shadow-xl shadow-primary-300">
                    📡
                  </div>
                </div>

                <div className="flex-1 text-center sm:text-left">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-xs font-extrabold tracking-wider uppercase mb-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Rapido Spot Search Active
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Connecting to nearby technicians...
                  </h3>
                  <p className="text-slate-600 text-xs sm:text-sm mt-1">
                    Searching top-rated service providers near <span className="font-semibold text-slate-800">{booking.serviceAddress?.city || 'your location'}</span>.
                  </p>

                  <div className="mt-3 flex items-center justify-center sm:justify-start gap-2 text-xs font-medium text-primary-700 bg-white/80 py-2 px-3.5 rounded-xl border border-primary-100 shadow-sm w-fit mx-auto sm:mx-0">
                    <div className="w-3.5 h-3.5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                    Matching technician ratings & distance...
                  </div>
                </div>
              </div>
            </div>
          )
        )}

        {/* Service info */}
        <div className="card p-5 mb-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-primary-50 rounded-xl text-3xl flex items-center justify-center">
              {booking.serviceId?.icon || '🔧'}
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-900">{booking.serviceId?.name}</h3>
              <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                <Clock size={13} />
                <span>{dayjs(booking.scheduledDate).format('ddd, D MMM')} · {booking.timeSlot?.from}–{booking.timeSlot?.to}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="card p-5 mb-4">
          <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <MapPin size={16} className="text-primary-600" /> Service Address
          </h3>
          <p className="text-slate-600 text-sm">
            {booking.serviceAddress?.line1}, {booking.serviceAddress?.city}, {booking.serviceAddress?.state} — {booking.serviceAddress?.pincode}
          </p>
        </div>

        {/* ── Start PIN — visible when job is assigned/accepted ── */}
        {(booking.status === 'assigned' || booking.status === 'accepted') && (
          <div className="card p-5 mb-4 border-2 border-primary-500 bg-gradient-to-br from-primary-50 to-indigo-50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🔑</span>
                <div>
                  <h3 className="font-bold text-slate-800">Start Service OTP</h3>
                  <p className="text-xs text-slate-500">Provide this OTP to the technician when they arrive to start the service</p>
                </div>
              </div>
              <button
                onClick={() => dispatch(fetchBookingById(id))}
                className="text-xs text-primary-600 underline font-medium"
              >
                Refresh
              </button>
            </div>
            {booking.startOtp ? (
              <>
                <div className="flex justify-center gap-3 my-4">
                  {booking.startOtp.split('').map((digit, i) => (
                    <div key={i} className="w-16 h-20 bg-white border-2 border-primary-400 rounded-2xl flex items-center justify-center text-4xl font-extrabold text-primary-600 shadow-lg">
                      {digit}
                    </div>
                  ))}
                </div>
                <p className="text-center text-xs text-slate-400">
                  🔒 Only share when the provider is physically present at your location
                </p>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-slate-650">OTP loading... tap <strong>Refresh</strong> if it doesn't appear</p>
              </div>
            )}
          </div>
        )}

        {/* ── Completion PIN — visible only when job is in progress ── */}
        {booking.status === 'in_progress' && (
          <div className="card p-5 mb-4 border-2 border-indigo-400 bg-gradient-to-br from-indigo-50 to-purple-50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🔐</span>
                <div>
                  <h3 className="font-bold text-indigo-900">Your Completion PIN</h3>
                  <p className="text-xs text-indigo-600">Share this PIN with the provider when the job is done</p>
                </div>
              </div>
              <button
                onClick={() => dispatch(fetchBookingById(id))}
                className="text-xs text-indigo-500 underline font-medium"
              >
                Refresh
              </button>
            </div>
            {booking.endOtp ? (
              <>
                <div className="flex justify-center gap-3 my-4">
                  {booking.endOtp.split('').map((digit, i) => (
                    <div key={i} className="w-16 h-20 bg-white border-2 border-indigo-400 rounded-2xl flex items-center justify-center text-4xl font-extrabold text-indigo-700 shadow-lg">
                      {digit}
                    </div>
                  ))}
                </div>
                <p className="text-center text-xs text-indigo-500">
                  🔒 Only share when you're satisfied the work is complete
                </p>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-indigo-600">PIN loading... tap <strong>Refresh</strong> if it doesn't appear</p>
              </div>
            )}
          </div>
        )}

        {/* Provider info with Google Trust Badges (Pillar 2) */}
        {booking.providerId && (
          <div className="card p-5 mb-4 group cursor-pointer hover:border-primary-300 transition-all" onClick={() => fetchProviderProfile(booking.providerId._id)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center font-bold text-primary-700 text-lg overflow-hidden relative">
                  {booking.providerId.avatar ? (
                    <img src={booking.providerId.avatar} alt="Provider" className="w-full h-full object-cover" />
                  ) : (
                    booking.providerId.name?.[0]
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <h3 className="text-xs font-medium text-slate-500 uppercase tracking-widest">Service Provider</h3>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-1.5 py-0.2 rounded flex items-center gap-0.5">
                      ✓ Verified Partner
                    </span>
                  </div>
                  <p className="font-bold text-slate-800">{booking.providerId.name}</p>
                  <div className="flex items-center gap-2 text-xs mt-0.5 font-medium">
                    <span className="flex items-center gap-1 text-amber-500 font-bold">
                      <Star size={12} fill="currentColor" /> {booking.providerId.rating || 4.9}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-600 font-medium">Verified Professional</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {canTrack && (
                  <Link to={`/bookings/${id}/track`} onClick={e => e.stopPropagation()} className="btn-secondary text-xs py-2 px-3 flex items-center gap-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border-none">
                    📍 Track
                  </Link>
                )}
                <a href={`tel:${booking.providerId.phone}`} onClick={e => e.stopPropagation()} className="btn-primary text-xs py-2 px-3 flex items-center gap-1 shadow-sm">
                  <Phone size={13} fill="currentColor" /> Call
                </a>
              </div>
            </div>
            <div className="mt-3 text-xs text-primary-600 font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              View full profile &rarr;
            </div>
          </div>
        )}

        {/* 🛡️ ANTI-FRAUD & WARRANTY WARNING BANNER */}
        {['accepted', 'in_progress'].includes(booking.status) && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 mb-4 shadow-sm text-xs">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white shrink-0 flex items-center justify-center font-bold text-sm">
                ⚠️
              </div>
              <div className="flex-1">
                <h4 className="font-extrabold text-slate-900 text-xs">Protect Your 30-Day Warranty!</h4>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  Never pay cash directly to technicians outside the app! All extra work & parts must be approved in-app to remain eligible for our <strong>30-Day Free Revisit Guarantee & Damage Protection</strong>.
                </p>
                <div className="mt-2.5 flex items-center justify-between border-t border-amber-200/60 pt-2">
                  <span className="text-[11px] text-amber-800 font-semibold">Offered direct cash deal?</span>
                  <button 
                    onClick={async () => {
                      try {
                        const res = await apiService.reportOffAppDeal(booking._id);
                        toast.success(res.data.message || 'Thank you for staying safe! 🛡️ You saved yourself from unauthorized repair fraud.');
                      } catch (err) {
                        toast.error(err.response?.data?.error || 'Failed to submit report');
                      }
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all"
                  >
                    🚩 Report Off-App Direct Deal
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── On-Site Inspection & Extra Issues Quotation Card ── */}
        {booking.quotation && booking.quotation.status !== 'none' && (
          <div className={`card p-5 mb-5 border-2 ${
            booking.quotation.status === 'pending' 
              ? 'border-amber-400 bg-gradient-to-br from-amber-50/90 via-orange-50/50 to-amber-100/40 shadow-lg'
              : booking.quotation.status === 'approved'
              ? 'border-emerald-300 bg-emerald-50/60'
              : 'border-slate-200 bg-slate-50'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🔍</span>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">On-Site Inspection Quotation</h3>
                  <p className="text-xs text-slate-500">Technician detected additional issues requiring fixes</p>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                booking.quotation.status === 'pending' ? 'bg-amber-500 text-white animate-pulse' :
                booking.quotation.status === 'approved' ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-700'
              }`}>
                {booking.quotation.status === 'pending' ? 'APPROVAL REQUIRED' : booking.quotation.status}
              </span>
            </div>

            {booking.quotation.note && (
              <p className="text-xs text-slate-700 bg-white/80 p-2.5 rounded-xl border border-amber-200/60 mb-3 italic">
                &ldquo;{booking.quotation.note}&rdquo;
              </p>
            )}

            <div className="space-y-2 mb-4 bg-white/90 p-3 rounded-2xl border border-slate-200/80">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Detected Issues & Fixed Charges</p>
              {booking.quotation.addons?.map((addon, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm py-1.5 border-b border-slate-100 last:border-0">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    {addon.name}
                  </span>
                  <span className="font-extrabold text-slate-900">₹{addon.price?.toLocaleString('en-IN')}</span>
                </div>
              ))}
              <div className="pt-2.5 mt-1 border-t border-slate-200 flex justify-between items-center text-sm font-extrabold">
                <span className="text-slate-600">Extra Issues Cost</span>
                <span className="text-amber-600">+ ₹{booking.quotation.totalAddonPrice?.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {booking.quotation.status === 'pending' && (
              <div className="space-y-3">
                <div className="bg-amber-100/90 p-3.5 rounded-xl text-xs text-amber-900 font-medium border border-amber-300 flex justify-between items-center">
                  <span>New Total Cost (Base Visit + Issues):</span>
                  <span className="text-lg font-extrabold text-amber-950">₹{(booking.basePrice + booking.quotation.totalAddonPrice).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleQuoteResponse('approve')}
                    disabled={respondingQuote}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl text-xs sm:text-sm shadow-md shadow-emerald-200 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    {respondingQuote ? 'Processing...' : '✅ Accept & Approve Quote'}
                  </button>
                  <button
                    onClick={() => handleQuoteResponse('decline')}
                    disabled={respondingQuote}
                    className="btn-secondary py-3.5 px-4 text-xs sm:text-sm text-slate-600 font-semibold border-slate-300"
                  >
                    ❌ Decline Quote
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 🛡️ 30-Day Digital Warranty Vault Card (Pillar 4) */}
        {(booking.warranty || ['completed', 'paid'].includes(booking.status)) && (
          <div className="card p-5 mb-5 border-2 border-emerald-400 bg-gradient-to-br from-emerald-50 via-teal-50/60 to-slate-50 shadow-md">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-xl shadow-md">
                  🛡️
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">30-Day Free Warranty Vault</h3>
                  <p className="text-xs text-emerald-800 font-medium">Urban Company Grade Service Protection</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-600 text-white uppercase tracking-wider">
                ✓ ACTIVE WARRANTY
              </span>
            </div>

            <div className="bg-white/90 rounded-2xl p-3.5 border border-emerald-200 text-xs space-y-2 mb-3">
              <div className="flex justify-between items-center text-slate-600">
                <span>Warranty Certificate ID:</span>
                <strong className="text-slate-900 font-mono font-bold">{booking.warranty?.warrantyId || `SH-WRN-${booking._id?.slice(-8).toUpperCase()}`}</strong>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Coverage Expiry Date:</span>
                <strong className="text-emerald-700 font-bold">
                  {booking.warranty?.validUntil 
                    ? dayjs(booking.warranty.validUntil).format('D MMMM YYYY') 
                    : dayjs(booking.scheduledDate).add(30, 'day').format('D MMMM YYYY')}
                </strong>
              </div>
              <div className="pt-2 border-t border-slate-100 text-slate-500 text-[11px]">
                🔒 <strong>Guarantee Terms:</strong> Covers 100% labor revisit & repair costs if the same issue reoccurs within 30 days of completion.
              </div>
            </div>
          </div>
        )}

        {/* Materials Summary */}
        {materials && (
          <div className="card p-5 mb-4 border-2 border-slate-100">
            <h3 className="font-semibold text-slate-800 mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">📦 Materials Used</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${materials.customerApproved ? 'bg-green-150 text-green-700' : 'bg-amber-100 text-amber-750'}`}>
                {materials.customerApproved ? 'Approved' : 'Pending Approval'}
              </span>
            </h3>
            
            <div className="space-y-3 mb-4">
              {materials.items?.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm py-1 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="font-semibold text-slate-800">{item.name}</p>
                    <p className="text-xs text-slate-400">
                      {item.brand ? `${item.brand} · ` : ''}{item.quantity} {item.unit}
                    </p>
                  </div>
                  <span className="font-bold text-slate-700">₹{(item.quantity * item.unitPrice).toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>

            {materials.notes && (
              <div className="bg-slate-50 p-3 rounded-xl text-xs text-slate-500 mb-4 font-medium italic border border-slate-100">
                &ldquo;{materials.notes}&rdquo;
              </div>
            )}

            {!materials.customerApproved && (
              <button
                onClick={handleApproveMaterials}
                disabled={approvingMaterials}
                className="w-full btn-primary bg-emerald-600 hover:bg-emerald-700 py-3.5 text-xs flex items-center justify-center gap-1.5 shadow-md transition-all font-bold"
              >
                {approvingMaterials ? (
                  <>Approving…</>
                ) : (
                  <>✓ Approve Materials & Update Bill</>
                )}
              </button>
            )}
          </div>
        )}

        {/* Bill */}
        <div className="card p-5 mb-4">
          <h3 className="font-semibold text-slate-800 mb-3">Bill Summary</h3>

          {/* 💵 Payment Mode Badge (Cash vs Online) */}
          {booking.status === 'paid' && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-xl shrink-0">{booking.paymentMethod === 'cash' ? '💵' : '💳'}</span>
                <span className="text-sm font-extrabold text-emerald-900 whitespace-nowrap">
                  {booking.paymentMethod === 'cash' ? 'Paid Cash' : 'Paid Online'}
                </span>
              </div>
              <span className="px-3 py-1 bg-emerald-600 text-white font-extrabold text-xs uppercase rounded-lg shadow whitespace-nowrap">
                ✓ {booking.paymentMethod === 'cash' ? 'Paid Cash' : 'Paid Online'}
              </span>
            </div>
          )}

          <BillBreakdown booking={booking} />
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {canPay && (
            <Link to={`/bookings/${id}/pay`} className="btn-primary w-full py-4 text-base text-center block">
              💳 Pay ₹{booking.totalAmount?.toLocaleString('en-IN')}
            </Link>
          )}
          {canReview && (
            <button onClick={() => setReviewModal(true)} className="btn-secondary w-full py-3 flex items-center justify-center gap-2">
              <Star size={16} /> Rate this service
            </button>
          )}
          {booking.status === 'paid' && (
            <button onClick={handleDownloadInvoice} className="btn-secondary w-full py-3 flex items-center justify-center gap-2">
              <Download size={16} /> Download Invoice (GST)
            </button>
          )}
          {['completed', 'paid'].includes(booking.status) && (
            <button
              onClick={() => {
                navigate(`/book/${booking.serviceId?._id}`, {
                  state: {
                    prefill: {
                      city: booking.serviceAddress?.city,
                      state: booking.serviceAddress?.state,
                      pincode: booking.serviceAddress?.pincode,
                      line1: booking.serviceAddress?.line1,
                    }
                  }
                });
                toast.success('Re-booking this service!');
              }}
              className="btn-secondary w-full py-3 flex items-center justify-center gap-2 border-2 border-primary-100 text-primary-600 bg-primary-50/30 hover:bg-primary-50 transition-all font-bold"
            >
              🔄 Re-book This Service
            </button>
          )}
          {canCancel && (
            <button onClick={() => setCancelModal(true)} className="w-full py-3 rounded-xl border-2 border-red-200 text-red-600 font-semibold text-sm hover:bg-red-50 transition-colors">
              Cancel Booking
            </button>
          )}

          {/* ── Raise Complaint button (completed/paid jobs only) ── */}
          {canComplain && (
            <button
              onClick={() => setComplaintModal(true)}
              className="w-full py-3 rounded-xl border-2 border-orange-200 text-orange-600 font-semibold text-sm hover:bg-orange-50 transition-colors flex items-center justify-center gap-2"
            >
              <AlertTriangle size={15} /> Raise a Complaint
            </button>
          )}
        </div>

      </div>

      <ConfirmModal
        isOpen={cancelModal}
        title="Cancel Booking?"
        message="Cancellation charges may apply depending on how close to the scheduled time you cancel."
        confirmLabel="Yes, Cancel"
        onConfirm={handleCancel}
        onCancel={() => setCancelModal(false)}
      />

      {reviewModal && (
        <ReviewModal bookingId={id} onClose={() => setReviewModal(false)} onSuccess={() => { setReviewModal(false); dispatch(fetchBookingById(id)); }} />
      )}

      {complaintModal && (
        <ComplaintModal
          bookingId={id}
          onClose={() => setComplaintModal(false)}
          onSuccess={() => { setComplaintModal(false); dispatch(fetchBookingById(id)); toast.success('Complaint raised! Technician will revisit.'); }}
        />
      )}


      {/* Provider Profile Modal */}
      {showProviderModal && providerProfile && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowProviderModal(false)} />
          <div className="bg-white rounded-2xl w-full max-w-sm relative shadow-2xl animate-in slide-in-from-bottom-5 sm:zoom-in-95">
            <div className="p-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-primary-100 text-primary-700 rounded-full flex justify-center items-center text-3xl font-bold mb-3 shadow-inner overflow-hidden">
                  {providerProfile.avatar ? (
                    <img src={providerProfile.avatar} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    providerProfile.name?.[0]
                  )}
                </div>
                <h2 className="text-xl font-bold text-slate-900">{providerProfile.name}</h2>
                <div className="flex items-center gap-2 mt-1 px-3 py-1 bg-amber-50 rounded-full">
                  <Star fill="#f59e0b" className="text-amber-500" size={14} />
                  <span className="font-bold text-amber-700">{providerProfile.rating}</span>
                  <span className="text-amber-600/60 text-xs">({providerProfile.ratingCount || 0} reviews)</span>
                </div>
              </div>
              
              <div className="mt-6 space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">Experience</p>
                    <p className="font-medium text-slate-800">{providerProfile.experience || 'Not listed'} yr</p>
                  </div>
                  <div className="w-px h-8 bg-slate-200"></div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">Jobs Done</p>
                    <p className="font-medium text-slate-800">{providerProfile.completedJobs}</p>
                  </div>
                  <div className="w-px h-8 bg-slate-200"></div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">Tier</p>
                    <p className="font-bold text-primary-600 capitalize">{providerProfile.tier}</p>
                  </div>
                </div>

                {providerProfile.specializations?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Specializations</p>
                    <div className="flex flex-wrap gap-2">
                      {providerProfile.specializations.map(s => (
                        <span key={s} className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button 
                onClick={() => setShowProviderModal(false)}
                className="btn-primary w-full mt-6 py-3"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusTimeline({ booking }) {
  const STEPS = ['pending','assigned','accepted','in_progress','completed','paid'];
  const currentIndex = STEPS.indexOf(booking.status);
  if (booking.status === 'cancelled') {
    return (
      <div className="card p-4 mb-4 bg-red-50 border-red-100 flex items-center gap-3">
        <span className="text-2xl">❌</span>
        <div>
          <p className="font-semibold text-red-700">Booking Cancelled</p>
          <p className="text-xs text-red-500">{booking.cancellation?.reason}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="card p-5 mb-4">
      <h3 className="font-semibold text-slate-800 mb-4">Booking Progress</h3>
      <div className="flex items-center gap-0">
        {STEPS.map((step, i) => {
          const done = i <= currentIndex;
          const active = i === currentIndex;
          return (
            <React.Fragment key={step}>
              <div className="flex flex-col items-center flex-1 min-w-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  done ? 'bg-primary-600 text-white' : 'bg-slate-200 text-slate-400'
                } ${active ? 'ring-4 ring-primary-200' : ''}`}>
                  {done ? '✓' : i + 1}
                </div>
                <p className={`text-[9px] mt-1 text-center capitalize leading-tight ${done ? 'text-primary-700 font-semibold' : 'text-slate-400'}`}>
                  {step.replace('_', '\n')}
                </p>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 flex-shrink-0 w-full max-w-[20px] transition-all ${i < currentIndex ? 'bg-primary-600' : 'bg-slate-200'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function BillBreakdown({ booking }) {
  return (
    <div className="space-y-2 text-sm">
      {[
        { label: 'Base price', value: booking.basePrice },
        booking.surgeMultiplier > 1 && { label: `Surge (${booking.surgeMultiplier}x)`, value: booking.basePrice * (booking.surgeMultiplier - 1) },
        booking.materialCost > 0 && { label: 'Materials used', value: booking.materialCost },
        booking.extraCharges > 0 && { label: booking.extraChargesNote || 'Extra charges', value: booking.extraCharges },
        booking.discountAmount > 0 && { label: `Discount (${booking.couponCode})`, value: -booking.discountAmount, cls: 'text-green-600' },
      ].filter(Boolean).map(({ label, value, cls }) => (
        <div key={label} className={`flex justify-between ${cls || 'text-slate-600'}`}>
          <span>{label}</span>
          <span className={value < 0 ? 'text-green-600' : ''}>{value < 0 ? '-' : ''}₹{Math.abs(value).toLocaleString('en-IN')}</span>
        </div>
      ))}
      <div className="flex justify-between font-bold text-slate-900 text-base pt-2 border-t border-slate-100">
        <span>Total</span>
        <span className="text-primary-700">₹{booking.totalAmount?.toLocaleString('en-IN')}</span>
      </div>
    </div>
  );
}

function ReviewModal({ bookingId, onClose, onSuccess }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!rating) return toast.error('Please select a rating');
    setSubmitting(true);
    try {
      await apiService.createReview({ bookingId, rating, comment });
      toast.success('Review submitted! Thank you.');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit review');
    } finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-md rounded-3xl p-6 animate-slide-up">
        <h3 className="text-lg font-bold text-slate-900 mb-1">Rate your experience</h3>
        <p className="text-slate-500 text-sm mb-6">How was the service? Your feedback helps others.</p>
        <div className="flex justify-center mb-6">
          <StarRating value={rating} onChange={setRating} size="lg" />
        </div>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Share your experience (optional)…"
          rows={3}
          className="input-field resize-none mb-4"
          maxLength={500}
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 btn-secondary">Skip</button>
          <button onClick={handleSubmit} disabled={submitting || !rating} className="flex-1 btn-primary">
            {submitting ? 'Submitting…' : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Complaint Modal ─────────────────────────────────────────────────────────────
function ComplaintModal({ bookingId, onClose, onSuccess }) {
  const CATEGORIES = [
    { value: 'poor_quality', label: '😞 Poor Quality of Work' },
    { value: 'damage',       label: '🔨 Damage Caused by Technician' },
    { value: 'behaviour',    label: '😠 Rude or Unprofessional Behaviour' },
    { value: 'overcharging', label: '💸 Overcharging' },
    { value: 'no_show',      label: '🚫 Technician Did Not Show Up' },
    { value: 'safety',       label: '⚠️ Safety Issue' },
    { value: 'other',        label: '📋 Other Issue' },
  ];

  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!category) { toast.error('Please select an issue type'); return; }
    const finalDesc = description.trim() || 'Service complaint submitted by customer.';
    setSubmitting(true);
    try {
      await apiService.createComplaint({ bookingId, category, description: finalDesc });
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to raise complaint');
    } finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 max-h-[90vh] overflow-y-auto" style={{ animation: 'slideUp 0.25s ease-out' }}>
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4 sm:hidden" />

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-orange-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Raise a Complaint</h3>
            <p className="text-xs text-slate-500">The technician will revisit to fix the issue</p>
          </div>
          <button onClick={onClose} className="ml-auto p-2 rounded-full hover:bg-slate-100 text-slate-400 text-lg font-bold">✕</button>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-3 mb-4 text-xs text-orange-700">
          ⚠️ Only raise a complaint if the work was genuinely unsatisfactory.
        </div>

        <p className="text-sm font-semibold text-slate-700 mb-2">What went wrong?</p>
        <div className="grid grid-cols-1 gap-2 mb-4">
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={`text-left text-sm px-4 py-2.5 rounded-xl border-2 font-medium transition-all ${
                category === c.value
                  ? 'border-orange-500 bg-orange-50 text-orange-900 font-bold'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <label className="block text-sm font-semibold text-slate-700 mb-1">
          Describe the issue <span className="text-slate-400 font-normal text-xs">(optional / brief detail)</span>
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          placeholder="Please describe what happened in detail so we can investigate and resolve your issue quickly…"
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none bg-slate-50 mb-1"
          maxLength={1000}
        />
        <div className="flex justify-between items-center text-xs text-slate-400 mb-5">
          <span>{description.trim().length < 5 && category ? 'Please type a short description (min 5 chars)' : ''}</span>
          <span>{description.length}/1000</span>
        </div>

        <div className="flex gap-3 sticky bottom-0 bg-white pt-2">
          <button onClick={onClose} className="flex-1 border-2 border-slate-200 text-slate-600 font-semibold rounded-xl py-3 hover:bg-slate-50 text-sm">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !category}
            className={`flex-1 font-bold rounded-xl py-3 text-sm flex items-center justify-center gap-2 transition-all ${
              submitting || !category
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-200'
            }`}
          >
            {submitting ? 'Submitting…' : <><AlertTriangle size={15} /> Submit Complaint</>}
          </button>
        </div>
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </div>
  );
}

