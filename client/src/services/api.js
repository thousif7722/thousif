import axios from 'axios';
import toast from 'react-hot-toast';

const getBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return `${import.meta.env.VITE_API_URL}/api/v1`;
  }
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    // Let Vite proxy handle mobile LAN traffic (bypasses Windows Firewall port 5000 blocks)
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return '/api/v1';
    }
    // Capacitor / Cordova / Native File WebView
    if (protocol === 'capacitor:' || protocol === 'file:' || protocol === 'ionic:') {
      return 'http://10.43.167.48:5000/api/v1';
    }
  }
  return '/api/v1';
};

const BASE_URL = getBaseUrl();

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor — attach token ────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor — handle token refresh & errors ─────────────────────
let isRefreshing = false;
let failedQueue = [];
let lastNetworkErrorToastTime = 0;

function processQueue(error, token = null) {
  failedQueue.forEach((prom) => error ? prom.reject(error) : prom.resolve(token));
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${BASE_URL}/auth/refresh-token`, { refreshToken });
        const newToken = data.data.accessToken;

        localStorage.setItem('accessToken', newToken);
        api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);

        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        clearAuthAndRedirect();
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    // Handle specific status codes & network errors
    if (error.response?.status === 429) {
      toast.error('Too many requests. Please wait a moment.');
    } else if (error.response?.status >= 500) {
      toast.error('Server error. Please try again later.');
    } else if (!error.response && error.code === 'ERR_NETWORK') {
      const now = Date.now();
      if (now - lastNetworkErrorToastTime > 15000) {
        lastNetworkErrorToastTime = now;
        toast.error('Connecting to server... Please check your network connection.', { id: 'network-err' });
      }
    }

    return Promise.reject(error);
  }
);

function clearAuthAndRedirect() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  if (!window.location.pathname.includes('/login')) {
    window.location.href = '/login';
  }
}

// ── Helper methods ─────────────────────────────────────────────────────────────
export const apiService = {
  // Auth
  firebaseLogin: (data) => api.post('/auth/firebase-login', data),
  activatePlus: (data) => api.post('/auth/plus', data),
  updateProfile: (data) => api.put('/auth/profile', data),

  // Services
  getServices: (params) => api.get('/services', { params }),
  getServiceById: (id) => api.get(`/services/${id}`),
  getServiceBySlug: (slug) => api.get(`/services/slug/${slug}`),
  getCategories: () => api.get('/services/categories'),

  // Bookings
  getMyBookings: (params) => api.get('/bookings', { params }),
  getBooking: (id) => api.get(`/bookings/${id}`),
  createBooking: (data) => api.post('/bookings', data),
  acceptBooking: (id) => api.put(`/bookings/${id}/accept`),
  rejectBooking: (id, reason) => api.put(`/bookings/${id}/reject`, { reason }),
  startJob: (id, data) => api.put(`/bookings/${id}/start`, data),
  addMaterials: (id, data) => api.post(`/bookings/${id}/materials`, data),
  approveMaterials: (id) => api.put(`/bookings/${id}/materials/approve`),
  completeJob: (id, data) => api.put(`/bookings/${id}/complete`, data),
  cancelBooking: (id, reason) => api.put(`/bookings/${id}/cancel`, { reason }),
  retryMatch: (id) => api.post(`/bookings/${id}/retry-match`),
  getPaymentStatus: (bookingId) => api.get(`/payments/bookings/${bookingId}/status`),
  confirmCashPayment: (bookingId) => api.put(`/payments/bookings/${bookingId}/cash-confirm`),
  trackProvider: (id) => api.get(`/bookings/${id}/track`),
  downloadInvoice: (id) => api.get(`/bookings/${id}/invoice`, { responseType: 'blob' }),

  // Payments
  createOrder: (data) => api.post('/payments/create-order', data),
  verifyPayment: (data) => api.post('/payments/verify', data),
  getPaymentOptions: (bookingId) => api.get(`/payments/bookings/${bookingId}/options`),
  getWallet: () => api.get('/payments/wallet'),
  withdraw: (amount) => api.post('/payments/withdraw', { amount }),

  // Provider
  getMyProfile: () => api.get('/providers/me'),
  updateProfile: (data) => api.put('/providers/me', data),
  uploadKYC: (formData) => api.post('/providers/me/kyc', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  toggleAvailability: (data) => api.put('/providers/me/availability', data),
  updateServices: (serviceIds) => api.put('/providers/me/services', { serviceIds }),
  updateBankAccount: (data) => api.put('/providers/me/bank', data),
  getSchedule: (date) => api.get('/providers/me/schedule', { params: { date } }),
  getEarnings: (period) => api.get('/providers/me/earnings', { params: { period } }),
  getProviderPublic: (id) => api.get(`/providers/${id}`),
  updateProviderLocation: (data) => api.put('/providers/me/location', data),

  // Reviews
  createReview: (data) => api.post('/reviews', data),
  getProviderReviews: (providerId, params) => api.get(`/reviews/provider/${providerId}`, { params }),

  // Complaints
  createComplaint: (data) => api.post('/complaints', data),
  getMyComplaints: () => api.get('/complaints/my'),
  getComplaint: (ticketNumber) => api.get(`/complaints/${ticketNumber}`),
  addComplaintComment: (id, text) => api.post(`/complaints/${id}/comment`, { text }),
  // Provider complaint resolution workflow
  scheduleRevisit: (id, data) => api.post(`/complaints/${id}/revisit`, data),
  uploadResolutionProof: (id, formData) => api.post(`/complaints/${id}/proof`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  generateResolutionOtp: (id) => api.post(`/complaints/${id}/resolve/otp`),
  confirmResolutionOtp: (id, otp) => api.post(`/complaints/${id}/resolve/confirm`, { otp }),
  // Customer escalation
  escalateComplaint: (id, reason) => api.post(`/complaints/${id}/escalate`, { reason }),

  // On-Site Inspection & Detected Issues Quotation
  submitQuote: (id, data) => api.post(`/bookings/${id}/quote`, data),
  respondToQuote: (id, action) => api.put(`/bookings/${id}/quote/respond`, { action }),
  reportOffAppDeal: (id) => api.post(`/bookings/${id}/report-fraud`),



  // Notifications
  getNotifications: (params) => api.get('/notifications', { params }),
  markAllRead: () => api.put('/notifications/read-all'),
  markRead: (id) => api.put(`/notifications/${id}/read`),

  // Admin
  getDashboard: () => api.get('/admin/dashboard'),
  getAdminUsers: (params) => api.get('/admin/users', { params }),
  blockUser: (id, reason) => api.put(`/admin/users/${id}/block`, { reason }),
  unblockUser: (id) => api.put(`/admin/users/${id}/unblock`),
  getAdminProviders: (params) => api.get('/admin/providers', { params }),
  getAdminProviderById: (id) => api.get(`/admin/providers/${id}`),
  approveProvider: (id) => api.put(`/admin/providers/${id}/approve`),
  rejectProvider: (id, reason) => api.put(`/admin/providers/${id}/reject`, { reason }),
  warnProvider: (id, reason) => api.put(`/admin/providers/${id}/warn`, { reason }),
  blockProvider: (id, reason) => api.put(`/admin/providers/${id}/block`, { reason }),
  unblockProvider: (id) => api.put(`/admin/providers/${id}/unblock`),
  updateProviderTier: (id, tier) => api.put(`/admin/providers/${id}/tier`, { tier }),
  bulkApproveProviders: (providerIds) => api.post('/admin/providers/bulk-approve', { providerIds }),
  autoDistributeKyc: () => api.post('/admin/providers/auto-distribute-kyc'),
  approveBank: (id) => api.put(`/admin/providers/${id}/bank/approve`),
  rejectBank: (id) => api.put(`/admin/providers/${id}/bank/reject`),
  getAdminBookings: (params) => api.get('/admin/bookings', { params }),
  assignBooking: (id, providerId) => api.put(`/admin/bookings/${id}/assign`, { providerId }),
  forceCompleteBooking: (id, reason) => api.put(`/admin/bookings/${id}/force-complete`, { reason }),
  getFinancials: (params) => api.get('/admin/financials', { params }),
  getAdminPayouts: (params) => api.get('/admin/payouts', { params }),
  settlePayout: (id, data) => api.put(`/admin/payouts/${id}/settle`, data),
  getFraudAlerts: () => api.get('/admin/fraud/alerts'),
  createService: (data) => api.post('/admin/services', data),
  updateService: (id, data) => api.put(`/admin/services/${id}`, data),
  deleteService: (id) => api.delete(`/admin/services/${id}`),
  updateSurgePricing: (data) => api.put('/admin/pricing/surge', data),
  refundPayment: (data) => api.post('/payments/refund', data),
  // Admin Complaints
  getAdminComplaints: (params) => api.get('/admin/complaints', { params }),
  reassignComplaint: (id, action) => api.put(`/admin/complaints/${id}/reassign`, { action }),
  // Provider Wallet & Commission (Rapido Model)
  getProviderDues: (id) => api.get(`/admin/providers/${id}/dues`),
  adjustProviderWallet: (id, data) => api.put(`/admin/providers/${id}/wallet`, data),
  clearProviderDues: (id, data) => api.put(`/admin/providers/${id}/dues/clear`, data),
  // KYC Document Viewer — generates a fresh signed S3 URL on every call (private bucket, 1-hr link)
  getProviderKycDocs: (id) => api.get(`/admin/providers/${id}/kyc-docs`),
  createCommissionOrder: (data) => api.post('/payments/commission/create-order', data),
  verifyCommissionPayment: (data) => api.post('/payments/commission/verify', data),
  // Team Management
  getAdminTeam: () => api.get('/admin/team'),
  getTeamWorkload: () => api.get('/admin/team/workload'),
  createTeamMember: (data) => api.post('/admin/team', data),
  updateTeamMember: (id, data) => api.put(`/admin/team/${id}`, data),
  markStaffResigned: (id) => api.put(`/admin/team/${id}/resign`),
  deleteStaffMember: (id) => api.delete(`/admin/team/${id}`),
  

  
  // Team Hierarchy
  createTeam: (data) => api.post('/admin/teams', data),
  getTeamHierarchy: () => api.get('/admin/teams/hierarchy'),
  
  // Announcements
  broadcastAnnouncement: (data) => api.post('/admin/announcements', data),
  
  // Attendance
  checkIn: (data) => api.post('/attendance/check-in', data),
  checkOut: () => api.post('/attendance/check-out'),
  getMyAttendance: (params) => api.get('/attendance/me', { params }),

  // Hiring / Candidates (Admin)
  getCandidates: (params) => api.get('/admin/candidates', { params }),
  updateCandidateStatus: (id, data) => api.put(`/admin/candidates/${id}/status`, data),
  onboardCandidate: (id) => api.post(`/admin/candidates/${id}/onboard`),

  // System Settings & Branding Media (Bagisto Style)
  getAdminSettings: () => api.get('/admin/settings'),
  updateAdminSettings: (data) => api.put('/admin/settings', data),
  getPublicSettings: () => api.get('/services/public-settings'),

  // Invoice & GST Customization System
  getAdminInvoiceSettings: () => api.get('/admin/invoice-settings'),
  updateAdminInvoiceSettings: (data) => api.put('/admin/invoice-settings', data),
  resetAdminInvoiceSettings: () => api.post('/admin/invoice-settings/reset'),
  downloadSampleInvoicePdf: (data) => api.post('/admin/invoice-settings/preview', data, { responseType: 'blob' }),
};

export default api;
