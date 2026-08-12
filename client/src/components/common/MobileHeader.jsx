import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { Bell, Menu, MapPin, ChevronDown, Navigation, Search, Check } from 'lucide-react';
import { selectUser } from '@/store/slices/authSlice';
import { selectPublicSettings } from '@/store/slices/serviceSlice';
import { selectUnreadCount, markAllRead } from '@/store/slices/notificationSlice';

const ALL_INDIAN_CITIES = [
  'Hyderabad', 'Bengaluru', 'Mumbai', 'Delhi NCR', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad',
  'Jaipur', 'Lucknow', 'Chandigarh', 'Kochi', 'Visakhapatnam', 'Surat', 'Indore', 'Patna'
];

export default function MobileHeader({ onOpenDrawer }) {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const settings = useSelector(selectPublicSettings);
  const unreadCount = useSelector(selectUnreadCount);

  const siteName = settings?.siteName || 'OneWayFix';
  const logoUrl = settings?.logoUrl;
  const role = user?.role || 'customer';

  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [detectingGps, setDetectingGps] = useState(false);
  const [citySearchQuery, setCitySearchQuery] = useState('');
  
  const [currentLocation, setCurrentLocation] = useState(() => {
    try {
      const saved = localStorage.getItem('sh_current_location');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const displayLocationText = currentLocation
    ? `${currentLocation.area ? currentLocation.area + ', ' : ''}${currentLocation.city}`
    : user?.addresses?.[0]?.city || 'Select Location';

  const filteredCities = ALL_INDIAN_CITIES.filter(c => c.toLowerCase().includes(citySearchQuery.toLowerCase()));

  const handleDetectGps = () => {
    if (!navigator.geolocation) return;
    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
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
      () => setDetectingGps(false),
      { timeout: 8000 }
    );
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/85 backdrop-blur-xl border-b border-slate-200/50 shadow-sm md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="px-4 py-3 flex items-center justify-between">
        
        {/* Left Side: Logo & Location Pill */}
        {role === 'customer' ? (
          <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
            {/* Logo Restored */}
            <Link to="/" className="flex items-center shrink-0">
              {logoUrl && logoUrl !== '/logo.png' ? (
                <img src={logoUrl} alt={siteName} className="h-6 w-auto object-contain max-w-[90px]" />
              ) : (
                <span className="text-[15px] font-black text-primary-700 tracking-tight">⚡ {siteName}</span>
              )}
            </Link>
            
            <div className="w-px h-6 bg-slate-200 shrink-0"></div>

            {/* Location Pill */}
            <button 
              onClick={() => setLocationModalOpen(true)}
              className="flex flex-col items-start text-slate-800 focus:outline-none flex-1 min-w-0 overflow-hidden text-left"
            >
              <div className="flex items-center gap-0.5 font-black text-[12px] tracking-tight">
                <span className="truncate text-slate-900 leading-tight">
                  {detectingGps ? 'Locating...' : (currentLocation?.area || 'Home Location')}
                </span>
                <ChevronDown size={14} className="text-primary-600 shrink-0" />
              </div>
              <p className="text-[10px] text-slate-500 font-bold truncate w-full">
                {displayLocationText}
              </p>
            </button>
          </div>
        ) : (
          <Link to={role === 'admin' ? '/admin' : '/provider'} className="flex items-center gap-1.5">
            {logoUrl && logoUrl !== '/logo.png' ? (
              <img src={logoUrl} alt={siteName} className="h-7 w-auto object-contain max-w-[120px]" />
            ) : (
              <span className="text-xl font-black text-primary-700 tracking-tight">⚡ {siteName}</span>
            )}
          </Link>
        )}

        {/* Right Side: Icons & Profile Avatar */}
        <div className="flex items-center gap-3">
          <button className="relative text-slate-600 p-2 bg-slate-100/80 rounded-full hover:bg-slate-200 transition-colors">
            <Bell size={20} className="fill-slate-600" />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center border-2 border-white shadow-sm">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          
          <button onClick={onOpenDrawer} className="focus:outline-none shadow-sm rounded-full active:scale-95 transition-transform">
            {user ? (
               <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary-600 to-primary-400 text-white flex items-center justify-center font-bold text-sm shadow-md border-2 border-white">
                 {user.name?.[0]?.toUpperCase() || 'U'}
               </div>
            ) : (
               <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center">
                 <Menu size={18} />
               </div>
            )}
          </button>
        </div>
      </div>

      {/* Provider Quick Nav (Mobile) */}
      {role === 'provider' && (
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none px-4 pb-2 -mt-1 pt-1 border-t border-slate-100/50">
          {[
            { label: 'Dashboard', to: '/provider' },
            { label: 'Jobs', to: '/provider/bookings' },
            { label: 'Complaints', to: '/provider/complaints' },
            { label: 'Earnings', to: '/provider/earnings' },
            { label: 'Profile', to: '/provider/profile' }
          ].map(link => {
            // Very simple active check
            const isActive = window.location.pathname === link.to;
            return (
              <Link 
                key={link.to} 
                to={link.to}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  isActive 
                    ? 'bg-slate-900 text-white shadow-sm' 
                    : 'text-slate-600 bg-slate-100/50 hover:bg-slate-100'
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </div>
      )}
    </header>
      
      {/* Location Bottom Sheet Custom Modal - Extracted outside header because backdrop-blur breaks fixed positioning */}
      {role === 'customer' && locationModalOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setLocationModalOpen(false)}></div>
          <div className="bg-white rounded-t-3xl shadow-2xl relative z-10 p-5 animate-slideUp">
            <div className="flex items-center justify-between mb-4 border-b border-slate-50 pb-2">
              <h3 className="font-extrabold text-lg text-slate-800">Select Location</h3>
              <button onClick={() => setLocationModalOpen(false)} className="bg-slate-100 p-2 rounded-full text-slate-600 font-bold">&times;</button>
            </div>
            
            <button onClick={handleDetectGps} disabled={detectingGps} className="w-full flex items-center justify-center gap-2 py-4 bg-primary-600 rounded-2xl text-white font-extrabold text-[15px] mb-2 shadow-lg shadow-primary-600/30 active:scale-95 transition-transform">
              <Navigation size={20} className={detectingGps ? 'animate-spin' : ''} />
              {detectingGps ? 'Fetching exactly where you are...' : 'Auto-detect My Location via GPS'}
            </button>
            
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-slate-100"></div>
              <span className="text-[10px] font-extrabold text-slate-300 uppercase tracking-widest">OR ENTER MANUALLY</span>
              <div className="flex-1 h-px bg-slate-100"></div>
            </div>

            <div className="relative mb-2">
              <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                value={citySearchQuery} 
                onChange={e => setCitySearchQuery(e.target.value)} 
                onKeyDown={e => {
                  if (e.key === 'Enter' && citySearchQuery.trim()) {
                     const locObj = { area: '', city: citySearchQuery.trim() };
                     setCurrentLocation(locObj);
                     localStorage.setItem('sh_current_location', JSON.stringify(locObj));
                     setLocationModalOpen(false);
                  }
                }}
                placeholder="Enter City, Area, or Pincode..." 
                className="w-full pl-11 pr-20 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-50 transition-all shadow-inner" 
              />
              <button 
                onClick={() => {
                  if (citySearchQuery.trim()) {
                     const locObj = { area: '', city: citySearchQuery.trim() };
                     setCurrentLocation(locObj);
                     localStorage.setItem('sh_current_location', JSON.stringify(locObj));
                     setLocationModalOpen(false);
                  }
                }}
                disabled={!citySearchQuery.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-slate-900 disabled:bg-slate-300 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors"
              >
                Submit
              </button>
            </div>
            <p className="text-center text-[11px] font-semibold text-slate-400 mt-3">
              Providing accurate location helps us match you with nearby service experts.
            </p>
          </div>
          
          <style>{`
            @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
            .animate-slideUp { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
          `}</style>
        </div>
      )}
      
      {/* Universal Auto-Spacer: Pushes page content down perfectly so it never hides under the fixed header */}
      <div className={`shrink-0 w-full md:hidden ${role === 'provider' ? 'h-[105px]' : 'h-[65px]'} transition-all`} />
    </>
  );
}
