import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Bell, LogOut, User, Home, BookOpen,
  Briefcase, DollarSign, Settings, Shield, BarChart2, AlertTriangle,
  MapPin, ChevronDown, Navigation, Check, Search, Menu, FileText, Globe
} from 'lucide-react';

import { logout, selectUser } from '@/store/slices/authSlice';
import { selectUnreadCount, markAllRead, fetchNotifications, selectNotifications } from '@/store/slices/notificationSlice';
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
  'Hyderabad', 'Bengaluru', 'Mumbai', 'Delhi NCR', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad',
  'Jaipur', 'Lucknow', 'Chandigarh', 'Kochi', 'Visakhapatnam', 'Surat', 'Indore', 'Patna',
  'Bhopal', 'Nagpur', 'Coimbatore', 'Vadodara', 'Bhubaneswar', 'Ludhiana', 'Agra', 'Nashik',
  'Vijayawada', 'Varanasi', 'Guwahati', 'Mysuru', 'Dehradun', 'Kanpur', 'Amritsar', 'Rajkot',
  'Jammu', 'Ranchi', 'Goa', 'Raipur', 'Thiruvananthapuram', 'Madurai', 'Kozhikode', 'Mangaluru',
  'Puducherry', 'Udaipur', 'Jodhpur', 'Bareilly', 'Meerut', 'Gwalior', 'Noida', 'Gurugram',
  'Faridabad', 'Ghaziabad', 'Aurangabad', 'Solapur', 'Jalandhar', 'Tiruchirappalli', 'Hubballi',
  'Salem', 'Warangal', 'Rourkela', 'Siliguri', 'Prayagraj', 'Aligarh', 'Moradabad', 'Gorakhpur'
];

