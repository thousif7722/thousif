import React, { useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser, selectUserRole } from '@/store/slices/authSlice';
import { fetchServices, fetchCategories, fetchPublicSettings, selectPublicSettings } from '@/store/slices/serviceSlice';
import { connectSocket, disconnectSocket } from '@/services/socket';
import LoadingScreen from '@/components/common/LoadingScreen';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import toast from 'react-hot-toast';

// ── Lazy-loaded pages ──────────────────────────────────────────────────────────
const LoginPage        = lazy(() => import('@/pages/LoginPage'));
const HomePage         = lazy(() => import('@/pages/customer/HomePage'));
const ServiceDetail    = lazy(() => import('@/pages/customer/ServiceDetail'));
const BookingForm      = lazy(() => import('@/pages/customer/BookingForm'));
const BookingDetail    = lazy(() => import('@/pages/customer/BookingDetail'));
const MyBookings       = lazy(() => import('@/pages/customer/MyBookings'));
const CustomerComplaints = lazy(() => import('@/pages/customer/CustomerComplaints'));

const TrackingPage     = lazy(() => import('@/pages/customer/TrackingPage'));
const PaymentPage      = lazy(() => import('@/pages/customer/PaymentPage'));
const PlusMembership   = lazy(() => import('@/pages/customer/PlusMembership'));
const ProfilePage      = lazy(() => import('@/pages/customer/ProfilePage'));
const ProviderDashboard= lazy(() => import('@/pages/provider/ProviderDashboard'));
const ProviderBookings = lazy(() => import('@/pages/provider/ProviderBookings'));
const ProviderEarnings = lazy(() => import('@/pages/provider/ProviderEarnings'));
const ProviderProfile  = lazy(() => import('@/pages/provider/ProviderProfile'));
const MaterialsBilling = lazy(() => import('@/pages/provider/MaterialsBilling'));
const ProviderComplaints = lazy(() => import('@/pages/provider/ProviderComplaints'));
const ProviderLockoutGuard = lazy(() => import('@/components/provider/ProviderLockoutGuard'));

const AdminDashboard   = lazy(() => import('@/pages/admin/AdminDashboard'));
const AdminUsers       = lazy(() => import('@/pages/admin/AdminUsers'));
const AdminProviders   = lazy(() => import('@/pages/admin/AdminProviders'));
const AdminBookings    = lazy(() => import('@/pages/admin/AdminBookings'));
const AdminFinancials  = lazy(() => import('@/pages/admin/AdminFinancials'));
const AdminServices    = lazy(() => import('@/pages/admin/AdminServices'));
const AdminTeam        = lazy(() => import('@/pages/admin/AdminTeam'));
const AdminComplaints  = lazy(() => import('@/pages/admin/AdminComplaints'));
const AdminAnnouncements = lazy(() => import('@/pages/admin/AdminAnnouncements'));
const AdminSettings     = lazy(() => import('@/pages/admin/AdminSettings'));
const AdminInvoiceSettings = lazy(() => import('@/pages/admin/AdminInvoiceSettings'));
const CategoryServicesPage = lazy(() => import('@/pages/customer/CategoryServicesPage'));
const NotificationsPage  = lazy(() => import('@/pages/shared/NotificationsPage'));
const PrivacyPolicy = lazy(() => import('@/pages/public/PrivacyPolicy'));
const TermsOfService = lazy(() => import('@/pages/public/TermsOfService'));
const Instructions = lazy(() => import('@/pages/public/Instructions'));
const Careers = lazy(() => import('@/pages/public/Careers'));
const PublicServicePage = lazy(() => import('@/pages/public/PublicServicePage'));
const GlobalJobAcceptModal = lazy(() => import('@/components/provider/GlobalJobAcceptModal'));

// ── Protected Route wrapper ────────────────────────────────────────────────────
function ProtectedRoute({ children, allowedRoles, requiredPermission }) {
  const user = useSelector(selectUser);
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={getRoleHome(user.role)} replace />;
  }
  if (user.role === 'staff' && requiredPermission) {
    const permissions = user.permissions || [];
    if (!permissions.includes(requiredPermission)) {
      toast.error(`Permission Denied: Staff account lacks '${requiredPermission}' permission.`);
      return <Navigate to="/admin" replace />;
    }
  }
  return children;
}

function getRoleHome(role) {
  if (role === 'admin' || role === 'staff') return '/admin';
  if (role === 'provider') return '/provider';
  return '/';
}

