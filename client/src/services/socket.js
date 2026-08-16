import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { store } from '@/store';
import { addNotification } from '@/store/slices/notificationSlice';
import { updateBookingStatus } from '@/store/slices/bookingSlice';

const getSocketUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol;
    if (protocol === 'capacitor:' || protocol === 'file:' || protocol === 'ionic:') {
      return 'http://10.43.167.48:5000';
    }
  }
  return window.location.origin;
};

const SOCKET_URL = getSocketUrl();

let socket = null;
let locationInterval = null;

// ── Deduplication: track notification IDs we've already toasted ────────────────
const _toastedNotifIds = new Set();

/**
 * Show a toast for a real-time notification exactly once per ID.
 * Falls back to showing regardless if no ID is present (one-off toasts).
 */
function toastNotification(data) {
  const id = data._id || data.notifId || null;
  if (id && _toastedNotifIds.has(id)) return; // already shown
  if (id) _toastedNotifIds.add(id);

  const toastId = id ? `notif_${id}` : undefined;
  toast(data.title || data.body || 'New notification', {
    id: toastId,
    icon: getNotifIcon(data.type),
    duration: 5000,
    style: {
      borderRadius: '12px',
      background: '#1e293b',
      color: '#f1f5f9',
      fontSize: '14px',
      maxWidth: '380px',
    },
  });
}

function getNotifIcon(type) {
  switch (type) {
    case 'complaint': return '📋';
    case 'otp':       return '🔐';
    case 'payment':   return '💰';
    case 'booking_update': return '📦';
    default:          return '🔔';
  }
}

