import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  ChevronLeft, Search, SlidersHorizontal, Star, Clock, ShieldCheck,
  Plus, Minus, ShoppingCart, X, ChevronRight, Zap, Info,
} from 'lucide-react';
import { selectUser } from '@/store/slices/authSlice';
import { selectPublicSettings } from '@/store/slices/serviceSlice';
import { apiService } from '@/services/api';
import Header from '@/components/common/Header';
import toast from 'react-hot-toast';

// ── Category visual map (mirrors CATEGORY_CONFIG in HomePage) ─────────────────
const CATEGORY_META = {
  'AC Repair':        { img: '/cat_ac.png',        icon: '❄️',  accent: '#0284c7', light: '#e0f2fe' },
  'Cleaning':         { img: '/cat_cleaning.png',  icon: '🧹',  accent: '#059669', light: '#d1fae5' },
  'Washing Machine':  { img: '/cat_washing.png',   icon: '🫧',  accent: '#3b82f6', light: '#eff6ff' },
  'Fridge & Cooler':  { img: '/cat_fridge.png',    icon: '🧊',  accent: '#0ea5e9', light: '#f0f9ff' },
  'Plumbing':         { img: '/cat_plumbing.png',  icon: '🔧',  accent: '#475569', light: '#f1f5f9' },
  'Electrical':       { img: '/cat_electrical.png',icon: '⚡',  accent: '#d97706', light: '#fef3c7' },
  'Pest Control':     { img: '/cat_pest.png',       icon: '🐛',  accent: '#65a30d', light: '#f0fdf4' },
  'Carpentry':        { img: '/cat_carpentry.png', icon: '🪚',  accent: '#ea580c', light: '#fff7ed' },
  'Painting':         { img: '/cat_painting.png',  icon: '🎨',  accent: '#db2777', light: '#fdf2f8' },
  'Salon':            { img: '/cat_salon.png',      icon: '💇',  accent: '#7c3aed', light: '#f5f3ff' },
};

const SORT_OPTIONS = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
];

// ── Skeleton loader ─────────────────────────────────────────────────────────────
function ServiceSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 animate-pulse">
      <div className="flex gap-4">
        <div className="w-24 h-24 rounded-xl bg-slate-200 shrink-0" />
        <div className="flex-1 space-y-2 py-1">
          <div className="h-4 bg-slate-200 rounded w-3/4" />
          <div className="h-3 bg-slate-100 rounded w-full" />
          <div className="h-3 bg-slate-100 rounded w-2/3" />
          <div className="h-6 bg-slate-200 rounded w-1/3 mt-2" />
        </div>
      </div>
      <div className="mt-4 h-10 bg-slate-200 rounded-xl" />
    </div>
  );
}

