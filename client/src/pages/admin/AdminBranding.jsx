import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import Header from '@/components/common/Header';
import { apiService } from '@/services/api';
import { updateSettingsState } from '@/store/slices/serviceSlice';
import toast from 'react-hot-toast';
import {
  Image, Trash2, Upload, RefreshCw, Shield, Smartphone,
  FileText, Monitor, Star, AlertCircle, CheckCircle2, X,
  CloudUpload, Eye, Loader2, Info,
} from 'lucide-react';

// ─── Asset Configuration ───────────────────────────────────────────────────────
const ASSET_CONFIG = [
  {
    type: 'logo',
    label: 'Main Logo',
    description: 'Primary brand logo used in the header and navigation bar across all pages.',
    icon: Star,
    color: 'from-primary-500 to-teal-500',
    bg: 'bg-primary-50',
    border: 'border-primary-200',
    accent: 'text-primary-600',
    badgeBg: 'bg-primary-100',
    badgeText: 'text-primary-700',
    maxSize: '5 MB',
    formats: 'PNG, JPG, WEBP, SVG',
    recommendedSize: '400×120 px',
  },
  {
    type: 'favicon',
    label: 'Favicon / Browser Icon',
    description: 'Small icon displayed in browser tabs and bookmarks.',
    icon: Monitor,
    color: 'from-indigo-500 to-purple-500',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    accent: 'text-indigo-600',
    badgeBg: 'bg-indigo-100',
    badgeText: 'text-indigo-700',
    maxSize: '2 MB',
    formats: 'PNG, ICO, SVG',
    recommendedSize: '32×32 or 48×48 px',
  },
  {
    type: 'darkLogo',
    label: 'Dark Mode Logo',
    description: 'Alternative logo for dark-themed interfaces and dark headers.',
    icon: Eye,
    color: 'from-slate-500 to-slate-700',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    accent: 'text-slate-600',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    maxSize: '5 MB',
    formats: 'PNG, JPG, WEBP, SVG',
    recommendedSize: '400×120 px',
  },
  {
    type: 'appIcon',
    label: 'App Icon',
    description: 'Square icon used for the mobile app and PWA home-screen shortcut.',
    icon: Smartphone,
    color: 'from-amber-500 to-orange-500',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    accent: 'text-amber-600',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    maxSize: '5 MB',
    formats: 'PNG, JPG, WEBP',
    recommendedSize: '512×512 px',
  },
  {
    type: 'loginLogo',
    label: 'Login Page Logo',
    description: 'Logo shown on the login / sign-in page, usually larger and centred.',
    icon: Shield,
    color: 'from-emerald-500 to-green-500',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    accent: 'text-emerald-600',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-700',
    maxSize: '5 MB',
    formats: 'PNG, JPG, WEBP, SVG',
    recommendedSize: '300×100 px',
  },
  {
    type: 'invoiceLogo',
    label: 'Invoice Logo',
    description: 'Logo embedded in PDF invoices sent to customers after every booking.',
    icon: FileText,
    color: 'from-rose-500 to-pink-500',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    accent: 'text-rose-600',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-700',
    maxSize: '5 MB',
    formats: 'PNG, JPG, WEBP, SVG',
    recommendedSize: '300×100 px',
  },
];