export function connectSocket() {
  const token = localStorage.getItem('accessToken');
  if (!token || socket?.connected) return;

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 20000,
  });

  // ── Connection events ──────────────────────────────────────────────────────
  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
    // socket.io handles reconnection automatically via reconnectionAttempts config.
  });

  socket.on('connect_error', (err) => {
    console.warn('[Socket] Connection error:', err.message);
  });

  // ── Booking events ─────────────────────────────────────────────────────────
  socket.on('booking:assigned', (data) => {
    store.dispatch(updateBookingStatus({ bookingId: data.bookingId, status: 'assigned' }));
    toast.success(data.message || 'Provider found!', { id: `booking_assigned_${data.bookingId}`, icon: '👷', duration: 5000 });
    showNotificationBanner(data.message);
  });

  socket.on('booking:accepted', (data) => {
    store.dispatch(updateBookingStatus({ bookingId: data.bookingId, status: 'accepted' }));
    toast.success(data.message || 'Provider accepted your booking!', { id: `booking_accepted_${data.bookingId}`, icon: '✅', duration: 5000 });
  });

  socket.on('booking:status_update', (data) => {
    store.dispatch(updateBookingStatus({ bookingId: data.bookingId, status: data.status, endOtp: data.endOtp }));
    if (data.message) toast(data.message, { id: `status_update_${data.bookingId}_${data.status}`, duration: 5000 });
  });

  socket.on('booking:completed', (data) => {
    store.dispatch(updateBookingStatus({ bookingId: data.bookingId, status: 'completed' }));
    toast.success(data.message || 'Service completed! Proceed to payment.', {
      id: `booking_completed_${data.bookingId}`,
      duration: 8000,
    });
  });

  socket.on('booking:paid', (data) => {
    store.dispatch(updateBookingStatus({ bookingId: data.bookingId, status: 'paid' }));
    toast.success(data.message || 'Payment successful!', { id: `booking_paid_${data.bookingId}`, icon: '🎉', duration: 6000 });
  });

  socket.on('booking:no_providers', (data) => {
    toast.error(data.message || 'No providers available in your area.', { id: 'no_providers_toast', duration: 4000 });
  });

  // ── Provider-specific events ───────────────────────────────────────────────
  socket.on('booking:new_request', (data) => {
    const notif = {
      _clientId: `new_request_${data.bookingId}`,
      title: 'New Booking Request!',
      body: `${data.service?.name || 'Service'} at ${data.address?.area} — ₹${data.estimatedEarnings?.toFixed(0)}`,
      type: 'booking_update',
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    store.dispatch(addNotification(notif));
    playNotificationSound();
    toast(`New booking request! You have ${data.acceptTimeoutSeconds}s to accept.`, {
      id: 'booking_new_request_toast',
      icon: '🔔',
      duration: 6000,
    });
  });

  socket.on('booking:expired', () => {
    stopRapidoAlertSound();
    toast.dismiss('booking_new_request_toast');
    toast('Booking request expired.', { id: 'booking_expired_toast', icon: '⏰', duration: 3000 });
  });

  socket.on('payment:received', (data) => {
    toast.success(data.message || `Payment received: ₹${data.earnings}`, { id: `payment_recv_${data.bookingId}`, icon: '💰', duration: 6000 });
  });

  // ── Real-time push notifications (from backend complaint/booking events) ───
  // IMPORTANT: Always show a toast + deduplicate by notif ID to prevent duplicate toasts.
  socket.on('notification:push', (data) => {
    // Generate a stable client-side ID for deduplication if no _id provided
    const clientId = data._id || `push_${data.type}_${data.title}_${Date.now()}`;
    const notif = {
      ...data,
      _clientId: clientId,
      isRead: false,
      createdAt: data.createdAt || new Date().toISOString(),
    };
    store.dispatch(addNotification(notif));
    toastNotification(notif);
  });

  // ── Complaint-specific events ──────────────────────────────────────────────
  // OTP received by customer (emitted ONLY via socket, never in API response)
  socket.on('complaint:resolution_otp', (data) => {
    // Dispatch a special in-memory notification that includes the OTP for the UI
    // This is NEVER persisted in DB \u2014 it lives only in React state during the session
    store.dispatch(addNotification({
      _clientId: `otp_${data.complaintId}_${Date.now()}`,
      title: '\ud83d\udd10 Resolution OTP',
      body: `Ticket #${data.ticketNumber}: Your OTP is ready. Share it with the technician to confirm the issue is resolved.`,
      type: 'otp',
      isRead: false,
      // Store OTP in the notification payload for UI display
      _otp: data.otp,
      _complaintId: data.complaintId,
      _ticketNumber: data.ticketNumber,
      _expiresInSeconds: data.expiresInSeconds || 600,
      createdAt: new Date().toISOString(),
    }));

    toast(`🔐 Resolution OTP: ${data.otp} (Ticket #${data.ticketNumber}) — Share with technician`, {
      id: `otp_toast_${data.complaintId}`,
      icon: '🔐',
      duration: 60000,
      style: {
        borderRadius: '16px',
        background: '#0f172a',
        color: '#34d399',
        fontWeight: 'bold',
        fontSize: '15px',
        padding: '16px 20px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
      },
    });
  });

  // Customer's complaint was successfully created
  socket.on('complaint:created', (data) => {
    toast.success(data.message || `Complaint filed. Ticket #${data.ticketNumber}`, {
      id: `complaint_created_${data.complaintId}`,
      icon: '📋',
      duration: 6000,
    });
  });

  // Complaint was resolved (provider confirmed with OTP)
  socket.on('complaint:resolved', (data) => {
    toast.success(`Complaint #${data.ticketNumber} resolved! \u2705`, {
      id: `complaint_resolved_${data.complaintId}`,
      duration: 8000,
    });
  });

  return socket;
}

export function disconnectSocket() {
  if (locationInterval) {
    clearInterval(locationInterval);
    locationInterval = null;
  }
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket() {
  return socket;
}

// ── Location tracking for providers ───────────────────────────────────────────
export function startLocationTracking() {
  if (!navigator.geolocation) return;
  if (locationInterval) clearInterval(locationInterval);

  const sendLocation = () => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (socket?.connected) {
          socket.emit('provider:location_update', {
            lat: coords.latitude,
            lng: coords.longitude,
            accuracy: coords.accuracy,
            heading: coords.heading,
            speed: coords.speed,
          });
        }
      },
      (err) => console.warn('[GPS] Error:', err.message),
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 15000 }
    );
  };

  sendLocation();
  locationInterval = setInterval(sendLocation, 8000); // Every 8 seconds
}

