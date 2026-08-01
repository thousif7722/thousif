import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Bell, LogOut, User, Menu, X, Home, BookOpen,
  Briefcase, DollarSign, Settings, Shield, BarChart2, AlertTriangle,
  MapPin, ChevronDown, Navigation, Check, Search,
} from 'lucide-react';

import { logout, selectUser } from '@/store/slices/authSlice';
import { selectUnreadCount, markAllRead } from '@/store/slices/notificationSlice';
import { fetchNotifications, selectNotifications } from '@/store/slices/notificationSlice';
import { selectPublicSettings } from '@/store/slices/serviceSlice';
import { apiService } from '@/services/api';
import { stopLocationTracking, toggleProviderAvailability } from '@/services/socket';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);

const NAV_LINKS = {
  customer: [
    { to: '/',            label: 'Home',       icon: Home },
    { to: '/bookings',    label: 'Bookings',   icon: BookOpen },
    { to: '/complaints',  label: 'Complaints', icon: AlertTriangle },
    { to: '/profile',     label: 'Profile',    icon: User },
  ],

  provider: [
    { to: '/provider',              label: 'Dashboard',  icon: Home },
    { to: '/provider/bookings',     label: 'Jobs',        icon: Briefcase },
    { to: '/provider/complaints',   label: 'Complaints',  icon: AlertTriangle },
    { to: '/provider/earnings',     label: 'Earnings',    icon: DollarSign },
    { to: '/provider/profile',      label: 'Profile',     icon: Settings },
  ],
};

const ALL_INDIAN_CITIES = [
  // Metros & Tier 1
  'Hyderabad', 'Bengaluru', 'Mumbai', 'Delhi NCR', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad',
  // Tier 2 & Major Cities
  'Jaipur', 'Lucknow', 'Chandigarh', 'Kochi', 'Visakhapatnam', 'Surat', 'Indore', 'Patna',
  'Bhopal', 'Nagpur', 'Coimbatore', 'Vadodara', 'Bhubaneswar', 'Ludhiana', 'Agra', 'Nashik',
  'Vijayawada', 'Varanasi', 'Guwahati', 'Mysuru', 'Dehradun', 'Kanpur', 'Amritsar', 'Rajkot',
  'Jammu', 'Ranchi', 'Goa', 'Raipur', 'Thiruvananthapuram', 'Madurai', 'Kozhikode', 'Mangaluru',
  'Puducherry', 'Udaipur', 'Jodhpur', 'Bareilly', 'Meerut', 'Gwalior', 'Noida', 'Gurugram',
  'Faridabad', 'Ghaziabad', 'Aurangabad', 'Solapur', 'Jalandhar', 'Tiruchirappalli', 'Hubballi',
  'Salem', 'Warangal', 'Rourkela', 'Siliguri', 'Prayagraj', 'Aligarh', 'Moradabad', 'Gorakhpur'
];