// ─── Single Branding Card ───────────────────────────────────────────────────────
function BrandingCard({ config, asset, onUploaded, onRemoved }) {
  const { type, label, description, icon: Icon, color, bg, border, accent, badgeBg, badgeText, maxSize, formats, recommendedSize } = config;

  const inputRef = useRef(null);
  const [dragover, setDragover] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState(null); // local object-URL before upload
  const [confirmDelete, setConfirmDelete] = useState(false);

  const currentUrl = asset?.url || null;
  const hasAsset = Boolean(currentUrl);
  const updatedAt = asset?.updatedAt ? new Date(asset.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null;

  // Build cache-busted preview URL
  const previewUrl = preview
    ? preview
    : hasAsset
    ? `${currentUrl}?v=${asset?.updatedAt ? new Date(asset.updatedAt).getTime() : Date.now()}`
    : null;

  function handleDragover(e) {
    e.preventDefault();
    setDragover(true);
  }
  function handleDragleave() { setDragover(false); }
  function handleDrop(e) {
    e.preventDefault();
    setDragover(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }
  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }

  async function processFile(file) {
    // Client-side MIME validation
    const allowedMime = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'];
    if (!allowedMime.includes(file.type)) {
      toast.error(`Invalid file type. Allowed: ${formats}`);
      return;
    }

    // Client-side size check
    const maxBytes = type === 'favicon' ? 2 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error(`File too large. Max size for ${label}: ${maxSize}`);
      return;
    }

    // Show local preview immediately
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    const fd = new FormData();
    fd.append('image', file);

    setUploading(true);
    setProgress(0);

    try {
      // Create xhr to track progress manually (axios onUploadProgress)
      const res = await apiService.uploadBranding(type, fd);
      
      toast.success(`✓ ${label} uploaded successfully`);
      setPreview(null);
      URL.revokeObjectURL(localUrl);
      onUploaded(type, res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to upload ${label}`);
      setPreview(null);
      URL.revokeObjectURL(localUrl);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  async function handleRemove() {
    try {
      await apiService.deleteBranding(type);
      toast.success(`✓ ${label} removed successfully`);
      setConfirmDelete(false);
      onRemoved(type);
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to remove ${label}`);
      setConfirmDelete(false);
    }
  }

  return (
    <div className={`bg-white rounded-3xl border ${border} shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md`}>
      {/* Card Header */}
      <div className={`bg-gradient-to-r ${color} px-6 py-4 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Icon size={20} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">{label}</h3>
            <span className={`text-xs text-white/70`}>{formats} • Max {maxSize}</span>
          </div>
        </div>
        {hasAsset && (
          <span className="flex items-center gap-1 text-[10px] font-bold bg-white/20 text-white px-2.5 py-1 rounded-full">
            <CheckCircle2 size={11} /> Active
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Description */}
        <p className="text-xs text-slate-500">{description}</p>

        {/* Preview Section */}
        <div
          className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 flex items-center justify-center min-h-[140px] cursor-pointer
            ${dragover ? `${border} bg-opacity-20 ${bg} scale-[1.01]` : hasAsset ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}
          `}
          onDragOver={handleDragover}
          onDragLeave={handleDragleave}
          onDrop={handleDrop}
          onClick={() => !uploading && inputRef.current?.click()}
          title={hasAsset ? 'Click or drag to replace' : 'Click or drag to upload'}
        >
          {uploading && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center gap-2 z-10">
              <Loader2 size={28} className="text-primary-600 animate-spin" />
              <span className="text-xs font-bold text-primary-700">Uploading to S3…</span>
              {progress > 0 && (
                <div className="w-32 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
          )}

          {previewUrl ? (
            <div className="relative p-4 flex flex-col items-center gap-2">
              <img
                src={previewUrl}
                alt={label}
                className="max-h-24 max-w-full object-contain rounded-xl"
                onError={e => { e.target.style.display = 'none'; }}
              />
              {preview && (
                <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full">Preview — Not saved yet</span>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-6 px-4 text-center pointer-events-none">
              <div className={`w-12 h-12 rounded-2xl ${bg} flex items-center justify-center`}>
                <CloudUpload size={22} className={accent} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">Drag & drop or click to browse</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{formats} • Max {maxSize} • Recommended: {recommendedSize}</p>
              </div>
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Metadata */}
        {hasAsset && updatedAt && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
            <span>Last updated: <strong className="text-slate-600">{updatedAt}</strong></span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all
              ${uploading
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : `bg-gradient-to-r ${color} text-white shadow-md hover:opacity-90 active:scale-95`
              }`}
          >
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {hasAsset ? 'Replace' : 'Upload'}
          </button>

          {hasAsset && !confirmDelete && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-all"
            >
              <Trash2 size={13} /> Remove
            </button>
          )}

          {confirmDelete && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <AlertCircle size={13} className="text-red-500 shrink-0" />
              <span className="text-[11px] font-bold text-red-700">Delete permanently?</span>
              <button onClick={handleRemove} className="text-[11px] font-bold text-red-600 hover:text-red-800 underline">Yes, delete</button>
              <button onClick={() => setConfirmDelete(false)} className="text-[11px] font-bold text-slate-500 hover:text-slate-700"><X size={13} /></button>
            </div>
          )}
        </div>

        {/* Favicon cache-bust note */}
        {type === 'favicon' && hasAsset && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <Info size={13} className="text-amber-600 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-700">
              Browser tab favicon may appear cached for a few minutes. The URL includes a version timestamp to force a refresh automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminBranding() {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(true);
  const [branding, setBranding] = useState({});
  const [effective, setEffective] = useState({});

  useEffect(() => {
    loadBranding();
  }, []);

  async function loadBranding() {
    try {
      setLoading(true);
      const res = await apiService.getBranding();
      setBranding(res.data.data.branding || {});
      setEffective(res.data.data.effective || {});
    } catch (err) {
      toast.error('Failed to load branding assets');
    } finally {
      setLoading(false);
    }
  }

  const handleUploaded = useCallback((type, assetData) => {
    setBranding(prev => ({
      ...prev,
      [type]: { url: assetData.url, key: assetData.key, updatedAt: assetData.updatedAt },
    }));
    setEffective(prev => ({ ...prev, [type]: assetData.url }));

    // Push logo/favicon into global Redux state so the rest of the app updates instantly
    if (type === 'logo') {
      dispatch(updateSettingsState({ logoUrl: assetData.url }));
      // Also update favicon immediately in the DOM if it's the logo
    }
    if (type === 'favicon') {
      dispatch(updateSettingsState({ faviconUrl: assetData.url }));
      // Force browser favicon refresh
      const ts = Date.now();
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = `${assetData.url}?v=${ts}`;
    }
  }, [dispatch]);

  const handleRemoved = useCallback((type) => {
    setBranding(prev => ({ ...prev, [type]: { url: null, key: null, updatedAt: null } }));
    setEffective(prev => ({ ...prev, [type]: null }));
    if (type === 'logo') dispatch(updateSettingsState({ logoUrl: '/logo.png' }));
    if (type === 'favicon') dispatch(updateSettingsState({ faviconUrl: '/logo.svg' }));
  }, [dispatch]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 pt-20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-500">Loading branding assets…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header />

      <main className="py-6 px-4 max-w-5xl mx-auto space-y-6">

        {/* Page Header */}
        <div className="bg-gradient-to-r from-slate-900 via-primary-900 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-primary-300 uppercase tracking-widest mb-2">
                <Image size={14} /> Admin Panel › Settings › Branding
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Branding & Appearance</h1>
              <p className="text-slate-300 text-sm mt-2 max-w-xl">
                Upload, replace, and manage all brand assets. Images are stored securely on Amazon S3
                and served globally. Changes take effect immediately across the platform.
              </p>
            </div>
            <button
              onClick={loadBranding}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-2xl text-xs font-bold transition-all shrink-0"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {/* S3 Architecture Banner */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Upload', desc: 'Admin Panel', icon: '📤' },
              { label: 'Store', desc: 'Amazon S3', icon: '☁️' },
              { label: 'Save', desc: 'URL in MongoDB', icon: '🗄️' },
              { label: 'Serve', desc: 'All Platforms', icon: '🌐' },
            ].map(step => (
              <div key={step.label} className="bg-white/10 backdrop-blur-sm rounded-2xl px-4 py-3 flex items-center gap-2">
                <span className="text-lg">{step.icon}</span>
                <div>
                  <p className="text-xs font-bold text-white">{step.label}</p>
                  <p className="text-[10px] text-slate-300">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Security Notice */}
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          <Shield size={18} className="text-emerald-600 shrink-0" />
          <p className="text-xs text-emerald-800 font-medium">
            <strong>Secure S3 Upload:</strong> Images are uploaded directly to Amazon S3 via the backend.
            No AWS credentials are ever exposed to the browser. All uploads use server-side encryption (AES-256).
          </p>
        </div>

        {/* Branding Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {ASSET_CONFIG.map(config => (
            <BrandingCard
              key={config.type}
              config={config}
              asset={branding[config.type] || {}}
              onUploaded={handleUploaded}
              onRemoved={handleRemoved}
            />
          ))}
        </div>

        {/* Live Preview Panel */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Eye className="text-primary-600" size={18} /> Live Brand Preview
          </h2>
          <p className="text-xs text-slate-500">Visual preview of how your branding assets appear across different surfaces.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Header Preview */}
            <div className="bg-slate-900 rounded-2xl p-4 space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Website Header</div>
              <div className="flex items-center gap-3 pt-1">
                {effective.logo ? (
                  <img src={`${effective.logo}?v=${Date.now()}`} alt="Logo" className="h-8 object-contain max-w-[160px]" />
                ) : (
                  <div className="text-primary-400 font-extrabold text-lg">⚡ OnewayFix</div>
                )}
              </div>
            </div>

            {/* Dark Header Preview */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-950 rounded-2xl p-4 space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dark Mode Header</div>
              <div className="flex items-center gap-3 pt-1">
                {effective.darkLogo ? (
                  <img src={`${effective.darkLogo}?v=${Date.now()}`} alt="Dark Logo" className="h-8 object-contain max-w-[160px]" />
                ) : effective.logo ? (
                  <img src={`${effective.logo}?v=${Date.now()}`} alt="Dark Logo fallback" className="h-8 object-contain max-w-[160px] opacity-80" />
                ) : (
                  <div className="text-slate-300 font-extrabold text-lg">⚡ OnewayFix</div>
                )}
              </div>
            </div>

            {/* Login Preview */}
            <div className="bg-gradient-to-br from-primary-700 to-blue-700 rounded-2xl p-4 space-y-2">
              <div className="text-[10px] font-bold text-primary-200 uppercase tracking-widest">Login Page</div>
              <div className="flex flex-col items-center gap-2 py-2">
                {effective.loginLogo ? (
                  <img src={`${effective.loginLogo}?v=${Date.now()}`} alt="Login Logo" className="h-10 object-contain max-w-[180px]" />
                ) : effective.logo ? (
                  <img src={`${effective.logo}?v=${Date.now()}`} alt="Login Logo fallback" className="h-10 object-contain max-w-[180px]" />
                ) : (
                  <div className="text-white font-extrabold text-xl">⚡ OnewayFix</div>
                )}
                <p className="text-xs text-primary-200">Your home, expertly cared for.</p>
              </div>
            </div>

            {/* Favicon Preview */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Browser Tab Favicon</div>
              <div className="flex items-center gap-3 pt-1">
                <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg px-3 py-1.5">
                  {effective.favicon ? (
                    <img src={`${effective.favicon}?v=${Date.now()}`} alt="Favicon" className="w-4 h-4 object-contain" />
                  ) : (
                    <div className="w-4 h-4 bg-primary-500 rounded-sm" title="Default favicon" />
                  )}
                  <span className="text-xs text-slate-700 font-medium">OnewayFix - Home Services</span>
                  <span className="text-slate-400 text-xs">×</span>
                </div>
              </div>
            </div>

            {/* App Icon Preview */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mobile App Icon</div>
              <div className="flex items-center gap-3 pt-1">
                {effective.appIcon ? (
                  <img src={`${effective.appIcon}?v=${Date.now()}`} alt="App Icon" className="w-16 h-16 rounded-2xl object-cover shadow-md border border-slate-200" />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-primary-600 flex items-center justify-center shadow-md border border-primary-700">
                    <Smartphone size={28} className="text-white" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold text-slate-800">OnewayFix</p>
                  <p className="text-xs text-slate-400">Home Services</p>
                </div>
              </div>
            </div>

            {/* Invoice Logo Preview */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Invoice PDF Logo</div>
              <div className="border border-dashed border-slate-200 rounded-xl p-3 flex items-start gap-3">
                {effective.invoiceLogo ? (
                  <img src={`${effective.invoiceLogo}?v=${Date.now()}`} alt="Invoice Logo" className="h-10 object-contain max-w-[120px]" />
                ) : effective.logo ? (
                  <img src={`${effective.logo}?v=${Date.now()}`} alt="Invoice Logo fallback" className="h-10 object-contain max-w-[120px] opacity-70" />
                ) : (
                  <div className="text-primary-600 font-extrabold text-base">⚡ OnewayFix</div>
                )}
                <div className="text-[10px] text-slate-500 leading-relaxed">
                  <div className="font-bold text-slate-700 text-xs">INVOICE</div>
                  #OWF-INV-100001<br />Date: {new Date().toLocaleDateString('en-IN')}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Usage Guide */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Info className="text-primary-600" size={18} /> Usage Guide
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { title: '📤 Uploading', body: 'Drag & drop an image onto a card or click Browse. The image is uploaded securely to S3. The card updates instantly on success.' },
              { title: '🔄 Replacing', body: 'Upload a new image while an existing one is active. The old S3 object is deleted only after the new upload succeeds — zero downtime.' },
              { title: '🗑️ Removing', body: 'Click Remove then confirm. The asset is deleted from S3 and the platform falls back to the default logo/icon immediately.' },
              { title: '🌐 Auto-Deploy', body: 'No code changes needed. All brand assets update across Header, Login, Invoices, Favicon, and Mobile App automatically.' },
            ].map(item => (
              <div key={item.title} className="bg-slate-50 rounded-2xl p-4">
                <p className="text-sm font-bold text-slate-800 mb-1">{item.title}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}
