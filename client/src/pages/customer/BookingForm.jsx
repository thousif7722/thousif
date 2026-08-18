import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  Calendar, Clock, MapPin, Tag, ChevronLeft, Loader,
  Navigation, PenLine, CheckCircle2, RefreshCw, Plus, Minus,
} from 'lucide-react';
import { createBooking, selectBookingLoading } from '@/store/slices/bookingSlice';
import { selectUser } from '@/store/slices/authSlice';
import { apiService } from '@/services/api';
import Header from '@/components/common/Header';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

const ALL_TIME_SLOTS = [
  { label: '07:00–09:00', from: 7 },
  { label: '09:00–11:00', from: 9 },
  { label: '11:00–13:00', from: 11 },
  { label: '13:00–15:00', from: 13 },
  { label: '15:00–17:00', from: 15 },
  { label: '17:00–19:00', from: 17 },
];

// Returns true if a slot starting at `fromHour` is already past for a given date
function isSlotPast(dateStr, fromHour) {
  if (!dateStr) return false;
  const now = new Date();
  const selected = new Date(dateStr);
  // Only apply cutoff for today
  if (
    selected.getFullYear() === now.getFullYear() &&
    selected.getMonth() === now.getMonth() &&
    selected.getDate() === now.getDate()
  ) {
    return fromHour <= now.getHours();
  }
  return false;
}

const schema = yup.object({
  scheduledDate: yup.string().required('Date required'),
  timeSlot: yup.string().required('Please select a time slot'),
  line1: yup.string().required('Address required'),
  city: yup.string().required('City required'),
  state: yup.string().required('State required'),
  couponCode: yup.string().optional(),
  notes: yup.string().max(300).optional(),
});

