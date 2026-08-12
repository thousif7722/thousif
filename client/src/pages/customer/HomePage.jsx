import React, { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { Search, MapPin, Star, ChevronRight, ChevronLeft, Clock, TrendingUp, ArrowRight, X, Shield, Play, Sparkles, Tag, History } from 'lucide-react';
import {
  fetchServices, fetchCategories,
  setSelectedCategory, setSearch,
  selectServices, selectCategories,
  selectSelectedCategory, selectServiceLoading,
  selectPublicSettings,
} from '@/store/slices/serviceSlice';
import { selectUser } from '@/store/slices/authSlice';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import { CardSkeleton } from '@/components/common/UI';
import SeoHead from '@/components/seo/SeoHead';

// ── Category config
const CATEGORY_CONFIG = {
  'AC Repair':        { img: '/cat_ac.png',        light: '#e0f2fe', accent: '#0284c7', icon: '❄️' },
  'Cleaning':         { img: '/cat_cleaning.png',  light: '#d1fae5', accent: '#059669', icon: '🧹' },
  'Washing Machine':  { img: '/cat_washing.png',   light: '#eff6ff', accent: '#3b82f6', icon: '🫧' },
  'Fridge & Cooler':  { img: '/cat_fridge.png',    light: '#f0f9ff', accent: '#0ea5e9', icon: '🧊' },
  'Plumbing':         { img: '/cat_plumbing.png',  light: '#f1f5f9', accent: '#475569', icon: '🔧' },
  'Electrical':       { img: '/cat_electrical.png',light: '#fef3c7', accent: '#d97706', icon: '⚡' },
  'Pest Control':     { img: '/cat_pest.png',      light: '#f0fdf4', accent: '#65a30d', icon: '🐛' },
  'Carpentry':        { img: '/cat_carpentry.png', light: '#fff7ed', accent: '#ea580c', icon: '🪚' },
  'Painting':         { img: '/cat_painting.png',  light: '#fdf2f8', accent: '#db2777', icon: '🎨' },
  'Salon':            { img: '/cat_salon.png',     light: '#f5f3ff', accent: '#7c3aed', icon: '💇' },
};

const ALL_CATS = Object.keys(CATEGORY_CONFIG);

const OFFERS = [
  { label: '50% OFF on AC Repair', code: 'AC50', bg: 'bg-emerald-100 text-emerald-800' },
  { label: 'Flat ₹200 OFF on Cleaning', code: 'CLEAN200', bg: 'bg-indigo-100 text-indigo-800' },
  { label: 'Free Inspection', code: 'INSPECT', bg: 'bg-amber-100 text-amber-800' },
];

const VIDEO_ADS = [
  {
    video: 'https://youtu.be/ge0suSTOVvg?si=5crAylnMXVZJEdxf',
    title: 'ServiceHub Video Spotlight',
    desc: 'Watch our verified professionals in action delivering quality home services',
    badge: '🎬 Featured Reel',
    cta: 'Book Service',
    category: 'AC Repair',
  },
  {
    video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    title: 'AC Service & Repair',
    desc: 'Beat the heat — certified AC experts at your home today',
    badge: '🔥 Most Booked',
    cta: 'Book AC Service',
    category: 'AC Repair',
  },
];

export default function HomePage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const services = useSelector(selectServices);
  const categories = useSelector(selectCategories);
  const selectedCategory = useSelector(selectSelectedCategory);
  const loading = useSelector(selectServiceLoading);
  const publicSettings = useSelector(selectPublicSettings);

  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);
  
  // Carousel Banners Data
  const banners = publicSettings?.promoBanners?.length > 0 ? publicSettings.promoBanners : [
    { type: 'image', url: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&q=80&w=800', link: '/category/Cleaning' },
    { type: 'video', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', link: '/category/AC%20Repair' },
    { type: 'image', url: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=800', link: '/category/Electrical' },
    { type: 'video', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', link: '/services' }
  ];

  useEffect(() => {
    dispatch(fetchServices({ category: selectedCategory !== 'All' ? selectedCategory : undefined }));
    dispatch(fetchCategories());
  }, [dispatch, selectedCategory]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = services.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const topRated = [...services].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 6);
  const recentBookings = [...services].reverse().slice(0, 4); // mocked logic

  const orgJsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'OneWayFix',
      url: 'https://onewayfix.com',
      logo: 'https://onewayfix.com/logo.png',
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: '+91-9000000000',
        contactType: 'customer service',
        areaServed: 'IN',
        availableLanguage: ['English', 'Hindi'],
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: 'OneWayFix Home Services',
      image: 'https://onewayfix.com/logo.png',
      priceRange: '₹149 - ₹4999',
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'IN',
      },
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-4">
      <SeoHead
        title="OneWayFix — Book Trusted Home Service Professionals Near You"
        description="Book verified home service professionals in your city. AC repair, electrician, plumber, appliance repair, cleaning and carpentry with instant booking."
        canonical="/"
        jsonLd={orgJsonLd}
      />
      <Header />

      {/* Visually hidden or hero-integrated H1 for SEO */}
      <h1 className="sr-only">Book Trusted Home Service Professionals Near You — OneWayFix</h1>

      {/* STICKY SEARCH BAR */}
      <div className="sticky top-[60px] md:top-16 z-30 bg-white/90 backdrop-blur-xl px-4 py-3 border-b border-slate-100 shadow-sm" ref={searchRef}>
        <div className="relative max-w-4xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-500" size={20} strokeWidth={2.5} />
          <input
            type="text"
            value={searchQuery}
            onFocus={() => setShowDropdown(true)}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search for Services..."
            className="w-full bg-slate-100 text-slate-800 pl-12 pr-10 py-3.5 rounded-full text-[15px] font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-inner placeholder:text-slate-400 placeholder:font-semibold transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 bg-slate-200 rounded-full p-1 transition-colors">
              <X size={14} strokeWidth={3} />
            </button>
          )}

          {/* Quick Search Dropdown */}
          {showDropdown && searchQuery.trim().length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-3xl shadow-2xl z-50 border border-slate-100 overflow-hidden">
              <div className="max-h-[60vh] overflow-y-auto w-full">
                {filtered.length > 0 ? (
                  <div className="p-2 space-y-1">
                    <p className="px-4 py-2 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Services</p>
                    {filtered.slice(0, 6).map(s => (
                      <button
                        key={s._id}
                        onClick={() => navigate(`/services/${s._id}`)}
                        className="w-full flex items-center gap-4 px-4 py-3 hover:bg-slate-50 rounded-2xl transition-colors text-left"
                      >
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ background: CATEGORY_CONFIG[s.category]?.light || '#f1f5f9' }}>
                          {s.icon || CATEGORY_CONFIG[s.category]?.icon || '🔧'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-800 text-sm truncate">{s.name}</p>
                          <p className="text-[11px] text-slate-500 font-semibold">{s.category}</p>
                        </div>
                        <p className="text-sm font-extrabold text-primary-600">₹{s.basePrice}</p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="py-10 text-center text-slate-400">
                    <Search size={32} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-bold text-slate-500">No services found for "{searchQuery}"</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-6 pt-6 pb-24 space-y-8 overflow-hidden">
        
        {/* FLIPKART / AMAZON STYLE HERO BANNER CAROUSEL */}
        <HeroBannerCarousel banners={banners} navigate={navigate} />

        {/* CATEGORIES GRID (Large Cards, Mobile 3-col, Desktop 4-col) */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Explore Categories</h2>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-x-3 gap-y-5">
            {ALL_CATS.map(name => {
              const cfg = CATEGORY_CONFIG[name];
              return (
                <button
                  key={name}
                  onClick={() => navigate(`/category/${encodeURIComponent(name)}`)}
                  className="flex flex-col items-center group w-full min-w-0"
                >
                  <div className="w-full aspect-square rounded-3xl flex items-center justify-center text-4xl sm:text-5xl shadow-sm border border-slate-100 transition-all duration-300 group-hover:scale-[1.03] group-hover:shadow-lg relative overflow-hidden" style={{ background: cfg.light }}>
                    {cfg.img ? (
                      <img src={cfg.img} alt={name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                    ) : (
                      cfg.icon
                    )}
                    <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-transparent transition-colors" />
                  </div>
                  <span className="text-[11px] sm:text-xs font-bold text-slate-700 mt-2 text-center w-full truncate px-1 tracking-tight">{name}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* RECENT BOOKINGS */}
        {user && recentBookings.length > 0 && (
          <section className="bg-blue-50 border border-blue-100 -mx-4 px-4 py-6 md:rounded-3xl md:mx-0">
            <h2 className="text-lg font-extrabold text-blue-900 mb-4 flex items-center gap-2">
              <History size={20} /> Watch your recent services
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none snap-x">
              {recentBookings.map(s => (
                <div key={s._id} className="snap-center shrink-0 w-60 bg-white rounded-2xl p-4 shadow-sm border border-blue-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: CATEGORY_CONFIG[s.category]?.light || '#f1f5f9' }}>
                      {s.icon || CATEGORY_CONFIG[s.category]?.icon || '🔧'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 text-sm truncate">{s.name}</p>
                      <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Book again</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* POPULAR SERVICES */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2 tracking-tight">
              <TrendingUp size={20} className="text-primary-600" /> Popular Services
            </h2>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none -mx-4 px-4 md:px-0 md:-mx-0 snap-x">
            {topRated.map(service => (
              <ServiceCard key={service._id} service={service} />
            ))}
          </div>
        </section>

        {/* VIDEO SECTION */}
        <VideoSpotlightSection navigate={navigate} />

        {/* SAFETY GUARANTEE */}
        <section className="bg-emerald-900 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl"></div>
          <h3 className="font-extrabold text-xl mb-4 flex items-center gap-2 relative z-10">
            <Shield size={24} className="text-emerald-400" /> Service Hub Trust
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
            {[
              { icon: '✅', text: 'Verified Professionals' },
              { icon: '🔒', text: 'Safe & Secure Visits' },
              { icon: '💯', text: '100% Satisfaction Guarantee' },
              { icon: '📞', text: '24x7 Customer Support' },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-3 bg-emerald-800/50 p-3 rounded-2xl border border-emerald-700/50">
                <span className="text-lg bg-emerald-700 w-8 h-8 rounded-xl flex items-center justify-center">{icon}</span>
                <span className="font-semibold text-sm tracking-wide">{text}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <Footer />
    </div>
  );
}

// ── Shared Compact Service Card for Scrollers
function ServiceCard({ service }) {
  const cfg = CATEGORY_CONFIG[service.category] || { icon: '🔧', bg: '#334155', light: '#f1f5f9' };
  return (
    <Link to={`/services/${service._id}`} className="snap-center shrink-0 w-44 bg-white rounded-3xl border border-slate-100 p-4 hover:shadow-xl transition-all duration-300 block group min-w-0">
      <div className="w-full aspect-video rounded-2xl mb-3 flex items-center justify-center text-3xl group-hover:scale-105 transition-transform overflow-hidden relative" style={{ background: cfg.light }}>
        <div className="absolute inset-0 bg-gradient-to-tr from-black/5 to-transparent"></div>
        <span className="relative z-10 drop-shadow-md">{service.icon || cfg.icon}</span>
      </div>
      <h3 className="font-bold text-slate-800 text-[13px] leading-snug line-clamp-2 mb-2 group-hover:text-primary-600 transition-colors h-9">
        {service.name}
      </h3>
      <div className="flex flex-col gap-1 mt-auto">
        <div className="flex items-center gap-1.5 bg-slate-50 w-fit px-2 py-0.5 rounded-lg border border-slate-100">
          <Star size={10} className="text-amber-500 fill-amber-500" />
          <span className="text-[11px] font-bold text-slate-600">{service.rating?.toFixed(1) || '4.8'}</span>
        </div>
        <p className="text-primary-700 font-extrabold text-sm tracking-tight">₹{service.basePrice}</p>
      </div>
    </Link>
  );
}
function VideoSpotlightSection({ navigate }) {
  const settings = useSelector(selectPublicSettings);
  const rawVideos = settings?.videoSpotlights || VIDEO_ADS;
  const videoList = rawVideos.filter(v => v.active !== false);

  const [activeVideo, setActiveVideo] = useState(null);

  if (!videoList || videoList.length === 0) return null;

  const getVideoEmbedUrl = (url) => {
    if (!url) return '';
    if (url.includes('youtu.be/')) {
      const id = url.split('youtu.be/')[1]?.split('?')[0];
      return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
    }
    if (url.includes('youtube.com/watch')) {
      const params = new URLSearchParams(url.split('?')[1]);
      return `https://www.youtube.com/embed/${params.get('v')}?autoplay=1&rel=0`;
    }
    return url;
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2 tracking-tight">
          <Sparkles size={20} className="text-primary-600" /> Service Spotlight Videos
        </h2>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none -mx-4 px-4 md:px-0 md:-mx-0 snap-x">
        {videoList.map((item, idx) => (
          <div 
            key={idx} 
            className="snap-center shrink-0 w-64 md:w-72 bg-slate-900 rounded-3xl overflow-hidden shadow-lg border border-slate-800 flex flex-col justify-between group relative"
          >
            {/* Video Thumbnail / Preview Container */}
            <div 
              className="h-44 relative bg-slate-950 overflow-hidden flex items-center justify-center cursor-pointer group"
              onClick={() => setActiveVideo(item)}
            >
              {item.video?.includes('youtu') ? (
                <iframe 
                  src={getVideoEmbedUrl(item.video).replace('autoplay=1', 'autoplay=0')} 
                  className="absolute inset-0 w-full h-full pointer-events-none opacity-80" 
                  frameBorder="0" 
                  title={item.title}
                />
              ) : (
                <video 
                  src={item.video} 
                  className="absolute inset-0 w-full h-full object-cover opacity-80" 
                  muted 
                  loop 
                  playsInline
                  autoPlay
                />
              )}

              {/* Play Overlay */}
              <div className="absolute inset-0 bg-slate-950/40 group-hover:bg-slate-950/20 transition-colors z-10" />
              <div className="absolute inset-0 flex flex-col items-center justify-center z-20 group-hover:scale-110 transition-transform">
                <div className="w-14 h-14 bg-primary-600/90 text-white rounded-full flex items-center justify-center shadow-2xl border-2 border-white/50 animate-pulse">
                  <Play size={26} className="fill-white ml-1 drop-shadow-md" />
                </div>
                <span className="text-[11px] font-bold text-white mt-2 bg-slate-900/80 px-2.5 py-0.5 rounded-full border border-white/20">
                  Tap to Watch Video
                </span>
              </div>

              {item.badge && (
                <span className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider z-20 shadow-md">
                  {item.badge}
                </span>
              )}
            </div>

            {/* Details & Direct Booking Action */}
            <div className="p-4 bg-slate-900 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-white text-sm leading-snug line-clamp-1 mb-1">{item.title}</h3>
                <p className="text-[11px] text-slate-400 line-clamp-2 mb-3">{item.desc}</p>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => setActiveVideo(item)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
                >
                  <Play size={14} className="fill-white" /> Watch
                </button>
                <button
                  onClick={() => navigate(`/category/${encodeURIComponent(item.category)}`)}
                  className="flex-1 bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1 transition-colors shadow-md"
                >
                  Book <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── VIDEO LIGHTBOX MODAL ──────────────────────────────────────────────── */}
      {activeVideo && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="bg-slate-900 text-white rounded-3xl overflow-hidden max-w-2xl w-full border border-slate-800 shadow-2xl relative flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-primary-500" />
                <h3 className="font-bold text-sm sm:text-base text-white truncate">{activeVideo.title}</h3>
              </div>
              <button 
                onClick={() => setActiveVideo(null)}
                className="w-9 h-9 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-full flex items-center justify-center transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Video Player */}
            <div className="w-full aspect-video bg-black relative flex items-center justify-center">
              {activeVideo.video?.includes('youtu') ? (
                <iframe 
                  src={getVideoEmbedUrl(activeVideo.video)}
                  className="w-full h-full"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={activeVideo.title}
                />
              ) : (
                <video 
                  src={activeVideo.video}
                  className="w-full h-full object-contain"
                  controls
                  autoPlay
                  playsInline
                />
              )}
            </div>

            {/* Footer with Description & Book Now Action */}
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border-t border-slate-800">
              <div>
                <p className="text-xs text-slate-300 leading-relaxed max-w-md">{activeVideo.desc}</p>
              </div>
              <button
                onClick={() => {
                  const cat = activeVideo.category;
                  setActiveVideo(null);
                  navigate(`/category/${encodeURIComponent(cat)}`);
                }}
                className="w-full sm:w-auto bg-primary-600 hover:bg-primary-500 text-white font-extrabold text-xs sm:text-sm px-6 py-3 rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"
              >
                Book {activeVideo.category} Now <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ── FLIPKART / AMAZON STYLE HERO BANNER CAROUSEL ──────────────────────────────
function HeroBannerCarousel({ banners, navigate }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const touchStartX = useRef(null);

  // Auto-slide every 5 seconds (5000ms), pause on hover/touch
  useEffect(() => {
    if (isHovered || !banners || banners.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [banners, isHovered]);

  const handlePrev = (e) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? banners.length - 1 : prev - 1));
  };

  const handleNext = (e) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;

    if (diff > 50) {
      handleNext(); // swipe left -> next
    } else if (diff < -50) {
      handlePrev(); // swipe right -> prev
    }
    touchStartX.current = null;
  };

  if (!banners || banners.length === 0) return null;

  return (
    <div 
      className="relative w-full rounded-2xl md:rounded-3xl overflow-hidden shadow-md border border-slate-100 bg-slate-900 group aspect-[16/9] md:aspect-[21/9]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Sliding track */}
      <div 
        className="flex w-full h-full transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {banners.map((banner, idx) => (
          <div 
            key={idx}
            onClick={() => banner.link && navigate(banner.link)}
            className={`shrink-0 w-full h-full relative ${banner.link ? 'cursor-pointer' : ''}`}
          >
            {banner.type === 'video' || (banner.url && banner.url.endsWith('.mp4')) ? (
              <video 
                src={banner.url} 
                autoPlay 
                loop 
                muted 
                playsInline 
                className="w-full h-full object-cover"
              />
            ) : (
              <img 
                src={banner.url} 
                alt={`Promo ${idx + 1}`} 
                className="w-full h-full object-cover"
                loading={idx === 0 ? 'eager' : 'lazy'} 
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent" />
          </div>
        ))}
      </div>

      {/* Prev Arrow (Flipkart style) */}
      {banners.length > 1 && (
        <button
          onClick={handlePrev}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 md:w-10 md:h-10 bg-black/40 hover:bg-black/70 text-white rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 transition-all opacity-0 group-hover:opacity-100 z-20 shadow-lg"
          aria-label="Previous Slide"
        >
          <ChevronLeft size={20} />
        </button>
      )}

      {/* Next Arrow (Flipkart style) */}
      {banners.length > 1 && (
        <button
          onClick={handleNext}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 md:w-10 md:h-10 bg-black/40 hover:bg-black/70 text-white rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 transition-all opacity-0 group-hover:opacity-100 z-20 shadow-lg"
          aria-label="Next Slide"
        >
          <ChevronRight size={20} />
        </button>
      )}

      {/* Flipkart Style Indicator Dots */}
      <div className="absolute bottom-3 left-0 right-0 flex justify-center items-center gap-1.5 z-20">
        {banners.map((_, idx) => (
          <button 
            key={idx} 
            onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }}
            className={`h-2 rounded-full transition-all duration-300 ${
              idx === currentIndex ? 'w-6 bg-white shadow-lg' : 'w-2 bg-white/50 hover:bg-white/80'
            }`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
