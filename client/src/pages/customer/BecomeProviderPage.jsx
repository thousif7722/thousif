import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, ArrowRight, CheckCircle, Clock, Zap, UserCheck } from 'lucide-react';
import { selectUser, fetchUserProfile } from '@/store/slices/authSlice';
import { apiService } from '@/services/api';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import SeoHead from '@/components/seo/SeoHead';
import toast from 'react-hot-toast';

export default function BecomeProviderPage() {
  const user = useSelector(selectUser);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleStartApplication = async () => {
    setLoading(true);
    try {
      const res = await apiService.becomeProvider({});
      toast.success(res.data.message || 'Application initiated!');
      await dispatch(fetchUserProfile());
      navigate('/provider/profile');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to initiate application');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <SeoHead title="Become a Service Partner | OneWayFix" />
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-10 w-full flex-1">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white rounded-3xl p-6 sm:p-10 shadow-xl border border-slate-100"
        >
          {user?.role === 'provider' || user?.providerStatus === 'approved' ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-8 text-center max-w-xl mx-auto shadow-sm">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl font-extrabold shadow-inner">
                🎉
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900 mb-2">You are an Approved Partner!</h2>
              <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                Your account has full Service Provider privileges enabled. Your Customer account functionality remains completely intact—you can book services as a customer anytime, or switch to your Partner Dashboard to accept incoming jobs.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => navigate('/provider')}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-2xl shadow-md transition-all text-sm flex items-center justify-center gap-2"
                >
                  <span>⚡ Go to Provider Dashboard</span>
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-6 py-3 rounded-2xl transition-all text-sm"
                >
                  <span>🛒 Browse Services as Customer</span>
                </button>
              </div>
            </div>
          ) : user?.providerApplicationStatus === 'pending' ? (
            <div className="bg-amber-50 border border-amber-200 rounded-3xl p-8 text-center max-w-xl mx-auto shadow-sm">
              <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl font-extrabold shadow-inner">
                ⏳
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Application Under Review</h2>
              <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                Your Partner Application has been submitted and is currently being verified by our onboarding team. Your Customer account remains <strong>100% active</strong> and unchanged while we review your details.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => navigate('/provider/pending')}
                  className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 py-3 rounded-2xl shadow-md transition-all text-sm flex items-center justify-center gap-2"
                >
                  <span>📋 View Application Status</span>
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-6 py-3 rounded-2xl transition-all text-sm"
                >
                  <span>🛒 Continue as Customer</span>
                </button>
              </div>
            </div>
          ) : (
            <>
          {/* Header Banner */}
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 font-bold text-2xl shadow-sm">
              ⚡
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-3">
              Become a OneWayFix Partner
            </h1>
            <p className="text-slate-600 text-base leading-relaxed">
              Earn reliable daily income by completing home-service jobs in your city. Apply now and start accepting bookings once verified!
            </p>
          </div>

          {/* Account Integrity Banner */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-8 flex items-start gap-3">
            <ShieldCheck size={24} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-emerald-900 text-sm mb-1">Your Account Stays Active</h3>
              <p className="text-emerald-700 text-xs leading-relaxed">
                Submitting this application does <strong>NOT</strong> change your current account to a provider immediately. Your account remains an active <strong>Customer account</strong> during the review period. Once approved by our team, your existing account will be upgraded with Provider privileges.
              </p>
            </div>
          </div>

          {/* Benefits Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            <div className="bg-slate-50 border border-slate-200/70 p-5 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold mb-3">
                💰
              </div>
              <h4 className="font-bold text-slate-900 text-sm mb-1">Daily Direct Payouts</h4>
              <p className="text-xs text-slate-500">Instant credit for completed jobs with direct bank transfer.</p>
            </div>

            <div className="bg-slate-50 border border-slate-200/70 p-5 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center font-bold mb-3">
                📍
              </div>
              <h4 className="font-bold text-slate-900 text-sm mb-1">Work Near You</h4>
              <p className="text-xs text-slate-500">Set your preferred service radius and get bookings in your locality.</p>
            </div>

            <div className="bg-slate-50 border border-slate-200/70 p-5 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold mb-3">
                ⏰
              </div>
              <h4 className="font-bold text-slate-900 text-sm mb-1">Flexible Schedule</h4>
              <p className="text-xs text-slate-500">Go online or offline anytime with a single toggle.</p>
            </div>
          </div>

          {/* How it Works Workflow */}
          <div className="border-t border-slate-100 pt-8 mb-10">
            <h3 className="font-extrabold text-slate-900 text-base mb-6 text-center">4 Simple Application Steps</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white font-bold text-xs flex items-center justify-center shrink-0">1</div>
                <div>
                  <h5 className="font-bold text-slate-800 text-sm">Customer Profile Active</h5>
                  <p className="text-xs text-slate-500">{user?.name} ({user?.phone || user?.email})</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">2</div>
                <div>
                  <h5 className="font-bold text-slate-800 text-sm">Select Services & Radius</h5>
                  <p className="text-xs text-slate-500">Choose your skills (Plumbing, Electrical, Cleaning, AC repair, etc.)</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">3</div>
                <div>
                  <h5 className="font-bold text-slate-800 text-sm">Upload KYC & Bank Details</h5>
                  <p className="text-xs text-slate-500">Upload Aadhaar / PAN card photos and bank account for payouts.</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="w-8 h-8 rounded-full bg-amber-500 text-white font-bold text-xs flex items-center justify-center shrink-0">4</div>
                <div>
                  <h5 className="font-bold text-slate-800 text-sm">Admin Verification & Role Activation</h5>
                  <p className="text-xs text-slate-500">Our verification team reviews your application within 24-48 hours.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action CTA */}
          <div className="text-center">
            <button
              onClick={handleStartApplication}
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-4 rounded-2xl shadow-lg shadow-blue-500/25 transition-all text-base disabled:opacity-50"
            >
              {loading ? 'Initiating Application…' : 'Start Provider Application'} <ArrowRight size={18} />
            </button>
          </div>
          </>
          )}
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