// ── Reverse-geocoding via OpenStreetMap Nominatim (no API key) ─────────────────
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    const addr = data.address || {};
    return {
      line1: [addr.road, addr.neighbourhood, addr.suburb].filter(Boolean).join(', ') || '',
      city: addr.city || addr.town || addr.village || addr.county || '',
      state: addr.state || '',
      pincode: addr.postcode || '',
    };
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// LOCATION PICKER COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
function LocationPicker({ onLocationSet, savedAddress }) {
  const [gpsCoords, setGpsCoords] = useState(null);
  const [detecting, setDetecting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  // FIX: Track if GPS was explicitly denied so we show manual form instead of blocking
  const [gpsDenied, setGpsDenied] = useState(false);

  const [manual, setManual] = useState({
    line1: savedAddress?.line1 || '',
    city: savedAddress?.city || '',
    state: savedAddress?.state || '',
  });

  const detectGPS = useCallback((isAuto = false) => {
    if (!navigator.geolocation) {
      if (!isAuto) toast.error('Geolocation not supported. Enter address manually.');
      setGpsDenied(true);
      return;
    }
    setDetecting(true);
    setGpsDenied(false);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { latitude: lat, longitude: lng } = coords;
        setGpsCoords([lng, lat]);
        if (!isAuto) toast.loading('Locating service area…', { id: 'geocode' });
        const addr = await reverseGeocode(lat, lng);
        if (!isAuto) toast.dismiss('geocode');
        if (addr) {
          setManual({ line1: addr.line1 || '', city: addr.city || '', state: addr.state || '' });
          if (!isAuto) toast.success('Location detected!');
        } else {
          if (!isAuto) toast.success('GPS locked!');
        }
        setDetecting(false);
        setConfirmed(false);
      },
      (err) => {
        setDetecting(false);
        // FIX: GPS denied → show manual form, don't block
        if (err.code === 1) {
          setGpsDenied(true);
          if (!isAuto) toast('GPS blocked. Enter your address manually.', { icon: '📍' });
        } else {
          if (!isAuto) toast.error('GPS unavailable. Enter address manually.');
          setGpsDenied(true);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => { detectGPS(true); }, [detectGPS]);

  function handleManualConfirm() {
    if (!manual.city || !manual.line1) {
      toast.error('Please fill in your address and city');
      return;
    }
    setConfirmed(true);
    // No GPS? Pass null coords — backend will use city-based matching
    onLocationSet({ coords: gpsCoords, address: manual, manualOnly: !gpsCoords });
    toast.success('Address confirmed!');
  }

  function handleGpsConfirm() {
    if (!gpsCoords) { toast.error('Please detect your location first'); return; }
    if (!manual.city) { toast.error('City not detected. Please redetect or enter manually.'); return; }
    setConfirmed(true);
    onLocationSet({ coords: gpsCoords, address: manual });
    toast.success('Location confirmed!');
  }

  // ── Manual address form (shown when GPS is blocked/denied) ──────────────────
  const ManualForm = () => (
    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
        <span className="text-lg">📍</span>
        <p className="text-xs text-amber-800 font-medium">GPS blocked. Enter your address below to continue.</p>
      </div>
      <input value={manual.line1} onChange={e => { setManual(m => ({ ...m, line1: e.target.value })); setConfirmed(false); }}
        placeholder="House No. / Street / Landmark *" className="input-field text-sm" />
      <div className="grid grid-cols-2 gap-2">
        <input value={manual.city} onChange={e => { setManual(m => ({ ...m, city: e.target.value })); setConfirmed(false); }}
          placeholder="City *" className="input-field text-sm" />
        <input value={manual.state} onChange={e => { setManual(m => ({ ...m, state: e.target.value })); setConfirmed(false); }}
          placeholder="State *" className="input-field text-sm" />
      </div>
      {!confirmed ? (
        <button type="button" onClick={handleManualConfirm}
          className="w-full py-3.5 rounded-2xl bg-slate-900 text-white font-bold flex items-center justify-center gap-2">
          <CheckCircle2 size={18} /> Confirm Address
        </button>
      ) : (
        <div className="flex items-center justify-center gap-2 text-emerald-600 bg-emerald-50 py-3.5 rounded-2xl border border-emerald-100 text-sm font-bold">
          <CheckCircle2 size={18} /> Address Confirmed
        </div>
      )}
      <button type="button" onClick={() => { setGpsDenied(false); detectGPS(); }}
        className="text-xs text-primary-600 hover:underline font-medium w-full text-center">
        Try GPS again
      </button>
    </div>
  );

  return (
    <div className="card p-5 space-y-4 border-2 border-primary-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
            <MapPin className="text-primary-600" size={18} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Service Location</h3>
            <p className="text-xs text-slate-400">{gpsDenied ? 'Manual entry' : 'GPS detection'}</p>
          </div>
        </div>
        {confirmed && (
          <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
            <CheckCircle2 size={13} /> Verified
          </span>
        )}
      </div>

      <div className="space-y-3 pt-1">
        {/* GPS denied → show manual form */}
        {gpsDenied && <ManualForm />}

        {/* GPS detecting */}
        {!gpsDenied && !gpsCoords && !detecting && (
          <button type="button" onClick={() => detectGPS()}
            className="w-full py-6 rounded-2xl border-2 border-dashed border-primary-200 bg-primary-50/30 flex flex-col items-center justify-center gap-2 text-primary-600 hover:bg-primary-50 transition-all">
            <Navigation className="animate-pulse" size={24} />
            <span className="text-sm font-bold">Detect My Location</span>
          </button>
        )}

        {!gpsDenied && detecting && (
          <div className="w-full py-6 rounded-2xl border-2 border-dashed border-primary-200 bg-primary-50/30 flex flex-col items-center justify-center gap-2 text-primary-600">
            <Loader className="animate-spin" size={24} />
            <span className="text-sm font-bold animate-pulse">Finding your GPS location…</span>
          </div>
        )}

        {/* GPS acquired */}
        {!gpsDenied && gpsCoords && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2">
              <div className="flex items-start gap-2">
                <MapPin size={14} className="text-primary-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Detected address</p>
                  <p className="text-sm text-slate-600 font-medium mt-1">
                    {manual.line1 ? `${manual.line1}, ` : ''}{manual.city}, {manual.state} {manual.pincode}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => detectGPS()}
                className="text-[10px] font-bold text-primary-600 hover:underline uppercase tracking-tighter">
                Not correct? Redetect GPS
              </button>
            </div>
            <div className="relative">
              <input value={manual.line1}
                onChange={e => { setManual(m => ({ ...m, line1: e.target.value })); setConfirmed(false); }}
                placeholder="Add Flat / House No / Landmark (Optional)"
                className="input-field pr-10 text-sm" />
              <PenLine size={14} className="absolute right-3 top-3.5 text-slate-400" />
            </div>

            {!confirmed ? (
              <button type="button" onClick={handleGpsConfirm}
                className="w-full py-3.5 rounded-2xl bg-slate-900 hover:bg-black text-white font-bold shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                <CheckCircle2 size={18} /> Confirm Location
              </button>
            ) : (
              <div className="flex items-center justify-center gap-2 text-emerald-600 bg-emerald-50 py-3.5 rounded-2xl border border-emerald-100 text-sm font-bold animate-in fade-in zoom-in duration-300">
                <CheckCircle2 size={18} /> GPS Location Confirmed
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// BOOKING FORM PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function BookingForm() {
  const { serviceId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const loading = useSelector(selectBookingLoading);
  const user = useSelector(selectUser);

  const prefill = location.state?.prefill;

  const [service, setService] = useState(null);
  const [couponApplied, setCouponApplied] = useState(null);
  const [locationData, setLocationData] = useState(null);
  // Quantity — initialized from ?qty= URL param (from CategoryServicesPage)
  const [quantity, setQuantity] = useState(() => Math.max(1, Math.min(10, parseInt(searchParams.get('qty') || '1', 10))));

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      scheduledDate: dayjs().format('YYYY-MM-DD'),
      city: prefill?.city || user?.addresses?.[0]?.city || '',
      state: prefill?.state || user?.addresses?.[0]?.state || '',
      line1: prefill?.line1 || user?.addresses?.[0]?.line1 || '',
    },
  });

  const selectedSlot = watch('timeSlot');

  useEffect(() => {
    // If prefill is provided, simulate confirming it to activate submission
    if (prefill) {
      setLocationData({
        address: prefill,
        coords: prefill.location?.coordinates || null,
        manualOnly: !prefill.location?.coordinates
      });
    }
  }, [prefill]);

  useEffect(() => {
    apiService.getServiceById(serviceId)
      .then(res => setService(res.data.data))
      .catch(() => { toast.error('Service not found'); navigate('/'); });
  }, [serviceId]);

  // When location is confirmed by the picker, populate the form fields
  const handleLocationSet = useCallback((data) => {
    setLocationData(data);
    if (data.address?.line1) setValue('line1', data.address.line1);
    if (data.address?.city) setValue('city', data.address.city);
    if (data.address?.state) setValue('state', data.address.state);
  }, [setValue]);

  async function onSubmit(data) {
    try {
      // FIX: Block submit if no location confirmed at all
      if (!locationData) {
        toast.error('Please confirm your service location first');
        return;
      }
      // FIX: Only use GPS coords if we have them — no silent fallback to wrong city
      const coords = locationData?.coords || null;

      const rawSlot = data.timeSlot || '';
      const parts = rawSlot.split(/[–\-—]/);
      const slotFrom = (parts[0] || '09:00').trim();
      const slotTo   = (parts[1] || '11:00').trim();

      const dateStr = data.scheduledDate || dayjs().add(1, 'day').format('YYYY-MM-DD');
      const scheduledDate = new Date(`${dateStr}T23:59:00`);

      const bookingData = {
        serviceId,
        scheduledDate: scheduledDate.toISOString(),
        timeSlot: { from: slotFrom, to: slotTo },
        serviceAddress: {
          line1: locationData.address?.line1 || data.line1,
          city: locationData.address?.city || data.city,
          state: locationData.address?.state || data.state,
          ...(coords ? { location: { coordinates: coords } } : {}),
        },
        customerNotes: data.notes?.trim() || undefined,
        couponCode: couponApplied?.code || undefined,
      };

      const result = await dispatch(createBooking(bookingData));
      if (result?.payload?.bookingId) {
        toast.success('Booking confirmed! Finding a provider near you…');
        navigate(`/bookings/${result.payload.bookingId}`);
      } else if (result.error) {
        toast.error(result.payload || 'Booking failed. Please try again.');
      }
    } catch (err) {
      console.error('Booking submit error:', err);
      toast.error('Unexpected error. Please try again.');
    }
  }

  const onError = (errs) => {
    const firstError = Object.values(errs)[0];
    if (firstError) toast.error(firstError.message);
  };

  const plusDiscount = user?.isPlusMember ? Math.round((service?.basePrice || 0) * quantity * 0.1) : 0;
  const baseTotal = service ? (service.basePrice * quantity) - plusDiscount - (couponApplied?.discountAmount || 0) : 0;
  const savedAddress = user?.addresses?.[0];

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <Header />
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-slate-500 hover:text-slate-700 mb-6 text-sm font-medium">
          <ChevronLeft size={16} /> Back
        </button>

        {service && (
          <div className="card p-4 mb-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-primary-50 rounded-2xl text-3xl flex items-center justify-center shrink-0 overflow-hidden relative border border-slate-200">
                {service.imageUrl || service.image ? (
                  <img src={service.imageUrl || service.image} alt={service.imageAlt || service.name} className="w-full h-full object-cover" />
                ) : (
                  <span>{service.icon || '🔧'}</span>
                )}
              </div>
              <div className="flex-1">
                <h2 className="font-bold text-slate-900">{service.name}</h2>
                <p className="text-sm text-slate-500">{service.duration} min · ₹{service.basePrice} per unit</p>
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 w-fit px-2.5 py-0.5 rounded-md border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                  Instant location radar matching
                </div>
              </div>
            </div>
            {/* Quantity selector */}
            <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">Number of Units</p>
                <p className="text-xs text-slate-400">e.g., 2 ACs, 3 rooms</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="w-9 h-9 rounded-xl bg-white shadow-sm border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
                >
                  <Minus size={15} />
                </button>
                <span className="w-8 text-center font-bold text-lg text-slate-900">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(q => Math.min(10, q + 1))}
                  className="w-9 h-9 rounded-xl bg-primary-600 shadow-sm flex items-center justify-center text-white hover:bg-primary-700 active:scale-95 transition-all"
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit, onError)} className="space-y-5">
          {/* Date */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="text-primary-600" size={18} />
              <h3 className="font-semibold text-slate-800">Select Date</h3>
            </div>
            <input
              type="date"
              {...register('scheduledDate')}
              min={dayjs().format('YYYY-MM-DD')}
              max={dayjs().add(30, 'day').format('YYYY-MM-DD')}
              className="input-field"
            />
            {errors.scheduledDate && <p className="text-red-500 text-xs mt-1">{errors.scheduledDate.message}</p>}
          </div>

          {/* Time Slots */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="text-primary-600" size={18} />
              <h3 className="font-semibold text-slate-800">Select Time Slot</h3>
            </div>
            {/* FIX: Past time slots disabled for today */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ALL_TIME_SLOTS.map(({ label: slot, from: fromHour }) => {
                const past = isSlotPast(watch('scheduledDate'), fromHour);
                return (
                  <button
                    key={slot}
                    type="button"
                    disabled={past}
                    onClick={() => !past && setValue('timeSlot', slot)}
                    className={`py-2.5 px-3 rounded-xl text-sm font-medium border-2 transition-all relative ${
                      past
                        ? 'border-slate-100 text-slate-300 bg-slate-50 cursor-not-allowed'
                        : selectedSlot === slot
                        ? 'bg-primary-600 border-primary-600 text-white'
                        : 'border-slate-200 text-slate-600 hover:border-primary-300 bg-white'
                    }`}
                  >
                    {slot}
                    {past && <span className="absolute -top-2 -right-1 text-[9px] text-slate-400 font-bold">Past</span>}
                  </button>
                );
              })}
            </div>
            {errors.timeSlot && <p className="text-red-500 text-xs mt-2">{errors.timeSlot.message}</p>}
          </div>

          {/* Location Picker — GPS or Manual */}
          <LocationPicker onLocationSet={handleLocationSet} savedAddress={prefill || savedAddress} />

          {/* Validation errors for address info */}
          {(errors.line1 || errors.city || errors.state || errors.pincode) && (
            <div className="px-5 py-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-medium">
              Please confirm your full address details above.
            </div>
          )}

          {/* Coupon */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="text-primary-600" size={18} />
              <h3 className="font-semibold text-slate-800">Coupon Code</h3>
            </div>
            <CouponInput
              serviceBasePrice={service?.basePrice || 0}
              onApply={setCouponApplied}
              applied={couponApplied}
            />
          </div>

          {/* Notes */}
          <div className="card p-5">
            <label className="block text-sm font-medium text-slate-700 mb-2">Special Instructions (optional)</label>
            <textarea {...register('notes')} rows={3} placeholder="Any special instructions for the service provider…" className="input-field resize-none" />
          </div>

          {/* Bill summary */}
          {service && (
            <div className="card p-5 bg-primary-50 border-primary-100">
              <h3 className="font-semibold text-slate-800 mb-3">Estimated Bill</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Base price</span>
                  <span>₹{service.basePrice}</span>
                </div>
                {quantity > 1 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Units × {quantity}</span>
                    <span>₹{service.basePrice * quantity}</span>
                  </div>
                )}
                {user?.isPlusMember && (
                  <div className="flex justify-between text-yellow-600 bg-yellow-50 px-2 py-1 -mx-2 rounded-lg items-center">
                    <span className="font-semibold flex items-center gap-1">★ Plus Discount (10%)</span>
                    <span className="font-bold">-₹{plusDiscount}</span>
                  </div>
                )}
                {couponApplied && (
                  <div className="flex justify-between text-emerald-600 px-2 py-1 -mx-2 bg-emerald-50 rounded-lg items-center">
                    <span className="font-semibold">Discount ({couponApplied.code})</span>
                    <span className="font-bold">-₹{couponApplied.discountAmount}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-400 text-xs">
                  <span>Material charges (if any)</span>
                  <span>After completion</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 text-base pt-2 border-t border-primary-200">
                  <span>Estimated Total</span>
                  <span className="text-primary-700">₹{baseTotal}+</span>
                </div>
              </div>
            </div>
          )}

          {/* Cancellation Policy — FIX: show BEFORE booking, not after */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-800">
            <p className="font-bold mb-1.5">📋 Cancellation Policy</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Cancel ≥ 2 hours before: <span className="font-semibold text-green-700">Free</span></li>
              <li>Cancel within 2 hours: <span className="font-semibold text-amber-700">₹50 cancellation fee</span></li>
              <li>Cancel after provider arrives: <span className="font-semibold text-red-700">₹100 + travel charges</span></li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={loading || !service || !locationData}
            className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? <><Loader size={18} className="animate-spin" /> Creating booking…</> : '✅ Confirm Booking'}
          </button>
          {!locationData && (
            <p className="text-center text-xs text-slate-400">👆 Confirm your service location first</p>
          )}
        </form>
      </div>
    </div>
  );
}

// FIX: Real coupon validation against API — no more hardcoded ₹50 for any string
function CouponInput({ serviceBasePrice, onApply, applied }) {
  const [code, setCode] = useState('');
  const [validating, setValidating] = useState(false);

  async function handleApply() {
    if (!code.trim()) return;
    setValidating(true);
    try {
      // Call real coupon validation endpoint
      const res = await import('@/services/api').then(m =>
        m.default.get(`/coupons/validate?code=${code.trim().toUpperCase()}&orderValue=${serviceBasePrice}`)
      );
      const coupon = res.data.data;
      onApply({ code: coupon.code, discountAmount: coupon.discountAmount, id: coupon._id });
      toast.success(`🎉 "${coupon.code}" applied — saving ₹${coupon.discountAmount}!`);
    } catch (err) {
      const msg = err.response?.data?.error || 'Invalid or expired coupon code';
      toast.error(msg);
    } finally {
      setValidating(false);
    }
  }

  if (applied) {
    return (
      <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
        <div>
          <p className="font-semibold text-green-700 text-sm">{applied.code} applied ✅</p>
          <p className="text-xs text-green-600">Saving ₹{applied.discountAmount}</p>
        </div>
        <button onClick={() => onApply(null)} className="text-red-500 text-xs font-medium hover:underline">Remove</button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <input
        value={code}
        onChange={e => setCode(e.target.value.toUpperCase())}
        placeholder="Enter coupon code"
        className="input-field flex-1"
        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleApply())}
      />
      <button
        type="button"
        onClick={handleApply}
        disabled={validating || !code.trim()}
        className="btn-secondary px-5 whitespace-nowrap"
      >
        {validating ? '…' : 'Apply'}
      </button>
    </div>
  );
}
