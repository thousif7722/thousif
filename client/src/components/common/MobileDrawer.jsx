import React, { useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { 
  X, User, Home, BookOpen, Heart, MapPin, 
  CreditCard, Bell, Tag, HelpCircle, Settings, LogOut, ChevronRight
} from 'lucide-react';
import { logout, selectUser } from '@/store/slices/authSlice';
import { apiService } from '@/services/api';
import { stopLocationTracking, toggleProviderAvailability } from '@/services/socket';

export default function MobileDrawer({ isOpen, onClose }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector(selectUser);

  // Prevent background scroll when opened
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => { document.body.style.overflow = 'auto'; };
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleLogout() {
    if (user?.role === 'provider') {
      try {
        toggleProviderAvailability(false);
        await apiService.toggleAvailability({ isOnline: false });
      } catch {}
      stopLocationTracking();
    }
    dispatch(logout());
    onClose();
    navigate('/login');
  }

  const isProviderRoute = location.pathname.startsWith('/provider');
  const isCustomer = !isProviderRoute;

  const menuItems = isCustomer ? [
    { to: '/', label: 'Home', icon: Home },
    { to: '/profile', label: 'My Profile', icon: User },
    { to: '/bookings', label: 'My Bookings', icon: BookOpen },
    { to: '/saved', label: 'Saved', icon: Heart },
    { to: '/profile/addresses', label: 'Addresses', icon: MapPin },
    { to: '/profile/payments', label: 'Payments', icon: CreditCard },
    { to: '/notifications', label: 'Notifications', icon: Bell },
    { to: '/offers', label: 'Offers', icon: Tag },
    { to: '/help', label: 'Help', icon: HelpCircle },
    { to: '/settings', label: 'Settings', icon: Settings }
  ] : [
    { to: '/provider', label: 'Dashboard', icon: Home },
    { to: '/provider/profile', label: 'My Profile', icon: User },
    { to: '/provider/bookings', label: 'My Jobs', icon: BookOpen },
    { to: '/provider/earnings', label: 'Earnings', icon: CreditCard },
    { to: '/provider/complaints', label: 'Complaints', icon: HelpCircle },
    { to: '/provider/settings', label: 'Settings', icon: Settings }
  ];

  return (
    <div className="fixed inset-0 z-[60] flex md:hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        style={{ animation: 'fadeIn 0.2s ease-out' }}
      ></div>

      {/* Drawer */}
      <div 
        className="absolute right-0 top-0 bottom-0 w-[85vw] max-w-sm bg-white rounded-l-3xl shadow-2xl flex flex-col overflow-hidden"
        style={{ animation: 'slideRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div className="flex items-center justify-between p-5 pb-4 border-b border-slate-50">
          <h2 className="font-bold text-lg text-slate-800 tracking-tight">Menu</h2>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-600 hover:bg-slate-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pb-safe">
          {/* Profile Card */}
          {user ? (
            <div className="px-5 py-6 bg-slate-50 border-b border-slate-100 relative group">
              <Link 
                to={isCustomer ? "/profile/edit" : "/provider/profile"}
                onClick={onClose}
                className="absolute top-6 right-5 text-slate-400 hover:text-primary-600 bg-white p-2 rounded-full border border-slate-200 shadow-sm"
              >
                <Settings size={14} />
              </Link>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-primary-500 to-indigo-500 text-white flex items-center justify-center font-bold text-xl shadow-md border-2 border-white">
                  {user.name?.[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-lg leading-tight flex items-center gap-2 group/edit cursor-pointer">
                    <span onClick={() => {
                        const newName = prompt('Enter your new name:', user.name);
                        if(newName && newName !== user.name) {
                            // Call API to update and dispatch to save in state silently
                            apiService.updateProfile({ name: newName }).then(res => {
                                dispatch({ type: 'auth/setUser', payload: res.user });
                            }).catch(() => alert('Failed to update name'));
                        }
                    }}>
                      {user.name || 'User'}
                    </span>
                    <span className="text-slate-300 group-hover/edit:text-primary-500 text-xs transition-colors" onClick={() => {
                        const newName = prompt('Enter your new name:', user.name);
                        if(newName && newName !== user.name) {
                            apiService.updateProfile({ name: newName }).then(res => {
                                dispatch({ type: 'auth/setUser', payload: res.user });
                                window.location.reload();
                            }).catch(() => alert('Failed to update name'));
                        }
                    }}>✎</span>
                  </h3>
                  <p className="text-slate-500 text-sm mt-0.5">{user.phone}</p>
                </div>
              </div>
              {isCustomer && (
                <div className="mt-4 bg-white rounded-xl p-3 border border-amber-100 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-500 text-lg">★</span>
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        {user.isPlusMember || user.subscription?.isPlusMember ? 'Plus Member' : 'Standard Plan'}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {user.isPlusMember || user.subscription?.isPlusMember ? 'Active Subscription' : 'Upgrade for benefits'}
                      </p>
                    </div>
                  </div>
                  {!(user.isPlusMember || user.subscription?.isPlusMember) && (
                    <Link to="/plus" onClick={onClose} className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                      Upgrade
                    </Link>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="px-5 py-6 bg-primary-50 border-b border-primary-100 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-slate-800 text-lg">Welcome!</h3>
                <p className="text-slate-500 text-xs mt-1">Login to access your bookings</p>
              </div>
              <Link to="/login" onClick={onClose} className="bg-primary-600 text-white font-bold py-2 px-4 rounded-xl shadow-sm text-sm">
                Login
              </Link>
            </div>
          )}

          {/* Role Switcher for Approved Providers */}
          {(user?.role === 'provider' || user?.isProvider || user?.providerStatus === 'approved') && (
            <div className="px-5 pt-3 pb-1">
              <button
                onClick={() => {
                  onClose();
                  if (location.pathname.startsWith('/provider')) {
                    navigate('/');
                  } else {
                    navigate('/provider');
                  }
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-xs shadow-md transition-all"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{location.pathname.startsWith('/provider') ? '🛒' : '⚡'}</span>
                  <span>{location.pathname.startsWith('/provider') ? 'Switch to Customer Panel' : 'Switch to Provider Dashboard'}</span>
                </div>
                <ChevronRight size={14} />
              </button>
            </div>
          )}

          {/* Links */}
          <div className="py-2 px-3">
            {menuItems.map((item, idx) => {
              const isActive = location.pathname === item.to;
              return (
                <Link
                  key={idx}
                  to={item.to}
                  onClick={onClose}
                  className={`flex items-center justify-between p-3 rounded-2xl mb-1 transition-colors ${
                    isActive ? 'bg-primary-50 text-primary-700' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon size={20} className={isActive ? 'text-primary-600' : 'text-slate-400'} />
                    <span className="font-semibold text-[15px]">{item.label}</span>
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                </Link>
              );
            })}
          </div>

          <div className="px-6 py-4">
            <div className="h-px bg-slate-100 w-full mb-4"></div>
            {user && (
              <button 
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 font-extrabold text-sm py-3.5 rounded-2xl hover:bg-red-100 transition-colors border border-red-100"
              >
                <LogOut size={18} /> Log out
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
    </div>
  );
}
