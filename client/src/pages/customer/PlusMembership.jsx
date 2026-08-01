import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Sparkles, CheckCircle2, Shield, Zap, Clock, Bell, Crown, Star, Check, Calendar } from 'lucide-react';
import Header from '@/components/common/Header';
import { selectUser, activatePlusMembership } from '@/store/slices/authSlice';
import { apiService } from '@/services/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

export default function PlusMembership() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const [notified, setNotified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    subscriptionModelActive: true,
    plusPrice6Months: 299,
    plusPrice1Year: 499,
  });

  const [selectedPlan, setSelectedPlan] = useState('6months');
  const [subscribing, setSubscribing] = useState(false);

  const isPlusMember = Boolean(user?.isPlusMember || user?.subscription?.isPlusMember || user?.subscription?.plan?.startsWith('plus_'));

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      setLoading(true);
      const res = await apiService.getAdminSettings();
      if (res.data?.data) {
        setSettings({
          subscriptionModelActive: res.data.data.subscriptionModelActive !== false,
          plusPrice6Months: res.data.data.plusPrice6Months || 299,
          plusPrice1Year: res.data.data.plusPrice1Year || 499,
        });
      }
    } catch (err) {
      console.error('Failed to load subscription settings', err);
    } finally {
      setLoading(false);
    }
  }

  const handleNotifyMe = () => {
    setNotified(true);
    toast.success('🎉 You are on the VIP waitlist! We will notify you as soon as Paid Subscriptions launch.');
  };

  const handleSubscribe = async () => {
    try {
      setSubscribing(true);
      const planMonths = selectedPlan === '1year' ? 12 : 6;
      const resultAction = await dispatch(activatePlusMembership({ planMonths, paymentMethod: 'online' }));
      
      if (activatePlusMembership.fulfilled.match(resultAction)) {
        toast.success(`🎉 Welcome to ServiceHub Plus! Subscription successfully activated.`);
      } else {
        toast.error(resultAction.payload || 'Subscription payment failed.');
      }
    } catch (err) {
      toast.error('Subscription purchase failed. Please try again.');
    } finally {
      setSubscribing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 pt-20 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header />
      <div className="py-6 max-w-lg mx-auto px-4 space-y-6">
        
        {/* 🛑 CASE 1: SUBSCRIPTION MODEL TURNED OFF BY ADMIN */}
        {!settings.subscriptionModelActive ? (
          <>
            {/* UPCOMING FEATURE BANNER */}
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-center justify-between text-xs font-semibold text-amber-900 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-sm shrink-0">
                  🚀
                </span>
                <div>
                  <p className="font-extrabold text-slate-900 text-sm">Subscriptions are an Upcoming Feature!</p>
                  <p className="text-slate-600 mt-0.5">Currently, all ServiceHub users are enrolled in our <strong>Free Lifetime Tier</strong>.</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-24 translate-x-32" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-500/10 rounded-full translate-y-16 -translate-x-12" />

              <div className="relative z-10 text-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 font-extrabold text-xs uppercase tracking-wider mb-4">
                  <Clock size={12} /> UPCOMING FEATURE
                </div>
                
                <h1 className="text-3xl font-extrabold mb-1">ServiceHub <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-500">Plus</span></h1>
                <p className="text-slate-300 text-sm mb-6">Premium membership subscription with zero surge pricing and priority dispatch is launching soon!</p>

                <div className="bg-white/10 rounded-2xl p-4 border border-white/20 backdrop-blur-sm mb-5 text-left">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-slate-300 font-bold">Your Current Plan</span>
                      <h4 className="text-lg font-black text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 size={18} /> Free Active Plan
                      </h4>
                    </div>
                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs px-2.5 py-1 rounded-full font-extrabold">
                      ₹0 / Lifetime
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-2">
                    Enjoy standard service booking, 30-Day Free Revisit Guarantee, and real-time technician tracking on your current free plan.
                  </p>
                </div>

                <button 
                  onClick={handleNotifyMe} 
                  disabled={notified}
                  className="w-full bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-slate-900 font-bold py-3.5 rounded-2xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 text-sm disabled:opacity-75"
                >
                  <Bell size={16} />
                  {notified ? '✓ On VIP Launch Waitlist' : 'Notify Me When Paid Subscriptions Launch'}
                </button>
              </div>
            </div>
          </>
        ) : isPlusMember ? (

          /* 👑 CASE 2: USER IS ALREADY A PLUS MEMBER */
          <div className="bg-gradient-to-br from-purple-950 via-slate-900 to-indigo-950 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden border border-amber-400/30">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full -translate-y-24 translate-x-32" />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 font-extrabold text-xs uppercase tracking-wider">
                  <Crown size={14} /> ACTIVE PLUS MEMBER
                </div>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 rounded-full flex items-center gap-1">
                  <CheckCircle2 size={13} /> Active VIP Tier
                </span>
              </div>

              <h1 className="text-2xl font-black mb-1">Welcome, <span className="text-amber-400">{user?.name || 'VIP Member'}</span></h1>
              <p className="text-slate-300 text-xs mb-6">You are enjoying flat 10% discounts on all service bookings & zero surge charges!</p>

              <div className="bg-white/10 rounded-2xl p-4 border border-white/20 backdrop-blur-sm space-y-3 mb-6">
                <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2">
                  <span className="text-slate-300 font-medium">Subscription Plan</span>
                  <span className="font-bold text-amber-300 uppercase">
                    {user?.subscription?.plan === 'plus_12m' ? '1-Year VIP Pass' : '6-Month Plus Plan'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium flex items-center gap-1">
                    <Calendar size={13} /> Expiry Date
                  </span>
                  <span className="font-bold text-white">
                    {user?.subscription?.expiresAt ? dayjs(user.subscription.expiresAt).format('D MMM YYYY') : 'Active (Extended)'}
                  </span>
                </div>
              </div>

              <div className="bg-amber-500/20 border border-amber-400/30 rounded-xl p-3 text-xs text-amber-200 flex items-center gap-2">
                <Sparkles size={16} className="text-amber-400 shrink-0" />
                <span>Your Plus perks are active across all categories on ServiceHub.</span>
              </div>
            </div>
          </div>
        ) : (

          /* ⚡ CASE 3: SUBSCRIPTION MODEL IS ACTIVE (ON) - USER IS NOT A PLUS MEMBER YET */
          <>
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full -translate-y-24 translate-x-32" />

              <div className="relative z-10 text-center">
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 font-extrabold text-xs uppercase tracking-wider mb-3">
                  <Crown size={14} /> VIP MEMBER CLUB
                </div>
                
                <h1 className="text-3xl font-extrabold mb-1">ServiceHub <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-500">Plus</span></h1>
                <p className="text-slate-300 text-sm mb-6">Unlock guaranteed 10–15% off every booking, zero surge pricing, and VIP priority dispatch!</p>

                {/* Plan Selection Cards */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {/* 6-Months Plan */}
                  <div
                    onClick={() => setSelectedPlan('6months')}
                    className={`cursor-pointer rounded-2xl p-4 border text-left transition-all relative ${
                      selectedPlan === '6months'
                        ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/50'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {selectedPlan === '6months' && (
                      <span className="absolute -top-2.5 right-3 bg-amber-400 text-slate-950 font-black text-[10px] uppercase px-2 py-0.5 rounded-full">
                        Selected
                      </span>
                    )}
                    <div className="text-xs text-slate-300 font-semibold">6 Months Plan</div>
                    <div className="text-2xl font-black text-white mt-1">₹{settings.plusPrice6Months}</div>
                    <div className="text-[10px] text-amber-300 mt-1 font-bold">~ ₹49 / Month</div>
                  </div>

                  {/* 1-Year VIP Plan */}
                  <div
                    onClick={() => setSelectedPlan('1year')}
                    className={`cursor-pointer rounded-2xl p-4 border text-left transition-all relative ${
                      selectedPlan === '1year'
                        ? 'bg-gradient-to-br from-amber-500/30 to-purple-500/30 border-amber-400 ring-2 ring-amber-400/50'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <span className="absolute -top-2.5 right-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-950 font-black text-[10px] uppercase px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md">
                      <Star size={10} fill="currentColor" /> Best Value
                    </span>
                    <div className="text-xs text-slate-300 font-semibold">1 Year VIP Pass</div>
                    <div className="text-2xl font-black text-amber-400 mt-1">₹{settings.plusPrice1Year}</div>
                    <div className="text-[10px] text-amber-300 mt-1 font-bold">Save 50% Extra</div>
                  </div>
                </div>

                {/* Benefits checklist */}
                <div className="bg-white/10 rounded-2xl p-4 border border-white/15 backdrop-blur-sm mb-6 text-left space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-200">
                    <Check size={14} className="text-amber-400 shrink-0" />
                    <span><strong>Flat 10% Extra Discount</strong> auto-applied at checkout</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-200">
                    <Check size={14} className="text-amber-400 shrink-0" />
                    <span><strong>Zero Surge Charges</strong> during peak hours</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-200">
                    <Check size={14} className="text-amber-400 shrink-0" />
                    <span><strong>Extended 60-Day Guarantee</strong> on all repairs</span>
                  </div>
                </div>

                <button
                  onClick={handleSubscribe}
                  disabled={subscribing}
                  className="w-full bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-slate-950 font-black py-4 rounded-2xl shadow-xl shadow-amber-500/20 transition-transform active:scale-95 flex items-center justify-center gap-2 text-base disabled:opacity-50"
                >
                  <Crown size={18} />
                  {subscribing ? 'Activating Plus Membership...' : `Upgrade to Plus (${selectedPlan === '1year' ? '₹' + settings.plusPrice1Year : '₹' + settings.plusPrice6Months})`}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Benefits Overview List */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-800 ml-2">ServiceHub Plus Member Privileges</h2>

          <div className="bg-white p-5 rounded-2xl shadow-sm flex items-start gap-4 border border-slate-100">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <Zap size={24} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Zero Surge Pricing</h3>
              <p className="text-sm text-slate-500 mt-1">Book services during peak morning or evening hours without ever paying extra multipliers.</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm flex items-start gap-4 border border-slate-100">
            <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <span className="text-2xl font-black">%</span>
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Flat 10% Extra Discount</h3>
              <p className="text-sm text-slate-500 mt-1">Enjoy an automatic flat 10% off the base price of every service you book on ServiceHub.</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm flex items-start gap-4 border border-slate-100">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
              <Shield size={24} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Extended Warranty Protection</h3>
              <p className="text-sm text-slate-500 mt-1">Get free 60-day repair revisit protection on all booked services.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
