import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldAlert, Clock, CheckCircle2, FileText, LogOut, ArrowRight, Phone, RefreshCw, ShoppingBag } from 'lucide-react';
import { selectUser, logout, fetchUserProfile } from '@/store/slices/authSlice';
import { apiService } from '@/services/api';
import SeoHead from '@/components/seo/SeoHead';
import toast from 'react-hot-toast';

export default function ProviderPendingPage() {
  const user = useSelector(selectUser);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStatus = async () => {
    setRefreshing(true);
    try {
      const actionResult = await dispatch(fetchUserProfile()).unwrap();
      if (actionResult?.role === 'provider' && actionResult?.providerApplicationStatus === 'approved') {
        toast.success('🎉 Your provider application has been approved!');
        navigate('/provider');
        return;
      }
      const res = await apiService.getMyProfile().catch(() => null);
      if (res?.data?.data) {
        setProfile(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load application status:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const approvalStatus = user?.providerApplicationStatus || profile?.approvalStatus || user?.providerStatus || 'pending';
  const kycStatus = profile?.kyc?.status || 'submitted';
  const rejectionReason = user?.rejectionReason || profile?.kyc?.rejectionReason || null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      <SeoHead title="Provider Application Status | OneWayFix" noIndex={true} />
      
      {/* Top Header */}
      <div className="max-w-4xl mx-auto w-full flex items-center justify-between py-4 border-b border-slate-200 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-md">
            ⚡
          </div>
          <div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">OneWayFix</span>
            <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
              Provider Application
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-xs font-semibold text-primary-700 bg-primary-50 border border-primary-200 px-3 py-2 rounded-xl hover:bg-primary-100 transition-colors"
          >
            <ShoppingBag size={14} /> Customer Panel
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-sm hover:bg-slate-100 transition-colors"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-2xl mx-auto w-full flex-1 flex flex-col justify-center my-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white rounded-3xl p-6 sm:p-10 shadow-xl border border-slate-100 text-center"
        >
          {approvalStatus === 'pending' && (
            <>
              <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                <Clock size={44} className="animate-pulse" />
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-3">
                Application Under Verification
              </h1>
              
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 text-left">
                <p className="text-blue-900 text-sm font-semibold mb-1 flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-blue-600" /> Active Account Status: Customer
                </p>
                <p className="text-blue-700 text-xs leading-relaxed">
                  Your account is currently a <strong>Customer account</strong>. After successful verification and approval by our admin team, your existing account will be automatically converted to a <strong>Service Provider account</strong>.
                </p>
              </div>

              {/* Progress Steps */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-6 text-left mb-8 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs">
                    ✓
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-slate-900">1. Customer Account Active</div>
                    <div className="text-xs text-slate-500">{user?.name} ({user?.phone || user?.email || 'Verified Account'})</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs">
                    ✓
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-slate-900">2. Provider Application & KYC Submitted</div>
                    <div className="text-xs text-slate-500">
                      Status: <span className="font-semibold capitalize text-amber-700">{kycStatus.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs animate-bounce">
                    3
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-slate-900">3. Admin Approval & Conversion</div>
                    <div className="text-xs text-slate-500">Verification usually completed within 24 - 48 business hours.</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  to="/"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-3 rounded-xl shadow-md transition-all text-sm"
                >
                  <ShoppingBag size={18} /> Continue to Customer Panel
                </Link>
                <button
                  onClick={loadStatus}
                  disabled={refreshing}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold px-6 py-3 rounded-xl transition-all text-sm border border-blue-200"
                >
                  <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                  {refreshing ? 'Refreshing…' : 'Refresh Status'}
                </button>
              </div>
            </>
          )}

          {approvalStatus === 'rejected' && (
            <>
              <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                <ShieldAlert size={44} />
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-3">
                Application Requires Revision
              </h1>
              <p className="text-slate-600 text-base mb-6 max-w-md mx-auto">
                Your provider application was not approved. Your account remains an active <strong>Customer account</strong>. You can update your details and re-apply anytime.
              </p>
              
              {rejectionReason && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm p-4 rounded-xl mb-6 text-left">
                  <span className="font-bold block mb-1">Reason for Rejection:</span>
                  {rejectionReason}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  to="/provider/profile"
                  className="inline-flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-rose-500/25 transition-all text-sm w-full sm:w-auto"
                >
                  Update Details & Re-apply <ArrowRight size={18} />
                </Link>
                <Link
                  to="/"
                  className="inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-6 py-3 rounded-xl transition-all text-sm w-full sm:w-auto"
                >
                  <ShoppingBag size={16} /> Continue as Customer
                </Link>
              </div>
            </>
          )}

          {approvalStatus === 'suspended' && (
            <>
              <div className="w-20 h-20 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShieldAlert size={44} />
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-3">
                Account Suspended
              </h1>
              <p className="text-slate-600 text-base mb-8 max-w-md mx-auto">
                Your provider partner account is currently suspended. Please contact OneWayFix Support for resolution.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center text-sm">
                <a href="tel:+919876543210" className="inline-flex items-center justify-center gap-2 bg-slate-900 text-white font-bold px-5 py-3 rounded-xl">
                  <Phone size={16} /> Contact Support
                </a>
              </div>
            </>
          )}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="text-center text-slate-400 text-xs py-4">
        © {new Date().getFullYear()} OneWayFix Inc. All rights reserved. • Customer & Partner Support
      </footer>
    </div>
  );
}
