import React, { useState, useEffect } from 'react';
import { apiService } from '@/services/api';
import { getSocket } from '@/services/socket';
import { AlertTriangle, ShieldAlert, CreditCard, Lock, CheckCircle2, Zap, ArrowRight, Loader, Info, PhoneCall } from 'lucide-react';
import toast from 'react-hot-toast';

import { loadRazorpayScript } from '@/utils/razorpay';

export default function ProviderDebtLockout({ profile, onUnlocked }) {
  const [paying, setPaying] = useState(false);
  const [customAmount, setCustomAmount] = useState('');

  // Extract debt amounts safely
  const walletBalance = Number(profile?.earnings?.walletBalance || 0);
  const pendingCommission = Number(profile?.earnings?.pendingCommission || 0);
  
  // Calculate exact debt due to unlock account
  const calculatedDue = Math.max(
    pendingCommission,
    walletBalance < 0 ? Math.abs(walletBalance) : 0,
    500
  );

  const [payAmount, setPayAmount] = useState(calculatedDue);

  // Pre-load Razorpay JS script
  useEffect(() => {
    loadRazorpayScript();
  }, []);

  // Listen for real-time socket unlock events from backend
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleUnlock = (data) => {
      if (data && data.isOnHold === false) {
        toast.success('🎉 Account automatically unlocked! Full access restored.', { duration: 5000 });
        if (onUnlocked) onUnlocked();
      }
    };

    socket.on('provider:unlocked', handleUnlock);
    socket.on('notification:push', (notif) => {
      if (notif && notif.isOnHold === false) {
        if (onUnlocked) onUnlocked();
      }
    });

    return () => {
      socket.off('provider:unlocked', handleUnlock);
    };
  }, [onUnlocked]);

  async function handlePayNow(amountToPayOverride) {
    const finalAmount = Number(amountToPayOverride) || Number(customAmount) || Number(payAmount) || calculatedDue;

    if (!finalAmount || finalAmount <= 0) {
      return toast.error('Please enter a valid payment amount');
    }

    setPaying(true);
    try {
      const isLoaded = await loadRazorpayScript();

      // 1. Create order on backend
      const { data } = await apiService.createCommissionOrder({ amount: finalAmount });
      const orderData = data.data;

      // Check if dev/demo mode or Razorpay SDK unavailable
      if (
        orderData.isDemo ||
        !window.Razorpay ||
        !isLoaded ||
        orderData.keyId?.includes('xxxxxxxxxxxxx') ||
        orderData.keyId?.includes('demo')
      ) {
        // Instant simulated repayment verification
        const verifyRes = await apiService.verifyCommissionPayment({
          razorpayOrderId: orderData.orderId,
          razorpayPaymentId: `pay_demo_${Date.now()}`,
          razorpaySignature: 'demo_signature',
          amount: finalAmount,
        });

        toast.success(verifyRes.data.message || 'Payment confirmed! Account unlocked 🎉', { duration: 5000 });
        setPaying(false);
        if (onUnlocked) onUnlocked();
        return;
      }

      // 2. Open Razorpay Checkout Modal
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'OneWayFix Platform',
        description: `Clear Commission Dues & Auto-Unlock (₹${finalAmount})`,
        order_id: orderData.orderId,
        prefill: orderData.prefill || {},
        theme: { color: '#DC2626' },
        modal: {
          ondismiss: () => setPaying(false),
        },
        handler: async (response) => {
          try {
            const verifyRes = await apiService.verifyCommissionPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              amount: finalAmount,
            });

            toast.success(verifyRes.data.message || 'Payment verified! Panel unlocked 🎉', { duration: 5000 });
            if (onUnlocked) onUnlocked();
          } catch (err) {
            toast.error(err.response?.data?.error || 'Payment verification failed.');
          } finally {
            setPaying(false);
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (resp) => {
        toast.error(`Payment failed: ${resp.error?.description || 'Transaction cancelled'}`);
        setPaying(false);
      });
      rzp.open();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to initialize payment');
      setPaying(false);
    }
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6 bg-slate-900 text-white rounded-3xl my-4 border-2 border-red-500/40 shadow-2xl overflow-hidden relative">
      {/* Background glow effects */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-amber-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-xl w-full space-y-6 relative z-10 text-center sm:text-left">
        {/* Top Warning Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 font-mono text-xs font-bold uppercase tracking-wider mx-auto sm:mx-0">
          <ShieldAlert size={16} className="text-red-500 animate-pulse" />
          <span>Maximum Outstanding Limit Reached</span>
        </div>

        {/* Lock Title */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight flex items-center justify-center sm:justify-start gap-3">
            <Lock className="text-red-500 shrink-0" size={32} />
            <span>Account Suspended</span>
          </h1>
          <p className="text-sm text-slate-300 mt-2 leading-relaxed">
            Your unpaid platform commission has reached the maximum allowed limit of <strong className="text-red-400">₹500</strong>. 
            All provider features (Jobs, Bookings, Earnings & Profile) are hidden until your dues are cleared.
          </p>
        </div>

        {/* Amount Due Card */}
        <div className="bg-slate-800/90 border border-slate-700/90 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-slate-700 pb-4">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Outstanding Due</p>
              <p className="text-3xl sm:text-4xl font-black text-red-500 mt-1">
                ₹{calculatedDue.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-red-950 text-red-400 border border-red-800">
                🔴 Auto-Locked
              </span>
              <p className="text-xs text-slate-400 mt-1">Instant Auto-Unlock</p>
            </div>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800">
            <div>
              <span className="text-slate-400 block">Pending Commission</span>
              <span className="font-bold text-slate-200">₹{pendingCommission.toLocaleString('en-IN')}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Wallet Balance</span>
              <span className={`font-bold ${walletBalance < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {walletBalance < 0 ? `-₹${Math.abs(walletBalance).toLocaleString('en-IN')}` : `+₹${walletBalance}`}
              </span>
            </div>
          </div>

          {/* Preset Quick Chips */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Select Amount to Pay & Unlock:
            </span>
            <div className="flex flex-wrap gap-2">
              {[calculatedDue, 500, 1000, 2000].map((amt) => {
                const isSel = payAmount === amt && !customAmount;
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setPayAmount(amt);
                      setCustomAmount('');
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                      isSel
                        ? 'bg-red-600 text-white border-red-500 shadow-lg shadow-red-900/50'
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    Pay ₹{amt} {amt === calculatedDue ? '(Full Due)' : ''}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Amount Input */}
          <div className="flex gap-2">
            <input
              type="number"
              placeholder={`Enter custom amount (min ₹${calculatedDue})`}
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value);
                setPayAmount(Number(e.target.value) || calculatedDue);
              }}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
            />
          </div>

          {/* Action Payment Button */}
          <button
            onClick={() => handlePayNow()}
            disabled={paying}
            className="w-full py-4 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-500 text-white font-black text-base rounded-2xl shadow-xl shadow-red-900/50 border border-red-400/30 flex items-center justify-center gap-3 transition-all cursor-pointer disabled:opacity-50"
          >
            {paying ? (
              <span className="flex items-center gap-2 animate-pulse">
                <Loader size={20} className="animate-spin" />
                VERIFYING PAYMENT...
              </span>
            ) : (
              <>
                <CreditCard size={20} />
                <span>PAY ₹{(Number(customAmount) || payAmount).toLocaleString('en-IN')} & UNLOCK NOW</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>

        {/* Security & Instant Unlock Assurance */}
        <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-4 flex items-center gap-3 text-xs text-slate-400">
          <Zap size={20} className="text-amber-400 shrink-0" />
          <div>
            <span className="font-bold text-slate-200 block">Instant Automated Account Unlocking</span>
            <span>Once payment is completed, your account unlocks instantly without any manual admin approval needed. Supported: UPI, GPay, PhonePe, Cards.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
