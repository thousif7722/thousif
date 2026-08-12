import React, { useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, ArrowRight, RefreshCw, ChevronLeft } from 'lucide-react';
import { sendOTP, verifyOTP, resetOtp, selectAuthLoading, loginWithGoogle } from '@/store/slices/authSlice';
import { selectPublicSettings } from '@/store/slices/serviceSlice';
import SeoHead from '@/components/seo/SeoHead';
import toast from 'react-hot-toast';

const SERVICES_PREVIEW = ['AC Repair', 'Home Cleaning', 'Plumbing', 'Electrical', 'Pest Control', 'Painting'];

export default function LoginPage() {
  const dispatch = useDispatch();
  const loading = useSelector(selectAuthLoading);
  const { otpSent, otpPhone } = useSelector(s => s.auth);
  const settings = useSelector(selectPublicSettings);

  const siteName = settings?.siteName || 'OneWayFix';
  const logoUrl = settings?.logoUrl;

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [role, setRole] = useState('customer');
  const [name, setName] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const otpRefs = useRef([]);
  const timerRef = useRef(null);

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

  function handlePhoneChange(e) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhone(val);
  }

  function handleSendOTP(e) {
    e.preventDefault();
    if (phone.length !== 10) return toast.error('Enter a valid 10-digit number');
    dispatch(sendOTP({ phone, role }));
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
    const payload = { phone: otpPhone, otp: otpCode, role };
    if (name.trim()) payload.name = name.trim();
    dispatch(verifyOTP(payload));
  }

  function handleResend() {
    if (resendTimer > 0) return;
    dispatch(sendOTP({ phone: otpPhone, role }));
  }

  function handleBack() {
    dispatch(resetOtp());
    setOtp(['', '', '', '', '', '']);
  }

  function handleGoogleLogin() {
    dispatch(loginWithGoogle(role));
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-primary-700 via-primary-600 to-blue-500">
      <SeoHead title="Login | OneWayFix" noIndex={true} />
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-16 text-white">
        <div>
          {logoUrl && logoUrl !== '/logo.png' ? (
            <img src={logoUrl} alt={siteName} className="h-10 w-auto object-contain mb-2 max-w-[220px]" />
          ) : (
            <div className="text-3xl font-bold tracking-tight mb-2">⚡ {siteName}</div>
          )}
          <p className="text-primary-200 text-sm">{settings?.tagline || 'Professional Home Services'}</p>
        </div>
        <div>
          <h1 className="text-5xl font-bold leading-tight mb-6">
            Your home,<br />
            <span className="text-blue-200">expertly cared for.</span>
          </h1>
          <p className="text-primary-100 text-lg mb-10">
            Book trusted professionals for AC repair, cleaning, plumbing, and 50+ services — at your doorstep.
          </p>
          <div className="flex flex-wrap gap-2">
            {SERVICES_PREVIEW.map(s => (
              <span key={s} className="bg-white/15 backdrop-blur-sm text-white text-sm px-3 py-1.5 rounded-full border border-white/20">
                {s}
              </span>
            ))}
          </div>
        </div>
        <div className="flex gap-8 text-sm text-primary-200">
          <div><div className="text-2xl font-bold text-white">10M+</div>Happy Customers</div>
          <div><div className="text-2xl font-bold text-white">50K+</div>Verified Pros</div>
          <div><div className="text-2xl font-bold text-white">4.8★</div>Avg. Rating</div>
        </div>
      </div>

      {/* Right panel — auth form */}
      <div className="flex-1 flex items-center justify-center p-3 xs:p-6 sm:p-8">
        <motion.div
          className="w-full max-w-md bg-white rounded-2xl xs:rounded-3xl shadow-2xl p-4 xs:p-7 sm:p-8"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="mb-8 text-center lg:hidden">
            {logoUrl && logoUrl !== '/logo.png' ? (
              <img src={logoUrl} alt={siteName} className="h-9 w-auto object-contain mx-auto" />
            ) : (
              <div className="text-2xl font-bold text-primary-700">⚡ {siteName}</div>
            )}
          </div>

          <div id="firebase-recaptcha" />

          <AnimatePresence mode="wait">
            {!otpSent ? (
              <motion.div key="phone" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-2xl font-bold text-slate-900 mb-1">Welcome back!</h2>
                <p className="text-slate-500 text-sm mb-8">Enter your phone number to continue</p>

                {/* Role selector */}
                <div className="flex bg-slate-100/90 border border-slate-200 rounded-2xl p-1.5 mb-6 gap-1.5 shadow-inner">
                  {[
                    { id: 'customer', label: '👤 Customer', activeClass: 'bg-blue-600 text-white shadow-md shadow-blue-500/30' },
                    { id: 'provider', label: '🔧 Provider', activeClass: 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30' }
                  ].map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRole(r.id)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center justify-center gap-1.5 ${
                        role === r.id ? `${r.activeClass} scale-[1.02]` : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSendOTP} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Phone Number</label>
                    <div className="flex items-center border-2 border-slate-200 rounded-xl focus-within:border-primary-500 transition-colors">
                      <span className="pl-4 pr-2 text-slate-500 font-medium text-sm">+91</span>
                      <div className="w-px h-5 bg-slate-200 mx-1" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={handlePhoneChange}
                        placeholder="9876543210"
                        className="flex-1 py-3 pr-4 bg-transparent outline-none text-slate-900 font-medium placeholder:text-slate-400"
                        maxLength={10}
                        autoFocus
                      />
                      <Phone size={18} className="text-slate-400 mr-4" />
                    </div>
                  </div>

                  {role === 'provider' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Your Name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Full name"
                        className="input-field"
                      />
                    </div>
                  )}

                  <button type="submit" disabled={loading || phone.length !== 10} className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base">
                    {loading ? <span className="animate-spin">↻</span> : <>Get OTP <ArrowRight size={18} /></>}
                  </button>
                  
                  <div className="flex items-center gap-4 my-2">
                    <div className="h-px bg-slate-200 flex-1" />
                    <span className="text-slate-400 text-sm font-medium">OR</span>
                    <div className="h-px bg-slate-200 flex-1" />
                  </div>

                  <button 
                    type="button" 
                    onClick={handleGoogleLogin} 
                    disabled={loading} 
                    className="w-full flex items-center justify-center gap-2 py-3 text-base font-semibold border-2 border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-slate-700 disabled:opacity-50"
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                      <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                        <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
                        <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
                        <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
                        <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
                      </g>
                    </svg>
                    Continue with Google
                  </button>
                </form>

                <p className="text-center text-xs text-slate-400 mt-6">
                  By continuing, you agree to our{' '}
                  <Link to="/terms" className="text-primary-600 underline hover:text-primary-800">Terms</Link> &{' '}
                  <Link to="/privacy" className="text-primary-600 underline hover:text-primary-800">Privacy Policy</Link>
                </p>
              </motion.div>
            ) : (
              <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <button onClick={handleBack} className="flex items-center gap-1 text-slate-500 hover:text-slate-700 mb-6 text-sm">
                  <ChevronLeft size={16} /> Back
                </button>
                <h2 className="text-2xl font-bold text-slate-900 mb-1">Enter 6-digit OTP</h2>
                <p className="text-slate-500 text-sm mb-8">
                  Sent to <span className="font-semibold text-slate-700">+91 {otpPhone}</span>. Please enter the 6-digit code below.
                </p>

                <div className="flex gap-1.5 xs:gap-2 sm:gap-3 justify-center mb-8">
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
                      className={`w-[13.5%] xs:w-11 sm:w-12 h-11 xs:h-13 sm:h-14 text-center text-lg xs:text-xl font-bold border-2 rounded-xl outline-none transition-all
                        ${digit ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 bg-slate-50'}
                        focus:border-primary-500`}
                      autoFocus={i === 0}
                    />
                  ))}
                </div>

                <button
                  onClick={() => handleVerify()}
                  disabled={loading || otp.join('').length !== 6}
                  className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base mb-4"
                >
                  {loading ? <span className="animate-spin">↻</span> : 'Verify OTP'}
                </button>

                <div className="text-center">
                  {resendTimer > 0 ? (
                    <p className="text-slate-400 text-sm">Resend OTP in {resendTimer}s</p>
                  ) : (
                    <button onClick={handleResend} className="text-primary-600 text-sm font-medium flex items-center gap-1 mx-auto hover:underline">
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