// ── Service Card ────────────────────────────────────────────────────────────────
function ServiceCard({ service, qty, onQtyChange, onBook, accentColor }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden transition-all duration-200 hover:shadow-md">
      <div className="p-5">
        <div className="flex gap-4">
          {/* Service image / icon */}
          <div
            className="w-24 h-24 rounded-xl shrink-0 flex items-center justify-center text-4xl overflow-hidden relative bg-slate-100"
            style={{ background: `${accentColor}15` }}
          >
            {service.imageUrl || service.image ? (
              <img
                src={service.imageUrl || service.image}
                alt={service.imageAlt || service.name}
                className="w-full h-full object-cover"
                onError={e => {
                  e.target.style.display = 'none';
                  if (e.target.parentNode) {
                    e.target.parentNode.innerHTML = `<span style="font-size:2.25rem">${service.icon || '🛠️'}</span>`;
                  }
                }}
              />
            ) : (
              <span>{service.icon || '🔧'}</span>
            )}
          </div>

          {/* Service info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 text-base leading-tight">{service.name}</h3>

            {/* Badges */}
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                <Clock size={10} /> {service.duration || 60} min
              </span>
              <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                <ShieldCheck size={10} /> Verified Pro
              </span>
              {service.isEmergencyAvailable && (
                <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 animate-pulse">
                  ⚡ 24/7 Emergency (60-Min)
                </span>
              )}
              {service.gstPct && (
                <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                  + {service.gstPct}% GST
                </span>
              )}
            </div>

            {/* Description */}
            <p className={`text-xs text-slate-500 mt-1.5 leading-relaxed ${!expanded ? 'line-clamp-2' : ''}`}>
              {service.description}
            </p>
            {service.description?.length > 80 && (
              <button
                onClick={() => setExpanded(e => !e)}
                className="text-xs font-medium mt-0.5 flex items-center gap-0.5"
                style={{ color: accentColor }}
              >
                {expanded ? 'Less' : 'More'} <ChevronRight size={11} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
              </button>
            )}

            {/* Price */}
            <div className="mt-2 flex items-baseline justify-between">
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs font-semibold text-slate-500">Starting</span>
                  <span className="text-xl font-extrabold text-slate-900">₹{(service.basePrice * qty).toLocaleString('en-IN')}</span>
                  {qty > 1 && (
                    <span className="text-xs text-slate-400 font-medium">(₹{service.basePrice} × {qty})</span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Inspection visit: ₹{service.visitCharge || 99} (adjusted in bill)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Includes list */}
        {expanded && service.includes?.length > 0 && (
          <div className="mt-3 p-3 rounded-xl border border-slate-100 bg-slate-50">
            <p className="text-xs font-semibold text-slate-600 mb-1.5">What's included:</p>
            <ul className="space-y-1">
              {service.includes.map((item, i) => (
                <li key={i} className="text-xs text-slate-600 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accentColor }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Quantity + Book */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
          {/* Quantity selector with label */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 shrink-0">Quantity:</span>
            <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1">
              <button
                onClick={() => onQtyChange(service._id, Math.max(1, qty - 1))}
                className="w-7 h-7 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-700 hover:bg-slate-50 active:scale-95 transition-transform"
              >
                <Minus size={13} />
              </button>
              <span className="w-6 text-center font-bold text-slate-900 text-xs">{qty}</span>
              <button
                onClick={() => onQtyChange(service._id, Math.min(10, qty + 1))}
                className="w-7 h-7 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-700 hover:bg-slate-50 active:scale-95 transition-transform"
              >
                <Plus size={13} />
              </button>
            </div>
          </div>

          {/* Book Now button */}
          <button
            onClick={() => onBook(service, qty)}
            className="flex-1 max-w-[170px] py-2.5 rounded-xl font-bold text-xs text-white flex items-center justify-center gap-1.5 shadow-md transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)` }}
          >
            <Zap size={14} /> Book Now
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function CategoryServicesPage() {
  const { categoryName } = useParams();
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const publicSettings = useSelector(selectPublicSettings);

  const decoded = useMemo(() => {
    try { return decodeURIComponent(categoryName); } catch { return categoryName; }
  }, [categoryName]);

  const meta = CATEGORY_META[decoded] || {
    img: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80',
    icon: '🛠️',
    accent: '#3b82f6',
    light: '#f0f4ff',
  };

  const [services, setServices] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [selectedType, setSelectedType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('popular');
  const [quantities, setQuantities] = useState({}); // serviceId → qty
  const [showFilter, setShowFilter] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      apiService.getServices({ category: decoded, sort }),
      apiService.getServiceTypesByCategory(decoded).catch(() => ({ data: { data: [] } })),
    ])
      .then(([resServices, resTypes]) => {
        setServices(resServices.data.data || []);
        setServiceTypes(resTypes.data.data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch category services:', err);
        setError('Failed to load services. Please try again.');
        setLoading(false);
      });
  }, [decoded, sort]);

  const customBanner = useMemo(() => {
    return publicSettings?.categoryBanners?.find(
      b => b.category?.toLowerCase() === decoded?.toLowerCase() && b.active !== false
    );
  }, [publicSettings, decoded]);

  // Client-side search & service type filter
  const filtered = useMemo(() => {
    let result = services;
    if (selectedType) {
      const typeObj = serviceTypes.find(t => t._id === selectedType);
      const typeName = typeObj ? typeObj.name.toLowerCase() : '';
      result = result.filter(s =>
        (s.serviceTypeId && s.serviceTypeId === selectedType) ||
        (s.subcategory && s.subcategory.toLowerCase() === typeName) ||
        (s.name && s.name.toLowerCase().includes(typeName))
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.tags?.some(t => t.toLowerCase().includes(q))
      );
    }
    return result;
  }, [services, serviceTypes, selectedType, search]);

  const displayHeroImg = customBanner?.heroImage || meta.img;
  const displayTitle = customBanner?.title || decoded;
  const displaySubtitle = customBanner?.subtitle || (loading ? '…' : `${filtered?.length || 0} service${filtered?.length !== 1 ? 's' : ''} available`);
  const displayBadge = customBanner?.badge;

  const handleQtyChange = useCallback((id, qty) => {
    setQuantities(prev => ({ ...prev, [id]: qty }));
  }, []);

  const handleBook = useCallback((service, qty) => {
    navigate(`/book/${service._id}?qty=${qty}`);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      {/* Hero banner - Removed redundant 4rem paddingTop because MobileHeader already renders 65px spacer */}
      <div className="relative overflow-hidden">
        <div className="relative h-36 sm:h-44 overflow-hidden">
          {displayHeroImg && (
            <img
              src={displayHeroImg}
              alt={displayTitle}
              className="w-full h-full object-cover"
            />
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end p-5 pb-6">
            <button
              onClick={() => navigate(-1)}
              className="absolute top-4 left-4 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>

            {displayBadge && (
              <span className="bg-amber-400 text-slate-900 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full w-max mb-2 shadow-sm">
                {displayBadge}
              </span>
            )}

            <div className="flex items-center gap-3">
              <span className="text-4xl">{meta.icon}</span>
              <div>
                <h1 className="text-2xl font-extrabold text-white leading-tight">{displayTitle}</h1>
                <p className="text-white/80 text-sm mt-0.5 font-medium">
                  {displaySubtitle}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search + Sort bar */}
      <div className="sticky top-14 z-10 bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex gap-2">
          <div className="flex-1 flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2">
            <Search size={16} className="text-slate-400 shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Search in ${decoded}…`}
              className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>
          {/* Sort button */}
          <button
            onClick={() => setShowFilter(f => !f)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${showFilter ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600'}`}
          >
            <SlidersHorizontal size={15} />
            Sort
          </button>
        </div>

        {/* Dynamic Service Types Pills Bar */}
        {serviceTypes.length > 0 && (
          <div className="max-w-2xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setSelectedType('')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all ${
                selectedType === ''
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Services
            </button>
            {serviceTypes.map(st => (
              <button
                key={st._id}
                onClick={() => setSelectedType(st._id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 flex items-center gap-1 transition-all ${
                  selectedType === st._id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{st.icon || '🔧'}</span>
                <span>{st.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Sort dropdown */}
        {showFilter && (
          <div className="max-w-2xl mx-auto px-4 pb-3 flex gap-2 flex-wrap">
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => { setSort(opt.value); setShowFilter(false); }}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  sort === opt.value
                    ? 'text-white border-transparent'
                    : 'border-slate-200 text-slate-600 bg-white'
                }`}
                style={sort === opt.value ? { background: meta.accent, borderColor: meta.accent } : {}}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Trust badges */}
      <div className="max-w-2xl mx-auto px-4 py-3">
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
          {[
            { icon: '✅', text: 'Background Verified' },
            { icon: '⏱️', text: 'On-Time Guarantee' },
            { icon: '🔄', text: 'Free Re-service' },
            { icon: '💳', text: 'Pay After Service' },
          ].map(b => (
            <div key={b.text} className="flex items-center gap-1.5 whitespace-nowrap text-xs text-slate-600 bg-white px-3 py-1.5 rounded-full border border-slate-100 shadow-sm shrink-0">
              <span>{b.icon}</span> {b.text}
            </div>
          ))}
        </div>
      </div>

      {/* Services list */}
      <div className="max-w-2xl mx-auto px-4 pb-32 space-y-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <ServiceSkeleton key={i} />)
        ) : error ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">⚠️</div>
            <p className="text-slate-600 font-medium">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-6 py-2 rounded-xl text-white text-sm font-semibold"
              style={{ background: meta.accent }}
            >
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-lg font-bold text-slate-800">No services found</h3>
            <p className="text-slate-500 text-sm mt-1">
              {search ? `No results for "${search}"` : `No services available in ${decoded} yet.`}
            </p>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="mt-4 text-sm font-medium underline"
                style={{ color: meta.accent }}
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          filtered.map(service => (
            <ServiceCard
              key={service._id}
              service={service}
              qty={quantities[service._id] || 1}
              onQtyChange={handleQtyChange}
              onBook={handleBook}
              accentColor={meta.accent}
            />
          ))
        )}
      </div>

      {/* Floating "View Details" hint on first load */}
      {!loading && filtered.length > 0 && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center pointer-events-none z-20">
          <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-sm text-white text-xs px-4 py-2 rounded-full shadow-xl pointer-events-auto">
            <Info size={13} />
            Tap <strong>"More"</strong> on any card to see what's included
          </div>
        </div>
      )}
    </div>
  );
}
