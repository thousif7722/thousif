import React, { useEffect, useState, useCallback } from 'react';
import { apiService } from '@/services/api';
import Header from '@/components/common/Header';
import {
  TrendingUp, DollarSign, RefreshCw, AlertTriangle, CheckCircle,
  CreditCard, Zap, X, ShieldAlert, ArrowUpRight, ArrowDownRight,
  Wallet, Clock, Ban,
} from 'lucide-react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';

const thCls = 'px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider';
const tdCls = 'px-4 py-3 text-sm text-slate-700';

// ── Wallet Adjust Modal ────────────────────────────────────────────────────────
function WalletAdjustModal({ provider, onClose, onDone }) {
  const [form, setForm] = useState({ amount: '', type: 'credit', reason: '', target: 'wallet' });
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!form.amount || !form.reason) return toast.error('All fields required');
    setLoading(true);
    try {
      await apiService.adjustProviderWallet(provider._id, {
        amount: Number(form.amount),
        type: form.type,
        reason: form.reason,
        target: form.target,
      });
      toast.success(`Wallet ${form.type === 'credit' ? 'credited' : 'debited'} ₹${form.amount}`);
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Adjust Wallet</h2>
            <p className="text-xs text-slate-500 mt-0.5">{provider.name} · {provider.phone}</p>
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
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary py-2.5 text-sm">Cancel</button>
            <button type="submit" disabled={loading} className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-colors ${form.type === 'credit' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}>
              {loading ? 'Processing…' : `${form.type === 'credit' ? 'Credit' : 'Debit'} ₹${form.amount || 0}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Provider Dues Panel ────────────────────────────────────────────────────────
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
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    } finally { setClearing(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Commission Dues</h2>
            <p className="text-xs text-slate-500 mt-0.5">{provider.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full text-slate-400"><X size={18} /></button>
        </div>
        <div className="p-5">
          {loading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}</div>
          ) : dues ? (
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
                    {clearing ? 'Processing…' : `Clear ₹${dues.pendingCommission?.toLocaleString('en-IN')} Dues`}
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="text-center text-slate-400 py-6">Failed to load dues</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Surge Pricing Modal ────────────────────────────────────────────────────────
function SurgeModal({ services, onClose }) {
  const [form, setForm] = useState({ serviceId: '', hour: 9, multiplier: 1.5 });
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!form.serviceId) return toast.error('Select a service');
    setLoading(true);
    try {
      await apiService.updateSurgePricing(form);
      toast.success(`Surge ${form.multiplier}x set for hour ${form.hour}:00`);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Manual Surge Override</h2>
            <p className="text-xs text-slate-500 mt-0.5">Force a surge multiplier for 1 hour</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full text-slate-400"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Service</label>
            <select value={form.serviceId} onChange={e => setForm(f => ({ ...f, serviceId: e.target.value }))} className="input-field py-2 text-sm w-full" required>
              <option value="">Select service…</option>
              {services.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Hour (0–23)</label>
              <input type="number" min="0" max="23" value={form.hour} onChange={e => setForm(f => ({ ...f, hour: Number(e.target.value) }))} className="input-field py-2 text-sm w-full" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Multiplier (1–3×)</label>
              <input type="number" min="1" max="3" step="0.1" value={form.multiplier} onChange={e => setForm(f => ({ ...f, multiplier: Number(e.target.value) }))} className="input-field py-2 text-sm w-full" />
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-start gap-2">
            <Zap size={14} className="text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700">Sets surge pricing for the next 1 hour then reverts to automatic pricing.</p>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary py-2.5 text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2.5 text-sm font-semibold rounded-xl transition-colors disabled:opacity-60">
              {loading ? 'Setting…' : `Set ${form.multiplier}× Surge`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN FINANCIALS — FULL PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function AdminFinancials() {
  const [data, setData] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [fraud, setFraud] = useState(null);
  const [services, setServices] = useState([]);
  const [from, setFrom] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [to, setTo] = useState(dayjs().format('YYYY-MM-DD'));
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // overview | payouts | fraud | surge
  const [walletModal, setWalletModal] = useState(null);
  const [duesModal, setDuesModal] = useState(null);
  const [surgeModal, setSurgeModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [finRes, payRes, fraudRes, svcRes] = await Promise.all([
        apiService.getFinancials({ from, to }),
        apiService.getAdminPayouts({ limit: 50 }),
        apiService.getFraudAlerts(),
        apiService.getServices(),
      ]);
      setData(finRes.data.data);
      setPayouts(payRes.data.data);
      setFraud(fraudRes.data.data);
      setServices(svcRes.data.data || []);
    } catch { toast.error('Failed to load financials'); }
    setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, []);

  async function handleSettle(provider) {
    const max = provider.earnings?.walletBalance || 0;
    if (max <= 0) return toast.error('No wallet balance to settle');
    const amountStr = window.prompt(`Enter amount to settle for ${provider.name} (Max: ₹${max.toLocaleString('en-IN')}):`, String(max));
    if (!amountStr) return;
    const amount = Number(amountStr);
    if (isNaN(amount) || amount <= 0 || amount > max) return toast.error('Invalid amount');
    try {
      await apiService.settlePayout(provider._id, {
        amount,
        reference: `ADM-${Date.now()}`,
        note: 'Manual admin payout',
      });
      toast.success(`₹${amount.toLocaleString('en-IN')} settled for ${provider.name}`);
      load();
    } catch { toast.error('Failed to settle'); }
  }

  async function handleBulkSettle() {
    const eligible = payouts.filter(p => (p.earnings?.walletBalance || 0) > 0 && p.earnings?.bankAccount?.verified);
    if (eligible.length === 0) return toast.error('No verified payouts available to settle');
    const totalAmount = eligible.reduce((sum, p) => sum + (p.earnings?.walletBalance || 0), 0);

    if (!window.confirm(`⚡ Bulk Settle ${eligible.length} verified providers for a total of ₹${totalAmount.toLocaleString('en-IN')}?`)) return;

    setLoading(true);
    let count = 0;
    for (const provider of eligible) {
      try {
        await apiService.settlePayout(provider._id, {
          amount: provider.earnings.walletBalance,
          reference: `BULK-${Date.now()}`,
          note: 'Automated bulk admin payout settlement',
        });
        count++;
      } catch (e) {
        // continue
      }
    }
    toast.success(`🎉 Bulk Settlement Complete: ${count} / ${eligible.length} payouts processed!`);
    load();
  }

  function handleExportCSV() {
    if (!data) return toast.error('No data to export');
    const csvRows = [
      ['Metric', 'Value (INR)', 'Transactions'],
      ['Gross Revenue', data.revenue.amount, data.revenue.transactions],
      ['Commission Earned', data.commissions.amount, data.commissions.transactions],
      ['Refunds Issued', data.refunds.amount, data.refunds.transactions],
      ['Settlements Paid', data.settlements.amount, data.settlements.transactions],
      ['Net Revenue', data.netRevenue, 'N/A'],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ServiceHub_Financial_Audit_${from}_to_${to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('📊 Financial report exported successfully!');
  }

  const TABS = [
    { id: 'overview', label: 'Revenue Overview', icon: TrendingUp },
    { id: 'payouts', label: `Payouts (${payouts.length})`, icon: Wallet },
    { id: 'fraud', label: `Fraud Alerts (${fraud?.highRiskProviders?.length || 0})`, icon: ShieldAlert },
    { id: 'surge', label: 'Commission & Pricing Rules', icon: Zap },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <Header />
      <div className="py-6 page-container">

        {/* Page Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Financials & Commission Ledger</h1>
            <p className="text-slate-400 text-sm mt-0.5">Real-time revenue, automated payouts, fraud audit & commission policies</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input-field py-2 text-xs w-auto" />
            <span className="text-slate-400 text-xs">to</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input-field py-2 text-xs w-auto" />
            <button onClick={load} disabled={loading} className="btn-primary py-2 px-3 text-xs flex items-center gap-1.5">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Apply
            </button>
            <button onClick={handleExportCSV} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition">
              📊 Export CSV
            </button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            {[
              { label: 'Gross Revenue', value: data.revenue.amount, txn: data.revenue.transactions, icon: TrendingUp, cls: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Commission Earned', value: data.commissions.amount, txn: data.commissions.transactions, icon: DollarSign, cls: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Refunds Issued', value: data.refunds.amount, txn: data.refunds.transactions, icon: ArrowDownRight, cls: 'text-red-600', bg: 'bg-red-50' },
              { label: 'Settlements Paid', value: data.settlements.amount, txn: data.settlements.transactions, icon: CreditCard, cls: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'Net Revenue', value: data.netRevenue, txn: null, icon: ArrowUpRight, cls: 'text-indigo-600 text-2xl', bg: 'bg-indigo-50' },
            ].map(({ label, value, txn, icon: Icon, cls, bg }) => (
              <div key={label} className={`card p-4 border-0 ${bg}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase">{label}</p>
                  <Icon size={16} className={cls.split(' ')[0]} />
                </div>
                <p className={`text-xl font-bold ${cls.split(' ')[0]}`}>₹{(value || 0).toLocaleString('en-IN')}</p>
                {txn !== null && <p className="text-xs text-slate-400 mt-0.5">{txn} transactions</p>}
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Icon size={14} />{label}
            </button>
          ))}
        </div>

        {/* ── Overview Tab ── */}
        {activeTab === 'overview' && data && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="card p-5 lg:col-span-2">
              <h3 className="font-semibold text-slate-800 mb-4">Revenue by Day</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data?.dailyRevenue || []} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="_id" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => [`₹${v.toLocaleString('en-IN')}`, 'Revenue']} />
                  <Area type="monotone" dataKey="revenue" stroke="#2563EB" fill="#DBEAFE" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-4">
              <div className="card p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Financial Summary</p>
                {[
                  { label: 'Gross Revenue', amount: data.revenue.amount, positive: true },
                  { label: 'Commission', amount: data.commissions.amount, positive: true },
                  { label: 'Refunds', amount: data.refunds.amount, positive: false },
                  { label: 'Settlements', amount: data.settlements.amount, positive: false },
                ].map(({ label, amount, positive }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <span className="text-sm text-slate-600">{label}</span>
                    <span className={`text-sm font-semibold ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
                      {positive ? '+' : '−'}₹{(amount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-3 mt-1 border-t-2 border-slate-200">
                  <span className="text-sm font-bold text-slate-800">Net Revenue</span>
                  <span className="text-base font-bold text-indigo-600">₹{(data.netRevenue || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Payouts Tab ── */}
        {activeTab === 'payouts' && (
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-800">Pending Provider Payouts</h2>
                <p className="text-xs text-slate-400 mt-0.5">Providers with wallet balance owed</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="bg-red-100 text-red-700 text-xs px-2.5 py-1 rounded-full font-semibold">
                  {payouts.length} Pending
                </span>
                <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-full font-semibold">
                  Total: ₹{payouts.reduce((s, p) => s + (p.earnings?.walletBalance || 0), 0).toLocaleString('en-IN')}
                </span>
                <button
                  onClick={handleBulkSettle}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs px-3.5 py-1.5 rounded-xl shadow-md shadow-emerald-200 transition-all active:scale-95 flex items-center gap-1.5"
                >
                  ⚡ Bulk Settle All Verified
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['Provider', 'Bank Details', 'Wallet Balance', 'Commission Hold', 'Actions'].map(h => (
                      <th key={h} className={thCls}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {payouts.length === 0 ? (
                    <tr><td colSpan="5" className="p-10 text-center text-slate-400">No pending payouts 🎉</td></tr>
                  ) : payouts.map(p => (
                    <tr key={p._id} className="hover:bg-slate-50 transition-colors">
                      <td className={tdCls}>
                        <div>
                          <p className="font-semibold text-slate-800">{p.name}</p>
                          <p className="text-xs text-slate-400 font-mono">{p.phone}</p>
                        </div>
                      </td>
                      <td className={tdCls}>
                        {p.earnings?.bankAccount?.accountNumber ? (
                          <div className="text-xs">
                            <p className="font-mono text-slate-700">{p.earnings.bankAccount.accountNumber}</p>
                            <p className="text-slate-400">{p.earnings.bankAccount.bankName} · {p.earnings.bankAccount.ifscCode}</p>
                            {p.earnings.bankAccount.verified ? (
                              <span className="inline-flex items-center gap-1 mt-1 text-green-600 text-[10px] font-semibold"><CheckCircle size={10} /> Verified</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 mt-1 text-amber-600 text-[10px] font-semibold"><Clock size={10} /> Unverified</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">No Bank Added</span>
                        )}
                      </td>
                      <td className={tdCls}>
                        <span className="text-base font-bold text-emerald-600">₹{(p.earnings?.walletBalance || 0).toLocaleString('en-IN')}</span>
                      </td>
                      <td className={tdCls}>
                        {p.earnings?.isOnHold ? (
                          <span className="inline-flex items-center gap-1 text-red-600 text-xs font-semibold bg-red-50 px-2 py-1 rounded-lg">
                            <Ban size={11} /> On Hold
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className={tdCls}>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setDuesModal(p)} className="text-xs font-medium text-blue-600 hover:underline flex items-center gap-1">
                            <AlertTriangle size={11} /> View Dues
                          </button>
                          <button onClick={() => setWalletModal(p)} className="text-xs font-medium text-purple-600 hover:underline flex items-center gap-1">
                            <Wallet size={11} /> Adjust
                          </button>
                          <button onClick={() => handleSettle(p)} className="btn-primary py-1.5 px-3 text-xs">
                            Settle
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Fraud Tab ── */}
        {activeTab === 'fraud' && (
          <div className="space-y-5">
            {/* High Risk Providers */}
            <div className="card overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                <ShieldAlert size={18} className="text-red-500" />
                <h2 className="font-bold text-slate-800">High Risk Providers (Score ≥ 70)</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      {['Provider', 'Risk Score', 'Warnings', 'Completed Jobs', 'Actions'].map(h => (
                        <th key={h} className={thCls}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {!fraud?.highRiskProviders?.length ? (
                      <tr><td colSpan="5" className="p-8 text-center text-slate-400">No high-risk providers 🎉</td></tr>
                    ) : fraud.highRiskProviders.map(p => (
                      <tr key={p._id} className="hover:bg-slate-50">
                        <td className={tdCls}>
                          <p className="font-medium text-slate-800">{p.name}</p>
                          <p className="text-xs text-slate-400 font-mono">{p.phone}</p>
                        </td>
                        <td className={tdCls}>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className={`h-2 rounded-full ${p.riskScore >= 80 ? 'bg-red-500' : 'bg-amber-500'}`}
                                style={{ width: `${p.riskScore}%` }}
                              />
                            </div>
                            <span className={`text-xs font-bold ${p.riskScore >= 80 ? 'text-red-600' : 'text-amber-600'}`}>
                              {p.riskScore}
                            </span>
                          </div>
                        </td>
                        <td className={tdCls}>
                          <span className={`text-sm font-bold ${p.warningCount >= 3 ? 'text-red-600' : p.warningCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                            {p.warningCount}/3
                          </span>
                        </td>
                        <td className={tdCls}>{p.completedJobs || 0}</td>
                        <td className={tdCls}>
                          <button onClick={() => setWalletModal(p)} className="text-xs text-purple-600 hover:underline font-medium">Adjust Wallet</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Overcharging Complaints */}
            <div className="card overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                <AlertTriangle size={18} className="text-amber-500" />
                <h2 className="font-bold text-slate-800">Open Overcharging Complaints</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      {['Raised By', 'Booking #', 'Base Price', 'Total Charged', 'Delta'].map(h => (
                        <th key={h} className={thCls}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {!fraud?.suspiciousOvercharging?.length ? (
                      <tr><td colSpan="5" className="p-8 text-center text-slate-400">No overcharging complaints 🎉</td></tr>
                    ) : fraud.suspiciousOvercharging.map(c => (
                      <tr key={c._id} className="hover:bg-slate-50">
                        <td className={tdCls}>{c.raisedBy?.name}</td>
                        <td className={tdCls + ' font-mono text-xs'}>{c.bookingId?.bookingNumber}</td>
                        <td className={tdCls}>₹{c.bookingId?.basePrice?.toLocaleString('en-IN')}</td>
                        <td className={tdCls + ' font-semibold'}>₹{c.bookingId?.totalAmount?.toLocaleString('en-IN')}</td>
                        <td className={tdCls}>
                          <span className="text-red-600 font-bold text-sm">
                            +₹{((c.bookingId?.totalAmount || 0) - (c.bookingId?.basePrice || 0)).toLocaleString('en-IN')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Surge Pricing Tab ── */}
        {activeTab === 'surge' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                  <Zap size={20} className="text-amber-500" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Surge Pricing Override</h3>
                  <p className="text-xs text-slate-500">Manually override dynamic pricing</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-5 leading-relaxed">
                By default, surge pricing is calculated automatically based on time of day and active bookings in an area.
                Use this control to force a specific multiplier for a service during a particular hour.
              </p>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-5">
                <p className="text-xs text-amber-700 font-medium">⚡ Surge multiplier ranges from 1.0× (no surge) to 3.0× (maximum). Overrides last 1 hour.</p>
              </div>
              <button onClick={() => setSurgeModal(true)} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
                <Zap size={16} /> Set Manual Surge Override
              </button>
            </div>

            <div className="card p-6">
              <h3 className="font-bold text-slate-900 mb-4">Auto Surge Rules</h3>
              <div className="space-y-3">
                {[
                  { time: '7:00 – 9:00 AM', label: 'Morning Rush', multiplier: '1.2×', color: 'text-amber-600 bg-amber-50' },
                  { time: '6:00 – 9:00 PM', label: 'Evening Rush', multiplier: '1.3×', color: 'text-orange-600 bg-orange-50' },
                  { time: '10:00 PM – 6:00 AM', label: 'Night Hours', multiplier: '1.5×', color: 'text-red-600 bg-red-50' },
                  { time: 'High demand in area', label: '>50 bookings', multiplier: '1.4×', color: 'text-purple-600 bg-purple-50' },
                ].map(({ time, label, multiplier, color }) => (
                  <div key={label} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{label}</p>
                      <p className="text-xs text-slate-400">{time}</p>
                    </div>
                    <span className={`text-sm font-bold px-3 py-1 rounded-lg ${color}`}>{multiplier}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {walletModal && (
        <WalletAdjustModal
          provider={walletModal}
          onClose={() => setWalletModal(null)}
          onDone={() => { setWalletModal(null); load(); }}
        />
      )}
      {duesModal && (
        <DuesPanel
          provider={duesModal}
          onClose={() => setDuesModal(null)}
          onDone={() => { setDuesModal(null); load(); }}
        />
      )}
      {surgeModal && (
        <SurgeModal services={services} onClose={() => setSurgeModal(false)} />
      )}
    </div>
  );
}
