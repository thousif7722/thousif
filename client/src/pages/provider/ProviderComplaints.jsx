import React, { useEffect, useState, useRef } from 'react';
import { apiService } from '@/services/api';
import Header from '@/components/common/Header';
import { EmptyState } from '@/components/common/UI';
import {
  AlertTriangle, CheckCircle2, Clock, MapPin, Camera,
  Calendar, MessageSquare, X, ChevronDown, ChevronUp,
  Upload, RefreshCw, Shield
} from 'lucide-react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

// ── OTP Entry Modal ─────────────────────────────────────────────────────────────
function OtpConfirmModal({ complaint, onClose, onResolved }) {
  const [otp, setOtp] = useState(['', '', '', '']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const inputRefs = [useRef(), useRef(), useRef(), useRef()];

  const fullOtp = otp.join('');

  function handleDigit(idx, val) {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[idx] = digit;
    setOtp(next);
    setError('');
    if (digit && idx < 3) inputRefs[idx + 1].current?.focus();
  }

  function handleKeyDown(idx, e) {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      inputRefs[idx - 1].current?.focus();
    }
  }

  async function handleGenerateOtp() {
    try {
      await apiService.generateResolutionOtp(complaint._id);
      setOtpSent(true);
      toast.success('OTP sent to customer\'s phone/app!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send OTP');
    }
  }

  async function handleConfirm() {
    if (fullOtp.length !== 4) { setError('Enter the 4-digit OTP'); return; }
    setSubmitting(true);
    try {
      await apiService.confirmResolutionOtp(complaint._id, fullOtp);
      toast.success('✅ Complaint resolved successfully!');
      onResolved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP');
      setOtp(['', '', '', '']);
      inputRefs[0].current?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl px-5 pt-5 pb-10 max-w-lg mx-auto"
        style={{ animation: 'slideUp 0.25s ease-out' }}>
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
            <Shield size={20} className="text-green-600" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Confirm Resolution</h2>
            <p className="text-xs text-slate-500">Ticket #{complaint.ticketNumber}</p>
          </div>
          <button onClick={onClose} className="ml-auto p-2 rounded-full hover:bg-slate-100 text-slate-400">
            <X size={18} />
          </button>
        </div>

        {!otpSent ? (
          <div className="text-center py-4">
            <div className="text-5xl mb-4">📱</div>
            <p className="text-slate-700 font-semibold mb-2">Send OTP to Customer</p>
            <p className="text-sm text-slate-500 mb-6">
              Click below to send a 4-digit confirmation OTP to the customer's app. They will share this OTP with you to confirm the problem is resolved.
            </p>
            <button
              onClick={handleGenerateOtp}
              className="w-full py-3.5 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg,#2563eb 0%,#3b82f6 100%)' }}
            >
              <RefreshCw size={17} /> Generate & Send OTP to Customer
            </button>
          </div>
        ) : (
          <>
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6 text-center">
              <p className="text-sm font-semibold text-blue-800">OTP sent! Ask the customer for the code.</p>
              <p className="text-xs text-blue-500 mt-1">The customer sees the OTP in their notification</p>
            </div>

            <div className="flex justify-center gap-3 mb-4">
              {otp.map((digit, i) => (
                <input
                  key={i} ref={inputRefs[i]}
                  type="number" inputMode="numeric" maxLength={1} value={digit}
                  onChange={e => handleDigit(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  className={`w-16 text-center text-3xl font-bold rounded-2xl border-2 outline-none transition-all
                    ${error ? 'border-red-400 bg-red-50 text-red-600' : digit ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 bg-slate-50'}
                    focus:border-green-500`}
                  style={{ height: '4.5rem', WebkitAppearance: 'none' }}
                />
              ))}
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 mb-4 text-sm text-red-600">
                <AlertTriangle size={15} className="shrink-0" /> {error}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setOtpSent(false)} className="flex-1 border-2 border-slate-200 text-slate-600 font-semibold rounded-xl py-3.5 text-sm hover:bg-slate-50">
                Resend OTP
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting || fullOtp.length !== 4}
                className={`flex-1 font-bold rounded-xl py-3.5 text-sm flex items-center justify-center gap-2 transition-all ${
                  submitting || fullOtp.length !== 4
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-200'
                }`}
              >
                {submitting ? 'Confirming…' : <><CheckCircle2 size={16} /> Confirm Resolved</>}
              </button>
            </div>
          </>
        )}
      </div>
      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        input[type=number]::-webkit-outer-spin-button, input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
      `}</style>
    </>
  );
}

// ── Proof Upload Modal ──────────────────────────────────────────────────────────
function ProofUploadModal({ complaint, onClose, onUploaded }) {
  const [note, setNote] = useState('');
  const [previews, setPreviews] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef();

  function handleFiles(files) {
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews(prev => [...prev, { url: reader.result, name: file.name }]);
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleUpload() {
    if (previews.length === 0) { toast.error('Please add at least one photo'); return; }
    setSubmitting(true);
    try {
      // In production these base64 strings would be uploaded to S3 first
      await apiService.uploadResolutionProof(complaint._id, {
        proofUrls: previews.map(p => p.url),
        workDoneNote: note.trim() || 'Issue fixed on revisit.',
      });
      toast.success('Proof uploaded successfully!');
      onUploaded();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl px-5 pt-5 pb-10 max-w-lg mx-auto"
        style={{ animation: 'slideUp 0.25s ease-out' }}>
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
            <Camera size={20} className="text-purple-600" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Upload Proof of Resolution</h2>
            <p className="text-xs text-slate-500">Ticket #{complaint.ticketNumber}</p>
          </div>
          <button onClick={onClose} className="ml-auto p-2 rounded-full hover:bg-slate-100 text-slate-400"><X size={18} /></button>
        </div>

        {/* Photo picker */}
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-all mb-4"
        >
          <Upload size={28} className="mx-auto mb-2 text-slate-400" />
          <p className="text-sm font-medium text-slate-600">Tap to add photos</p>
          <p className="text-xs text-slate-400">Before & after photos of the fixed issue</p>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
            onChange={e => handleFiles(e.target.files)} />
        </div>

        {/* Image previews */}
        {previews.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
            {previews.map((p, i) => (
              <div key={i} className="relative shrink-0">
                <img src={p.url} alt={p.name} className="w-20 h-20 rounded-xl object-cover border border-slate-200" />
                <button
                  onClick={() => setPreviews(pr => pr.filter((_, idx) => idx !== i))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                >×</button>
              </div>
            ))}
          </div>
        )}

        <textarea
          value={note} onChange={e => setNote(e.target.value)} rows={2}
          placeholder="Describe what was fixed… e.g. Replaced faulty capacitor, cleaned filters"
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none bg-slate-50 mb-4"
        />

        <button
          onClick={handleUpload} disabled={submitting}
          className={`w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
            submitting ? 'bg-slate-200 text-slate-400' : 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-200'
          }`}
        >
          {submitting ? 'Uploading…' : <><Upload size={16} /> Upload Proof Photos</>}
        </button>
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </>
  );
}

// ── Revisit Schedule Modal ──────────────────────────────────────────────────────
function RevisitModal({ complaint, onClose, onScheduled }) {
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSchedule() {
    if (!date) { toast.error('Please select a date and time'); return; }
    setSubmitting(true);
    try {
      await apiService.scheduleRevisit(complaint._id, { revisitDate: date, revisitNote: note });
      toast.success('Revisit scheduled! Customer has been notified.');
      onScheduled();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to schedule');
    } finally {
      setSubmitting(false);
    }
  }

  const minDate = new Date().toISOString().slice(0, 16);

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl px-5 pt-5 pb-10 max-w-lg mx-auto"
        style={{ animation: 'slideUp 0.25s ease-out' }}>
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Calendar size={20} className="text-blue-600" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Schedule Revisit</h2>
            <p className="text-xs text-slate-500">Ticket #{complaint.ticketNumber}</p>
          </div>
          <button onClick={onClose} className="ml-auto p-2 rounded-full hover:bg-slate-100 text-slate-400"><X size={18} /></button>
        </div>

        <label className="block text-sm font-medium text-slate-700 mb-1">Revisit Date & Time</label>
        <input
          type="datetime-local" value={date} min={minDate}
          onChange={e => setDate(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50 mb-4"
        />

        <label className="block text-sm font-medium text-slate-700 mb-1">Message to Customer <span className="text-slate-400 font-normal">(optional)</span></label>
        <textarea
          value={note} onChange={e => setNote(e.target.value)} rows={2}
          placeholder="e.g. I will bring the replacement part and fix it."
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none bg-slate-50 mb-5"
        />

        <button
          onClick={handleSchedule} disabled={submitting || !date}
          className={`w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
            !date || submitting ? 'bg-slate-200 text-slate-400' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200'
          }`}
        >
          {submitting ? 'Scheduling…' : <><Calendar size={16} /> Confirm Revisit</>}
        </button>
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </>
  );
}

// ── Complaint Card ──────────────────────────────────────────────────────────────
function ComplaintCard({ complaint, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [modal, setModal] = useState(null); // 'revisit' | 'proof' | 'otp'

  const booking = complaint.bookingId;
  const customer = complaint.raisedBy;
  const isOpen = ['open', 'in_review'].includes(complaint.status);

  const STATUS_COLORS = {
    open: 'bg-red-100 text-red-700',
    in_review: 'bg-amber-100 text-amber-700',
    resolved: 'bg-green-100 text-green-700',
    closed: 'bg-slate-100 text-slate-500',
  };

  const CATEGORY_LABELS = {
    poor_quality: 'Poor Quality',
    no_show: 'No Show',
    behaviour: 'Behaviour',
    damage: 'Damage Caused',
    overcharging: 'Overcharging',
    safety: 'Safety Issue',
    fraud: 'Fraud',
    other: 'Other',
  };

  return (
    <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${isOpen ? 'border-red-200' : 'border-slate-100'}`}>
      {/* Status banner for open */}
      {isOpen && (
        <div className="bg-red-500 px-4 py-1.5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span className="text-white text-xs font-bold tracking-wide">ACTION REQUIRED — COMPLAINT</span>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-xl shrink-0">⚠️</div>
            <div>
              <p className="font-bold text-slate-900 text-sm">#{complaint.ticketNumber}</p>
              <p className="text-xs text-slate-500">{CATEGORY_LABELS[complaint.category] || complaint.category}</p>
            </div>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[complaint.status] || 'bg-slate-100 text-slate-500'}`}>
            {complaint.status.replace('_', ' ').toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 mb-3">
          <div className="flex items-center gap-1.5">
            <Clock size={11} /> {dayjs(complaint.createdAt).format('D MMM, h:mm A')}
          </div>
          {booking?.serviceAddress?.city && (
            <div className="flex items-center gap-1.5">
              <MapPin size={11} /> {booking.serviceAddress.city}
            </div>
          )}
        </div>

        <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 mb-3 line-clamp-2">
          "{complaint.description}"
        </p>

        <p className="text-xs text-slate-500 mb-3">
          Raised by: <span className="font-semibold text-slate-700">{customer?.name || 'Customer'}</span>
          {customer?.phone && <span className="ml-1 text-slate-400">· {customer.phone}</span>}
        </p>

        {/* Action buttons for open complaints */}
        {isOpen && (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setModal('revisit')}
                className="flex flex-col items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl py-2.5 text-xs font-semibold hover:bg-blue-100 transition-colors"
              >
                <Calendar size={16} />
                Schedule Revisit
              </button>
              <button
                onClick={() => setModal('proof')}
                className="flex flex-col items-center gap-1 bg-purple-50 border border-purple-200 text-purple-700 rounded-xl py-2.5 text-xs font-semibold hover:bg-purple-100 transition-colors"
              >
                <Camera size={16} />
                Upload Proof
              </button>
              <button
                onClick={() => setModal('otp')}
                className="flex flex-col items-center gap-1 bg-green-50 border border-green-200 text-green-700 rounded-xl py-2.5 text-xs font-semibold hover:bg-green-100 transition-colors"
              >
                <CheckCircle2 size={16} />
                Mark Resolved
              </button>
            </div>

            <div className="text-center text-xs text-slate-400 pt-1">
              Step 1: Schedule Revisit → Step 2: Upload Proof → Step 3: Get OTP from Customer
            </div>
          </div>
        )}

        {/* Resolved state */}
        {complaint.status === 'resolved' && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 text-sm text-green-700">
            <CheckCircle2 size={16} className="shrink-0" />
            <span className="font-semibold">Resolved on {dayjs(complaint.resolution?.resolvedAt).format('D MMM YYYY')}</span>
          </div>
        )}

        {/* Expand/Collapse Comments */}
        {complaint.comments?.length > 0 && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="mt-3 w-full flex items-center justify-between text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            <span className="flex items-center gap-1">
              <MessageSquare size={12} /> {complaint.comments.length} comment{complaint.comments.length > 1 ? 's' : ''}
            </span>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}

        {expanded && complaint.comments?.length > 0 && (
          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
            {complaint.comments.map((c, i) => (
              <div key={i} className={`text-xs rounded-xl px-3 py-2 ${c.role === 'provider' ? 'bg-blue-50 text-blue-800 ml-4' : 'bg-slate-100 text-slate-700 mr-4'}`}>
                <p className="font-semibold mb-0.5 capitalize">{c.role === 'provider' ? '🔧 You' : '👤 Customer'}</p>
                <p>{c.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {modal === 'revisit' && (
        <RevisitModal complaint={complaint} onClose={() => setModal(null)} onScheduled={onRefresh} />
      )}
      {modal === 'proof' && (
        <ProofUploadModal complaint={complaint} onClose={() => setModal(null)} onUploaded={onRefresh} />
      )}
      {modal === 'otp' && (
        <OtpConfirmModal complaint={complaint} onClose={() => setModal(null)} onResolved={onRefresh} />
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────────
export default function ProviderComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');

  useEffect(() => { loadComplaints(); }, []);

  async function loadComplaints() {
    setLoading(true);
    try {
      const res = await apiService.getMyComplaints();
      setComplaints(res.data.data || []);
    } catch (err) {
      toast.error('Failed to load complaints');
    } finally {
      setLoading(false);
    }
  }

  const displayed = complaints.filter(c =>
    filter === 'active'
      ? ['open', 'in_review'].includes(c.status)
      : ['resolved', 'closed'].includes(c.status)
  );

  const activeCount = complaints.filter(c => ['open', 'in_review'].includes(c.status)).length;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header />
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Complaints</h1>
            <p className="text-sm text-slate-500 mt-0.5">Resolve customer issues to maintain your rating</p>
          </div>
          {activeCount > 0 && (
            <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-sm">
              {activeCount}
            </div>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex bg-slate-100 rounded-xl p-1 mb-5 gap-1">
          {[
            { id: 'active', label: `⚠️ Pending (${activeCount})` },
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

        {/* How it works banner */}
        {filter === 'active' && activeCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5">
            <p className="text-xs font-bold text-amber-800 mb-2">📋 How to Resolve a Complaint</p>
            <div className="space-y-1 text-xs text-amber-700">
              <p>1️⃣ <strong>Schedule Revisit</strong> — Pick a date & notify the customer</p>
              <p>2️⃣ <strong>Visit & Fix</strong> — Go to customer's location and resolve the issue</p>
              <p>3️⃣ <strong>Upload Proof</strong> — Take before/after photos as evidence</p>
              <p>4️⃣ <strong>Get OTP</strong> — Customer confirms resolution with a 4-digit OTP</p>
            </div>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 animate-pulse h-40" />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <EmptyState
            icon={filter === 'active' ? '🎉' : '📋'}
            title={filter === 'active' ? 'No Pending Complaints' : 'No Resolved Complaints'}
            description={filter === 'active' ? 'You have no open complaints. Keep up the great work!' : 'Resolved complaints will appear here.'}
          />
        ) : (
          <div className="space-y-4">
            {displayed.map(c => (
              <ComplaintCard key={c._id} complaint={c} onRefresh={loadComplaints} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
