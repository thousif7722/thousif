import React, { useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, ArrowRight, RefreshCw, ChevronLeft, UserCheck, Briefcase, Check, ShieldCheck, Star } from 'lucide-react';
import {
  loginWithGoogle,
  completeRegistration,
  sendOTP,
  verifyOTP,
  resetOtp,
  resetRoleSelection,
  selectAuthLoading,
  selectUser,
  selectNeedsRoleSelection,
  selectPendingGoogleUser
} from '@/store/slices/authSlice';
import { selectPublicSettings } from '@/store/slices/serviceSlice';
import SeoHead from '@/components/seo/SeoHead';
import toast from 'react-hot-toast';

const SERVICES_PREVIEW = ['AC Repair', 'Home Cleaning', 'Plumbing', 'Electrical', 'Pest Control', 'Painting'];

export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const loading = useSelector(selectAuthLoading);
  const user = useSelector(selectUser);
  const { otpSent, otpPhone } = useSelector(s => s.auth);
  const needsRoleSelection = useSelector(selectNeedsRoleSelection);
  const pendingGoogleUser = useSelector(selectPendingGoogleUser);
  const settings = useSelector(selectPublicSettings);

  const siteName = settings?.siteName || 'OneWayFix';
  const logoUrl = settings?.logoUrl;

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [phoneRole, setPhoneRole] = useState('customer');
  const [name, setName] = useState('');
  const [showPhoneAuth, setShowPhoneAuth] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [resendTimer, setResendTimer] = useState(0);

  const otpRefs = useRef([]);
  const timerRef = useRef(null);

  // Auto-redirect logged-in users to their respective homes
  useEffect(() => {
    if (user && !needsRoleSelection) {
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
  }, [user, needsRoleSelection, navigate, location]);

  useEffect(() => {
    if (otpSent) startResendTimer();
    return () => clearInterval(timerRef.current);
  }, [otpSent]);

  function startResendTimer() {
    setResendTimer(30);
    timerRef.current = setInterval(() => {
      setResendTimer(t => { if (t <= 1) { clearInterval(timerRef.current); return 0; } return t - 1; });
    }, 1000);
  }

  function handleGoogleLogin() {
    dispatch(loginWithGoogle());
  }

  function handleCompleteRegistration(chosenRole) {
    if (!pendingGoogleUser?.idToken) {
      toast.error('Session expired. Please sign in with Google again.');
      dispatch(resetRoleSelection());
      return;
    }
    dispatch(completeRegistration({
      idToken: pendingGoogleUser.idToken,
      role: chosenRole,
      name: pendingGoogleUser.name || '',
    }));
  }

  function handlePhoneChange(e) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhone(val);
  }

  function handleSendOTP(e) {
    e.preventDefault();
    if (phone.length !== 10) return toast.error('Enter a valid 10-digit mobile number');
    dispatch(sendOTP({ phone, role: phoneRole }));
  }

  function handleOTPChange(index, value) {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
    if (newOtp.every(d => d) && newOtp.join('').length === 6) {
      handleVerify(newOtp.join(''));
    }
  }

  function handleOTPKeyDown(index, e) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleVerify(code) {
    const otpCode = code || otp.join('');
    if (otpCode.length !== 6) return toast.error('Enter the complete 6-digit OTP');
    const payload = { phone: otpPhone, otp: otpCode, role: phoneRole };
    if (name.trim()) payload.name = name.trim();
    dispatch(verifyOTP(payload));
  }

  function handleResend() {
    if (resendTimer > 0) return;
    dispatch(sendOTP({ phone: otpPhone, role: phoneRole }));
  }

  function handleBack() {
    if (needsRoleSelection) {
      dispatch(resetRoleSelection());
      return;
    }
    if (otpSent) {
      dispatch(resetOtp());
      setOtp(['', '', '', '', '', '']);
      return;
    }
    setShowPhoneAuth(false);
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      <SeoHead title={`Login | ${siteName}`} noIndex={true} />

      {/* Left panel — Branding */}
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

      {/* Right panel — Authentication UI */}
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

          <div id="firebase-recaptcha" />

          <AnimatePresence mode="wait">
            {/* ── STEP A: NEW USER ROLE SELECTION SCREEN ──────────────────────────────── */}
            {needsRoleSelection ? (
              <motion.div key="role-selection" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 mb-6 bg-slate-100 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <ChevronLeft size={16} /> Change Account
                </button>

                <div className="text-center mb-8">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full inline-block mb-2">
                    Google Auth Success
                  </span>
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">How will you use {siteName}?</h2>
                  <p className="text-slate-500 text-sm mt-1">
                    Select your primary profile type to complete setup for <span className="font-semibold text-slate-700">{pendingGoogleUser?.email}</span>
                  </p>
                </div>

                <div className="space-y-4 mb-8">
                  {/* Customer Option Card */}
                  <button
                    type="button"
                    onClick={() => handleCompleteRegistration('customer')}
                    disabled={loading}
                    className="w-full text-left p-5 rounded-2xl border-2 border-amber-200 bg-amber-50/50 hover:bg-amber-50 hover:border-amber-400 transition-all duration-200 group relative overflow-hidden shadow-sm"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-xl shadow-md group-hover:scale-105 transition-transform">
                        🏠
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-extrabold text-slate-900 text-lg group-hover:text-amber-700 transition-colors">
                            I'm a Customer
                          </h3>
                          <ArrowRight size={18} className="text-amber-600 group-hover:translate-x-1 transition-transform" />
                        </div>
                        <p className="text-slate-600 text-xs mt-1 leading-relaxed">
                          Book trusted home repair, cleaning & inspection services with instant pricing.
                        </p>
                      </div>
                    </div>
                  </button>

                  {/* Provider Option Card */}
                  <button
                    type="button"
                    onClick={() => handleCompleteRegistration('provider')}
                    disabled={loading}
                    className="w-full text-left p-5 rounded-2xl border-2 border-blue-200 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-400 transition-all duration-200 group relative overflow-hidden shadow-sm"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-md group-hover:scale-105 transition-transform">
                        🔧
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-extrabold text-slate-900 text-lg group-hover:text-blue-700 transition-colors">
                            I'm a Service Provider
                          </h3>
                          <ArrowRight size={18} className="text-blue-600 group-hover:translate-x-1 transition-transform" />
                        </div>
                        <p className="text-slate-600 text-xs mt-1 leading-relaxed">
                          Accept local job requests, manage earnings, and grow your service business.
                        </p>
                      </div>
                    </div>
                  </button>
                </div>

                {loading && (
                  <div className="text-center text-xs text-slate-500 flex items-center justify-center gap-2 py-2">
                    <span className="animate-spin text-base">↻</span> Setting up your account profile...
                  </div>
                )}
              </motion.div>

            /* ── STEP B: NORMAL LOGIN SCREEN (Google Primary) ───────────────────────── */
            ) : !showPhoneAuth && !otpSent ? (
              <motion.div key="main-login" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Welcome Back!</h2>
                  <p className="text-slate-500 text-sm mt-1.5">Login to book services or manage your jobs</p>
                </div>

                {/* Primary Google Login Button */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 py-4 px-6 text-base font-bold text-slate-800 bg-white border-2 border-slate-200 rounded-2xl hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-60 mb-6"
                >
                  {loading ? (
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

                {/* Role Informational Cards (No selection required before Google click) */}
                <div className="grid grid-cols-2 gap-3 mb-6">
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

                <div className="flex items-center gap-4 my-6">
                  <div className="h-px bg-slate-200 flex-1" />
                  <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">OR</span>
                  <div className="h-px bg-slate-200 flex-1" />
                </div>

                {/* Phone Auth Option (For existing phone users / recovery) */}
                <button
                  type="button"
                  onClick={() => setShowPhoneAuth(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors mb-6"
                >
                  <Phone size={16} /> Sign in with Phone Number
                </button>

                <p className="text-center text-xs text-slate-400">
                  By continuing, you agree to OneWayFix's{' '}
                  <Link to="/terms" className="text-blue-600 underline font-medium hover:text-blue-800">Terms</Link> &{' '}
                  <Link to="/privacy" className="text-blue-600 underline font-medium hover:text-blue-800">Privacy Policy</Link>
                </p>
              </motion.div>

            /* ── STEP C: PHONE OTP INPUT FORM (Existing Phone Users) ───────────────── */
            ) : !otpSent ? (
              <motion.div key="phone-auth" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <button onClick={handleBack} className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 mb-6 bg-slate-100 px-3 py-1.5 rounded-lg transition-colors">
                  <ChevronLeft size={16} /> Back to Google Sign-In
                </button>

                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-1">Phone Login</h2>
                <p className="text-slate-500 text-xs mb-6">Enter your registered 10-digit Indian mobile number</p>

                {/* Role Switcher for Phone Login */}
                <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-6 gap-1.5">
                  {[
                    { id: 'customer', label: '👤 Customer', active: 'bg-amber-500 text-white shadow-sm' },
                    { id: 'provider', label: '🔧 Provider', active: 'bg-blue-600 text-white shadow-sm' }
                  ].map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setPhoneRole(r.id)}
                      className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                        phoneRole === r.id ? r.active : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSendOTP} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Phone Number</label>
                    <div className="flex items-center border-2 border-slate-200 rounded-xl focus-within:border-blue-500 transition-colors">
                      <span className="pl-4 pr-2 text-slate-500 font-bold text-sm">+91</span>
                      <div className="w-px h-5 bg-slate-200 mx-1" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={handlePhoneChange}
                        placeholder="9876543210"
                        className="flex-1 py-3 pr-4 bg-transparent outline-none text-slate-900 font-semibold placeholder:text-slate-400 text-base"
                        maxLength={10}
                        autoFocus
                      />
                    </div>
                  </div>

                  {phoneRole === 'provider' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Your Name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Full Name"
                        className="w-full py-3 px-4 border-2 border-slate-200 rounded-xl outline-none focus:border-blue-500 text-sm font-semibold"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || phone.length !== 10}
                    className="w-full flex items-center justify-center gap-2 py-3.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all disabled:opacity-50"
                  >
                    {loading ? <span className="animate-spin text-base">↻</span> : <>Send Verification OTP <ArrowRight size={16} /></>}
                  </button>
                </form>
              </motion.div>

            /* ── STEP D: VERIFY OTP ────────────────────────────────────────────────── */
            ) : (
              <motion.div key="otp-auth" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <button onClick={handleBack} className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 mb-6 bg-slate-100 px-3 py-1.5 rounded-lg transition-colors">
                  <ChevronLeft size={16} /> Change Number
                </button>
                <h2 className="text-2xl font-extrabold text-slate-900 mb-1">Verify OTP</h2>
                <p className="text-slate-500 text-xs mb-6">
                  Sent to <span className="font-bold text-slate-800">+91 {otpPhone}</span>
                </p>

                <div className="flex gap-2 justify-center mb-6">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={el => otpRefs.current[i] = el}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOTPChange(i, e.target.value)}
                      onKeyDown={e => handleOTPKeyDown(i, e)}
                      className={`w-11 h-13 text-center text-xl font-bold border-2 rounded-xl outline-none transition-all
                        ${digit ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50'}
                        focus:border-blue-600`}
                      autoFocus={i === 0}
                    />
                  ))}
                </div>

                <button
                  onClick={() => handleVerify()}
                  disabled={loading || otp.join('').length !== 6}
                  className="w-full py-3.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all disabled:opacity-50 mb-4"
                >
                  {loading ? <span className="animate-spin text-base">↻</span> : 'Verify & Continue'}
                </button>

                <div className="text-center">
                  {resendTimer > 0 ? (
                    <p className="text-slate-400 text-xs">Resend code in {resendTimer}s</p>
                  ) : (
                    <button onClick={handleResend} className="text-blue-600 text-xs font-bold flex items-center gap-1 mx-auto hover:underline">
                      <RefreshCw size={14} /> Resend OTP
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
