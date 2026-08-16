import React, { useEffect, useState, useRef } from 'react';
import { apiService } from '@/services/api';
import Header from '@/components/common/Header';
import { EmptyState } from '@/components/common/UI';
import {
  AlertTriangle, CheckCircle2, Clock, MapPin, ChevronDown,
  ChevronUp, MessageSquare, X, Siren, RefreshCw, ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { getSocket } from '@/services/socket';

// ── Escalation Confirmation Modal ───────────────────────────────────────────────
function EscalateModal({ complaint, onClose, onEscalated }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleEscalate() {
    setSubmitting(true);
    try {
      await apiService.escalateComplaint(
        complaint._id,
        reason.trim() || 'Technician did not visit to resolve the issue.'
      );
      toast.success('Complaint escalated to admin! Support will contact you within 2 hours.');
      onEscalated();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to escalate');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl px-5 pt-5 pb-10 max-w-lg mx-auto"
        style={{ animation: 'slideUp 0.25s ease-out' }}
      >
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
            <Siren size={20} className="text-red-600" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Escalate to Admin</h2>
            <p className="text-xs text-slate-500">Ticket #{complaint.ticketNumber}</p>
          </div>
          <button onClick={onClose} className="ml-auto p-2 rounded-full hover:bg-slate-100 text-slate-400">
            <X size={18} />
          </button>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-5">
          <p className="text-sm font-semibold text-red-800 mb-1">⚠️ Only escalate if:</p>
          <ul className="text-xs text-red-700 space-y-1 list-disc list-inside">
            <li>The technician promised to revisit but didn't show up</li>
            <li>The revisit time has passed and the issue is still not resolved</li>
            <li>The technician is not responding</li>
          </ul>
        </div>

        <label className="block text-sm font-medium text-slate-700 mb-1">
          Tell us what happened <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          placeholder="e.g. The technician scheduled revisit for yesterday but never came. Not responding to calls."
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none bg-slate-50 mb-5"
          maxLength={500}
        />

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border-2 border-slate-200 text-slate-600 font-semibold rounded-xl py-3.5 hover:bg-slate-50 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleEscalate}
            disabled={submitting}
            className={`flex-1 font-bold rounded-xl py-3.5 text-sm flex items-center justify-center gap-2 transition-all ${
              submitting
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-200'
            }`}
          >
            {submitting ? 'Escalating…' : <><Siren size={16} /> Escalate to Admin</>}
          </button>
        </div>
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </>
  );
}

// ── Complaint Card ──────────────────────────────────────────────────────────────
function CustomerComplaintCard({ complaint, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [escalateModal, setEscalateModal] = useState(false);

  const booking = complaint.bookingId;
  const isActive = ['open', 'in_review'].includes(complaint.status);
  const canEscalate = isActive;
  const isEscalated = complaint.status === 'escalated';

  const STATUS_CONFIG = {
    open:       { color: 'bg-red-100 text-red-700',    label: 'Awaiting Technician' },
    in_review:  { color: 'bg-amber-100 text-amber-700', label: 'Revisit Scheduled' },
    escalated:  { color: 'bg-red-600 text-white',       label: '🚨 Escalated to Admin' },
    resolved:   { color: 'bg-green-100 text-green-700', label: '✅ Resolved' },
    closed:     { color: 'bg-slate-100 text-slate-500', label: 'Closed' },
  };

  const CATEGORY_LABELS = {
    poor_quality: 'Poor Quality',
    damage:       'Damage Caused',
    behaviour:    'Bad Behaviour',
    overcharging: 'Overcharging',
    no_show:      'Tech No-Show',
    safety:       'Safety Issue',
    fraud:        'Fraud',
    other:        'Other',
  };

  const cfg = STATUS_CONFIG[complaint.status] || STATUS_CONFIG.open;

  // Time since filed, show escalation prompt if > 24h and still open
  const hoursSinceFiled = (Date.now() - new Date(complaint.createdAt).getTime()) / (1000 * 60 * 60);
  const showEscalationHint = canEscalate && hoursSinceFiled >= 24;

  return (
    <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${isEscalated ? 'border-red-400' : isActive ? 'border-orange-200' : 'border-slate-100'}`}>
      {/* Status Banner */}
      {isEscalated && (
        <div className="bg-red-600 px-4 py-1.5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span className="text-white text-xs font-bold tracking-wide">ESCALATED — ADMIN REVIEWING</span>
        </div>
      )}
      {complaint.status === 'resolved' && (
        <div className="bg-green-500 px-4 py-1.5 flex items-center gap-2">
          <CheckCircle2 size={14} className="text-white" />
          <span className="text-white text-xs font-bold tracking-wide">RESOLVED BY TECHNICIAN</span>
        </div>
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="font-bold text-slate-900 text-sm">#{complaint.ticketNumber}</p>
            <p className="text-xs text-slate-500 mt-0.5">{CATEGORY_LABELS[complaint.category] || complaint.category}</p>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.color}`}>{cfg.label}</span>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mb-3">
          <span className="flex items-center gap-1"><Clock size={11} /> {dayjs(complaint.createdAt).format('D MMM · h:mm A')}</span>
          {booking?.bookingNumber && <span>Booking #{booking.bookingNumber}</span>}
          {booking?.serviceAddress?.city && (
            <span className="flex items-center gap-1"><MapPin size={11} /> {booking.serviceAddress.city}</span>
          )}
        </div>

        {/* Description */}
        <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 mb-3 italic leading-relaxed line-clamp-2">
          "{complaint.description}"
        </p>

        {/* Status-specific info */}
        {complaint.status === 'in_review' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-3 text-xs text-amber-700 flex items-start gap-2">
            <Clock size={14} className="mt-0.5 shrink-0" />
            <span>
              <strong>Technician has scheduled a revisit.</strong>{' '}
              If they don't show up after the scheduled time, you can escalate this complaint.
            </span>
          </div>
        )}

        {complaint.status === 'resolved' && complaint.resolution?.resolvedAt && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 mb-3 text-xs text-green-700 flex items-center gap-2">
            <CheckCircle2 size={14} className="shrink-0" />
            <span>Resolved on {dayjs(complaint.resolution.resolvedAt).format('D MMM YYYY, h:mm A')}</span>
          </div>
        )}

        {isEscalated && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 mb-3 text-xs text-red-700">
            🚨 <strong>This complaint is with our admin team.</strong> We will contact you within 2 hours. You may also receive a call from our support agent.
          </div>
        )}

        {/* Escalation prompt (24h hint) */}
        {showEscalationHint && (
          <div className="bg-orange-50 border border-orange-300 rounded-xl px-3 py-2.5 mb-3 text-xs text-orange-800 flex items-start gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>
              <strong>24h passed!</strong> If the technician hasn't visited or contacted you, escalate this to our admin team for immediate action.
            </span>
          </div>
        )}

        {/* Escalate Button */}
        {canEscalate && (
          <button
            onClick={() => setEscalateModal(true)}
            className="w-full py-2.5 rounded-xl border-2 border-red-300 text-red-600 font-bold text-xs hover:bg-red-50 transition-colors flex items-center justify-center gap-2 mb-2"
          >
            <Siren size={14} /> Technician Didn't Visit — Escalate to Admin
          </button>
        )}

        {/* Comments toggle */}
        {complaint.comments?.length > 0 && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-600 transition-colors pt-1"
          >
            <span className="flex items-center gap-1">
              <MessageSquare size={12} /> {complaint.comments.length} update{complaint.comments.length > 1 ? 's' : ''}
            </span>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}

        {expanded && complaint.comments?.length > 0 && (
          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
            {complaint.comments.map((c, i) => (
              <div
                key={i}
                className={`text-xs rounded-xl px-3 py-2 ${
                  c.role === 'provider'
                    ? 'bg-blue-50 text-blue-800 ml-4'
                    : c.role === 'system'
                      ? 'bg-slate-100 text-slate-600 text-center italic'
                      : 'bg-orange-50 text-orange-800 mr-4'
                }`}
              >
                {c.role !== 'system' && (
                  <p className="font-semibold mb-0.5 capitalize">
                    {c.role === 'provider' ? '🔧 Technician' : '👤 You'}
                  </p>
                )}
                <p>{c.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {escalateModal && (
        <EscalateModal
          complaint={complaint}
          onClose={() => setEscalateModal(false)}
          onEscalated={onRefresh}
        />
      )}
    </div>
  );
}

// ── OTP Display Banner ──────────────────────────────────────────────────────────
function OtpBanner({ otp, ticketNumber, expiresAt, onDismiss }) {
  const [timeLeft, setTimeLeft] = useState(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));

  useEffect(() => {
    if (timeLeft <= 0) { onDismiss(); return; }
    const t = setInterval(() => setTimeLeft(s => {
      if (s <= 1) { clearInterval(t); onDismiss(); return 0; }
      return s - 1;
    }), 1000);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const secs = String(timeLeft % 60).padStart(2, '0');

  return (
    <div className="fixed bottom-24 left-0 right-0 z-50 px-4 max-w-lg mx-auto">
      <div className="bg-slate-900 rounded-2xl shadow-2xl border border-emerald-500/30 p-5 relative">
        <button onClick={onDismiss} className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-slate-700 text-slate-400">
          <X size={16} />
        </button>
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={20} className="text-emerald-400 shrink-0" />
          <div>
            <p className="font-bold text-white text-sm">Resolution OTP — Ticket #{ticketNumber}</p>
            <p className="text-xs text-slate-400">Share this code with the technician to confirm resolution</p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-3 bg-slate-800 rounded-xl py-4 mb-3">
          {otp.split('').map((digit, i) => (
            <div key={i} className="w-12 h-14 bg-slate-700 rounded-xl flex items-center justify-center">
              <span className="text-3xl font-black text-emerald-400">{digit}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Expires in</span>
          <span className={`font-mono font-bold ${timeLeft < 60 ? 'text-red-400' : 'text-slate-300'}`}>{mins}:{secs}</span>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────────
export default function CustomerComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');
  // OTP received via socket (shown in overlay banner)
  const [activeOtp, setActiveOtp] = useState(null); // { otp, ticketNumber, expiresAt }
  const loadingRef = useRef(false);

  useEffect(() => { loadComplaints(); }, []);

  // ── Real-time socket: complaint events ────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onCreated = (data) => {
      toast.success(data.message || `Complaint filed! Ticket #${data.ticketNumber}`, { icon: '📋', duration: 6000 });
      loadComplaints();
    };
    const onResolved = () => { loadComplaints(); };
    const onOtp = (data) => {
      setActiveOtp({
        otp: data.otp,
        ticketNumber: data.ticketNumber,
        expiresAt: Date.now() + (data.expiresInSeconds || 600) * 1000,
      });
    };
    // Also refresh if any complaint-related push notification arrives
    const onNotifPush = (data) => {
      if (data.type === 'complaint' || data.type === 'otp') loadComplaints();
    };

    socket.on('complaint:created', onCreated);
    socket.on('complaint:resolved', onResolved);
    socket.on('complaint:resolution_otp', onOtp);
    socket.on('notification:push', onNotifPush);

    return () => {
      socket.off('complaint:created', onCreated);
      socket.off('complaint:resolved', onResolved);
      socket.off('complaint:resolution_otp', onOtp);
      socket.off('notification:push', onNotifPush);
    };
  }, []);

  async function loadComplaints() {
    setLoading(true);
    try {
      const res = await apiService.getMyComplaints();
      setComplaints(res.data.data || []);
    } catch {
      toast.error('Failed to load complaints');
    } finally {
      setLoading(false);
    }
  }

  const displayed = complaints.filter(c =>
    filter === 'active'
      ? ['open', 'in_review', 'escalated'].includes(c.status)
      : ['resolved', 'closed'].includes(c.status)
  );

  const activeCount = complaints.filter(c => ['open', 'in_review', 'escalated'].includes(c.status)).length;
  const escalatedCount = complaints.filter(c => c.status === 'escalated').length;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header />

      {/* OTP overlay banner — shown when provider triggers resolution OTP */}
      {activeOtp && (
        <OtpBanner
          otp={activeOtp.otp}
          ticketNumber={activeOtp.ticketNumber}
          expiresAt={activeOtp.expiresAt}
          onDismiss={() => setActiveOtp(null)}
        />
      )}

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Complaints</h1>
            <p className="text-sm text-slate-500 mt-0.5">Track and escalate unresolved service issues</p>
          </div>
          <div className="flex items-center gap-2">
            {escalatedCount > 0 && (
              <div className="bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                {escalatedCount} Escalated
              </div>
            )}
            <button
              onClick={loadComplaints}
              disabled={loading}
              className="flex items-center gap-1 text-xs font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {/* Info card */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-5">
          <p className="text-xs font-bold text-blue-800 mb-2">📋 What happens with your complaint?</p>
          <div className="space-y-1 text-xs text-blue-700">
            <p>1️⃣ Technician reviews and <strong>schedules a revisit</strong></p>
            <p>2️⃣ Technician visits, fixes the issue, and <strong>uploads proof</strong></p>
            <p>3️⃣ You share an <strong>OTP to confirm</strong> the problem is resolved</p>
            <p>4️⃣ If technician <strong>doesn't visit in 24h</strong>, escalate to our admin team</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-slate-100 rounded-xl p-1 mb-5 gap-1">
          {[
            { id: 'active', label: `⚠️ Active (${activeCount})` },
            { id: 'resolved', label: '✅ Resolved' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${filter === f.id ? 'bg-white shadow text-primary-700' : 'text-slate-500'}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 animate-pulse h-44" />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <EmptyState
            icon={filter === 'active' ? '🎉' : '📋'}
            title={filter === 'active' ? 'No Active Complaints' : 'No Resolved Complaints'}
            description={
              filter === 'active'
                ? 'All your complaints have been resolved. Great!'
                : 'Resolved complaints will appear here.'
            }
          />
        ) : (
          <div className="space-y-4">
            {displayed.map(c => (
              <CustomerComplaintCard key={c._id} complaint={c} onRefresh={loadComplaints} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
