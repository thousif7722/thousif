import React, { useEffect, useState } from 'react';
import { apiService } from '@/services/api';
import Header from '@/components/common/Header';
import {
  Plus, Edit2, Trash2, Search, X, Check, EyeOff, ChevronDown, Tag, ShieldCheck,
  Upload, Image as ImageIcon, Sparkles, RefreshCw, CheckCircle2, AlertCircle, Eye,
  Link as LinkIcon, Star, Clock, Shield, Camera
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── Realistic HD Service Photo Presets ──────────────────────────────────────
const CATEGORY_REALISTIC_PRESETS = {
  'AC Repair': [
    { title: 'AC Installation', alt: 'Technician installing indoor AC unit', url: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=800&q=80' },
    { title: 'AC Gas Charging', alt: 'Technician checking outdoor AC unit pressure & gas', url: 'https://images.unsplash.com/photo-1581094288338-2314dddb7ece?auto=format&fit=crop&w=800&q=80' },
    { title: 'AC PCB Repair', alt: 'Technician soldering & repairing AC circuit board', url: 'https://images.unsplash.com/photo-1597733336794-12d05021d510?auto=format&fit=crop&w=800&q=80' },
    { title: 'AC Deep Cleaning', alt: 'Technician jet foam cleaning AC filter coils', url: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80' },
    { title: 'AC Water Leakage', alt: 'Technician clearing AC drain line & water tray', url: 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=800&q=80' },
    { title: 'AC Compressor Repair', alt: 'Technician replacing outdoor AC compressor unit', url: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=800&q=80' },
    { title: 'AC Fan Motor Repair', alt: 'Technician servicing AC fan blower motor', url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80' },
    { title: 'AC Uninstallation', alt: 'Technician safely dismantling AC unit', url: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=800&q=80' },
    { title: 'AC Relocation', alt: 'Technician packing & relocating split AC', url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80' },
    { title: 'AC General Service', alt: 'Technician performing routine AC checkup & filter wash', url: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=800&q=80' },
  ],
  'Washing Machine': [
    { title: 'Front Load Service', alt: 'Technician inspecting front load washing machine drum', url: 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&w=800&q=80' },
    { title: 'Top Load Repair', alt: 'Technician fixing top load washing machine motor', url: 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?auto=format&fit=crop&w=800&q=80' },
    { title: 'Drain Pump Fix', alt: 'Technician clearing washing machine drain pump filter', url: 'https://images.unsplash.com/photo-1563770660941-20978e870e26?auto=format&fit=crop&w=800&q=80' },
  ],
  'Fridge & Cooler': [
    { title: 'Double Door Refrigerator', alt: 'Technician testing fridge cooling & gas pressure', url: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=800&q=80' },
    { title: 'Compressor Gas Refill', alt: 'Technician charging R600a eco gas in fridge', url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80' },
  ],
  'Cleaning': [
    { title: 'Full Home Deep Clean', alt: 'Professional cleaning crew with floor scrubber', url: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80' },
    { title: 'Sofa & Upholstery Shampoo', alt: 'Cleaners vacuuming and shampooing luxury sofa', url: 'https://images.unsplash.com/photo-1603712725038-e9334ae8f39f?auto=format&fit=crop&w=800&q=80' },
  ],
  'Plumbing': [
    { title: 'Pipe & Sink Leak Fix', alt: 'Plumber using wrench under kitchen sink pipe', url: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=800&q=80' },
    { title: 'Tap & Shower Fitting', alt: 'Plumber installing modern chrome bathroom faucet', url: 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=800&q=80' },
  ],
  'Electrical': [
    { title: 'Wiring & MCB Repair', alt: 'Electrician working on main circuit breaker panel', url: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=800&q=80' },
    { title: 'Switchboard & Socket', alt: 'Electrician wiring modular wall switchboard', url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=800&q=80' },
  ],
  'Pest Control': [
    { title: 'Cockroach & Ant Spray', alt: 'Pest technician spraying gel & eco spray in kitchen', url: 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=800&q=80' },
  ],
  'Carpentry': [
    { title: 'Furniture Assembly & Repair', alt: 'Carpenter assembling wooden cabinet with power drill', url: 'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&w=800&q=80' },
  ],
  'Painting': [
    { title: 'Interior Room Wall Paint', alt: 'Painter using roller on interior living room wall', url: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=800&q=80' },
  ],
  'Salon': [
    { title: 'Haircut & Styling', alt: 'Stylist blow drying customer hair in salon chair', url: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80' },
  ],
};

// ── Category → Subcategory map (Canonical 21 Categories) ──────────────────────────────
const CATEGORY_OPTIONS = {
  'AC Repair & Services': {
    icon: '❄️',
    subcategories: ['Normal AC Service', 'AC Deep Cleaning', 'AC Gas Charging', 'AC Installation & Removal'],
  },
  'Washing Machine Repair': {
    icon: '🫧',
    subcategories: ['Front Load Repair', 'Top Load & Semi-Auto Repair'],
  },
  'Refrigerator Repair': {
    icon: '🧊',
    subcategories: ['Single & Double Door Repair', 'Fridge Gas Refill & Compressor'],
  },
  'RO & Water Purifier': {
    icon: '💧',
    subcategories: ['RO Filter Change & Service'],
  },
  'Geyser Repair': {
    icon: '🔥',
    subcategories: ['Electric & Gas Geyser Repair'],
  },
  'Air Cooler Repair': {
    icon: '🌬️',
    subcategories: ['Cooler Servicing & Repairs'],
  },
  'Microwave Repair': {
    icon: '📻',
    subcategories: ['Microwave Heating & PCB Fix'],
  },
  'Television Repair': {
    icon: '📺',
    subcategories: ['LED & Smart TV Repairs'],
  },
  'Chimney Repair & Cleaning': {
    icon: '🍳',
    subcategories: ['Chimney Cleaning & Servicing'],
  },
  'Dishwasher Repair': {
    icon: '🍽️',
    subcategories: ['Dishwasher Repairs'],
  },
  'Electrician Services': {
    icon: '⚡',
    subcategories: ['Switches & Wiring', 'Fan & Light Fitting'],
  },
  'Plumbing Services': {
    icon: '🔧',
    subcategories: ['Tap & Shower Repairs', 'Drainage & Pipe Unclogging'],
  },
  'Carpentry Services': {
    icon: '🪚',
    subcategories: ['Door & Lock Repairs'],
  },
  'House Painting': {
    icon: '🎨',
    subcategories: ['Interior Wall Painting'],
  },
  'Full Home Deep Cleaning': {
    icon: '🧹',
    subcategories: ['Apartment Deep Cleaning'],
  },
  'Sofa & Upholstery Cleaning': {
    icon: '🛋️',
    subcategories: ['Sofa & Mattress Shampoo'],
  },
  'Bathroom Cleaning': {
    icon: '🧼',
    subcategories: ['Bathroom Tile & Tap Clean'],
  },
  'Pest Control Services': {
    icon: '🐛',
    subcategories: ['Cockroach & General Pest'],
  },
  'Salon for Women': {
    icon: '💇‍♀️',
    subcategories: ['Facial & Waxing Packages'],
  },
  'Salon for Men': {
    icon: '💇‍♂️',
    subcategories: ['Grooming & Haircut'],
  },
  'Spa & Massage': {
    icon: '🧘',
    subcategories: ['Body Therapies'],
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

// ── Live Customer Mobile Card Simulation ──────────────────────────────────────
function CustomerCardPreview({ form }) {
  const currentImg = form.imageUrl || form.image;
  return (
    <div className="bg-slate-900/5 p-4 rounded-2xl border border-slate-200 space-y-2 mt-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
          <Eye size={12} className="text-primary-600" /> Live Customer Card Preview
        </span>
        <span className="text-[10px] text-slate-400">Updates dynamically</span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden max-w-sm mx-auto hover:shadow-md transition-all">
        {/* Card Header Image */}
        <div className="relative h-36 bg-slate-100 flex items-center justify-center overflow-hidden">
          {currentImg ? (
            <img
              src={currentImg}
              alt={form.imageAlt || form.name || 'Service thumbnail'}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none';
                if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div
            className={`w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400 p-4 text-center ${currentImg ? 'hidden' : 'flex'}`}
          >
            <div className="text-3xl mb-1">{form.icon || '🛠️'}</div>
            <span className="text-[10px] text-slate-400 font-medium">No realistic image set (icon fallback)</span>
          </div>

          {/* Badges Overlay */}
          <div className="absolute top-2 left-2 flex gap-1">
            <span className="bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <Star size={10} className="text-amber-400 fill-amber-400" /> 4.8
            </span>
          </div>
          <div className="absolute top-2 right-2">
            <span className="bg-emerald-500 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
              <Shield size={10} /> 30-Day Guarantee
            </span>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-3.5 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[10px] font-extrabold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-md uppercase">
                {form.category || 'Category'}
              </span>
              <h4 className="font-bold text-slate-800 text-sm mt-1 leading-snug">
                {form.name || 'Service Title'}
              </h4>
            </div>
            <div className="text-right shrink-0">
              <span className="text-sm font-extrabold text-slate-900">₹{form.basePrice || '499'}</span>
              <p className="text-[10px] text-slate-400 capitalize">{form.duration || 60} mins</p>
            </div>
          </div>

          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
            {form.description || 'Verified background-checked technicians for doorstep service.'}
          </p>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Clock size={11} /> Next slot available
            </span>
            <button type="button" className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-sm">
              Book Service
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Service Image Upload & Preset Selector Component ──────────────────────────
function ServiceImageManager({ form, set }) {
  const [tab, setTab] = useState('preset'); // 'preset' | 'upload' | 'url'
  const [uploading, setUploading] = useState(false);

  const categoryPresets = CATEGORY_REALISTIC_PRESETS[form.category] || CATEGORY_REALISTIC_PRESETS['AC Repair'] || [];
  const currentImg = form.imageUrl || form.image;

  async function handleFileUpload(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds 5MB limit');
      return;
    }
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a JPG, PNG, or WEBP image file');
      return;
    }

    setUploading(true);
    const toastId = toast.loading('Uploading photo directly to S3…');
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await apiService.uploadServiceImage(formData);
      const url = res.data.data.imageUrl;
      set('imageUrl', url);
      set('image', url);
      set('imageSource', 'upload');
      if (!form.imageAlt) set('imageAlt', `${form.name || 'Service'} realistic photo`);
      toast.success('Image uploaded to S3 successfully!', { id: toastId });
    } catch (err) {
      toast.error(err.response?.data?.error || 'S3 Upload failed. Please try again.', { id: toastId });
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFileUpload(file);
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
            <Camera size={14} className="text-primary-600" /> Service Image Manager
          </p>
          <p className="text-xs text-slate-400 mt-0.5">High-definition realistic photo displayed to customers</p>
        </div>
        {currentImg && (
          <button
            type="button"
            onClick={() => {
              set('imageUrl', '');
              set('image', '');
              set('imageAlt', '');
              set('imageSource', 'none');
              toast('Image removed', { icon: '🗑️' });
            }}
            className="text-xs text-red-600 font-bold hover:underline flex items-center gap-1"
          >
            <Trash2 size={13} /> Remove Image
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 p-1 bg-slate-200/60 rounded-xl text-xs font-bold">
        <button
          type="button"
          onClick={() => setTab('preset')}
          className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 ${tab === 'preset' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <Sparkles size={13} className="text-amber-500" /> HD Presets
        </button>
        <button
          type="button"
          onClick={() => setTab('upload')}
          className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 ${tab === 'upload' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <Upload size={13} className="text-primary-600" /> Upload File (S3)
        </button>
        <button
          type="button"
          onClick={() => setTab('url')}
          className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 ${tab === 'url' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <LinkIcon size={13} className="text-slate-600" /> Image URL
        </button>
      </div>

      {/* Tab Content: Presets */}
      {tab === 'preset' && (
        <div className="space-y-3">
          <p className="text-[11px] text-slate-500">
            Select a realistic photo preset for <span className="font-bold text-slate-700">{form.category || 'this category'}</span>:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto pr-1">
            {categoryPresets.map((preset, idx) => {
              const isSelected = currentImg === preset.url;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    set('imageUrl', preset.url);
                    set('image', preset.url);
                    set('imageAlt', preset.alt);
                    set('imageSource', 'preset');
                    toast.success(`Selected "${preset.title}" photo!`);
                  }}
                  className={`p-2 rounded-xl border text-left transition-all relative group overflow-hidden ${
                    isSelected ? 'border-primary-600 bg-primary-50/50 ring-2 ring-primary-500/20' : 'border-slate-200 bg-white hover:border-primary-300'
                  }`}
                >
                  <div className="h-16 rounded-lg bg-slate-100 overflow-hidden mb-1.5 relative">
                    <img src={preset.url} alt={preset.alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    {isSelected && (
                      <div className="absolute top-1 right-1 bg-primary-600 text-white rounded-full p-0.5 shadow">
                        <CheckCircle2 size={12} />
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] font-bold text-slate-800 leading-tight truncate">{preset.title}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab Content: Upload File */}
      {tab === 'upload' && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed border-primary-200 bg-white hover:bg-primary-50/20 rounded-2xl p-6 text-center transition-all cursor-pointer relative"
        >
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => handleFileUpload(e.target.files?.[0])}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            disabled={uploading}
          />
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center">
              {uploading ? <RefreshCw className="animate-spin" size={24} /> : <Upload size={24} />}
            </div>
            {uploading ? (
              <p className="text-xs font-bold text-primary-600 animate-pulse">Uploading photo to AWS S3…</p>
            ) : (
              <>
                <p className="text-xs font-bold text-slate-800">
                  Drag & Drop service photo here, or <span className="text-primary-600 underline">browse</span>
                </p>
                <p className="text-[10px] text-slate-400">Supports JPG, PNG, WEBP (Max 5MB). Stored directly in S3.</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab Content: Direct URL */}
      {tab === 'url' && (
        <div className="space-y-2">
          <input
            value={currentImg}
            onChange={(e) => {
              set('imageUrl', e.target.value);
              set('image', e.target.value);
              set('imageSource', 'url');
            }}
            placeholder="Paste S3/CDN Image URL (e.g. https://...)"
            className="input-field text-sm bg-white font-mono"
          />
        </div>
      )}

      {/* Alt Text Input */}
      {currentImg && (
        <div className="pt-2 border-t border-slate-200">
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Photo Description (Alt Text for SEO & Accessibility)</label>
          <input
            value={form.imageAlt || ''}
            onChange={(e) => set('imageAlt', e.target.value)}
            placeholder="e.g. Technician performing AC deep cleaning"
            className="input-field text-xs bg-white"
          />
        </div>
      )}

      {/* Live Customer Preview */}
      <CustomerCardPreview form={form} />
    </div>
  );
}

const EMPTY_FORM = {
  name: '', slug: '', category: '', subcategory: '',
  description: '', basePrice: '', duration: 60,
  priceType: 'fixed', icon: '', image: '', imageUrl: '', imageAlt: '', imageSource: 'none', isActive: true,
  tags: '', includes: '', excludes: '',
  gstPct: 18, isEmergencyAvailable: false, emergencyCharge: 0, visitCharge: 99,
  locationAvailability: 'all', allowedCities: 'Mumbai, Delhi, Bengaluru, Hyderabad, Chennai, Pune',
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
  const [activeTab, setActiveTab] = useState('services'); // 'services' | 'categories' | 'types'
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

  const [dbCategoriesList, setDbCategoriesList] = useState([]);
  const [dbServiceTypesList, setDbServiceTypesList] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const [resServices, resCats, resTypes] = await Promise.all([
        apiService.getServices(),
        apiService.getAdminCategories(),
        apiService.getAdminServiceTypes(),
      ]);

      const list = resServices.data.data || [];
      const catsList = resCats.data.data || [];
      const typesList = resTypes.data.data || [];

      setServices(list);
      setDbCategoriesList(catsList);
      setDbServiceTypesList(typesList);

      // Build dynamic categoryMap from DB
      const nextMap = { ...CATEGORY_OPTIONS };
      catsList.forEach(c => {
        const subTypes = typesList.filter(t => (t.categoryId?._id || t.categoryId) === c._id).map(t => t.name);
        nextMap[c.name] = {
          _id: c._id,
          icon: c.icon || '🛠️',
          subcategories: subTypes.length > 0 ? subTypes : (nextMap[c.name]?.subcategories || ['General Service', 'Repair', 'Installation']),
        };
      });

      // Also merge any legacy categories found in services
      list.forEach(s => {
        if (s.category && !nextMap[s.category]) {
          nextMap[s.category] = {
            icon: s.icon || '🛠️',
            subcategories: s.subcategory ? [s.subcategory] : ['General Service', 'Repair', 'Installation']
          };
        } else if (s.category && s.subcategory && !nextMap[s.category].subcategories.includes(s.subcategory)) {
          nextMap[s.category].subcategories.push(s.subcategory);
        }
      });

      setCategoryMap(nextMap);
    } catch { toast.error('Failed to load services & categories'); }
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

  async function handleSaveCategory(e) {
    e.preventDefault();
    const name = catForm.name.trim();
    if (!name) return toast.error('Category name is required');

    const subs = catForm.subcategories
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const subList = subs.length > 0 ? subs : ['General Service', 'Repair', 'Installation'];

    try {
      // Persist new Category to DB
      const resCat = await apiService.createCategory({
        name,
        icon: catForm.icon || '✨',
        shortDescription: `Services for ${name}`,
      });
      const newCatObj = resCat.data.data;

      // Create Service Types for this category in DB
      for (let i = 0; i < subList.length; i++) {
        await apiService.createServiceType({
          categoryId: newCatObj._id,
          name: subList[i],
          icon: catForm.icon || '✨',
          sortOrder: i + 1,
        }).catch(() => {});
      }

      toast.success(`Category "${name}" saved to database!`);
      setIsCatModalOpen(false);
      await load();

      if (isModalOpen) {
        setForm(f => ({
          ...f,
          category: name,
          subcategory: subList[0] || '',
          icon: catForm.icon || '✨',
        }));
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save category');
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
      gstPct: svc.gstPct ?? 18,
      isEmergencyAvailable: svc.isEmergencyAvailable ?? false,
      emergencyCharge: svc.emergencyCharge ?? 0,
      visitCharge: svc.visitCharge ?? 99,
      locationAvailability: svc.locationAvailability || 'all',
      allowedCities: Array.isArray(svc.allowedCities) ? svc.allowedCities.join(', ') : (svc.allowedCities || 'Mumbai, Delhi, Bengaluru, Hyderabad, Chennai, Pune'),
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
        gstPct: parseInt(form.gstPct) ?? 18,
        emergencyCharge: parseInt(form.emergencyCharge) || 0,
        visitCharge: parseInt(form.visitCharge) || 0,
        isEmergencyAvailable: Boolean(form.isEmergencyAvailable),
        allowedCities: form.allowedCities ? form.allowedCities.split(',').map(c => c.trim()).filter(Boolean) : [],
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
            <h1 className="text-2xl font-bold text-slate-900">Manage Service Catalog</h1>
            <p className="text-slate-500 text-sm mt-1">Central control for 21 Categories, Service Types, and Bookable Services</p>
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

        {/* Bookable Services Section */}
          <>
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
                {filtered.map(svc => {
                  const cardImg = svc.imageUrl || svc.image;
                  return (
                    <div key={svc._id} className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition flex flex-col overflow-hidden ${!svc.isActive ? 'opacity-55 border-dashed' : 'border-slate-200'}`}>
                      {/* Card Image Banner */}
                      {cardImg ? (
                        <div className="relative h-32 bg-slate-100 overflow-hidden group">
                          <img src={cardImg} alt={svc.imageAlt || svc.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          <div className="absolute top-2 right-2 flex gap-1">
                            <span className="bg-slate-900/70 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Camera size={10} /> {svc.imageSource || 'photo'}
                            </span>
                          </div>
                          <div className="absolute bottom-2 left-2">
                            <span className="bg-white/90 backdrop-blur-md text-slate-800 text-xs px-2 py-0.5 rounded-md font-extrabold shadow-sm">
                              {svc.icon || '🛠️'}
                            </span>
                          </div>
                        </div>
                      ) : null}

                      <div className="p-5 flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex gap-3 items-center">
                            {!cardImg && (
                              <div className="w-10 h-10 rounded-xl bg-primary-50 text-xl flex items-center justify-center border border-primary-100 shrink-0">
                                {svc.icon || '🛠️'}
                              </div>
                            )}
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
                    </div>
                  );
                })}
              </div>
            )}
          </>
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

              {/* ── Step 2: Name & Slug ── */}
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
                    className="input-field text-sm font-mono bg-white"
                  />
                </div>
              </div>

              {/* ── Step 3: Realistic Image Uploader & Live Card Preview ── */}
              <ServiceImageManager form={form} set={set} />

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
                <div className="grid grid-cols-3 gap-3 pt-1 border-t border-emerald-100">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">GST Rate (%)</label>
                    <input type="number" min="0" max="28" value={form.gstPct} onChange={e => set('gstPct', e.target.value)} className="input-field text-sm font-mono" placeholder="18" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Inspection Visit Fee (₹)</label>
                    <input type="number" min="0" value={form.visitCharge} onChange={e => set('visitCharge', e.target.value)} className="input-field text-sm font-mono" placeholder="99" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Emergency Fee (₹)</label>
                    <input type="number" min="0" value={form.emergencyCharge} onChange={e => set('emergencyCharge', e.target.value)} className="input-field text-sm font-mono text-amber-700" placeholder="299" disabled={!form.isEmergencyAvailable} />
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={form.isEmergencyAvailable} onChange={e => set('isEmergencyAvailable', e.target.checked)} className="rounded text-amber-500 w-4 h-4" />
                    ⚡ Enable 24/7 60-Min Emergency Dispatch
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Sort Order</label>
                    <input type="number" min="1" value={form.sortOrder} onChange={e => set('sortOrder', e.target.value)} className="input-field text-sm font-mono" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Popularity Score (0-100)</label>
                    <input type="number" min="0" max="100" value={form.popularityScore} onChange={e => set('popularityScore', e.target.value)} className="input-field text-sm font-mono" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Allowed Cities (comma separated)</label>
                  <input type="text" value={form.allowedCities} onChange={e => set('allowedCities', e.target.value)} className="input-field text-sm" placeholder="Mumbai, Delhi, Bengaluru, Hyderabad, Chennai, Pune" />
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