export default function App() {
  const user = useSelector(selectUser);
  const settings = useSelector(selectPublicSettings);
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(fetchCategories());
    dispatch(fetchServices());
    dispatch(fetchPublicSettings());
  }, [dispatch]);

  useEffect(() => {
    if (settings?.siteName) {
      document.title = `${settings.siteName} - ${settings.tagline || 'Home Services'}`;
    }
    if (settings?.faviconUrl) {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = settings.faviconUrl;
    }
  }, [settings]);

  useEffect(() => {
    if (user) {
      connectSocket();
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    } else {
      disconnectSocket();
    }
    return () => {};
  }, [user]);

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingScreen />}>
        <GlobalJobAcceptModal />
        <Routes>
        {/* Public */}
        <Route path="/login" element={user ? <Navigate to={getRoleHome(user.role)} replace /> : <LoginPage />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="/instructions" element={<Instructions />} />
        <Route path="/careers" element={<Careers />} />
        <Route path="/service/:slug" element={<PublicServicePage />} />

        {/* Customer */}
        <Route path="/" element={<ProtectedRoute allowedRoles={['customer']}><HomePage /></ProtectedRoute>} />
        <Route path="/category/:categoryName" element={<ProtectedRoute allowedRoles={['customer']}><CategoryServicesPage /></ProtectedRoute>} />
        <Route path="/services/:id" element={<ProtectedRoute allowedRoles={['customer']}><ServiceDetail /></ProtectedRoute>} />
        <Route path="/book/:serviceId" element={<ProtectedRoute allowedRoles={['customer']}><BookingForm /></ProtectedRoute>} />
        <Route path="/bookings" element={<ProtectedRoute allowedRoles={['customer']}><MyBookings /></ProtectedRoute>} />
        <Route path="/complaints" element={<ProtectedRoute allowedRoles={['customer']}><CustomerComplaints /></ProtectedRoute>} />

        <Route path="/bookings/:id" element={<ProtectedRoute allowedRoles={['customer']}><BookingDetail /></ProtectedRoute>} />
        <Route path="/bookings/:id/track" element={<Navigate to="/bookings/:id" replace />} />
        <Route path="/bookings/:id/pay" element={<ProtectedRoute allowedRoles={['customer']}><PaymentPage /></ProtectedRoute>} />
        <Route path="/plus" element={<ProtectedRoute allowedRoles={['customer']}><PlusMembership /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute allowedRoles={['customer']}><ProfilePage /></ProtectedRoute>} />

        {/* Shared */}
        <Route path="/notifications" element={<ProtectedRoute allowedRoles={['customer', 'provider', 'admin', 'staff']}><NotificationsPage /></ProtectedRoute>} />

        {/* Provider */}
        <Route path="/provider" element={<ProtectedRoute allowedRoles={['provider']}><ProviderLockoutGuard><ProviderDashboard /></ProviderLockoutGuard></ProtectedRoute>} />
        <Route path="/provider/bookings" element={<ProtectedRoute allowedRoles={['provider']}><ProviderLockoutGuard><ProviderBookings /></ProviderLockoutGuard></ProtectedRoute>} />
        <Route path="/provider/bookings/:id/materials" element={<ProtectedRoute allowedRoles={['provider']}><ProviderLockoutGuard><MaterialsBilling /></ProviderLockoutGuard></ProtectedRoute>} />
        <Route path="/provider/earnings" element={<ProtectedRoute allowedRoles={['provider']}><ProviderLockoutGuard><ProviderEarnings /></ProviderLockoutGuard></ProtectedRoute>} />
        <Route path="/provider/profile" element={<ProtectedRoute allowedRoles={['provider']}><ProviderLockoutGuard><ProviderProfile /></ProviderLockoutGuard></ProtectedRoute>} />
        <Route path="/provider/complaints" element={<ProtectedRoute allowedRoles={['provider']}><ProviderLockoutGuard><ProviderComplaints /></ProviderLockoutGuard></ProtectedRoute>} />


        {/* Admin & Staff Permission Guarded Routes */}
        <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin', 'staff']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['admin', 'staff']} requiredPermission="manage_users"><AdminUsers /></ProtectedRoute>} />
        <Route path="/admin/providers" element={<ProtectedRoute allowedRoles={['admin', 'staff']} requiredPermission="manage_providers"><AdminProviders /></ProtectedRoute>} />
        <Route path="/admin/bookings" element={<ProtectedRoute allowedRoles={['admin', 'staff']} requiredPermission="manage_bookings"><AdminBookings /></ProtectedRoute>} />
        <Route path="/admin/financials" element={<ProtectedRoute allowedRoles={['admin', 'staff']} requiredPermission="manage_financials"><AdminFinancials /></ProtectedRoute>} />
        <Route path="/admin/services" element={<ProtectedRoute allowedRoles={['admin', 'staff']} requiredPermission="manage_services"><AdminServices /></ProtectedRoute>} />
        <Route path="/admin/complaints" element={<ProtectedRoute allowedRoles={['admin', 'staff']} requiredPermission="manage_complaints"><AdminComplaints /></ProtectedRoute>} />
        <Route path="/admin/team" element={<ProtectedRoute allowedRoles={['admin']}><AdminTeam /></ProtectedRoute>} />
        <Route path="/admin/announcements" element={<ProtectedRoute allowedRoles={['admin', 'staff']} requiredPermission="manage_announcements"><AdminAnnouncements /></ProtectedRoute>} />
        <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={['admin']}><AdminSettings /></ProtectedRoute>} />
        <Route path="/admin/invoice-settings" element={<ProtectedRoute allowedRoles={['admin', 'staff']} requiredPermission="manage_financials"><AdminInvoiceSettings /></ProtectedRoute>} />
        <Route path="/admin/settings/invoice" element={<ProtectedRoute allowedRoles={['admin', 'staff']} requiredPermission="manage_financials"><AdminInvoiceSettings /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to={user ? getRoleHome(user.role) : '/login'} replace />} />
      </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
