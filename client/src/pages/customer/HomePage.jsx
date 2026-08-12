import React, { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { Search, MapPin, Star, ChevronRight, Clock, TrendingUp, ArrowRight, X, Shield, Play, Sparkles, Tag, History } from 'lucide-react';
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
  
  // Carousel State
  const carouselRef = useRef(null);
  const [bannerIndex, setBannerIndex] = useState(0);
  const banners = publicSettings?.promoBanners?.length > 0 ? publicSettings.promoBanners : [
    { type: 'image', url: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&q=80&w=800', link: '/category/Cleaning' },
    { type: 'video', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', link: '/category/AC%20Repair' },
    { type: 'image', url: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=800', link: '/category/Electrical' },
    { type: 'video', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', link: '/services' } // Highly reliable MP4 sample
  ];

  // Auto-Slide Effect
  useEffect(() => {
    const timer = setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % banners.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [banners.length]);

  // Sync scroll with index
  useEffect(() => {
    if (carouselRef.current) {
      const scrollValue = carouselRef.current.clientWidth * bannerIndex;
      carouselRef.current.scrollTo({ left: scrollValue, behavior: 'smooth' });
    }
  }, [bannerIndex]);

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
        
        {/* FLIPKART/AMAZON STYLE MEDIA SLIDER BANNERS */}
        <div className="relative w-full rounded-2xl md:rounded-3xl overflow-hidden shadow-sm border border-slate-100 bg-slate-900 group">
          <div 
            ref={carouselRef}
            className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none aspect-[16/9] md:aspect-[21/9]" 
            style={{ scrollBehavior: 'smooth' }}
            onScroll={(e) => {
              const idx = Math.round(e.target.scrollLeft / e.target.clientWidth);
              if (idx !== bannerIndex) setBannerIndex(idx);
            }}
          >
            {banners.map((banner, idx) => (
              <div 
                key={idx} 
                onClick={() => banner.link && navigate(banner.link)}
                className={`shrink-0 w-full h-full snap-center relative ${banner.link ? 'cursor-pointer' : ''}`}
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
                    alt={`Promo ${idx}`} 
                    className="w-full h-full object-cover"
                    loading="lazy" 
                  />
                )}
                {/* Subtle Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent" />
              </div>
            ))}
          </div>
          {/* Slider Dots */}
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
            {banners.map((_, idx) => (
              <div 
                key={idx} 
                className={`h-1.5 rounded-full transition-all duration-300 ${idx === bannerIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`}
              />
            ))}
          </div>
        </div>

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

// ── Shared Video Component
function VideoSpotlightSection({ navigate }) {
  const settings = useSelector(selectPublicSettings);
  const rawVideos = settings?.videoSpotlights || VIDEO_ADS;
  const videoList = rawVideos.filter(v => v.active !== false);

  if (!videoList || videoList.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2 tracking-tight">
          <Sparkles size={20} className="text-primary-600" /> Service Spotlight
        </h2>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none -mx-4 px-4 md:px-0 md:-mx-0 snap-x">
        {videoList.map((item, idx) => (
          <div key={idx} className="snap-center shrink-0 w-64 md:w-72 bg-slate-900 rounded-3xl overflow-hidden shadow-lg border border-slate-800 group relative cursor-pointer" onClick={() => navigate(`/category/${encodeURIComponent(item.category)}`)}>
            <div className="h-40 relative bg-slate-950 overflow-hidden flex items-center justify-center group">
               {item.video.includes('youtu') ? (
                 <iframe 
                   src={item.video.replace('youtu.be/', 'www.youtube.com/embed/').replace('watch?v=', 'embed/')} 
                   className="absolute inset-0 w-full h-full pointer-events-none" 
                   frameBorder="0" 
                   allow="autoplay; encrypted-media" 
                   allowFullScreen
                   title={item.title}
                 />
               ) : (
                 <video 
                   src={item.video} 
                   className="absolute inset-0 w-full h-full object-cover" 
                   autoPlay 
                   muted 
                   loop 
                   playsInline
                 />
               )}
               <div className="absolute inset-0 bg-blue-900/20 group-hover:bg-transparent transition-colors z-10" />
               <div className="absolute inset-0 flex flex-col items-center justify-center z-20 group-hover:scale-110 transition-transform">
                 <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center shadow-2xl border border-white/40">
                   <Play size={24} className="text-white fill-white ml-1 drop-shadow-md" />
                 </div>
               </div>
            </div>
            <div className="p-4 bg-slate-900 relative z-20">
              <span className="bg-primary-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider mb-2 inline-block">
                {item.badge}
              </span>
              <h3 className="font-bold text-white text-sm leading-snug line-clamp-1 mb-1">{item.title}</h3>
              <p className="text-[11px] text-slate-400 line-clamp-1">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
