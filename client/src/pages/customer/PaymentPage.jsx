import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '@/services/api';
import Header from '@/components/common/Header';
import { CreditCard, Banknote, Shield, Lock, CheckCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PaymentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [paymentOptions, setPaymentOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('online');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    Promise.all([
      apiService.getBooking(id),
      apiService.getPaymentOptions(id),
    ]).then(([bookingRes, optionsRes]) => {
      setBooking(bookingRes.data.data.booking);
      setPaymentOptions(optionsRes.data.data);
      // Default to online if cash is unavailable
      if (!optionsRes.data.data.cash?.available) {
        setPaymentMethod('online');
      }
      setLoading(false);
    }).catch(() => {
      toast.error('Booking not found');
      navigate('/bookings');
    });
  }, [id]);

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    return () => document.body.removeChild(script);
  }, []);

  async function handleOnlinePayment() {
    setPaying(true);
    try {
      const { data } = await apiService.createOrder({ bookingId: id, paymentMethod: 'online' });
      const orderData = data.data;

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'ServiceHub',
        description: `Booking #${booking.bookingNumber}`,
        order_id: orderData.orderId,
        prefill: orderData.prefill,
        theme: { color: '#2563EB' },
        modal: { ondismiss: () => setPaying(false) },
        handler: async (response) => {
          try {
            await apiService.verifyPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              bookingId: id,
            });
            setSuccess(true);
            toast.success('Payment successful! 🎉');
          } catch (err) {
            toast.error('Payment verification failed. Contact support.');
            setPaying(false);
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (resp) => {
        toast.error(`Payment failed: ${resp.error.description}`);
        setPaying(false);
      });
      rzp.open();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to initiate payment');
      setPaying(false);
    }
  }

  async function handleCashPayment() {
    // Re-check options before proceeding
    if (!paymentOptions?.cash?.available) {
      toast.error(paymentOptions?.cash?.message || 'Cash payment not available');
      return;
    }
    setPaying(true);
    try {
      await apiService.createOrder({ bookingId: id, paymentMethod: 'cash' });
      setSuccess(true);
      toast.success('Cash payment recorded!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to record cash payment');
      setPaying(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-50 pt-20 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  );

  if (success) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
        <CheckCircle className="text-green-600 w-10 h-10" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Payment Successful!</h2>
      <p className="text-slate-500 mb-8">Your booking #{booking?.bookingNumber} is now complete.</p>
      <div className="flex gap-3">
        <button onClick={() => navigate(`/bookings/${id}`)} className="btn-secondary">View Booking</button>
        <button onClick={() => navigate('/')} className="btn-primary">Book Again</button>
      </div>
    </div>
  );

  const cashBlocked = !paymentOptions?.cash?.available;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header />
      <div className="pt-16 max-w-md mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Complete Payment</h1>

        {/* Order summary */}
        <div className="card p-5 mb-6">
          <h3 className="font-semibold text-slate-800 mb-4">Order Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Service</span>
              <span>{booking?.serviceId?.name || 'Service'}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Booking #</span>
              <span className="font-mono">{booking?.bookingNumber}</span>
            </div>
            {booking?.materialCost > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Materials</span>
                <span>₹{booking.materialCost}</span>
              </div>
            )}
            {booking?.extraCharges > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Extra charges</span>
                <span>₹{booking.extraCharges}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-slate-900 text-lg pt-3 border-t border-slate-100 mt-2">
              <span>Total Amount</span>
              <span className="text-primary-700">₹{booking?.totalAmount?.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Cash blocked banner */}
        {cashBlocked && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 mb-5 flex gap-3 items-start">
            <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Cash payment unavailable</p>
              <p className="text-xs text-amber-700 mt-1">
                {paymentOptions?.cash?.message ||
                  'The provider does not have enough balance to cover the platform commission. Please pay online.'}
              </p>
              {paymentOptions?.cash?.shortfall > 0 && (
                <p className="text-xs text-amber-600 mt-1 font-medium">
                  Shortfall: ₹{paymentOptions.cash.shortfall.toLocaleString('en-IN')}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Payment method */}
        <div className="card p-5 mb-6">
          <h3 className="font-semibold text-slate-800 mb-4">Payment Method</h3>
          <div className="space-y-3">
            {[
              { id: 'online', icon: CreditCard, label: 'Pay Online', desc: 'UPI, Cards, Net Banking via Razorpay', badge: 'Recommended', disabled: false },
              { id: 'cash', icon: Banknote, label: 'Pay Cash', desc: cashBlocked ? 'Unavailable — provider balance insufficient' : 'Pay directly to the service provider', disabled: cashBlocked },
            ].map(({ id: mId, icon: Icon, label, desc, badge, disabled }) => (
              <button
                key={mId}
                onClick={() => !disabled && setPaymentMethod(mId)}
                disabled={disabled}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                  disabled
                    ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                    : paymentMethod === mId
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${disabled ? 'bg-slate-100' : paymentMethod === mId ? 'bg-primary-100' : 'bg-slate-100'}`}>
                  <Icon size={20} className={disabled ? 'text-slate-300' : paymentMethod === mId ? 'text-primary-600' : 'text-slate-500'} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold text-sm ${disabled ? 'text-slate-400' : 'text-slate-800'}`}>{label}</span>
                    {badge && !disabled && <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">{badge}</span>}
                    {disabled && <span className="bg-slate-100 text-slate-400 text-xs px-2 py-0.5 rounded-full font-medium">Unavailable</span>}
                  </div>
                  <p className={`text-xs mt-0.5 ${disabled ? 'text-slate-400' : 'text-slate-500'}`}>{desc}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${disabled ? 'border-slate-200' : paymentMethod === mId ? 'border-primary-500 bg-primary-500' : 'border-slate-300'}`}>
                  {!disabled && paymentMethod === mId && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Security badge */}
        <div className="flex items-center gap-2 text-slate-400 text-xs mb-6 justify-center">
          <Shield size={14} />
          <span>256-bit SSL encryption · Secured by Razorpay</span>
          <Lock size={12} />
        </div>

        {(paymentMethod === 'online' || !cashBlocked) && (
          <button
            onClick={paymentMethod === 'online' ? handleOnlinePayment : handleCashPayment}
            disabled={paying}
            className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2"
          >
            {paying ? (
              <><span className="animate-spin">↻</span> Processing…</>
            ) : paymentMethod === 'online' ? (
              <>💳 Pay ₹{booking?.totalAmount?.toLocaleString('en-IN')} Online</>
            ) : (
              <>💵 Confirm Cash Payment</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
