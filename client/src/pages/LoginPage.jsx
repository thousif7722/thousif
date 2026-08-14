import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ChevronLeft } from 'lucide-react';
import {
  loginWithGoogle,
  completeRegistration,
  resetRoleSelection,
  selectAuthLoading,
  selectUser,
  selectNeedsPhone,
  selectIsNewUser,
  selectExistingUserToUpdate,
  selectNeedsRoleSelection,
  selectPendingGoogleUser
} from '@/store/slices/authSlice';
import { selectPublicSettings } from '@/store/slices/serviceSlice';
import { apiService } from '@/services/api';
import SeoHead from '@/components/seo/SeoHead';
import toast from 'react-hot-toast';

const SERVICES_PREVIEW = ['AC Repair', 'Home Cleaning', 'Plumbing', 'Electrical', 'Pest Control', 'Painting'];

export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const loading = useSelector(selectAuthLoading);
  const user = useSelector(selectUser);
  const needsPhone = useSelector(selectNeedsPhone);
  const isNewUser = useSelector(selectIsNewUser);
  const existingUserToUpdate = useSelector(selectExistingUserToUpdate);
  const needsRoleSelection = useSelector(selectNeedsRoleSelection);
  const pendingGoogleUser = useSelector(selectPendingGoogleUser);
  const settings = useSelector(selectPublicSettings);

  const siteName = settings?.siteName || 'OneWayFix';
  const logoUrl = settings?.logoUrl;

  const [phoneInput, setPhoneInput] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [validatedPhone, setValidatedPhone] = useState('');
  const [showRoleStep, setShowRoleStep] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-redirect logged-in users to their respective home pages
  useEffect(() => {
    if (user && !needsPhone && !needsRoleSelection && !showRoleStep) {
      const from = location.state?.from?.pathname;
      if (from && from !== '/login') {
        navigate(from, { replace: true });
        return;
      }
      if (user.role === 'admin' || user.role === 'staff') {
        navigate('/admin', { replace: true });
      } else if (user.role === 'provider') {
        if (user.providerStatus === 'approved') {
          navigate('/provider', { replace: true });
        } else {
          navigate('/provider/pending', { replace: true });
        }
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [user, needsPhone, needsRoleSelection, showRoleStep, navigate, location]);

  function handleGoogleLogin() {
    if (isSubmitting || loading) return;
    dispatch(loginWithGoogle());
  }

  function validateAndNormalizePhone(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const str = raw.trim();
    if (/[a-zA-Z]/.test(str)) return null;
    const digits = str.replace(/\D/g, '');
    let normalized = digits;
    if (digits.length === 12 && digits.startsWith('91')) {
      normalized = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith('0')) {
      normalized = digits.slice(1);
    }
    if (!/^[6-9]\d{9}$/.test(normalized)) return null;
    return normalized;
  }

  async function handlePhoneSubmit(e) {
    if (e) e.preventDefault();
    if (isSubmitting || loading) return;

    setPhoneError('');
    const normalized = validateAndNormalizePhone(phoneInput);
    if (!normalized) {
      setPhoneError('Enter a valid 10-digit Indian mobile number.');
      toast.error('Enter a valid 10-digit Indian mobile number.', { id: 'phone-validation-toast' });
      return;
    }

    setIsSubmitting(true);
    try {
      // Pre-check phone availability before moving to Role Selection
      await apiService.checkPhone(normalized);
      setValidatedPhone(normalized);

      // If user already exists with an assigned role (e.g. customer/provider), save phone directly
      if (!isNewUser && existingUserToUpdate?.role) {
        await dispatch(completeRegistration({
          idToken: pendingGoogleUser?.idToken,
          phone: normalized,
          role: existingUserToUpdate.role,
          name: existingUserToUpdate.name || pendingGoogleUser?.name || '',
        })).unwrap();
      } else {
        // New user -> proceed to role selection step
        setShowRoleStep(true);
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Mobile number already registered';
      setPhoneError('This number is already linked to another OneWayFix account.');
      toast.error('Mobile number already registered', { id: 'phone-duplicate-toast' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCompleteRegistration(chosenRole) {
    if (isSubmitting || loading) return;

    if (!pendingGoogleUser?.idToken) {
      toast.error('Your Google session has expired. Please sign in again.', { id: 'session-expired-toast' });
      dispatch(resetRoleSelection());
      return;
    }

    const phoneToUse = validatedPhone || validateAndNormalizePhone(phoneInput);
    if (!phoneToUse) {
      toast.error('Enter a valid 10-digit Indian mobile number.', { id: 'phone-validation-toast' });
      setShowRoleStep(false);
      return;
    }

    setIsSubmitting(true);
    try {
      await dispatch(completeRegistration({
        idToken: pendingGoogleUser.idToken,
        phone: phoneToUse,
        role: chosenRole,
        name: pendingGoogleUser.name || '',
      })).unwrap();
    } catch (err) {
      const errMsg = typeof err === 'string' ? err : err?.message || 'Registration failed';
      if (errMsg.toLowerCase().includes('already registered') || errMsg.toLowerCase().includes('already exists')) {
        setPhoneError('This number is already linked to another OneWayFix account.');
        toast.error('Mobile number already registered', { id: 'phone-duplicate-toast' });
        setShowRoleStep(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleBack() {
    if (showRoleStep) {
      setShowRoleStep(false);
    } else if (needsPhone || needsRoleSelection) {
      dispatch(resetRoleSelection());
      setPhoneInput('');
      setPhoneError('');
      setValidatedPhone('');
      setShowRoleStep(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      <SeoHead title={`Login | ${siteName}`} noIndex={true} />

      {/* Left Panel — Branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-16 bg-gradient-to-br from-slate-900 via-primary-950 to-blue-900 text-white relative overflow-hidden">
        {/* Background Subtle Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:24px_24px] opacity-15 pointer-events-none" />

        <div className="relative z-10">
          {logoUrl && logoUrl !== '/logo.png' ? (
            <img src={logoUrl} alt={siteName} className="h-10 w-auto object-contain mb-2 max-w-[220px]" />
          ) : (
            <div className="text-3xl font-extrabold tracking-tight mb-2 flex items-center gap-2">
              <span className="w-9 h-9 bg-gradient-to-tr from-amber-400 to-orange-500 rounded-xl flex items-center justify-center text-white text-xl shadow-lg">⚡</span>
              {siteName}
            </div>
          )}
          <p className="text-slate-300 text-sm font-medium">{settings?.tagline || 'Your Service, Our Priority'}</p>
        </div>

        <div className="relative z-10 my-auto py-12">
          <h1 className="text-5xl font-black leading-tight mb-6 tracking-tight">
            One platform.<br />
            <span className="bg-gradient-to-r from-amber-400 via-orange-300 to-blue-300 bg-clip-text text-transparent">
              All home services.
            </span>
          </h1>
          <p className="text-slate-300 text-lg mb-10 max-w-lg leading-relaxed">
            Book verified experts for AC repair, cleaning, plumbing, and electrical services — or manage your service business all in one app.
          </p>

          <div className="flex flex-wrap gap-2.5">
            {SERVICES_PREVIEW.map(s => (
              <span key={s} className="bg-white/10 backdrop-blur-md text-white text-xs font-semibold px-4 py-2 rounded-full border border-white/15 shadow-sm">
                {s}
              </span>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex gap-10 text-sm text-slate-300 border-t border-white/10 pt-6">
          <div>
            <div className="text-2xl font-black text-white">100%</div>
            <div className="text-xs text-slate-400 font-medium">Verified Pros</div>
          </div>
          <div>
            <div className="text-2xl font-black text-white">30-Day</div>
            <div className="text-xs text-slate-400 font-medium">Warranty Vault</div>
          </div>
          <div>
            <div className="text-2xl font-black text-amber-400">4.9★</div>
            <div className="text-xs text-slate-400 font-medium">Customer Rating</div>
          </div>
        </div>
      </div>

      {/* Right Panel — Authentication UI */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-white">
        <motion.div
          className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Mobile Header Branding */}
          <div className="mb-8 text-center lg:hidden">
            {logoUrl && logoUrl !== '/logo.png' ? (
              <img src={logoUrl} alt={siteName} className="h-10 w-auto object-contain mx-auto" />
            ) : (
              <div className="text-2xl font-extrabold text-slate-900 flex items-center justify-center gap-2">
                <span className="w-8 h-8 bg-gradient-to-tr from-amber-400 to-orange-500 rounded-lg flex items-center justify-center text-white text-lg">⚡</span>
                {siteName}
              </div>
            )}
            <p className="text-slate-500 text-xs font-medium mt-1">Your Service, Our Priority</p>
          </div>

          <AnimatePresence mode="wait">
            {/* ── STEP 1: MOBILE NUMBER COLLECTION SCREEN ──────────────────────────────── */}
            {needsPhone && !showRoleStep ? (
              <motion.div key="phone-input" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 mb-6 bg-slate-100 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <ChevronLeft size={16} /> Back
                </button>

                <div className="text-center mb-6">
                  <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl font-bold shadow-sm">
                    📱
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Almost there!</h2>
                  <p className="text-slate-500 text-xs sm:text-sm mt-1.5 leading-relaxed max-w-sm mx-auto">
                    Enter your mobile number so we can contact you about bookings, service updates and support.
                  </p>
                </div>

                <form onSubmit={handlePhoneSubmit} className="space-y-4 mb-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Mobile Number
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3.5 text-sm font-bold text-slate-700 select-none flex items-center gap-1">
                        <span>🇮🇳</span> +91
                      </span>
                      <input
                        type="tel"
                        maxLength={13}
                        value={phoneInput}
                        onChange={(e) => {
                          setPhoneInput(e.target.value);
                          if (phoneError) setPhoneError('');
                        }}
                        placeholder="98765 43210"
                        autoFocus
                        className={`w-full pl-16 pr-4 py-3.5 text-slate-900 text-base font-bold rounded-2xl border-2 transition-all ${
                          phoneError
                            ? 'border-red-500 bg-red-50/30 focus:ring-red-200'
                            : 'border-slate-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10'
                        }`}
                      />
                    </div>
                    {phoneError && (
                      <p className="text-xs text-red-600 font-semibold mt-1.5 flex items-center gap-1">
                        <span>⚠️</span> {phoneError}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || loading || !phoneInput.trim()}
                    className="w-full py-3.5 px-6 text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {(isSubmitting || loading) ? (
                      <span className="animate-spin text-base">↻</span>
                    ) : (
                      <>
                        Continue <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </form>

                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center">
                  <p className="text-[11px] text-slate-500 font-medium">
                    Your number is used for service communication and support.
                  </p>
                </div>
              </motion.div>

            /* ── STEP 2: ROLE SELECTION SCREEN (FOR NEW USERS) ─────────────────────── */
            ) : (needsRoleSelection || showRoleStep) ? (
              <motion.div key="role-selection" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 mb-6 bg-slate-100 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <ChevronLeft size={16} /> Back
                </button>

                <div className="text-center mb-8">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full inline-block mb-2">
                    Mobile Number Verified
                  </span>
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">How will you use {siteName}?</h2>
                  <p className="text-slate-500 text-sm mt-1">
                    Select your account type to complete setup for <span className="font-semibold text-slate-700">{pendingGoogleUser?.email}</span>
                  </p>
                </div>

                <div className="space-y-4 mb-8">
                  {/* Customer Option Card */}
                  <button
                    type="button"
                    onClick={() => handleCompleteRegistration('customer')}
                    disabled={isSubmitting || loading}
                    className="w-full text-left p-5 rounded-2xl border-2 border-amber-200 bg-amber-50/50 hover:bg-amber-50 hover:border-amber-400 transition-all duration-200 group relative overflow-hidden shadow-sm disabled:opacity-60"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-xl shadow-md group-hover:scale-105 transition-transform">
                        🏠
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-extrabold text-slate-900 text-lg group-hover:text-amber-700 transition-colors">
                            Customer
                          </h3>
                          <ArrowRight size={18} className="text-amber-600 group-hover:translate-x-1 transition-transform" />
                        </div>
                        <p className="text-slate-600 text-xs mt-1 leading-relaxed">
                          Book trusted home services
                        </p>
                      </div>
                    </div>
                  </button>

                  {/* Service Provider Option Card */}
                  <button
                    type="button"
                    onClick={() => handleCompleteRegistration('provider')}
                    disabled={isSubmitting || loading}
                    className="w-full text-left p-5 rounded-2xl border-2 border-blue-200 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-400 transition-all duration-200 group relative overflow-hidden shadow-sm disabled:opacity-60"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-md group-hover:scale-105 transition-transform">
                        🔧
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-extrabold text-slate-900 text-lg group-hover:text-blue-700 transition-colors">
                            Service Provider
                          </h3>
                          <ArrowRight size={18} className="text-blue-600 group-hover:translate-x-1 transition-transform" />
                        </div>
                        <p className="text-slate-600 text-xs mt-1 leading-relaxed">
                          Manage jobs & earnings
                        </p>
                      </div>
                    </div>
                  </button>
                </div>

                {(isSubmitting || loading) && (
                  <div className="text-center text-xs text-slate-500 flex items-center justify-center gap-2 py-2">
                    <span className="animate-spin text-base">↻</span> Setting up your account profile...
                  </div>
                )}
              </motion.div>

            /* ── STEP 3: GOOGLE SIGN-IN PRIMARY SCREEN ──────────────────────────────── */
            ) : (
              <motion.div key="main-login" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Welcome Back!</h2>
                  <p className="text-slate-500 text-sm mt-1.5">Login to book services or manage your jobs</p>
                </div>

                {/* Primary Google Login Button */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isSubmitting || loading}
                  className="w-full flex items-center justify-center gap-3 py-4 px-6 text-base font-bold text-slate-800 bg-white border-2 border-slate-200 rounded-2xl hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-60 mb-6"
                >
                  {(isSubmitting || loading) ? (
                    <span className="animate-spin text-xl text-primary-600">↻</span>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" width="22" height="22" xmlns="http://www.w3.org/2000/svg">
                        <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                          <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
                          <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
                          <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
                          <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
                        </g>
                      </svg>
                      Continue with Google
                    </>
                  )}
                </button>

                {/* Role Context Informational Cards */}
                <div className="grid grid-cols-2 gap-3 mb-8">
                  <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-left">
                    <div className="flex items-center gap-1.5 font-extrabold text-xs text-amber-800">
                      <span>🏠</span> Customer
                    </div>
                    <p className="text-[11px] text-amber-700/90 mt-1 leading-tight">
                      Book trusted home services
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200/80 text-left">
                    <div className="flex items-center gap-1.5 font-extrabold text-xs text-blue-800">
                      <span>🔧</span> Service Provider
                    </div>
                    <p className="text-[11px] text-blue-700/90 mt-1 leading-tight">
                      Manage jobs & earnings
                    </p>
                  </div>
                </div>

                <p className="text-center text-xs text-slate-400">
                  By continuing, you agree to OneWayFix's{' '}
                  <Link to="/terms" className="text-blue-600 underline font-medium hover:text-blue-800">Terms</Link> &{' '}
                  <Link to="/privacy" className="text-blue-600 underline font-medium hover:text-blue-800">Privacy Policy</Link>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
