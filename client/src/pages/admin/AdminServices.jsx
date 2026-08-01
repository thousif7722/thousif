import React, { useEffect, useState } from 'react';
import { apiService } from '@/services/api';
import Header from '@/components/common/Header';
import { Plus, Edit2, Trash2, Search, X, Check, EyeOff, ChevronDown, Tag, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

// ── Category → Subcategory map ──────────────────────────────────────────────
const CATEGORY_OPTIONS = {
  'AC Repair': {
    icon: '❄️',
    subcategories: ['Normal Service', 'Deep Clean', 'Gas Charging', 'Installation', 'Uninstallation', 'PCB Repair', 'Compressor Repair'],
  },
  'Washing Machine': {
    icon: '🫧',
    subcategories: ['Normal Service', 'Deep Clean', 'Repair', 'Installation', 'Drum Cleaning', 'Uninstallation'],
  },
  'Fridge & Cooler': {
    icon: '🧊',
    subcategories: ['Normal Service', 'Gas Refill', 'Repair', 'Deep Clean', 'Installation', 'Thermostat Repair'],
  },
  'Cleaning': {
    icon: '🧹',
    subcategories: ['Home Cleaning', 'Deep Clean', 'Bathroom Clean', 'Kitchen Clean', 'Sofa Clean', 'Carpet Clean'],
  },
  'Plumbing': {
    icon: '🔧',
    subcategories: ['Pipe Repair', 'Tap Fitting', 'Drainage Clean', 'Water Heater', 'Toilet Repair', 'Tank Cleaning'],
  },
  'Electrical': {
    icon: '⚡',
    subcategories: ['Wiring', 'Switch/Socket', 'Fan Installation', 'MCB/Fuse', 'Light Fitting', 'Inverter Setup'],
  },
  'Pest Control': {
    icon: '🐛',
    subcategories: ['Cockroach Treatment', 'Termite Treatment', 'Bed Bugs', 'Ant Control', 'Rodent Control', 'General Pest'],
  },
  'Carpentry': {
    icon: '🪚',
    subcategories: ['Furniture Repair', 'Door Fitting', 'Wardrobe', 'Shelf Fixing', 'Wood Polish', 'Custom Work'],
  },
  'Painting': {
    icon: '🎨',
    subcategories: ['Interior Paint', 'Exterior Paint', 'Texture Paint', 'Wall Putty', 'Waterproofing', 'Wood Paint'],
  },
  'Salon': {
    icon: '💇',
    subcategories: ['Haircut', 'Facial', 'Waxing', 'Manicure', 'Pedicure', 'Bridal Package'],
  },
};

const DEFAULT_CATEGORY_SPARES = {
  'AC Repair': [
    { name: 'AC Gas Top-Up (R32/R410)', price: 1499, icon: '❄️', isAvailable: true },
    { name: 'Compressor Capacitor (45 MFD)', price: 450, icon: '⚡', isAvailable: true },
    { name: 'PCB Circuit Board Repair', price: 1200, icon: '🔌', isAvailable: true },
    { name: 'Drain Pipe Flushing & Jet Wash', price: 299, icon: '🚰', isAvailable: true },
    { name: 'Deep Foam Chemical Jet Service', price: 499, icon: '🧼', isAvailable: true },
    { name: 'Copper Pipe Fitting (per meter)', price: 350, icon: '🛠️', isAvailable: true },
  ],
  'Washing Machine': [
    { name: 'Drain Pump Replacement', price: 650, icon: '🌊', isAvailable: true },
    { name: 'Drive Belt Replacement', price: 350, icon: '⚙️', isAvailable: true },
    { name: 'Inlet Solenoid Valve Fix', price: 400, icon: '🚰', isAvailable: true },
    { name: 'Control Board PCB Repair', price: 1500, icon: '🔌', isAvailable: true },
    { name: 'Motor Carbon Brush Pair', price: 280, icon: '⚡', isAvailable: true },
    { name: 'Tub Suspension Spring Set', price: 450, icon: '🛠️', isAvailable: true },
  ],
  'Fridge & Cooler': [
    { name: 'Thermostat Replacement', price: 550, icon: '🌡️', isAvailable: true },
    { name: 'Refrigerator Gas Charging (R134a/R600)', price: 1250, icon: '❄️', isAvailable: true },
    { name: 'Relay & Overload Protector (OLP)', price: 380, icon: '⚡', isAvailable: true },
    { name: 'Door Gasket Magnetic Rubber Seal', price: 450, icon: '🚪', isAvailable: true },
    { name: 'Evaporator Fan Motor', price: 750, icon: '🌀', isAvailable: true },
  ],
  'Water Purifier': [
    { name: 'Sediment Filter Cartridge', price: 250, icon: '💧', isAvailable: true },
    { name: 'Activated Carbon Filter', price: 350, icon: '🧪', isAvailable: true },
    { name: 'RO Membrane (75 GPD)', price: 850, icon: '🌊', isAvailable: true },
    { name: 'Booster Pump 24V DC', price: 1450, icon: '⚙️', isAvailable: true },
    { name: 'UV Lamp & Choke Kit', price: 450, icon: '💡', isAvailable: true },
    { name: 'SMPS Power Adaptor 24V', price: 500, icon: '🔌', isAvailable: true },
  ],
  'Geyser': [
    { name: 'Heating Element (2kW Heavy Duty)', price: 750, icon: '🔥', isAvailable: true },
    { name: 'Geyser Thermostat Cutout', price: 350, icon: '🌡️', isAvailable: true },
    { name: 'Safety Pressure Valve', price: 280, icon: '🛡️', isAvailable: true },
    { name: 'Anode Rod Anti-Rust', price: 320, icon: '🔩', isAvailable: true },
  ],
  'Microwave': [
    { name: 'Magnetron Heating Unit', price: 1250, icon: '📻', isAvailable: true },
    { name: 'High Voltage Capacitor & Diode', price: 450, icon: '⚡', isAvailable: true },
    { name: 'Door Safety Micro Switch', price: 220, icon: '🔘', isAvailable: true },
    { name: 'Glass Turntable Ring & Coupler', price: 180, icon: '🍽️', isAvailable: true },
  ],
  'TV Repair': [
    { name: 'LED Backlight Strip Kit Replacement', price: 1650, icon: '📺', isAvailable: true },
    { name: 'Power Supply Board Repair', price: 950, icon: '⚡', isAvailable: true },
    { name: 'Main Motherboard IC Repair', price: 1450, icon: '🖥️', isAvailable: true },
    { name: 'T-Con Board Replacement', price: 850, icon: '🔌', isAvailable: true },
  ],
  'Plumbing': [
    { name: 'Tap Washer / Leak Seal Fix', price: 180, icon: '🔧', isAvailable: true },
    { name: 'Flush Tank Mechanism Kit', price: 480, icon: '🚰', isAvailable: true },
    { name: 'P-Trap / Waste Pipe Fix', price: 250, icon: '🛠️', isAvailable: true },
    { name: 'CPVC Ball Valve 1 inch', price: 320, icon: '🔩', isAvailable: true },
    { name: 'Health Faucet Gun & Hose', price: 350, icon: '🚿', isAvailable: true },
  ],
  'Electrical': [
    { name: 'Electrical MCB Switch Replacement', price: 250, icon: '💡', isAvailable: true },
    { name: 'Modular Socket 16A Change', price: 180, icon: '🔌', isAvailable: true },
    { name: 'Ceiling Fan Capacitor 2.5 MFD', price: 150, icon: '⚡', isAvailable: true },
    { name: 'Heavy Wire Wiring (per meter)', price: 90, icon: '🧵', isAvailable: true },
    { name: 'Main Distribution Box 4-Way', price: 650, icon: '📦', isAvailable: true },
  ],
  'Cleaning': [
    { name: 'Deep Foam Chemical Refill Bottle', price: 250, icon: '🧼', isAvailable: true },
    { name: 'Microfiber Cleaning Towel Pack (3x)', price: 150, icon: '🧽', isAvailable: true },
    { name: 'High Pressure Water Jet Nozzle Tip', price: 200, icon: '🚰', isAvailable: true },
  ],
  'Pest Control': [
    { name: 'Cockroach Herbal Gel Bait Syringe', price: 299, icon: '🪳', isAvailable: true },
    { name: 'Termite Chemical Treatment Fluid (1L)', price: 650, icon: '🐛', isAvailable: true },
    { name: 'Rat Glue Traps Heavy (Set of 2)', price: 180, icon: '🐀', isAvailable: true },
  ],
  'Carpentry': [
    { name: 'SS Stainless Steel Door Hinges (Pair)', price: 220, icon: '🚪', isAvailable: true },
    { name: 'Heavy Duty Drawer Telescopic Channel Pair', price: 380, icon: '🗄️', isAvailable: true },
    { name: 'Hydraulic Soft Close Cabinet Hinge Pair', price: 320, icon: '🪚', isAvailable: true },
    { name: 'Door Latch / Tower Bolt 6 inch', price: 160, icon: '🔒', isAvailable: true },
  ],
};

const PRICE_TYPES = ['fixed', 'hourly', 'quote'];

const EMPTY_FORM = {
  name: '', slug: '', category: '', subcategory: '',
  description: '', basePrice: '', duration: 60,
  priceType: 'fixed', icon: '', image: '', isActive: true,
  tags: '', includes: '', excludes: '',
  warrantyDays: 30, plusDiscountPct: 10, minProviderTier: 'any',
  popularityScore: 70, sortOrder: 99,
};

function getCategorySpares(categoryStr = '', serviceNameStr = '') {
  const text = `${categoryStr} ${serviceNameStr}`.toLowerCase();
  
  if (text.includes('wash') || text.includes('laundry')) return DEFAULT_CATEGORY_SPARES['Washing Machine'];
  if (text.includes('ac') || text.includes('air condition') || text.includes('cooling')) return DEFAULT_CATEGORY_SPARES['AC Repair'];
  if (text.includes('fridge') || text.includes('refrigerat') || text.includes('freezer') || text.includes('cooler')) return DEFAULT_CATEGORY_SPARES['Fridge & Cooler'];
  if (text.includes('water') || text.includes('ro') || text.includes('purifier')) return DEFAULT_CATEGORY_SPARES['Water Purifier'];
  if (text.includes('geyser') || text.includes('heater')) return DEFAULT_CATEGORY_SPARES['Geyser'];
  if (text.includes('microwave') || text.includes('oven')) return DEFAULT_CATEGORY_SPARES['Microwave'];
  if (text.includes('tv') || text.includes('television')) return DEFAULT_CATEGORY_SPARES['TV Repair'];
  if (text.includes('plumb') || text.includes('tap') || text.includes('leak')) return DEFAULT_CATEGORY_SPARES['Plumbing'];
  if (text.includes('electr') || text.includes('switch') || text.includes('fan') || text.includes('mcb')) return DEFAULT_CATEGORY_SPARES['Electrical'];
  if (text.includes('clean')) return DEFAULT_CATEGORY_SPARES['Cleaning'];
  if (text.includes('pest')) return DEFAULT_CATEGORY_SPARES['Pest Control'];
  if (text.includes('carpent') || text.includes('door') || text.includes('furniture')) return DEFAULT_CATEGORY_SPARES['Carpentry'];

  return DEFAULT_CATEGORY_SPARES['AC Repair'];
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function AdminServices() {
  const [services, setServices] = useState([]);
  const [categoryMap, setCategoryMap] = useState(CATEGORY_OPTIONS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', icon: '✨', subcategories: '' });

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiService.getServices();
      const list = res.data.data || [];
      setServices(list);

      // Dynamically extract any custom categories present in DB
      setCategoryMap(prev => {
        const next = { ...prev };
        list.forEach(s => {
          if (s.category && !next[s.category]) {
            next[s.category] = {
              icon: s.icon || '🛠️',
              subcategories: s.subcategory ? [s.subcategory] : ['General Service', 'Repair', 'Installation']
            };
          } else if (s.category && s.subcategory && !next[s.category].subcategories.includes(s.subcategory)) {
            next[s.category].subcategories.push(s.subcategory);
          }
        });
        return next;
      });
    } catch { toast.error('Failed to load services'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, spareParts: DEFAULT_CATEGORY_SPARES['AC Repair'] });
    setIsModalOpen(true);
  }

  function openAddCategory() {
    setCatForm({ name: '', icon: '✨', subcategories: 'General Repair, Installation, Maintenance' });
    setIsCatModalOpen(true);
  }

  function handleSaveCategory(e) {
    e.preventDefault();
    const name = catForm.name.trim();
    if (!name) return toast.error('Category name is required');

    const subs = catForm.subcategories
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const subList = subs.length > 0 ? subs : ['General Service', 'Repair', 'Installation'];

    setCategoryMap(prev => ({
      ...prev,
      [name]: {
        icon: catForm.icon || '✨',
        subcategories: subList,
      }
    }));

    toast.success(`Category "${name}" added!`);
    setIsCatModalOpen(false);

    // If service modal is currently open, auto-select this new category
    if (isModalOpen) {
      setForm(f => ({
        ...f,
        category: name,
        subcategory: subList[0] || '',
        icon: catForm.icon || '✨',
      }));
    }
  }

  function openEdit(svc) {
    setEditingId(svc._id);
    const catSpares = getCategorySpares(svc.category, svc.name);

    // Detect if existing stored spareParts are invalid/mismatched AC defaults
    const isWashingOrNonAC = !`${svc.category} ${svc.name}`.toLowerCase().includes('ac');
    const hasACMismatch = isWashingOrNonAC && Array.isArray(svc.spareParts) && svc.spareParts.some(p => (p.name || '').toLowerCase().includes('ac gas'));

    const hasValidSpares = Array.isArray(svc.spareParts) && svc.spareParts.length > 0 && !hasACMismatch;
    const initialSpares = hasValidSpares ? svc.spareParts : catSpares;

    setForm({
      name: svc.name || '', slug: svc.slug || '',
      category: svc.category || '', subcategory: svc.subcategory || '',
      description: svc.description || '', basePrice: svc.basePrice || '',
      duration: svc.duration || 60, priceType: svc.priceType || 'fixed',
      icon: svc.icon || '', image: svc.image || '', isActive: svc.isActive !== false,
      tags: (svc.tags || []).join(', '),
      includes: (svc.includes || []).join(', '),
      excludes: (svc.excludes || []).join(', '),
      spareParts: initialSpares,
      warrantyDays: svc.warrantyDays ?? 30,
      plusDiscountPct: svc.plusDiscountPct ?? 10,
      minProviderTier: svc.minProviderTier || 'any',
      popularityScore: svc.popularityScore ?? 70,
      sortOrder: svc.sortOrder ?? 99,
    });
    setIsModalOpen(true);
  }

  function set(key, val) {
    setForm(f => {
      const next = { ...f, [key]: val };
      // Auto-fill icon & spare parts from category
      if (key === 'category') {
        if (categoryMap[val]) {
          next.icon = next.icon || categoryMap[val].icon;
          next.subcategory = '';
        }
        next.spareParts = getCategorySpares(val, next.name);
      }
      // Auto-generate name + slug from category + subcategory
      if ((key === 'category' || key === 'subcategory')) {
        const cat = key === 'category' ? val : next.category;
        const sub = key === 'subcategory' ? val : next.subcategory;
        if (cat && sub) {
          const fullName = `${cat} - ${sub}`;
          if (!next.name || next.name.startsWith(cat)) next.name = fullName;
          next.slug = slugify(fullName);
        }
      }
      if (key === 'name') next.slug = slugify(val);
      return next;
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        basePrice: parseInt(form.basePrice) || 0,
        duration: parseInt(form.duration) || 60,
        warrantyDays: parseInt(form.warrantyDays) || 30,
        plusDiscountPct: parseInt(form.plusDiscountPct) || 0,
        minProviderTier: form.minProviderTier || 'any',
        popularityScore: parseInt(form.popularityScore) || 70,
        sortOrder: parseInt(form.sortOrder) || 99,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        includes: form.includes ? form.includes.split(',').map(t => t.trim()).filter(Boolean) : [],
        excludes: form.excludes ? form.excludes.split(',').map(t => t.trim()).filter(Boolean) : [],
      };
      if (editingId) {
        await apiService.updateService(editingId, payload);
        toast.success('Service updated!');
      } else {
        await apiService.createService(payload);
        toast.success('Service created!');
      }
      setIsModalOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!window.confirm('Deactivate this service?')) return;
    try {
      await apiService.deleteService(id);
      toast.success('Service deactivated');
      load();
    } catch { toast.error('Failed'); }
  }

  const filtered = services.filter(s => {
    const q = search.toLowerCase();
    const matchQ = !q || s.name?.toLowerCase().includes(q) || s.category?.toLowerCase().includes(q) || s.subcategory?.toLowerCase().includes(q);
    const matchCat = !filterCat || s.category === filterCat;
    return matchQ && matchCat;
  });

  const subcats = categoryMap[form.category]?.subcategories || [];

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header />
      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Manage Services</h1>
            <p className="text-slate-500 text-sm mt-1">{services.length} services across {Object.keys(categoryMap).length} categories</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={openAddCategory} className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white font-bold text-sm text-slate-700 hover:bg-slate-50 shadow-sm flex items-center gap-2 transition-all">
              <Plus size={16} className="text-primary-600" /> Add Category
            </button>
            <button onClick={openAdd} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Add Service
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 flex-1 shadow-sm">
            <Search size={16} className="text-slate-400 shrink-0" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search services…"
              className="flex-1 outline-none text-sm text-slate-800 bg-transparent"
            />
            {search && <button onClick={() => setSearch('')}><X size={14} className="text-slate-400" /></button>}
          </div>
          <select
            value={filterCat} onChange={e => setFilterCat(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 shadow-sm outline-none cursor-pointer"
          >
            <option value="">All Categories</option>
            {Object.keys(categoryMap).map(c => (
              <option key={c} value={c}>{categoryMap[c].icon} {c}</option>
            ))}
          </select>
        </div>

        {/* Services grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse h-44" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center bg-white p-10 rounded-2xl border border-slate-200">
            <div className="text-5xl mb-3">🛠️</div>
            <h2 className="text-lg font-semibold text-slate-800">No services found</h2>
            <button onClick={openAdd} className="btn-primary mt-4 inline-flex gap-2"><Plus size={16} /> Add Service</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(svc => (
              <div key={svc._id} className={`bg-white rounded-2xl border shadow-sm p-5 hover:shadow-md transition flex flex-col ${!svc.isActive ? 'opacity-55 border-dashed' : 'border-slate-200'}`}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex gap-3 items-center">
                    <div className="w-10 h-10 rounded-xl bg-primary-50 text-xl flex items-center justify-center border border-primary-100 shrink-0">
                      {svc.icon || '🛠️'}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 leading-tight text-sm">{svc.name}</h3>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{svc.category}</span>
                        {svc.subcategory && (
                          <span className="text-xs text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">{svc.subcategory}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(svc)} className="text-slate-400 hover:text-primary-600 p-1.5 rounded-lg hover:bg-primary-50 transition">
                      <Edit2 size={14} />
                    </button>
                    {svc.isActive && (
                      <button onClick={() => handleDelete(svc._id)} className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-500 line-clamp-2 flex-1 mb-3">{svc.description}</p>

                {svc.includes?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {svc.includes.slice(0, 3).map(inc => (
                      <span key={inc} className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded-full">{inc}</span>
                    ))}
                    {svc.includes.length > 3 && <span className="text-[10px] text-slate-400">+{svc.includes.length - 3} more</span>}
                  </div>
                )}

                <div className="bg-slate-50 px-3 py-2 rounded-xl flex items-center justify-between text-sm border border-slate-100 mt-auto">
                  <span className="font-bold text-slate-900">₹{svc.basePrice?.toLocaleString('en-IN')}</span>
                  <span className="text-slate-400 text-xs capitalize">{svc.priceType} · {svc.duration}m</span>
                  {!svc.isActive && <EyeOff size={13} className="text-red-400 ml-1" title="Inactive" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal ─────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            {/* Modal header */}
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex justify-between items-center rounded-t-2xl z-10">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{editingId ? 'Edit Service' : 'Add New Service'}</h2>
                <p className="text-sm text-slate-400 mt-0.5">Fill in the details below</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5">

              {/* ── Step 1: Category & Subcategory ── */}
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Step 1 — Choose Category & Type</p>
                  <button
                    type="button"
                    onClick={openAddCategory}
                    className="text-xs text-blue-700 font-bold hover:underline flex items-center gap-1"
                  >
                    <Plus size={13} /> Add New Category
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Category *</label>
                    <select
                      required
                      value={form.category}
                      onChange={e => set('category', e.target.value)}
                      className="input-field text-sm"
                    >
                      <option value="">Select category…</option>
                      {Object.entries(categoryMap).map(([name, cfg]) => (
                        <option key={name} value={name}>{cfg.icon} {name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Service Type *</label>
                    <select
                      required
                      value={form.subcategory}
                      onChange={e => set('subcategory', e.target.value)}
                      disabled={!form.category}
                      className="input-field text-sm disabled:opacity-50"
                    >
                      <option value="">Select type…</option>
                      {subcats.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* ── Step 2: Name, Slug, Icon ── */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Step 2 — Name & Identity</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Service Name *</label>
                    <input
                      required value={form.name}
                      onChange={e => set('name', e.target.value)}
                      className="input-field text-sm"
                      placeholder="e.g. AC Repair - Gas Charging"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Icon (Emoji)</label>
                    <input
                      value={form.icon}
                      onChange={e => set('icon', e.target.value)}
                      className="input-field text-sm text-center text-2xl"
                      placeholder="❄️"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Slug (URL-safe) *</label>
                  <input
                    required value={form.slug}
                    onChange={e => set('slug', e.target.value)}
                    className="input-field text-sm font-mono bg-white mb-3"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Service Card Image URL (Optional)</label>
                  <input
                    value={form.image}
                    onChange={e => set('image', e.target.value)}
                    className="input-field text-sm bg-white"
                    placeholder="https://images.unsplash.com/... or Base64 Image URL"
                  />
                </div>
              </div>

              {/* ── Step 3: Description ── */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Description *</label>
                <textarea
                  required rows={3} value={form.description}
                  onChange={e => set('description', e.target.value)}
                  className="input-field resize-none text-sm"
                  placeholder="What does this service include? What problem does it solve?"
                />
              </div>

              {/* ── Step 4: Pricing & Duration ── */}
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 space-y-3">
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Step 3 — Pricing</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Base Price (₹) *</label>
                    <input
                      type="number" required min="0"
                      value={form.basePrice}
                      onChange={e => set('basePrice', e.target.value)}
                      className="input-field font-mono text-sm"
                      placeholder="499"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Duration (mins) *</label>
                    <input
                      type="number" required min="1"
                      value={form.duration}
                      onChange={e => set('duration', e.target.value)}
                      className="input-field font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Price Type</label>
                    <select
                      value={form.priceType}
                      onChange={e => set('priceType', e.target.value)}
                      className="input-field text-sm"
                    >
                      {PRICE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Sort Order</label>
                    <input type="number" min="1" value={form.sortOrder} onChange={e => set('sortOrder', e.target.value)} className="input-field text-sm font-mono" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Popularity Score (0-100)</label>
                    <input type="number" min="0" max="100" value={form.popularityScore} onChange={e => set('popularityScore', e.target.value)} className="input-field text-sm font-mono" />
                  </div>
                </div>
              </div>

              {/* ── Step 5: Tags, Includes, Excludes ── */}
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 space-y-3">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1"><Tag size={11} /> Step 4 — What's Included</p>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Includes (comma-separated)</label>
                  <input
                    value={form.includes}
                    onChange={e => set('includes', e.target.value)}
                    className="input-field text-sm"
                    placeholder="Gas refill, Leak check, Performance test"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Excludes (comma-separated)</label>
                  <input
                    value={form.excludes}
                    onChange={e => set('excludes', e.target.value)}
                    className="input-field text-sm"
                    placeholder="Spare parts cost, Repair of leaks"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Search Tags (comma-separated)</label>
                  <input
                    value={form.tags}
                    onChange={e => set('tags', e.target.value)}
                    className="input-field text-sm"
                    placeholder="ac, gas, cooling, split ac"
                  />
                </div>
              </div>

              {/* ── Step 6: Dynamic Spare Parts & Rate-Card Items ── */}
              <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center gap-2">
                  <p className="text-xs font-bold text-purple-700 uppercase tracking-wide">Step 5 — Spare Parts Rate Card (Admin Defined)</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const defaults = getCategorySpares(form.category);
                        setForm(f => ({ ...f, spareParts: defaults }));
                        toast.success(`Loaded standard ${form.category || 'category'} spares!`);
                      }}
                      className="bg-purple-100 text-purple-800 hover:bg-purple-200 font-bold text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
                      title="Load standard preset spare parts & rates for this service category"
                    >
                      ⚡ Load Preset Spares
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setForm(f => ({
                          ...f,
                          spareParts: [...(f.spareParts || []), { name: '', price: '', icon: '🔧', isAvailable: true }]
                        }));
                      }}
                      className="bg-purple-600 text-white font-bold text-xs px-2.5 py-1 rounded-lg hover:bg-purple-700 flex items-center gap-1 shadow-sm"
                    >
                      <Plus size={13} /> Add Part
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-purple-600">Technicians will see these fixed part rates in their inspection quote menu.</p>
                
                {(!form.spareParts || form.spareParts.length === 0) ? (
                  <p className="text-xs text-slate-400 italic">No custom spare parts defined for this service yet. Standard defaults will apply.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {form.spareParts.map((sp, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-purple-100 text-xs">
                        <input
                          type="text"
                          placeholder="Icon (e.g. ⚡)"
                          value={sp.icon || '🔧'}
                          onChange={e => {
                            const updated = [...form.spareParts];
                            updated[idx].icon = e.target.value;
                            setForm(f => ({ ...f, spareParts: updated }));
                          }}
                          className="w-10 text-center border border-slate-200 rounded-lg p-1.5"
                        />
                        <input
                          type="text"
                          placeholder="Spare Part Name (e.g. Capacitor 45 MFD)"
                          value={sp.name}
                          onChange={e => {
                            const updated = [...form.spareParts];
                            updated[idx].name = e.target.value;
                            setForm(f => ({ ...f, spareParts: updated }));
                          }}
                          className="flex-1 border border-slate-200 rounded-lg p-1.5"
                        />
                        <input
                          type="number"
                          placeholder="₹ Price"
                          value={sp.price}
                          onChange={e => {
                            const updated = [...form.spareParts];
                            updated[idx].price = Number(e.target.value);
                            setForm(f => ({ ...f, spareParts: updated }));
                          }}
                          className="w-20 border border-slate-200 rounded-lg p-1.5"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = form.spareParts.filter((_, i) => i !== idx);
                            setForm(f => ({ ...f, spareParts: updated }));
                          }}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Step 6: Warranty & Plus Subscriber Discount ── */}
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 space-y-3">
                <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide flex items-center gap-1">
                  <ShieldCheck size={13} /> Step 6 — Service Guarantee & Plus Offer
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Protection Warranty (Days)</label>
                    <input
                      type="number"
                      value={form.warrantyDays}
                      onChange={e => set('warrantyDays', e.target.value)}
                      className="input-field text-sm"
                      placeholder="30"
                    />
                    <p className="text-[10px] text-emerald-600 mt-1">Shown to customer on booking page</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Plus Member Discount (%)</label>
                    <input
                      type="number"
                      value={form.plusDiscountPct}
                      onChange={e => set('plusDiscountPct', e.target.value)}
                      className="input-field text-sm"
                      placeholder="10"
                    />
                    <p className="text-[10px] text-emerald-600 mt-1">Special price for Plus subscribers</p>
                  </div>
                </div>
              </div>

              {/* 📱 Live Customer App View Preview Card */}
              <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-md space-y-2">
                <div className="flex justify-between items-center text-xs text-slate-400 font-mono">
                  <span>📱 LIVE CUSTOMER APP PREVIEW</span>
                  <span className="text-emerald-400 font-bold">✓ Active Preview</span>
                </div>
                <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{form.icon || '🛠️'}</span>
                    <div>
                      <h4 className="font-bold text-sm text-white">{form.name || 'Service Title'}</h4>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-300">
                        <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-medium">🛡️ {form.warrantyDays || 30}-Day Guarantee</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-white">₹{form.basePrice || 0}</div>
                    {Number(form.plusDiscountPct) > 0 && (
                      <div className="text-[10px] text-purple-300 font-semibold">
                        Plus: ₹{Math.round((Number(form.basePrice) || 0) * (1 - (Number(form.plusDiscountPct) || 10) / 100))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Active toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={form.isActive} onChange={e => set('isActive', e.target.checked)} />
                  <div className={`block w-12 h-7 rounded-full transition-colors ${form.isActive ? 'bg-primary-500' : 'bg-slate-300'}`} />
                  <div className={`dot absolute left-1 top-1 bg-white w-5 h-5 rounded-full shadow transition-transform ${form.isActive ? 'translate-x-5' : ''}`} />
                </div>
                <span className="text-sm font-medium text-slate-700">Active — visible to customers</span>
              </label>

              {/* Buttons */}
              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition text-sm">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl btn-primary flex items-center justify-center gap-2 text-sm font-semibold">
                  {saving ? <span className="animate-spin">↻</span> : <Check size={16} />}
                  {saving ? 'Saving…' : (editingId ? 'Save Changes' : 'Create Service')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Category Modal ──────────────────────────────────────────────── */}
      {isCatModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">Add New Service Category</h3>
                <p className="text-xs text-slate-400">Expand your ServiceHub catalog categories</p>
              </div>
              <button onClick={() => setIsCatModalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  value={catForm.name}
                  onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Solar Services, Home Salon, Car Wash"
                  className="input-field text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category Icon / Emoji</label>
                <input
                  type="text"
                  value={catForm.icon}
                  onChange={e => setCatForm(f => ({ ...f, icon: e.target.value }))}
                  placeholder="☀️"
                  className="input-field text-sm text-center text-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Subcategories / Service Types (comma separated)</label>
                <textarea
                  rows={3}
                  value={catForm.subcategories}
                  onChange={e => setCatForm(f => ({ ...f, subcategories: e.target.value }))}
                  placeholder="Installation, Repair, Deep Cleaning, Maintenance"
                  className="input-field text-sm resize-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">These will appear as dropdown types when adding services under this category.</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCatModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 font-semibold text-sm text-slate-700 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl btn-primary font-semibold text-sm flex items-center justify-center gap-1.5"
                >
                  <Plus size={16} /> Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