export default function Header() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector(selectUser);
  const settings = useSelector(selectPublicSettings);
  const unreadCount = useSelector(selectUnreadCount);
  const notifications = useSelector(selectNotifications);

  const siteName = settings?.siteName || 'ServiceHub';
  const logoUrl = settings?.logoUrl;

  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [detectingGps, setDetectingGps] = useState(false);
  const [citySearchQuery, setCitySearchQuery] = useState('');
  
  // Stored location state
  const [currentLocation, setCurrentLocation] = useState(() => {
    try {
      const saved = localStorage.getItem('sh_current_location');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const notifRef = useRef(null);
  const locRef = useRef(null);

  const role = user?.role || 'customer';
  let links = NAV_LINKS[role] || NAV_LINKS.customer;

  if (role === 'admin' || role === 'staff') {
    const p = user?.permissions || [];
    const has = (perm) => role === 'admin' || p.includes(perm);

    links = [{ to: '/admin', label: 'Dashboard', icon: BarChart2 }];
    
    if (has('manage_bookings')) links.push({ to: '/admin/bookings', label: 'Bookings', icon: BookOpen });
    if (has('manage_providers')) links.push({ to: '/admin/providers', label: 'Providers', icon: Shield });
    if (has('manage_complaints')) links.push({ to: '/admin/complaints', label: 'Complaints', icon: Bell });
    if (has('manage_financials')) links.push({ to: '/admin/financials', label: 'Financials', icon: DollarSign });
    if (has('manage_services')) links.push({ to: '/admin/services', label: 'Services', icon: Briefcase });
    if (has('manage_users')) links.push({ to: '/admin/users', label: 'Users', icon: User });
    
    if (role === 'admin') {
      links.push({ to: '/admin/team', label: 'Team', icon: Briefcase });
      links.push({ to: '/admin/announcements', label: 'Broadcast', icon: Bell });
      links.push({ to: '/admin/settings', label: 'Settings', icon: Settings });
    }
  }

  useEffect(() => {
    if (user) dispatch(fetchNotifications());
  }, [user, dispatch]);

  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (locRef.current && !locRef.current.contains(e.target)) setLocationModalOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Auto-detect GPS on first mount if no saved location
  useEffect(() => {
    if (!currentLocation && role === 'customer' && navigator.geolocation) {
      handleDetectGps(true);
    }
  }, []);

  async function handleDetectGps(silent = false) {
    if (!navigator.geolocation) return;
    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const data = await res.json();
          const addr = data.address || {};
          const locObj = {
            area: addr.suburb || addr.neighbourhood || addr.road || addr.residential || '',
            city: addr.city || addr.town || addr.village || addr.county || 'Hyderabad',
            state: addr.state || '',
            lat,
            lng
          };
          setCurrentLocation(locObj);
          localStorage.setItem('sh_current_location', JSON.stringify(locObj));
        } catch {
          const fallback = { area: '', city: 'Hyderabad', lat, lng };
          setCurrentLocation(fallback);
          localStorage.setItem('sh_current_location', JSON.stringify(fallback));
        } finally {
          setDetectingGps(false);
          setLocationModalOpen(false);
        }
      },
      (err) => {
        setDetectingGps(false);
        if (!currentLocation) {
          const defaultLoc = { area: 'Main Market', city: user?.addresses?.[0]?.city || 'Hyderabad' };
          setCurrentLocation(defaultLoc);
          localStorage.setItem('sh_current_location', JSON.stringify(defaultLoc));
        }
      },
      { timeout: 8000 }
    );
  }

  function handleSelectCustomCity(cityName) {
    const locObj = { area: 'Central', city: cityName };
    setCurrentLocation(locObj);
    localStorage.setItem('sh_current_location', JSON.stringify(locObj));
    setLocationModalOpen(false);
    setCitySearchQuery('');
  }

  async function handleLogout() {
    if (role === 'provider') {
      try {
        toggleProviderAvailability(false);
        await apiService.toggleAvailability({ isOnline: false });
      } catch {}
      stopLocationTracking();
    }
    dispatch(logout());
    navigate('/login');
  }

  function handleNotifOpen() {
    setNotifOpen(v => !v);
    if (!notifOpen && unreadCount > 0) {
      dispatch(markAllRead());
    }
  }

  const isAnnouncementVisible = settings?.announcementActive !== false && settings?.announcementText;
  const displayLocationText = currentLocation
    ? `${currentLocation.area ? currentLocation.area + ', ' : ''}${currentLocation.city}`
    : user?.addresses?.[0]?.city || 'Select Location';

  const filteredCities = ALL_INDIAN_CITIES.filter(c =>
    c.toLowerCase().includes(citySearchQuery.toLowerCase())
  );

  return (
    <>
      <header className="sticky top-0 left-0 right-0 z-50 bg-white border-b border-slate-100 shadow-sm">
        {/* Top Announcement Bar */}
        {isAnnouncementVisible && (
          <div className="bg-slate-900 text-white text-[11px] sm:text-xs font-semibold py-1.5 px-4 text-center tracking-wide overflow-hidden whitespace-nowrap text-ellipsis">
            {settings.announcementText}
          </div>
        )}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2 xl:gap-4">
          {/* Logo & Location Detection */}
          <div className="flex items-center gap-3 shrink-0">
            <Link to={role === 'admin' ? '/admin' : role === 'provider' ? '/provider' : '/'} className="flex items-center gap-1.5">
              {logoUrl && logoUrl !== '/logo.png' ? (
                <img src={logoUrl} alt={siteName} className="h-8 w-auto object-contain max-w-[140px]" />
              ) : (
                <span className="text-lg xl:text-xl font-bold text-primary-700">⚡ {siteName}</span>
              )}
              {role !== 'customer' && (
                <span className={`text-[10px] xl:text-xs font-semibold px-2 py-0.5 rounded-full ${role === 'admin' ? 'bg-red-100 text-red-700' : role === 'staff' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                  {role === 'admin' ? 'Admin' : role === 'staff' ? 'Staff' : 'Pro'}
                </span>
              )}
              {role === 'customer' && (user?.isPlusMember || user?.subscription?.isPlusMember) && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 text-white shadow-sm uppercase tracking-wider ml-1">
                  ★ Plus
                </span>
              )}
            </Link>

            {/* Location Selector (Upper Side Header Format - Urban Company / Swiggy style) */}
            {role === 'customer' && (
              <div className="relative" ref={locRef}>
                <button
                  onClick={() => setLocationModalOpen(v => !v)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 transition-all text-xs font-semibold group max-w-[160px] sm:max-w-[220px] truncate"
                  title="Select Service Location"
                >
                  <MapPin size={15} className="text-primary-600 shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="truncate">
                    {detectingGps ? 'Locating...' : displayLocationText}
                  </span>
                  <ChevronDown size={13} className={`text-slate-400 shrink-0 transition-transform ${locationModalOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Location Picker Popover / Modal */}
                {locationModalOpen && (
                  <div className="absolute left-0 top-11 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200 max-h-[85vh] flex flex-col">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Select Service City</span>
                      <button onClick={() => setLocationModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">&times;</button>
                    </div>

                    {/* Detect GPS Button */}
                    <button
                      onClick={() => handleDetectGps(false)}
                      disabled={detectingGps}
                      className="w-full mb-3 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-primary-50 hover:bg-primary-100 text-primary-700 font-bold text-xs transition-colors border border-primary-200 shrink-0"
                    >
                      <Navigation size={15} className={`text-primary-600 ${detectingGps ? 'animate-spin' : ''}`} />
                      {detectingGps ? 'Detecting Location via GPS...' : 'Use Current GPS Location'}
                    </button>

                    {/* City Search Bar */}
                    <div className="relative mb-3 shrink-0">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={citySearchQuery}
                        onChange={(e) => setCitySearchQuery(e.target.value)}
                        placeholder="Search your city in India..."
                        className="w-full bg-slate-50 border border-slate-200 pl-9 pr-8 py-2 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                      />
                      {citySearchQuery && (
                        <button
                          onClick={() => setCitySearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm font-bold"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Saved Addresses (if available) */}
                    {user?.addresses?.length > 0 && !citySearchQuery && (
                      <div className="mb-3 space-y-1 shrink-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Saved Addresses</span>
                        {user.addresses.map((addr, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSelectCustomCity(addr.city || 'Hyderabad')}
                            className="w-full text-left p-2 rounded-lg hover:bg-slate-50 flex items-center justify-between text-xs transition-colors"
                          >
                            <div className="truncate">
                              <p className="font-semibold text-slate-800">{addr.city}</p>
                              <p className="text-[11px] text-slate-400 truncate">{addr.line1}</p>
                            </div>
                            {currentLocation?.city === addr.city && <Check size={14} className="text-primary-600 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Scrollable Indian Cities Grid */}
                    <div className="space-y-1 overflow-y-auto max-h-56 pr-1 custom-scrollbar">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {citySearchQuery ? `Search Results (${filteredCities.length})` : 'All Indian Cities'}
                        </span>
                      </div>

                      {filteredCities.length > 0 ? (
                        <div className="grid grid-cols-2 gap-1.5">
                          {filteredCities.map((city) => (
                            <button
                              key={city}
                              onClick={() => handleSelectCustomCity(city)}
                              className={`py-1.5 px-2.5 rounded-lg text-xs font-medium text-left transition-colors flex items-center justify-between ${
                                currentLocation?.city === city
                                  ? 'bg-primary-600 text-white font-bold'
                                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                              }`}
                            >
                              <span className="truncate">{city}</span>
                              {currentLocation?.city === city && <Check size={12} className="text-white shrink-0 ml-1" />}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="py-4 text-center">
                          <p className="text-xs text-slate-500">No city matching "{citySearchQuery}"</p>
                          <button
                            onClick={() => handleSelectCustomCity(citySearchQuery)}
                            className="mt-2 text-xs font-bold text-primary-600 hover:underline"
                          >
                            Use "{citySearchQuery}" as location
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5 xl:gap-1.5 overflow-x-auto no-scrollbar max-w-[70%]">
            {links.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 px-2 xl:px-3 py-1.5 rounded-lg text-xs xl:text-sm font-medium whitespace-nowrap transition-colors ${
                  location.pathname === to
                    ? 'bg-primary-50 text-primary-700 font-bold'
                    : 'text-slate-600 hover:text-primary-600 hover:bg-slate-50'
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            ))}
            {role === 'customer' && !(user?.isPlusMember || user?.subscription?.isPlusMember) && (
              <Link
                to="/plus"
                className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors shadow-sm shrink-0"
              >
                ★ Get Plus
              </Link>
            )}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={handleNotifOpen}
                className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-600"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-elevated border border-slate-100 overflow-hidden z-50">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-800 text-sm">Notifications</h3>
                    {unreadCount > 0 && <span className="text-xs text-primary-600 font-medium">{unreadCount} new</span>}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-sm">No notifications yet</div>
                    ) : (
                      notifications.slice(0, 15).map((n, i) => (
                        <div key={i} className={`px-4 py-3 ${!n.isRead ? 'bg-primary-50/50' : 'hover:bg-slate-50'} transition-colors`}>
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <p className="text-sm font-medium text-slate-800">{n.title}</p>
                              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.body}</p>
                            </div>
                            {!n.isRead && <div className="w-2 h-2 rounded-full bg-primary-500 shrink-0 mt-1" />}
                          </div>
                          <p className="text-xs text-slate-400 mt-1">{dayjs(n.createdAt).fromNow()}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User avatar */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm">
                {user?.name?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="hidden lg:block">
                <p className="text-xs font-semibold text-slate-800 leading-none">{user?.name || 'User'}</p>
                <p className="text-[10px] text-slate-400">{user?.phone}</p>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
              title="Logout"
            >
              <LogOut size={18} />
            </button>

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-xl hover:bg-slate-100 text-slate-600"
              onClick={() => setMenuOpen(v => !v)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white px-4 py-3 flex flex-col gap-1">
            {links.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium ${
                  location.pathname === to ? 'bg-primary-50 text-primary-700' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon size={17} /> {label}
              </Link>
            ))}
          </div>
        )}
      </header>
    </>
  );
}
