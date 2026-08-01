import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectUserRole } from '@/store/slices/authSlice';
import { getSocket, playRapidoAlertSound, stopRapidoAlertSound } from '@/services/socket';
import { apiService } from '@/services/api';
import { MapPin, Clock, DollarSign, CheckCircle2, XCircle, Navigation, ShieldCheck, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

export default function GlobalJobAcceptModal() {
  const role = useSelector(selectUserRole);
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [timer, setTimer] = useState(60);
  const [accepting, setAccepting] = useState(false);
  const totalTimeRef = useRef(60);

  useEffect(() => {
    if (role !== 'provider') return;

    const socket = getSocket();
    if (!socket) return;

    const handleNewRequest = (data) => {
      if (!data || !data.bookingId) return;

      // Check if this booking request was already popped & seen during this session
      const seenKey = `seen_popup_${data.bookingId}`;
      if (sessionStorage.getItem(seenKey)) {
        console.log(`[JobModal] Booking ${data.bookingId} already seen once. Skipping duplicate popup.`);
        return;
      }

      // Mark as seen so navigating pages (History, Profile, etc.) won't re-trigger siren/popup
      sessionStorage.setItem(seenKey, 'true');

      const timeout = data.acceptTimeoutSeconds || 60;
      setRequest(data);
      setTimer(timeout);
      totalTimeRef.current = timeout;

      // Dismiss background toasts so full screen modal is clean without UI disturbance
      toast.dismiss();

      // Start loud sirens & vibration
      playRapidoAlertSound(timeout * 1000);
      if ('vibrate' in navigator) {
        try { navigator.vibrate([400, 200, 400, 200, 400]); } catch {}
      }
    };

    const handleExpired = () => {
      setRequest(null);
      stopRapidoAlertSound();
    };

    socket.on('booking:new_request', handleNewRequest);
    socket.on('booking:expired', handleExpired);

    return () => {
      socket.off('booking:new_request', handleNewRequest);
      socket.off('booking:expired', handleExpired);
    };
  }, [role]);

  // Countdown timer
  useEffect(() => {
    if (!request || timer <= 0) return;
    const interval = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          stopRapidoAlertSound();
          setRequest(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [request, timer]);

  if (role !== 'provider' || !request) return null;

  const serviceName = request.service?.name || request.serviceName || 'Home Service';
  const category = request.service?.category || request.category || 'General';
  const earnings = request.estimatedEarnings || request.totalAmount || 0;
  const distance = request.distanceKm || (Math.random() * 4 + 0.8).toFixed(1);
  const address = request.address?.area || request.address?.city || request.serviceAddress?.city || 'Nearby Area';
  const timeSlot = request.timeSlot?.from || request.scheduledDate ? 'Today' : 'Immediate';

  async function handleAccept() {
    if (!request?.bookingId) return;
    setAccepting(true);
    stopRapidoAlertSound();

    try {
      await apiService.acceptBooking(request.bookingId);
      toast.success('⚡ JOB ACCEPTED! Navigating to Active Job...', { duration: 4000 });
      setRequest(null);
      navigate('/provider/bookings?tab=active');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to accept job. It may have expired.');
      setRequest(null);
    } finally {
      setAccepting(false);
    }
  }

  async function handleDecline() {
    stopRapidoAlertSound();
    if (request?.bookingId) {
      try {
        await apiService.rejectBooking(request.bookingId, 'Provider declined request');
      } catch (e) {
        // silent
      }
    }
    setRequest(null);
    toast('Job declined');
  }

  const pct = Math.max(0, (timer / totalTimeRef.current) * 100);

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4">
      {/* Animated Glowing Dispatch Card */}
      <div 
        className="w-full max-w-md bg-slate-900 text-white rounded-t-3xl sm:rounded-3xl shadow-2xl border-2 border-emerald-500/50 overflow-hidden flex flex-col transition-all duration-300"
        style={{ animation: 'rapidoPop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}
      >
        {/* Top Timer Bar */}
        <div className="w-full bg-slate-800 h-2.5 relative overflow-hidden">
          <div 
            className={`h-full transition-all duration-1000 ${timer < 15 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Dispatch Header Banner */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-5 py-3.5 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
            </span>
            <span className="font-black text-xs uppercase tracking-widest text-emerald-100 flex items-center gap-1">
              <Zap size={14} className="fill-white" /> NEW JOB REQUEST
            </span>
          </div>
          <div className="bg-black/30 backdrop-blur-md px-3 py-1 rounded-full text-xs font-black font-mono text-emerald-300 border border-emerald-400/30">
            ⏰ {timer}s LEFT
          </div>
        </div>

        {/* Main Job Body */}
        <div className="p-6 space-y-5">
          {/* Earnings Highlight */}
          <div className="flex items-center justify-between bg-slate-800/80 border border-slate-700 rounded-2xl p-4">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Your Estimated Earnings</p>
              <p className="text-3xl font-black text-emerald-400 mt-0.5 flex items-center">
                ₹{Number(earnings).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-2xl">
              ⚡
            </div>
          </div>

          {/* Service Info */}
          <div>
            <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950 border border-emerald-800 px-2.5 py-0.5 rounded-md uppercase tracking-wide">
              {category}
            </span>
            <h2 className="text-xl font-extrabold text-white mt-1.5 leading-snug">{serviceName}</h2>
          </div>

          {/* Location & Time Pills */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-3 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                <MapPin size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-slate-400 font-medium text-[10px]">DISTANCE</p>
                <p className="font-bold text-white truncate">{distance} km away</p>
                <p className="text-slate-400 text-[10px] truncate">{address}</p>
              </div>
            </div>

            <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-3 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <Clock size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-slate-400 font-medium text-[10px]">TIME SLOT</p>
                <p className="font-bold text-white truncate">{timeSlot}</p>
                <p className="text-emerald-400 text-[10px] font-semibold">Immediate Dispatch</p>
              </div>
            </div>
          </div>

          {/* FAST 1-TAP ACCEPT BUTTON */}
          <div className="space-y-2 pt-2">
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full h-16 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-400 hover:to-teal-500 active:scale-98 text-white font-black text-lg rounded-2xl shadow-xl shadow-emerald-900/40 border border-emerald-400/30 flex items-center justify-center gap-3 transition-all cursor-pointer"
            >
              {accepting ? (
                <span className="flex items-center gap-2 animate-pulse">
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ACCEPTING JOB...
                </span>
              ) : (
                <>
                  <CheckCircle2 size={24} className="fill-emerald-400 text-slate-900" />
                  <span>ACCEPT JOB NOW</span>
                  <span className="bg-black/20 text-xs px-2.5 py-1 rounded-lg font-mono">₹{earnings}</span>
                </>
              )}
            </button>

            <button
              onClick={handleDecline}
              disabled={accepting}
              className="w-full py-3 text-xs font-bold text-slate-400 hover:text-red-400 transition-colors flex items-center justify-center gap-1.5"
            >
              <XCircle size={14} /> Decline Request
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes rapidoPop {
          0% { transform: scale(0.9) translateY(40px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