export default function DesktopHeader() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector(selectUser);
  const settings = useSelector(selectPublicSettings);
  const unreadCount = useSelector(selectUnreadCount);
  const notifications = useSelector(selectNotifications);

  const siteName = settings?.siteName || 'OneWayFix';
  const logoUrl = settings?.logoUrl;

  const [notifOpen, setNotifOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [detectingGps, setDetectingGps] = useState(false);
  const [citySearchQuery, setCitySearchQuery] = useState('');
  
  const [currentLocation, setCurrentLocation] = useState(() => {
    try {
      const saved = localStorage.getItem('sh_current_location');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const notifRef = useRef(null);
  const locRef = useRef(null);

  const role = user?.role || 'customer';
  let links = NAV_LINKS[role] || NAV_LINKS.customer;

  const [moreToolsOpen, setMoreToolsOpen] = useState(false);
  const moreToolsRef = useRef(null);

  const p = user?.permissions || [];
  const has = (perm) => role === 'admin' || p.includes(perm);

  let secondaryAdminLinks = [];

  if (role === 'admin' || role === 'staff') {
    links = [{ to: '/admin', label: 'Dashboard', icon: BarChart2 }];
    if (has('manage_bookings')) links.push({ to: '/admin/bookings', label: 'Bookings', icon: BookOpen });
    if (has('manage_providers')) links.push({ to: '/admin/providers', label: 'Providers', icon: Shield });
    if (has('manage_complaints')) links.push({ to: '/admin/complaints', label: 'Complaints', icon: AlertTriangle });
    if (has('manage_financials')) links.push({ to: '/admin/financials', label: 'Financials', icon: DollarSign });
    if (role === 'admin') links.push({ to: '/admin/settings', label: 'Settings', icon: Settings });

    // Secondary Admin / Staff links placed inside the 'More' dropdown
    if (has('manage_financials')) {
      secondaryAdminLinks.push({ to: '/admin/invoice-settings', label: 'Invoice & GST Engine', icon: FileText });
    }
    if (has('manage_services')) secondaryAdminLinks.push({ to: '/admin/services', label: 'Services Catalog', icon: Briefcase });
    if (has('manage_users')) secondaryAdminLinks.push({ to: '/admin/users', label: 'User Directory', icon: User });
    if (role === 'admin') {
      secondaryAdminLinks.push({ to: '/admin/team', label: 'Team & Staff', icon: Briefcase });
      secondaryAdminLinks.push({ to: '/admin/announcements', label: 'Broadcast & Reels', icon: Bell });
      secondaryAdminLinks.push({ to: '/admin/settings/branding', label: 'S3 Branding Assets', icon: Globe });
    }
  }

  useEffect(() => {
    if (user) dispatch(fetchNotifications());
  }, [user, dispatch]);

  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (locRef.current && !locRef.current.contains(e.target)) setLocationModalOpen(false);
      if (moreToolsRef.current && !moreToolsRef.current.contains(e.target)) setMoreToolsOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, { headers: { 'Accept-Language': 'en' } });
          const data = await res.json();
          const addr = data.address || {};
          const locObj = {
            area: addr.suburb || addr.neighbourhood || addr.road || addr.residential || '',
            city: addr.city || addr.town || addr.village || addr.county || 'Hyderabad',
            state: addr.state || '',
            lat, lng
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
    if (!notifOpen && unreadCount > 0) dispatch(markAllRead());
  }

  const isAnnouncementVisible = settings?.announcementActive !== false && settings?.announcementText;
  const displayLocationText = currentLocation
    ? `${currentLocation.area ? currentLocation.area + ', ' : ''}${currentLocation.city}`
    : user?.addresses?.[0]?.city || 'Select Location';

  const filteredCities = ALL_INDIAN_CITIES.filter(c => c.toLowerCase().includes(citySearchQuery.toLowerCase()));

  return (
    <header className="sticky top-0 left-0 right-0 z-50 bg-white border-b border-slate-100 shadow-sm hidden md:block">
      {isAnnouncementVisible && (
        <div className="bg-slate-900 text-white text-[11px] sm:text-xs font-semibold py-1.5 px-4 text-center tracking-wide overflow-hidden whitespace-nowrap text-ellipsis">
          {settings.announcementText}
        </div>
      )}
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 shrink-0">
          <Link to={role === 'admin' ? '/admin' : role === 'provider' ? '/provider' : '/'} className="flex items-center gap-1.5">
            {logoUrl && logoUrl !== '/logo.png' ? (
              <img src={logoUrl} alt={siteName} className="h-8 w-auto object-contain max-w-[140px]" />
            ) : (
              <span className="text-xl font-black tracking-tight text-primary-700 font-sans">⚡{siteName}</span>
            )}
            {role !== 'customer' && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${role === 'admin' ? 'bg-red-100 text-red-700' : role === 'staff' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                {role === 'admin' ? 'Admin' : role === 'staff' ? 'Staff' : 'Pro'}
              </span>
            )}
            {role === 'customer' && (user?.isPlusMember || user?.subscription?.isPlusMember) && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 text-white shadow-sm uppercase tracking-wider ml-1">
                ★ Plus
              </span>
            )}
          </Link>

          {role === 'customer' && (
            <div className="relative ml-2" ref={locRef}>
              <button
                onClick={() => setLocationModalOpen(v => !v)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 transition-all text-sm font-semibold group max-w-[250px] truncate"
              >
                <MapPin size={16} className="text-primary-600 shrink-0 group-hover:scale-110 transition-transform" />
                <span className="truncate">{detectingGps ? 'Locating...' : displayLocationText}</span>
                <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${locationModalOpen ? 'rotate-180' : ''}`} />
              </button>

              {locationModalOpen && (
                <div className="absolute left-0 top-12 w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 z-50 animate-in fade-in slide-in-from-top-2 flex flex-col max-h-[80vh]">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Select Service City</span>
                    <button onClick={() => setLocationModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg">&times;</button>
                  </div>
                  <button onClick={() => handleDetectGps(false)} disabled={detectingGps} className="w-full mb-3 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-primary-50 hover:bg-primary-100 text-primary-700 font-bold text-sm transition-colors border border-primary-200">
                    <Navigation size={16} className={detectingGps ? 'animate-spin' : ''} />
                    {detectingGps ? 'Detecting Location...' : 'Use Current GPS Location'}
                  </button>
                  <div className="relative mb-3">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" value={citySearchQuery} onChange={e => setCitySearchQuery(e.target.value)} placeholder="Search city..." className="w-full bg-slate-50 border border-slate-200 pl-9 pr-8 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                  </div>
                  <div className="space-y-1 overflow-y-auto pr-1 custom-scrollbar">
                    {filteredCities.map(city => (
                      <button key={city} onClick={() => handleSelectCustomCity(city)} className={`w-full py-2 px-3 rounded-xl text-sm text-left flex justify-between items-center ${currentLocation?.city === city ? 'bg-primary-600 text-white font-bold' : 'hover:bg-slate-50 text-slate-700'}`}>
                        {city} {currentLocation?.city === city && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <nav className="flex items-center gap-1.5 relative">
          {links.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-colors shrink-0 ${location.pathname === to ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              <Icon size={16} /> {label}
            </Link>
          ))}

          {secondaryAdminLinks.length > 0 && (
            <div className="relative shrink-0" ref={moreToolsRef}>
              <button
                type="button"
                onClick={() => setMoreToolsOpen(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                  secondaryAdminLinks.some(l => location.pathname === l.to)
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>More</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${moreToolsOpen ? 'rotate-180' : ''}`} />
              </button>

              {moreToolsOpen && (
                <div className="absolute right-0 top-12 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-[999] animate-in fade-in slide-in-from-top-2">
                  {secondaryAdminLinks.map(({ to, label, icon: Icon }) => (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setMoreToolsOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-extrabold transition-colors ${
                        location.pathname === to
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <Icon size={15} className={location.pathname === to ? 'text-teal-400' : 'text-primary-600'} />
                      <span>{label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <div className="relative" ref={notifRef}>
            <button onClick={handleNotifOpen} className="relative p-2.5 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors">
              <Bell size={20} />
              {unreadCount > 0 && <span className="absolute 1 top-1 right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-12 w-80 bg-white rounded-3xl shadow-elevated border border-slate-100 overflow-hidden z-50">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <h3 className="font-bold text-slate-800">Notifications</h3>
                  {unreadCount > 0 && <span className="text-xs text-primary-600 font-bold bg-primary-50 px-2 py-1 rounded-full">{unreadCount} new</span>}
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-sm font-medium">No notifications yet</div>
                  ) : notifications.slice(0, 15).map((n, i) => (
                    <div key={i} className={`px-5 py-3 ${!n.isRead ? 'bg-primary-50/50' : 'hover:bg-slate-50'} transition-colors`}>
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="text-sm font-bold text-slate-800">{n.title}</p>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{n.body}</p>
                        </div>
                        {!n.isRead && <div className="w-2 h-2 rounded-full bg-primary-500 shrink-0 mt-1.5" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {user?.role === 'provider' && (
            <button
              onClick={() => {
                if (location.pathname.startsWith('/provider')) {
                  navigate('/');
                } else {
                  navigate('/provider');
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs shadow-sm transition-all ml-1 shrink-0"
            >
              <span>{location.pathname.startsWith('/provider') ? '🛒 Customer Panel' : '⚡ Provider Panel'}</span>
            </button>
          )}
          <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
            <div className="text-right">
              <p className="text-sm font-bold text-slate-800 leading-none">{user?.name || 'User'}</p>
              <p className="text-xs text-slate-400 mt-1">{role.charAt(0).toUpperCase() + role.slice(1)}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold">
              {user?.name?.[0]?.toUpperCase() || '?'}
            </div>
          </div>
          <button onClick={handleLogout} className="p-2.5 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors ml-1">
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}
