// ProviderEarnings.jsx
import React, { useEffect, useState } from 'react';
import { apiService } from '@/services/api';
import Header from '@/components/common/Header';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Wallet, TrendingUp, ArrowDownCircle, Loader, AlertTriangle, CheckCircle, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

import { loadRazorpayScript } from '@/utils/razorpay';

export default function ProviderEarnings() {
  const [earnings, setEarnings] = useState(null);
  const [period, setPeriod] = useState('30d');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  const [payingCommission, setPayingCommission] = useState(false);

  useEffect(() => {
    apiService.getEarnings(period).then(r => setEarnings(r.data.data));
  }, [period]);

  // Pre-load Razorpay script
  useEffect(() => {
    loadRazorpayScript();
  }, []);

  const [customTopUp, setCustomTopUp] = useState('');

  async function handlePayCommission(customAmt) {
    const walletBal = earnings?.summary?.walletBalance || 0;
    const pendingDues = earnings?.summary?.pendingCommission || Math.abs(walletBal < 0 ? walletBal : 0);
    const payAmt = Number(customAmt) || Number(customTopUp) || pendingDues || 100;

    if (!payAmt || payAmt <= 0) {
      return toast.error('Please enter a valid amount to add');
    }
    setPayingCommission(true);
    try {
      const isLoaded = await loadRazorpayScript();
      const { data } = await apiService.createCommissionOrder({ amount: payAmt });
      const orderData = data.data;

      if (orderData.isDemo || !window.Razorpay || !isLoaded || orderData.keyId?.includes('xxxxxxxxxxxxx') || orderData.keyId?.includes('demo')) {
        // Instant simulated wallet top-up in development mode
        const verifyRes = await apiService.verifyCommissionPayment({
          razorpayOrderId: orderData.orderId,
          razorpayPaymentId: `pay_demo_${Date.now()}`,
          razorpaySignature: 'demo_signature',
          amount: payAmt,
        });
        toast.success(verifyRes.data.message || 'Wallet top-up successful! 🎉');
        setCustomTopUp('');
        apiService.getEarnings(period).then(r => setEarnings(r.data.data));
        setPayingCommission(false);
        return;
      }

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'OneWayFix Platform',
        description: `Add Money to Wallet / Clear Dues (₹${payAmt})`,
        order_id: orderData.orderId,
        prefill: orderData.prefill,
        theme: { color: '#2563EB' },
        modal: { ondismiss: () => setPayingCommission(false) },
        handler: async (response) => {
          try {
            const verifyRes = await apiService.verifyCommissionPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              amount: payAmt,
            });
            toast.success(verifyRes.data.message || 'Wallet updated successfully! 🎉');
            setCustomTopUp('');
            apiService.getEarnings(period).then(r => setEarnings(r.data.data));
          } catch (err) {
            toast.error(err.response?.data?.error || 'Payment verification failed.');
          } finally {
            setPayingCommission(false);
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (resp) => {
        toast.error(`Payment failed: ${resp.error?.description || 'Transaction cancelled'}`);
        setPayingCommission(false);
      });
      rzp.open();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to initiate payment');
      setPayingCommission(false);
    }
  }

  async function handleWithdraw() {
    const amount = Number(withdrawAmount);
    if (!amount || amount < 100) return toast.error('Minimum withdrawal is ₹100');
    setWithdrawing(true);
    try {
      await apiService.withdraw(amount);
      toast.success(`₹${amount} withdrawal initiated!`);
      setWithdrawAmount('');
      apiService.getEarnings(period).then(r => setEarnings(r.data.data));
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    setWithdrawing(false);
  }

  const rawWalletBal = earnings?.summary?.walletBalance || 0;
  const isNegative = rawWalletBal < 0;
  const pendingDues = earnings?.summary?.pendingCommission || (isNegative ? Math.abs(rawWalletBal) : 0);
  const isSuspended = rawWalletBal <= -500 || pendingDues >= 500 || earnings?.summary?.isOnHold;
  const progressPct = Math.min(100, Math.round((pendingDues / 500) * 100));

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <h1 className="text-2xl font-bold text-slate-900">Earnings & Wallet</h1>

        {/* 💳 PROVIDER WALLET CARD (Negative Balance in Red + Add Money Option) */}
        <div className={`rounded-2xl border-2 p-5 shadow-sm transition-all ${
          isNegative
            ? isSuspended
              ? 'bg-gradient-to-br from-red-50 via-rose-50 to-orange-50 border-red-400'
              : 'bg-gradient-to-br from-amber-50 via-rose-50 to-orange-50 border-amber-300'
            : 'bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 border-emerald-300'
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0 shadow-sm ${
                isNegative ? (isSuspended ? 'bg-red-600 text-white' : 'bg-amber-500 text-white') : 'bg-emerald-600 text-white'
              }`}>
                {isNegative ? (isSuspended ? '🚫' : '⚠️') : '💼'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-slate-900 text-base">
                    {isNegative ? 'Unpaid Commission (Minus Balance)' : 'Provider Wallet'}
                  </h3>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    isNegative 
                      ? (isSuspended ? 'bg-red-600 text-white animate-pulse' : 'bg-amber-200 text-amber-900')
                      : 'bg-emerald-200 text-emerald-900'
                  }`}>
                    {isNegative ? (isSuspended ? '🔴 JOBS SUSPENDED' : '🔴 MINUS BALANCE') : '✓ ACTIVE'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  {isNegative 
                    ? 'When customers pay cash, platform commission is debited from your wallet. Add money to clear minus balance.' 
                    : 'Your wallet balance is healthy. You can accept live jobs and receive payments.'}
                </p>
              </div>
            </div>
          </div>

          {/* Balance Display */}
          <div className="mt-4 bg-white/90 backdrop-blur-sm p-4 rounded-xl border border-slate-200/80 space-y-3">
            <div className="flex justify-between items-end">
              <div>
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                  {isNegative ? 'Current Wallet Balance (Minus)' : 'Wallet Balance'}
                </span>
                <p className={`text-3xl font-black ${isNegative ? 'text-red-600' : 'text-emerald-600'}`}>
                  {isNegative ? `-₹${Math.abs(rawWalletBal).toLocaleString('en-IN')}` : `+₹${rawWalletBal.toLocaleString('en-IN')}`}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 font-medium">Suspension Limit</span>
                <p className="text-sm font-bold text-slate-700">-₹500 Max</p>
              </div>
            </div>

            {/* Threshold Progress Bar if Negative */}
            {isNegative && (
              <div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${isSuspended ? 'bg-red-600' : 'bg-amber-500'}`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                  <span>₹0</span>
                  <span className={isSuspended ? 'text-red-600 font-bold' : ''}>{progressPct}% minus used</span>
                  <span>-₹500 Limit</span>
                </div>
              </div>
            )}

            {isSuspended && (
              <div className="bg-red-100/80 border border-red-200 rounded-lg p-2.5 text-xs text-red-800 font-medium flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-600 shrink-0" />
                <span>Job dispatch suspended. Clear minus balance to -₹499 or above to resume jobs immediately.</span>
              </div>
            )}
          </div>

          {/* Add Money Quick Amounts & Trigger */}
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">➕ Add Money to Wallet</span>
              <span className="text-[10px] text-slate-500">PhonePe / GPay / UPI / Cards</span>
            </div>

            {/* Quick chips */}
            <div className="flex gap-2 flex-wrap">
              {[pendingDues > 0 ? pendingDues : null, 100, 200, 500, 1000].filter(Boolean).map(amt => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handlePayCommission(amt)}
                  disabled={payingCommission}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-300 hover:border-blue-600 hover:text-blue-600 text-slate-700 shadow-sm transition-all flex items-center gap-1"
                >
                  +₹{amt} {amt === pendingDues ? '(Clear Dues)' : ''}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Custom amount (e.g. ₹300)"
                value={customTopUp}
                onChange={e => setCustomTopUp(e.target.value)}
                className="flex-1 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
              <button
                onClick={() => handlePayCommission()}
                disabled={payingCommission}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md flex items-center justify-center gap-1.5 transition-all shrink-0 ${
                  isSuspended
                    ? 'bg-red-600 hover:bg-red-700 shadow-red-200'
                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                } disabled:opacity-50`}
              >
                {payingCommission ? <Loader size={14} className="animate-spin" /> : '💳 Add Money Now'}
              </button>
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Wallet Balance', value: `₹${earnings?.summary?.walletBalance?.toLocaleString('en-IN') || 0}`, icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Total Earned', value: `₹${earnings?.summary?.totalEarnings?.toLocaleString('en-IN') || 0}`, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className={`card p-5 ${bg} border-0`}>
              <Icon className={`${color} mb-3`} size={22} />
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-slate-500 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Security deposit card */}
        {earnings?.summary !== undefined && (
          <div className="card p-5 bg-violet-50 border-0">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-500 mb-1">Security Deposit (Locked)</p>
                <p className="text-2xl font-bold text-violet-700">₹{earnings.summary.securityDeposit?.toLocaleString('en-IN') || 0}</p>
                <p className="text-xs text-violet-500 mt-1">Used to cover cash job commissions</p>
              </div>
              <Shield size={22} className="text-violet-400" />
            </div>
            {(earnings.summary.cashCommissionBalance || 0) > 0 && (
              <div className="mt-3 text-xs text-slate-500">
                Cash cover: <span className="font-semibold text-slate-700">₹{earnings.summary.cashCommissionBalance?.toLocaleString('en-IN')}</span> available
              </div>
            )}
          </div>
        )}

        {/* Withdraw */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <ArrowDownCircle size={18} className="text-primary-600" /> Withdraw Earnings
          </h3>
          <div className="flex gap-3">
            <input
              type="number"
              value={withdrawAmount}
              onChange={e => setWithdrawAmount(e.target.value)}
              placeholder="Enter amount (min. ₹100)"
              className="input-field flex-1"
              min={100}
            />
            <button onClick={handleWithdraw} disabled={withdrawing} className="btn-primary px-5 flex items-center gap-1">
              {withdrawing ? <Loader size={15} className="animate-spin" /> : 'Withdraw'}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2">Transfers in 2–3 business days to your linked bank account</p>
        </div>

        {/* Period selector + chart */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Earnings Chart</h3>
            <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
              {['7d', '30d', '90d'].map(p => (
                <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${period === p ? 'bg-white shadow text-primary-700' : 'text-slate-500'}`}>{p}</button>
              ))}
            </div>
          </div>
          {earnings?.weeklyEarnings?.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={earnings.weeklyEarnings}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="_id" tickFormatter={d => dayjs(d).format('DD')} tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${v}`} />
                <Tooltip formatter={(v) => [`₹${v}`, 'Earnings']} />
                <Area type="monotone" dataKey="amount" stroke="#2563EB" fill="#DBEAFE" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-slate-400 text-sm">No earnings data for this period</div>
          )}
        </div>

        {/* Job breakdown */}
        {earnings?.jobBreakdown?.length > 0 && (
          <div className="card p-5">
            <h3 className="font-semibold text-slate-800 mb-4">Earnings by Service</h3>
            <div className="space-y-3">
              {earnings.jobBreakdown.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700">{item.service?.name || 'Unknown'}</p>
                    <p className="text-xs text-slate-400">{item.count} jobs</p>
                  </div>
                  <span className="font-bold text-emerald-600">₹{item.earnings?.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
