import React, { useEffect, useState, useCallback } from 'react';
import { apiService } from '@/services/api';
import Header from '@/components/common/Header';
import { ConfirmModal } from '@/components/common/UI';
import {
  Search, Ban, CheckCircle, AlertTriangle, RefreshCw,
  Eye, FileText, CreditCard, X, Wallet, Clock,
  ShieldAlert, MapPin, Star, Briefcase, User, ExternalLink, Lock, RefreshCcw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

const thCls = 'px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider';
const tdCls = 'px-4 py-3 text-sm text-slate-700';

// ── Wallet Adjust Modal ────────────────────────────────────────────────────────
function WalletModal({ provider, onClose, onDone }) {
  const [form, setForm] = useState({ amount: '', type: 'credit', reason: '', target: 'wallet' });
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!form.amount || !form.reason) return toast.error('All fields required');
    setLoading(true);
    try {
      await apiService.adjustProviderWallet(provider._id, {
        amount: Number(form.amount), type: form.type, reason: form.reason, target: form.target,
      });
      toast.success(`Wallet ${form.type === 'credit' ? 'credited' : 'debited'} ₹${form.amount}`);
      onDone();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Adjust Wallet</h2>
            <p className="text-xs text-slate-500 mt-0.5">{provider.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full text-slate-400"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="input-field py-2 text-sm w-full">
                <option value="credit">Credit (+)</option>
                <option value="debit">Debit (−)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Target</label>
              <select value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} className="input-field py-2 text-sm w-full">
                <option value="wallet">Wallet</option>
                <option value="securityDeposit">Security Deposit</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Amount (₹)</label>
            <input type="number" min="1" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" className="input-field py-2 text-sm w-full" required />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Reason</label>
            <input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Correction, bonus, penalty…" className="input-field py-2 text-sm w-full" required />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary py-2.5 text-sm">Cancel</button>
            <button type="submit" disabled={loading}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-colors ${form.type === 'credit' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}>
              {loading ? 'Processing…' : `${form.type === 'credit' ? 'Credit' : 'Debit'} ₹${form.amount || 0}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── KYC Document Viewer ───────────────────────────────────────────────────────
// Documents live PERMANENTLY in AWS S3 (private bucket).
// On each admin view request, the backend generates a fresh 7-day signed URL.
function KycDocViewer({ provider }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [docs, setDocs] = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);

  const hasAnyDoc = provider.kyc?.aadhaarDoc || provider.kyc?.panDoc || provider.kyc?.selfie;

  async function fetchDocs() {
    setLoading(true);
    try {
      const res = await apiService.getProviderKycDocs(provider._id);
      setDocs(res.data.data.docs);
      setGeneratedAt(res.data.data.generatedAt);
      setOpen(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to fetch document links');
    } finally {
      setLoading(false);
    }
  }

  if (!hasAnyDoc) {
    return <span className="text-xs text-slate-400 italic">No documents uploaded</span>;
  }

  return (
    <>
      <button
        onClick={fetchDocs}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3.5 py-2 rounded-xl transition-all disabled:opacity-60 shadow-sm"
      >
        {loading ? (
          <><RefreshCcw size={13} className="animate-spin" /> Fetching Secure Links…</>
        ) : (
          <><Lock size={13} /> View Permanent KYC Documents</>
        )}
      </button>

      {open && docs && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">

            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-900 flex items-center gap-2">
                  <Lock size={18} className="text-indigo-600" /> KYC Documents — {provider.name}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  ♾️ Permanent S3 Document Access · Private Encrypted Storage
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchDocs}
                  disabled={loading}
                  title="Regenerate fresh signed URLs"
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
                >
                  <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
                <button onClick={() => setOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Security notice */}
            <div className="mx-5 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
              <ShieldAlert size={15} className="text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800">
                <strong>Confidential Identity Files.</strong> Stored permanently for legal compliance & audit purposes.
                Access is logged. Do not share, screenshot, or distribute these links.
              </p>
            </div>

            {/* Documents grid */}
            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Selfie */}
              <DocCard
                label="🤳 Selfie / Photo ID"
                url={docs.selfie}
                color="blue"
              />
              {/* Aadhaar */}
              <DocCard
                label="🪪 Aadhaar Card"
                url={docs.aadhaarDoc}
                number={provider.kyc?.aadhaarNumber}
                color="green"
              />
              {/* PAN */}
              <DocCard
                label="💳 PAN Card"
                url={docs.panDoc}
                number={provider.kyc?.panNumber}
                color="purple"
              />
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end">
              <button onClick={() => setOpen(false)} className="btn-secondary px-6 text-sm font-semibold">Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DocCard({ label, url, number, color }) {
  const colors = {
    blue: { bg: 'bg-blue-50/60', border: 'border-blue-200', badge: 'bg-blue-600 hover:bg-blue-700', text: 'text-blue-700' },
    green: { bg: 'bg-green-50/60', border: 'border-green-200', badge: 'bg-green-600 hover:bg-green-700', text: 'text-green-700' },
    purple: { bg: 'bg-purple-50/60', border: 'border-purple-200', badge: 'bg-purple-600 hover:bg-purple-700', text: 'text-purple-700' },
  };
  const c = colors[color] || colors.blue;

  if (!url) {
    return (
      <div className={`rounded-xl border ${c.border} ${c.bg} p-4 flex flex-col items-center justify-center h-52`}>
        <FileText size={32} className="text-slate-300 mb-2" />
        <p className="text-xs font-bold text-slate-600">{label}</p>
        <p className="text-xs text-slate-400 mt-1 italic">Not uploaded</p>
      </div>
    );
  }

  // Check if URL is a PDF document
  const isPdf = typeof url === 'string' && url.toLowerCase().includes('.pdf');

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-3.5 flex flex-col justify-between gap-2`}>
      <div>
        <p className="text-xs font-bold text-slate-800 mb-1">{label}</p>
        {number && (
          <p className={`text-xs font-mono font-bold ${c.text} mb-2`}>{number}</p>
        )}
      </div>

      {!isPdf ? (
        <a href={url} target="_blank" rel="noreferrer" className="block my-1">
          <img
            src={url}
            alt={label}
            className="w-full h-36 object-cover rounded-lg border border-slate-200 hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
            onError={e => { e.target.style.display = 'none'; if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'; }}
          />
          <div style={{ display: 'none' }} className="w-full h-36 rounded-lg border border-slate-200 flex flex-col items-center justify-center bg-slate-100 text-slate-400 gap-1">
            <FileText size={28} />
            <span className="text-[10px] font-bold">Image Preview</span>
          </div>
        </a>
      ) : (
        <a href={url} target="_blank" rel="noreferrer" className="w-full h-36 rounded-lg border border-slate-200 bg-white flex flex-col items-center justify-center gap-1 my-1 hover:bg-slate-50 transition-colors">
          <FileText size={32} className="text-emerald-600" />
          <span className="text-[10px] font-bold text-slate-500 uppercase">PDF Document</span>
        </a>
      )}

      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={`inline-flex items-center justify-center gap-1.5 w-full text-xs font-semibold text-white ${c.badge} py-2 rounded-lg transition-colors shadow-sm mt-1`}
      >
        <ExternalLink size={12} /> Open Full Document
      </a>
    </div>
  );
}

// ── Provider Full Details Modal ────────────────────────────────────────────────
function ProviderDetailModal({ provider, onClose, onAction, onWallet, onDues }) {
  const tabs = ['KYC & Bank', 'Performance', 'Earnings'];
  const [tab, setTab] = useState('KYC & Bank');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center text-primary-600 font-bold text-xl shadow-inner">
              {provider.name?.[0]}
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-lg leading-snug">{provider.name}</h2>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs text-slate-500 font-mono">{provider.phone}</span>
                {provider.city && <span className="text-xs text-slate-400 flex items-center gap-1"><MapPin size={10} />{provider.city}</span>}
                <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${provider.isBlocked ? 'bg-red-100 text-red-700' : provider.approvalStatus === 'approved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {provider.isBlocked ? 'Blocked' : provider.approvalStatus}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full text-slate-400 transition-colors"><X size={20} /></button>
        </div>

        {provider.isBlocked && provider.blockReason && (
          <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
            <AlertTriangle size={16} className="text-red-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800">Account Blocked/Frozen</p>
              <p className="text-xs text-red-700 mt-0.5">{provider.blockReason}</p>
            </div>
          </div>
        )}

        {/* Quick stats strip */}
        <div className="grid grid-cols-4 divide-x divide-slate-100 bg-slate-50 border-b border-slate-100">
          {[
            { icon: Star, label: 'Rating', value: provider.rating?.toFixed(1) || '—', sub: `${provider.ratingCount || 0} reviews` },
            { icon: Briefcase, label: 'Completed', value: provider.completedJobs || 0, sub: `${provider.cancelledJobs || 0} cancelled` },
            { icon: AlertTriangle, label: 'Warnings', value: `${provider.warningCount || 0}/3`, sub: provider.warningCount >= 3 ? 'Auto-blocked' : 'Active' },
            { icon: ShieldAlert, label: 'Risk Score', value: provider.riskScore || 0, sub: provider.riskScore >= 70 ? '⚠️ High Risk' : 'Normal' },
          ].map(({ icon: Icon, label, value, sub }) => (
            <div key={label} className="flex items-center gap-3 p-4">
              <Icon size={16} className="text-slate-400 shrink-0" />
              <div>
                <p className="text-xs text-slate-400">{label}</p>
                <p className="font-bold text-slate-800">{value}</p>
                <p className="text-[10px] text-slate-400">{sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-4 border-b border-slate-100">
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-5 overflow-y-auto flex-1 bg-slate-50">
          {tab === 'KYC & Bank' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* KYC */}
              <div className="card p-5 border border-slate-100 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><FileText size={15} className="text-primary-600" /> Identity (KYC) & Audit Log</h3>
                {provider.kyc?.verifiedBy?.name && (
                  <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-emerald-900">Approved by Staff: {provider.kyc.verifiedBy.name}</p>
                        <p className="text-[10px] text-emerald-700">{provider.kyc.verifiedBy.email} • {provider.kyc.verifiedAt ? dayjs(provider.kyc.verifiedAt).format('DD MMM YYYY, HH:mm') : ''}</p>
                      </div>
                    </div>
                    <span className="text-[10px] bg-emerald-200 text-emerald-800 font-bold px-2 py-0.5 rounded-full">Audited</span>
                  </div>
                )}
                {provider.kyc?.assignedTo?.name && !provider.kyc?.verifiedBy?.name && (
                  <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-center gap-2">
                    <Clock size={16} className="text-purple-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-purple-900">Assigned Staff Reviewer: {provider.kyc.assignedTo.name}</p>
                      <p className="text-[10px] text-purple-700">{provider.kyc.assignedTo.email}</p>
                    </div>
                  </div>
                )}
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Status</p>
                    <span className={`status-badge text-xs ${provider.kyc?.status === 'verified' ? 'bg-green-100 text-green-700' : provider.kyc?.status === 'submitted' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                      {provider.kyc?.status || 'Pending'}
                    </span>
                  </div>
                  {/* Aadhaar & PAN numbers */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Aadhaar No.</p>
                      <p className="font-medium text-slate-800 text-sm font-mono">{provider.kyc?.aadhaarNumber || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">PAN No.</p>
                      <p className="font-medium text-slate-800 text-sm font-mono">{provider.kyc?.panNumber || '—'}</p>
                    </div>
                  </div>

                  {/* Secure Document Viewer — generates fresh signed URLs on demand */}
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                      <Lock size={11} /> Documents (Aadhaar / PAN / Selfie)
                    </p>
                    <KycDocViewer provider={provider} />
                  </div>
                </div>
              </div>

              {/* Bank */}
              <div className="card p-5 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <CreditCard size={15} className={provider.earnings?.bankAccount?.verified ? 'text-emerald-600' : 'text-amber-500'} /> Bank Account
                  </h3>
                  {provider.earnings?.bankAccount?.accountNumber && (
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${provider.earnings.bankAccount.verified ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {provider.earnings.bankAccount.verified ? '✓ Verified' : '⏳ Pending'}
                    </span>
                  )}
                </div>
                {provider.earnings?.bankAccount?.accountNumber ? (
                  <div className="space-y-3">
                    {[
                      ['Account Holder', provider.earnings.bankAccount.accountHolder],
                      ['Account Number', provider.earnings.bankAccount.accountNumber],
                      ['IFSC Code', provider.earnings.bankAccount.ifscCode],
                      ['Bank Name', provider.earnings.bankAccount.bankName],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="text-xs text-slate-500">{label}</p>
                        <p className="font-medium text-slate-800 text-sm font-mono">{value || '—'}</p>
                      </div>
                    ))}
                    {!provider.earnings.bankAccount.verified && (
                      <div className="flex gap-3 pt-3 border-t border-slate-100">
                        <button onClick={() => onAction('rejectBank')} className="flex-1 btn-secondary border-red-200 text-red-600 hover:bg-red-50 py-2 text-sm">Reject</button>
                        <button onClick={() => onAction('approveBank')} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 text-sm font-semibold rounded-xl transition-colors">Verify & Approve</button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-400">
                    <CreditCard size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No bank account added</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'Performance' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: 'Tier', value: provider.tier || 'bronze', cls: provider.tier === 'gold' ? 'text-amber-500' : provider.tier === 'silver' ? 'text-slate-500' : 'text-orange-700' },
                  { label: 'Experience', value: `${provider.experience || 0} yrs`, cls: 'text-slate-700' },
                  { label: 'Service Radius', value: `${provider.serviceRadius || 10} km`, cls: 'text-slate-700' },
                  { label: 'Completion Rate', value: provider.completedJobs + provider.cancelledJobs > 0 ? `${Math.round((provider.completedJobs / (provider.completedJobs + provider.cancelledJobs)) * 100)}%` : '—', cls: 'text-emerald-600' },
                  { label: 'Is Online', value: provider.isOnline ? '✅ Yes' : '❌ No', cls: 'text-slate-700' },
                  { label: 'Risk Score', value: provider.riskScore || 0, cls: (provider.riskScore || 0) >= 70 ? 'text-red-600 font-bold' : 'text-slate-700' },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="card p-4">
                    <p className="text-xs text-slate-400 mb-1">{label}</p>
                    <p className={`text-lg font-bold ${cls}`}>{value}</p>
                  </div>
                ))}
              </div>
              <div className="card p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Services Offered</p>
                <div className="flex flex-wrap gap-2">
                  {provider.services?.length > 0 ? provider.services.map(s => (
                    <span key={s._id} className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-xs font-medium">{s.name}</span>
                  )) : <span className="text-slate-400 text-sm">No services assigned</span>}
                </div>
              </div>
              {provider.warnings?.length > 0 && (
                <div className="card p-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Warning History</p>
                  <div className="space-y-2">
                    {provider.warnings.map((w, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl">
                        <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm text-slate-800">{w.reason}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{dayjs(w.issuedAt).format('D MMM YYYY HH:mm')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'Earnings' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'Total Earnings', value: provider.earnings?.totalEarnings || 0, cls: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Wallet Balance', value: provider.earnings?.walletBalance || 0, cls: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Security Deposit', value: provider.earnings?.securityDeposit || 0, cls: 'text-purple-600', bg: 'bg-purple-50' },
                { label: 'Pending Commission', value: provider.earnings?.pendingCommission || 0, cls: 'text-red-600', bg: 'bg-red-50' },
                { label: 'Total Commission Paid', value: provider.earnings?.totalCommissionPaid || 0, cls: 'text-slate-700', bg: 'bg-slate-50' },
                { label: 'On Hold', value: provider.earnings?.isOnHold ? '⛔ Yes' : '✅ No', cls: provider.earnings?.isOnHold ? 'text-red-600' : 'text-emerald-600', bg: 'bg-slate-50', raw: true },
              ].map(({ label, value, cls, bg, raw }) => (
                <div key={label} className={`card p-4 border-0 ${bg}`}>
                  <p className="text-xs text-slate-500 mb-1">{label}</p>
                  <p className={`text-xl font-bold ${cls}`}>
                    {raw ? value : `₹${Number(value).toLocaleString('en-IN')}`}
                  </p>
                </div>
              ))}
              <div className="md:col-span-2 flex gap-3">
                <button onClick={onDues} className="flex-1 btn-secondary flex items-center justify-center gap-2 py-2.5">
                  <AlertTriangle size={15} /> View Dues & Clear Hold
                </button>
                <button onClick={onWallet} className="flex-1 btn-secondary flex items-center justify-center gap-2 py-2.5">
                  <Wallet size={15} /> Adjust Wallet
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-white rounded-b-2xl">
          <div className="flex gap-2">
            {provider.approvalStatus === 'pending' && (
              <>
                <button onClick={() => onAction('reject')} className="btn-secondary border-red-200 text-red-600 hover:bg-red-50 px-4 text-sm">Reject KYC</button>
                <button onClick={() => onAction('approve')} className="btn-primary px-6 text-sm">Approve Provider</button>
              </>
            )}
            {provider.approvalStatus === 'approved' && !provider.isBlocked && (
              <>
                <button onClick={() => onAction('warn')} className="btn-secondary border-amber-200 text-amber-600 hover:bg-amber-50 px-4 text-sm flex items-center gap-1">
                  <AlertTriangle size={13} /> Warn
                </button>
                <button onClick={() => onAction('block')} className="btn-secondary border-red-200 text-red-600 hover:bg-red-50 px-4 text-sm flex items-center gap-1">
                  <Ban size={13} /> Block
                </button>
              </>
            )}
            {provider.isBlocked && (
              <button onClick={() => onAction('unblock')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 text-sm font-semibold rounded-xl transition-colors flex items-center gap-2">
                <CheckCircle size={14} /> Unblock Provider
              </button>
            )}
          </div>
          <button onClick={onClose} className="btn-secondary px-5">Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Dues Panel Modal ────────────────────────────────────────────────────────────
function DuesPanel({ provider, onClose, onDone }) {
  const [dues, setDues] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    apiService.getProviderDues(provider._id)
      .then(r => setDues(r.data.data))
      .catch(() => toast.error('Failed to load dues'))
      .finally(() => setLoading(false));
  }, [provider._id]);

  async function clearDues() {
    setClearing(true);
    try {
      await apiService.clearProviderDues(provider._id, { amountPaid: dues.pendingCommission, note: 'Cleared by admin' });
      toast.success('Dues cleared! Hold lifted.');
      onDone();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setClearing(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div><h2 className="font-bold text-slate-900">Commission Dues</h2><p className="text-xs text-slate-500 mt-0.5">{provider.name}</p></div>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full text-slate-400"><X size={18} /></button>
        </div>
        <div className="p-5">
          {loading ? <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}</div>
            : dues ? (
              <>
                {dues.isOnHold && (
                  <div className="mb-4 flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-xl">
                    <Ban size={16} className="text-red-600 shrink-0" />
                    <p className="text-sm text-red-700 font-medium">Provider is on hold — cannot accept new jobs</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {[
                    { label: 'Wallet Balance', value: `₹${(dues.walletBalance || 0).toLocaleString('en-IN')}`, cls: 'text-emerald-600' },
                    { label: 'Security Deposit', value: `₹${(dues.securityDeposit || 0).toLocaleString('en-IN')}`, cls: 'text-blue-600' },
                    { label: 'Pending Commission', value: `₹${(dues.pendingCommission || 0).toLocaleString('en-IN')}`, cls: 'text-red-600' },
                    { label: 'Days Overdue', value: dues.daysOverdue || 0, cls: dues.daysOverdue > 7 ? 'text-red-600' : 'text-slate-700' },
                  ].map(({ label, value, cls }) => (
                    <div key={label} className="bg-slate-50 rounded-xl p-3">
                      <p className="text-xs text-slate-500 mb-1">{label}</p>
                      <p className={`text-lg font-bold ${cls}`}>{value}</p>
                    </div>
                  ))}
                </div>
                {dues.transactions?.length > 0 && (
                  <div className="mb-5">
                    <p className="text-xs font-semibold text-slate-600 uppercase mb-2">Unpaid Cash Commissions</p>
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      {dues.transactions.map(txn => (
                        <div key={txn._id} className="flex items-center justify-between text-sm bg-red-50 px-3 py-2 rounded-lg">
                          <span className="text-slate-600 font-mono text-xs">{txn.bookingId?.bookingNumber || '—'}</span>
                          <span className="text-red-600 font-semibold">₹{txn.amount?.toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-3">
                  <button onClick={onClose} className="flex-1 btn-secondary py-2.5 text-sm">Close</button>
                  {dues.pendingCommission > 0 && (
                    <button onClick={clearDues} disabled={clearing} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 text-sm font-semibold rounded-xl transition-colors disabled:opacity-60">
                      {clearing ? 'Processing…' : `Clear ₹${dues.pendingCommission?.toLocaleString('en-IN')}`}
                    </button>
                  )}
                </div>
              </>
            ) : <p className="text-center text-slate-400 py-6">Failed to load dues</p>}
        </div>
      </div>
    </div>
  );
}

function ApprovalBadge({ p }) {
  if (p.isBlocked) {
    return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">Blocked</span>;
  }
  if (p.approvalStatus === 'approved') {
    return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">Approved</span>;
  }
  if (p.approvalStatus === 'rejected') {
    return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">Rejected</span>;
  }
  if (p.approvalStatus === 'suspended') {
    return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">Suspended</span>;
  }
  return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">Pending KYC</span>;
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN PROVIDERS — FULL PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function AdminProviders() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [modal, setModal] = useState(null); // confirm modal
  const [detailProvider, setDetailProvider] = useState(null);
  const [walletModal, setWalletModal] = useState(null);
  const [duesModal, setDuesModal] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [distributing, setDistributing] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getAdminProviders({
        page, limit: 20,
        search: search || undefined,
        approvalStatus: statusFilter || undefined,
        tier: tierFilter || undefined,
      });
      setProviders(res.data.data);
      setTotal(res.data.pagination.total);
      setSelectedIds([]);
    } catch { toast.error('Failed to load providers'); }
    finally { setLoading(false); }
  }, [page, search, statusFilter, tierFilter]);

  useEffect(() => { load(); }, [load]);

  function confirmAction(action, provider) {
    const titles = {
      approve: `Approve Provider ${provider.name}`,
      reject: `Reject Provider ${provider.name}`,
      warn: `Issue Warning to ${provider.name}`,
      block: `Block Provider ${provider.name}`,
      unblock: `Unblock Provider ${provider.name}`,
      approveBank: `Approve Bank Details for ${provider.name}`,
      rejectBank: `Reject Bank Details for ${provider.name}`,
    };

    const messages = {
      approve: `Are you sure you want to approve ${provider.name}'s KYC and enable them for job assignments?`,
      reject: `Are you sure you want to reject ${provider.name}'s application?`,
      warn: `This will issue an official administrative warning to ${provider.name}.`,
      block: `Blocking ${provider.name} will immediately suspend their job dispatch access.`,
      unblock: `Unblocking ${provider.name} will restore their access to customer job requests.`,
      approveBank: `Approve and mark bank account details for ${provider.name} as verified?`,
      rejectBank: `Reject bank account submission for ${provider.name}?`,
    };

    const variants = {
      approve: 'default',
      reject: 'danger',
      warn: 'warning',
      block: 'danger',
      unblock: 'default',
      approveBank: 'default',
      rejectBank: 'danger',
    };

    setModal({
      title: titles[action] || 'Confirm Action',
      message: messages[action] || 'Are you sure you want to proceed?',
      label: action.toUpperCase(),
      variant: variants[action] || 'default',
      onConfirm: async () => {
        setModal(null);
        try {
          if (action === 'approve') await apiService.approveProvider(provider._id);
          else if (action === 'reject') await apiService.rejectProvider(provider._id, { reason: 'KYC Verification Failed' });
          else if (action === 'warn') await apiService.warnProvider(provider._id, { reason: 'Administrative Policy Warning' });
          else if (action === 'block') await apiService.blockProvider(provider._id, { reason: 'Administrative Suspension' });
          else if (action === 'unblock') await apiService.unblockProvider(provider._id);
          else if (action === 'approveBank') await apiService.verifyProviderBank(provider._id, { action: 'approve' });
          else if (action === 'rejectBank') await apiService.verifyProviderBank(provider._id, { action: 'reject' });
          toast.success(`Action '${action}' completed.`);
          load();
        } catch (err) {
          toast.error(err.response?.data?.error || `Failed to perform ${action}`);
        }
      },
    });
  }

  function handleDetailAction(action) {
    if (!detailProvider) return;
    const p = detailProvider;
    setDetailProvider(null);
    confirmAction(action, p);
  }

  async function handleAutoDistribute() {
    setDistributing(true);
    try {
      const res = await apiService.autoDistributeKyc();
      toast.success(res.data.message);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to distribute workload');
    } finally {
      setDistributing(false);
    }
  }

  async function handleBulkApprove() {
    if (selectedIds.length === 0) return toast.error('No providers selected');
    setBulkProcessing(true);
    try {
      const res = await apiService.bulkApproveProviders(selectedIds);
      toast.success(res.data.message);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Bulk approve failed');
    } finally {
      setBulkProcessing(false);
    }
  }

  function toggleSelectAll() {
    if (selectedIds.length === providers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(providers.map(p => p._id));
    }
  }

  function toggleSelectOne(id) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <Header />
      <div className="py-6 page-container">

        {/* Page Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Providers <span className="text-slate-400 font-normal text-base ml-2">({total})</span>
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">Distributed KYC approvals, staff workload balancing, wallet & dues management</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleAutoDistribute}
              disabled={distributing}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs px-4 py-2 rounded-xl flex items-center gap-2 transition shadow-sm"
              title="Automatically split unassigned pending KYC applications evenly among active staff members"
            >
              ⚡ {distributing ? 'Distributing…' : 'Auto-Distribute Workload'}
            </button>
            <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {/* Filters & Bulk Action Bar */}
        <div className="card p-4 mb-5 flex gap-3 flex-wrap items-center border-b-0 rounded-b-none shadow-none border">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name or phone…"
              className="input-field pl-9 py-2 text-sm w-full"
            />
          </div>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="input-field py-2 text-sm w-auto">
            <option value="">All Status</option>
            <option value="pending">Pending KYC</option>
            <option value="pending_bank">Pending Bank</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="suspended">Suspended</option>
          </select>
          <select value={tierFilter} onChange={e => { setTierFilter(e.target.value); setPage(1); }} className="input-field py-2 text-sm w-auto">
            <option value="">All Tiers</option>
            <option value="gold">🥇 Gold</option>
            <option value="silver">🥈 Silver</option>
            <option value="bronze">🥉 Bronze</option>
          </select>

          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkApprove}
              disabled={bulkProcessing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow flex items-center gap-1.5"
            >
              ✓ {bulkProcessing ? 'Approving…' : `Bulk Approve Selected (${selectedIds.length})`}
            </button>
          )}
        </div>

        {/* Table */}
        <div className="card overflow-hidden rounded-t-none border-t-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-3 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={providers.length > 0 && selectedIds.length === providers.length}
                      onChange={toggleSelectAll}
                      className="rounded text-primary-600 focus:ring-primary-500 cursor-pointer"
                    />
                  </th>
                  {['Provider', 'Phone', 'Tier', 'Rating', 'Jobs', 'Warnings', 'KYC', 'Verified By', 'Commission Hold', 'Status', 'Actions'].map(h => (
                    <th key={h} className={thCls}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  [...Array(8)].map((_, i) => (
                    <tr key={i}>{[...Array(12)].map((_, j) => <td key={j} className={tdCls}><div className="skeleton h-4 rounded w-20" /></td>)}</tr>
                  ))
                ) : providers.length === 0 ? (
                  <tr><td colSpan="12" className="p-10 text-center text-slate-400">No providers found</td></tr>
                ) : providers.map(p => (
                  <tr key={p._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-3 w-8">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(p._id)}
                        onChange={() => toggleSelectOne(p._id)}
                        className="rounded text-primary-600 focus:ring-primary-500 cursor-pointer"
                      />
                    </td>
                    <td className={tdCls}>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-sm shrink-0">
                          {p.name?.[0]}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{p.name}</p>
                          {p.city && <p className="text-xs text-slate-400">{p.city}, {p.state}</p>}
                        </div>
                      </div>
                    </td>
                    <td className={tdCls + ' font-mono text-xs'}>{p.phone}</td>
                    <td className={tdCls}>
                      <span className={`text-xs font-bold ${p.tier === 'gold' ? 'text-amber-500' : p.tier === 'silver' ? 'text-slate-500' : 'text-orange-700'}`}>
                        {p.tier === 'gold' ? '🥇' : p.tier === 'silver' ? '🥈' : '🥉'} {p.tier}
                      </span>
                    </td>
                    <td className={tdCls}>{p.rating?.toFixed(1) || '—'} ⭐</td>
                    <td className={tdCls}>{p.completedJobs || 0}</td>
                    <td className={tdCls}>
                      <span className={`text-xs font-bold ${p.warningCount >= 3 ? 'text-red-600' : p.warningCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                        {p.warningCount || 0}/3
                      </span>
                    </td>
                    <td className={tdCls}>
                      <span className={`status-badge text-xs ${p.kyc?.status === 'verified' ? 'bg-green-100 text-green-700' : p.kyc?.status === 'submitted' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                        {p.kyc?.status || 'pending'}
                      </span>
                    </td>
                    <td className={tdCls}>
                      {p.kyc?.verifiedBy?.name ? (
                        <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md inline-flex items-center gap-1" title={`Approved by staff: ${p.kyc.verifiedBy.email}`}>
                          👤 {p.kyc.verifiedBy.name}
                        </span>
                      ) : p.kyc?.assignedTo?.name ? (
                        <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md" title={`Assigned reviewer: ${p.kyc.assignedTo.email}`}>
                          ⏳ {p.kyc.assignedTo.name}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className={tdCls}>
                      {p.earnings?.isOnHold ? (
                        <button onClick={() => setDuesModal(p)} className="inline-flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-lg font-semibold hover:bg-red-100 transition-colors">
                          <Ban size={10} /> On Hold
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className={tdCls}><ApprovalBadge p={p} /></td>
                    <td className={tdCls}>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setDetailProvider(p)} className="text-primary-600 text-xs font-medium hover:underline flex items-center gap-1">
                          <Eye size={12} /> View
                        </button>
                        {p.approvalStatus === 'pending' && (
                          <div className="flex gap-1.5 pl-2 border-l border-slate-200">
                            <button onClick={() => confirmAction('approve', p)} className="text-green-600 text-xs font-medium hover:underline">Approve</button>
                            <button onClick={() => confirmAction('reject', p)} className="text-red-500 text-xs font-medium hover:underline">Reject</button>
                          </div>
                        )}
                        {p.approvalStatus === 'approved' && !p.isBlocked && (
                          <div className="flex gap-1.5 pl-2 border-l border-slate-200">
                            <button onClick={() => confirmAction('warn', p)} className="text-amber-600 text-xs hover:underline font-medium">Warn</button>
                            <button onClick={() => confirmAction('block', p)} className="text-red-500 text-xs hover:underline font-medium">Block</button>
                          </div>
                        )}
                        {p.isBlocked && (
                          <button onClick={() => confirmAction('unblock', p)} className="text-green-600 text-xs font-medium hover:underline pl-2 border-l border-slate-200">Unblock</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-sm text-slate-500">{providers.length} of {total}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40">← Prev</button>
              <span className="px-3 py-1.5 text-sm text-slate-600">Page {page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={providers.length < 20} className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40">Next →</button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={!!modal}
        title={modal?.title}
        message={modal?.message}
        confirmLabel={modal?.label}
        variant={modal?.variant}
        onConfirm={modal?.onConfirm}
        onCancel={() => setModal(null)}
      />

      {/* Provider Detail Modal */}
      {detailProvider && (
        <ProviderDetailModal
          provider={detailProvider}
          onClose={() => setDetailProvider(null)}
          onAction={handleDetailAction}
          onWallet={() => { setDetailProvider(null); setWalletModal(detailProvider); }}
          onDues={() => { setDetailProvider(null); setDuesModal(detailProvider); }}
        />
      )}

      {/* Wallet Modal */}
      {walletModal && (
        <WalletModal
          provider={walletModal}
          onClose={() => setWalletModal(null)}
          onDone={() => { setWalletModal(null); load(); }}
        />
      )}

      {/* Dues Modal */}
      {duesModal && (
        <DuesPanel
          provider={duesModal}
          onClose={() => setDuesModal(null)}
          onDone={() => { setDuesModal(null); load(); }}
        />
      )}
    </div>
  );
}