export function stopLocationTracking() {
  if (locationInterval) {
    clearInterval(locationInterval);
    locationInterval = null;
  }
}

// ── Chat helpers ───────────────────────────────────────────────────────────────
export function sendChatMessage(bookingId, message, type = 'text') {
  if (!socket?.connected) {
    toast.error('Not connected. Please check your internet.');
    return false;
  }
  socket.emit('chat:send', { bookingId, message, type });
  return true;
}

export function getChatHistory(bookingId, callback) {
  if (!socket?.connected) return;
  socket.emit('chat:history', { bookingId });
  socket.once('chat:history', callback);
}

export function sendTypingIndicator(bookingId, isTyping) {
  socket?.emit('chat:typing', { bookingId, isTyping });
}

export function onChatMessage(callback) {
  socket?.on('chat:message', callback);
  return () => socket?.off('chat:message', callback);
}

export function onProviderLocation(callback) {
  socket?.on('provider:location', callback);
  return () => socket?.off('provider:location', callback);
}

export function toggleProviderAvailability(isOnline) {
  socket?.emit('provider:toggle_availability', { isOnline });
}

// ── Rapido-Style Loud Siren Alert Sound Synthesizer ─────────────────────────────
let alertAudioCtx = null;
let alertIntervalId = null;

export function playRapidoAlertSound(durationMs = 15000) {
  stopRapidoAlertSound();
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    alertAudioCtx = new AudioContext();

    let toggle = false;
    const playChimeTone = () => {
      if (!alertAudioCtx || alertAudioCtx.state === 'closed') return;
      try {
        const osc = alertAudioCtx.createOscillator();
        const gain = alertAudioCtx.createGain();
        osc.connect(gain);
        gain.connect(alertAudioCtx.destination);

        // Rapido-style dual chime frequency: 880Hz (A5) & 1174.66Hz (D6)
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(toggle ? 1174.66 : 880, alertAudioCtx.currentTime);
        toggle = !toggle;

        gain.gain.setValueAtTime(0.5, alertAudioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, alertAudioCtx.currentTime + 0.25);

        osc.start(alertAudioCtx.currentTime);
        osc.stop(alertAudioCtx.currentTime + 0.25);
      } catch (e) {
        console.warn('[AlertSound] Error playing chime:', e);
      }
    };

    // Play immediately, then repeat every 320ms for durationMs
    playChimeTone();
    alertIntervalId = setInterval(playChimeTone, 320);

    // Auto stop after durationMs
    setTimeout(() => {
      stopRapidoAlertSound();
    }, durationMs);
  } catch (err) {
    console.warn('[AlertSound] Failed to initialize Web Audio API:', err);
  }
}

export function stopRapidoAlertSound() {
  if (alertIntervalId) {
    clearInterval(alertIntervalId);
    alertIntervalId = null;
  }
  if (alertAudioCtx) {
    try {
      if (alertAudioCtx.state !== 'closed') {
        alertAudioCtx.close();
      }
    } catch {}
    alertAudioCtx = null;
  }
}

function playNotificationSound() {
  playRapidoAlertSound(10000);
}

function showNotificationBanner(message) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification('ServiceHub', { body: message, icon: '/logo.svg' });
        }).catch(() => {
          try { new Notification('ServiceHub', { body: message, icon: '/logo.svg' }); } catch {}
        });
      } else {
        try { new Notification('ServiceHub', { body: message, icon: '/logo.svg' }); } catch {}
      }
    }
  } catch (e) {
    console.warn('[Notification] Failed to display system notification:', e);
  }
}
