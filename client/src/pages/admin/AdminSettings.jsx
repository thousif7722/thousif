import React, { useEffect, useState } from 'react';
import { apiService } from '@/services/api';
import Header from '@/components/common/Header';
import { 
  Settings, Image, Video, Plus, Trash2, Save, Upload,
  Check, Globe, Phone, Mail, Sparkles, Shield, AlertCircle, Play, Eye,
  DollarSign, MapPin, Clock, Megaphone, Wrench, ShieldAlert,
  Share2, Smartphone, Users, Search, FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useDispatch } from 'react-redux';
import { updateSettingsState } from '@/store/slices/serviceSlice';

export default function AdminSettings() {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('branding');

  // Settings State
  const [siteName, setSiteName] = useState('ServiceHub');
  const [logoUrl, setLogoUrl] = useState('/logo.png');
  const [faviconUrl, setFaviconUrl] = useState('/logo.svg');
  const [tagline, setTagline] = useState('Premium Home Services at your Doorstep');
  const [currencySymbol, setCurrencySymbol] = useState('₹');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [defaultRadius, setDefaultRadius] = useState(25);

  const [supportPhone, setSupportPhone] = useState('+91 9876543210');
  const [supportEmail, setSupportEmail] = useState('support@servicehub.com');
  const [supportAddress, setSupportAddress] = useState('ServiceHub HQ, Hitech City, Hyderabad 500081');
  const [workingHours, setWorkingHours] = useState('8:00 AM - 10:00 PM');

  const [gstRate, setGstRate] = useState(18);
  const [platformFee, setPlatformFee] = useState(49);
  const [plusPrice, setPlusPrice] = useState(299);
  const [plusPrice6Months, setPlusPrice6Months] = useState(299);
  const [plusPrice1Year, setPlusPrice1Year] = useState(499);
  const [subscriptionModelActive, setSubscriptionModelActive] = useState(true);

  const [announcementText, setAnnouncementText] = useState('🎉 Special Launch Offer: Get 20% OFF on your first booking! Code: FIRST20');
  const [announcementActive, setAnnouncementActive] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [allowBookings, setAllowBookings] = useState(true);

  // Social & Mobile Apps
  const [facebookUrl, setFacebookUrl] = useState('https://facebook.com');
  const [instagramUrl, setInstagramUrl] = useState('https://instagram.com');
  const [twitterUrl, setTwitterUrl] = useState('https://twitter.com');
  const [youtubeUrl, setYoutubeUrl] = useState('https://youtube.com');
  const [whatsappNumber, setWhatsappNumber] = useState('+91 9876543210');

  const [apkDownloadUrl, setApkDownloadUrl] = useState('/downloads/servicehub.apk');
  const [playStoreUrl, setPlayStoreUrl] = useState('');
  const [appStoreUrl, setAppStoreUrl] = useState('');

  // Provider Policy
  const [defaultCommissionRate, setDefaultCommissionRate] = useState(20);
  const [minSettlementAmount, setMinSettlementAmount] = useState(500);
  const [maxCommissionDebtLimit, setMaxCommissionDebtLimit] = useState(2000);
  const [autoApproveKyc, setAutoApproveKyc] = useState(false);

  // SEO & Analytics
  const [metaTitle, setMetaTitle] = useState('ServiceHub — On-Demand Home Services & Maintenance');
  const [metaDescription, setMetaDescription] = useState('Book verified electricians, plumbers, AC technicians, and home cleaning experts instantly.');
  const [metaKeywords, setMetaKeywords] = useState('home services, electrician, plumber, AC repair, cleaning, ServiceHub');
  const [googleAnalyticsId, setGoogleAnalyticsId] = useState('');

  // Legal Policies
  const [termsContent, setTermsContent] = useState('Standard terms of service apply to all users and service providers on ServiceHub.');
  const [privacyContent, setPrivacyContent] = useState('ServiceHub respects user privacy and secures data with end-to-end encryption.');
  const [refundContent, setRefundContent] = useState('Full refund provided for cancellations made at least 2 hours prior to scheduled slot.');

  const [videoSpotlights, setVideoSpotlights] = useState([]);
  const [categoryBanners, setCategoryBanners] = useState([]);

  // New Category Banner Form State
  const [newCatBanner, setNewCatBanner] = useState({
    category: 'AC Repair',
    heroImage: '',
    title: '',
    subtitle: '',
    badge: '🔥 Summer Sale',
  });

  // New Video Form State
  const [newVideo, setNewVideo] = useState({
    title: '',
    video: '',
    category: 'AC Repair',
    badge: '🔥 Most Booked',
    desc: '',
    cta: 'Book Now',
  });

  const [previewVideo, setPreviewVideo] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      setLoading(true);
      const res = await apiService.getAdminSettings();
      const data = res.data.data;
      if (data) {
        setSiteName(data.siteName || 'ServiceHub');
        setLogoUrl(data.logoUrl || '/logo.png');
        setFaviconUrl(data.faviconUrl || '/logo.svg');
        setTagline(data.tagline || 'Premium Home Services at your Doorstep');
        setCurrencySymbol(data.currencySymbol || '₹');
        setTimezone(data.timezone || 'Asia/Kolkata');
        setDefaultRadius(data.defaultRadius || 25);

        setSupportPhone(data.supportPhone || '+91 9876543210');
        setSupportEmail(data.supportEmail || 'support@servicehub.com');
        setSupportAddress(data.supportAddress || 'ServiceHub HQ, Hitech City, Hyderabad 500081');
        setWorkingHours(data.workingHours || '8:00 AM - 10:00 PM');

        setGstRate(data.gstRate ?? 18);
        setPlatformFee(data.platformFee ?? 49);
        setPlusPrice(data.plusPrice ?? 299);
        setPlusPrice6Months(data.plusPrice6Months ?? 299);
        setPlusPrice1Year(data.plusPrice1Year ?? 499);
        setSubscriptionModelActive(data.subscriptionModelActive !== false);

        setAnnouncementText(data.announcementText || '🎉 Special Launch Offer: Get 20% OFF on your first booking! Code: FIRST20');
        setAnnouncementActive(data.announcementActive !== false);
        setMaintenanceMode(Boolean(data.maintenanceMode));
        setAllowBookings(data.allowBookings !== false);

        setFacebookUrl(data.facebookUrl || 'https://facebook.com');
        setInstagramUrl(data.instagramUrl || 'https://instagram.com');
        setTwitterUrl(data.twitterUrl || 'https://twitter.com');
        setYoutubeUrl(data.youtubeUrl || 'https://youtube.com');
        setWhatsappNumber(data.whatsappNumber || '+91 9876543210');

        setApkDownloadUrl(data.apkDownloadUrl || '/downloads/servicehub.apk');
        setPlayStoreUrl(data.playStoreUrl || '');
        setAppStoreUrl(data.appStoreUrl || '');

        setDefaultCommissionRate(data.defaultCommissionRate ?? 20);
        setMinSettlementAmount(data.minSettlementAmount ?? 500);
        setMaxCommissionDebtLimit(data.maxCommissionDebtLimit ?? 2000);
        setAutoApproveKyc(Boolean(data.autoApproveKyc));

        setMetaTitle(data.metaTitle || 'ServiceHub — On-Demand Home Services & Maintenance');
        setMetaDescription(data.metaDescription || 'Book verified electricians, plumbers, AC technicians, and home cleaning experts instantly.');
        setMetaKeywords(data.metaKeywords || 'home services, electrician, plumber, AC repair, cleaning, ServiceHub');
        setGoogleAnalyticsId(data.googleAnalyticsId || '');

        setTermsContent(data.termsContent || 'Standard terms of service apply to all users and service providers on ServiceHub.');
        setPrivacyContent(data.privacyContent || 'ServiceHub respects user privacy and secures data with end-to-end encryption.');
        setRefundContent(data.refundContent || 'Full refund provided for cancellations made at least 2 hours prior to scheduled slot.');

        setVideoSpotlights(data.videoSpotlights || []);
        setCategoryBanners(data.categoryBanners || []);
        dispatch(updateSettingsState(data));
      }
    } catch (err) {
      toast.error('Failed to load system settings');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSettings(e) {
    if (e) e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        siteName,
        logoUrl,
        faviconUrl,
        tagline,
        currencySymbol,
        timezone,
        defaultRadius,
        supportPhone,
        supportEmail,
        supportAddress,
        workingHours,
        gstRate,
        platformFee,
        plusPrice,
        plusPrice6Months,
        plusPrice1Year,
        subscriptionModelActive,
        announcementText,
        announcementActive,
        maintenanceMode,
        allowBookings,
        facebookUrl,
        instagramUrl,
        twitterUrl,
        youtubeUrl,
        whatsappNumber,
        apkDownloadUrl,
        playStoreUrl,
        appStoreUrl,
        defaultCommissionRate,
        minSettlementAmount,
        maxCommissionDebtLimit,
        autoApproveKyc,
        metaTitle,
        metaDescription,
        metaKeywords,
        googleAnalyticsId,
        termsContent,
        privacyContent,
        refundContent,
        videoSpotlights,
        categoryBanners,
      };
      await apiService.updateAdminSettings(payload);
      dispatch(updateSettingsState(payload));
      toast.success('Website settings & category banners saved! 🎉');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  }

  function handleAddCategoryBanner(e) {
    e.preventDefault();
    if (!newCatBanner.category || !newCatBanner.heroImage) {
      toast.error('Please select a category and upload or enter an image URL');
      return;
    }
    const existingIndex = categoryBanners.findIndex(b => b.category === newCatBanner.category);
    let updated;
    if (existingIndex >= 0) {
      updated = [...categoryBanners];
      updated[existingIndex] = { ...newCatBanner, active: true };
      toast.success(`Updated banner for ${newCatBanner.category}! (Click Save Settings to publish)`);
    } else {
      updated = [...categoryBanners, { ...newCatBanner, active: true }];
      toast.success(`Added custom banner for ${newCatBanner.category}! (Click Save Settings to publish)`);
    }
    setCategoryBanners(updated);
    setNewCatBanner({
      category: 'AC Repair',
      heroImage: '',
      title: '',
      subtitle: '',
      badge: '🔥 Summer Sale',
      active: true,
    });
  }

  function handleDeleteCategoryBanner(index) {
    const updated = categoryBanners.filter((_, i) => i !== index);
    setCategoryBanners(updated);
    toast.success('Category banner removed (Click Save Settings to publish)');
  }

  function handleToggleCategoryBannerActive(index) {
    const updated = [...categoryBanners];
    updated[index].active = !updated[index].active;
    setCategoryBanners(updated);
  }

  function handleAddVideo(e) {
    e.preventDefault();
    if (!newVideo.title || !newVideo.video) {
      toast.error('Please enter video title and video URL');
      return;
    }
    setVideoSpotlights([...videoSpotlights, { ...newVideo, active: true }]);
    setNewVideo({
      title: '',
      video: '',
      category: 'AC Repair',
      badge: '🔥 Most Booked',
      desc: '',
      cta: 'Book Now',
    });
    toast.success('Video added to list (Click Save Settings to publish)');
  }

  function handleDeleteVideo(index) {
    const updated = videoSpotlights.filter((_, i) => i !== index);
    setVideoSpotlights(updated);
    toast.success('Video removed (Click Save Settings to publish)');
  }

  function handleToggleVideoActive(index) {
    const updated = [...videoSpotlights];
    updated[index].active = !updated[index].active;
    setVideoSpotlights(updated);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 pt-20 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  const TABS = [
    { id: 'branding', label: 'Brand Identity', icon: Globe, desc: 'S3 Logos, Site Name, Tagline & Currency' },
    { id: 'financials', label: 'Fees & Taxes', icon: DollarSign, desc: 'GST %, Platform Fee, Plus Membership' },
    { id: 'contact', label: 'Support & Info', icon: Phone, desc: 'Helpline, Support Email & Working Hours' },
    { id: 'catbanners', label: 'Category Banners', icon: Image, desc: 'Hero banners for AC, Cleaning, Plumbing' },
    { id: 'social', label: 'Social & Mobile', icon: Share2, desc: 'Social handles, PlayStore & APK links' },
    { id: 'providers', label: 'Provider Rules', icon: Users, desc: 'Commission %, KYC policy & Payout limits' },
    { id: 'seo', label: 'SEO & Analytics', icon: Search, desc: 'Google search meta tags & GA ID' },
    { id: 'legal', label: 'Legal Policies', icon: FileText, desc: 'Terms of Service, Privacy & Refund policy' },
    { id: 'announcements', label: 'Banners & Reels', icon: Megaphone, desc: 'Announcement bar & Video spotlights' },
    { id: 'ops', label: 'System Controls', icon: Wrench, desc: 'Maintenance mode & Booking controls' },
  ];

  const filteredTabs = TABS.filter(t => 
    !searchQuery || 
    t.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <Header />
      
      <main className="py-6 px-4 max-w-6xl mx-auto space-y-6">
        
        {/* Top Header Hub */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <div>
            <div className="flex items-center gap-2 text-xs font-extrabold text-primary-600 uppercase tracking-widest mb-1">
              <Settings size={16} /> Admin Control Center
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">Website & Platform Settings</h1>
            <p className="text-slate-500 text-sm mt-0.5">Centralized hub to manage brand identity, pricing, policies, and system controls</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-extrabold rounded-2xl text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary-600/20 shrink-0"
            >
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={18} />}
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>

        {/* Top Quick Access Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <a
            href="/admin/settings/branding"
            className="bg-gradient-to-br from-slate-900 to-primary-950 text-white rounded-3xl p-5 shadow-sm hover:shadow-md transition-all border border-slate-800 flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold">
                <Globe size={20} />
              </div>
              <span className="text-[10px] font-extrabold bg-teal-400 text-slate-950 px-2.5 py-0.5 rounded-full uppercase">S3 Assets</span>
            </div>
            <div className="mt-4">
              <h3 className="font-extrabold text-base text-white group-hover:text-teal-300 transition-colors">Branding & Logos</h3>
              <p className="text-xs text-slate-300 mt-1">Upload 6 brand logos & favicons directly to Amazon S3</p>
            </div>
            <span className="text-xs font-bold text-teal-400 mt-3 inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              Open Branding Manager →
            </span>
          </a>

          <a
            href="/admin/invoice-settings"
            className="bg-gradient-to-br from-teal-900 to-slate-900 text-white rounded-3xl p-5 shadow-sm hover:shadow-md transition-all border border-teal-800 flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold">
                <FileText size={20} />
              </div>
              <span className="text-[10px] font-extrabold bg-emerald-400 text-slate-950 px-2.5 py-0.5 rounded-full uppercase">GST & Invoice</span>
            </div>
            <div className="mt-4">
              <h3 className="font-extrabold text-base text-white group-hover:text-emerald-300 transition-colors">Invoice Customization</h3>
              <p className="text-xs text-teal-200 mt-1">GST split rules, charge tables, colors & guarantee card</p>
            </div>
            <span className="text-xs font-bold text-emerald-400 mt-3 inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              Configure Invoices →
            </span>
          </a>

          <button
            type="button"
            onClick={() => setActiveTab('financials')}
            className={`rounded-3xl p-5 text-left transition-all border shadow-sm flex flex-col justify-between group ${
              activeTab === 'financials' ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-100 hover:border-amber-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                <DollarSign size={20} />
              </div>
              <span className="text-[10px] font-extrabold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full">GST {gstRate}%</span>
            </div>
            <div className="mt-4">
              <h3 className="font-extrabold text-base text-slate-900 group-hover:text-amber-600 transition-colors">Fees & Taxes</h3>
              <p className="text-xs text-slate-500 mt-1">Platform fee ₹{platformFee}, GST rate, Plus subscriptions</p>
            </div>
            <span className="text-xs font-bold text-amber-600 mt-3 inline-flex items-center gap-1">
              Edit Fees & Taxes →
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ops')}
            className={`rounded-3xl p-5 text-left transition-all border shadow-sm flex flex-col justify-between group ${
              activeTab === 'ops' ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-slate-100 hover:border-indigo-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
                <Wrench size={20} />
              </div>
              <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${maintenanceMode ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {maintenanceMode ? 'Maintenance ON' : 'System Live'}
              </span>
            </div>
            <div className="mt-4">
              <h3 className="font-extrabold text-base text-slate-900 group-hover:text-indigo-600 transition-colors">System Controls</h3>
              <p className="text-xs text-slate-500 mt-1">Toggle maintenance mode, enable/disable live bookings</p>
            </div>
            <span className="text-xs font-bold text-indigo-600 mt-3 inline-flex items-center gap-1">
              System Controls →
            </span>
          </button>
        </div>

        {/* Settings Search Bar */}
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search all settings (e.g. GST, Commission, Logo, Phone, Meta, Maintenance)..."
            className="w-full bg-white border border-slate-200 pl-11 pr-4 py-3.5 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 shadow-sm transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 bg-slate-100 px-2 py-1 rounded-lg"
            >
              Clear
            </button>
          )}
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex overflow-x-auto bg-white rounded-2xl p-1.5 shadow-sm border border-slate-100 gap-1 scrollbar-hide">
          {filteredTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 shrink-0 ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon size={15} className={isActive ? 'text-teal-400' : 'text-slate-400'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── TAB 1: STORE IDENTITY & BRANDING ── */}
        {activeTab === 'branding' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-2">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Globe className="text-primary-600" size={20} /> Brand Identity Settings
              </h2>
              <span className="text-xs text-primary-700 bg-primary-50 px-3 py-1 rounded-full font-bold">
                ⚡ Changes apply across Header, Login & Footer
              </span>
            </div>

            {/* ── S3-Backed Branding Assets Hero Card ── */}
            <div className="bg-gradient-to-r from-slate-900 via-primary-950 to-teal-950 text-white rounded-3xl p-6 border border-teal-700/50 shadow-md">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0 mt-1">
                    <Sparkles size={26} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-lg text-white">Centralized S3 Branding Assets Manager</h3>
                      <span className="text-[10px] font-extrabold uppercase bg-teal-400 text-slate-950 px-2.5 py-0.5 rounded-full">RECOMMENDED</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                      Upload, preview, and delete 6 core branding assets (Main Logo, Favicon, Dark Mode Logo, App Icon, Login Logo & Invoice Logo) directly stored in Amazon S3 with dynamic cache busting.
                    </p>

                    {/* Branding Quick Badges */}
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      {['Main Logo', 'Favicon', 'Dark Logo', 'App Icon', 'Login Logo', 'Invoice Logo'].map(asset => (
                        <span key={asset} className="text-[10px] font-bold bg-white/10 text-teal-200 px-2.5 py-1 rounded-lg border border-white/10">
                          ✓ {asset}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <a
                  href="/admin/settings/branding"
                  className="px-6 py-3.5 bg-teal-400 hover:bg-teal-300 text-slate-950 font-extrabold rounded-2xl text-xs flex items-center justify-center gap-2 shrink-0 transition-all shadow-lg hover:scale-105"
                >
                  <Upload size={16} /> Open Branding & Assets Manager ⚡
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Site Name */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                  Website / Brand Name
                </label>
                <input
                  type="text"
                  value={siteName}
                  onChange={e => setSiteName(e.target.value)}
                  placeholder="e.g. ServiceHub or OneWayFix"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
                <p className="text-[11px] text-slate-400 mt-1">Updates platform title text across header, footer, and emails.</p>
              </div>

              {/* Hero Tagline */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                  Hero Tagline / Subtitle
                </label>
                <input
                  type="text"
                  value={tagline}
                  onChange={e => setTagline(e.target.value)}
                  placeholder="e.g. Premium Home Services at your Doorstep"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
                <p className="text-[11px] text-slate-400 mt-1">Displayed on customer homepage hero header.</p>
              </div>

              {/* Currency Symbol */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                  Default Currency Symbol
                </label>
                <input
                  type="text"
                  value={currencySymbol}
                  onChange={e => setCurrencySymbol(e.target.value)}
                  placeholder="₹"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
              </div>

              {/* Default Service Radius */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                  Default Matching Radius (KM)
                </label>
                <input
                  type="number"
                  value={defaultRadius}
                  onChange={e => setDefaultRadius(Number(e.target.value))}
                  placeholder="25"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
              </div>

            </div>

            {/* Live Brand Preview Cards */}
            <div className="pt-6 border-t border-slate-100 space-y-4">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Live Preview across Application</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Header Navigation Preview */}
                <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Header Bar Preview</div>
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      {logoUrl && logoUrl !== '/logo.png' ? (
                        <img src={logoUrl} alt={siteName} className="h-8 w-auto object-contain max-w-[160px]" />
                      ) : (
                        <div className="text-xl font-bold text-primary-400">⚡ {siteName}</div>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 hidden sm:inline">{tagline}</span>
                  </div>
                </div>

                {/* Login Page Preview */}
                <div className="bg-gradient-to-r from-primary-700 to-blue-600 text-white rounded-2xl p-4 border border-primary-500 space-y-2">
                  <div className="text-[10px] font-bold text-primary-200 uppercase tracking-widest">Login Page Preview</div>
                  <div className="pt-1">
                    {logoUrl && logoUrl !== '/logo.png' ? (
                      <img src={logoUrl} alt={siteName} className="h-8 w-auto object-contain max-w-[160px]" />
                    ) : (
                      <div className="text-xl font-bold text-white">⚡ {siteName}</div>
                    )}
                    <p className="text-xs text-primary-100 mt-1">Your home, expertly cared for.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: SUPPORT & WORKING HOURS ── */}
        {activeTab === 'contact' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
              <Phone className="text-primary-600" size={20} /> Support Contact & Operating Hours
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Support Phone */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                  Support Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                  <input
                    type="text"
                    value={supportPhone}
                    onChange={e => setSupportPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  />
                </div>
              </div>

              {/* Support Email */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                  Support Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                  <input
                    type="email"
                    value={supportEmail}
                    onChange={e => setSupportEmail(e.target.value)}
                    placeholder="support@servicehub.com"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  />
                </div>
              </div>

              {/* Support Address */}
              <div className="md:col-span-2">
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                  Headquarters / Support Address
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                  <input
                    type="text"
                    value={supportAddress}
                    onChange={e => setSupportAddress(e.target.value)}
                    placeholder="ServiceHub HQ, Hitech City, Hyderabad"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  />
                </div>
              </div>

              {/* Working Hours */}
              <div className="md:col-span-2">
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                  Customer Support Working Hours
                </label>
                <div className="relative">
                  <Clock className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                  <input
                    type="text"
                    value={workingHours}
                    onChange={e => setWorkingHours(e.target.value)}
                    placeholder="8:00 AM - 10:00 PM (Mon-Sun)"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  />
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ── TAB 3: FINANCIALS & FEES ── */}
        {activeTab === 'financials' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
              <DollarSign className="text-primary-600" size={20} /> Platform Fees, GST Tax & Membership Pricing
            </h2>

            {/* Master Subscription Switch Banner */}
            <div className={`rounded-3xl p-5 border transition-all ${subscriptionModelActive ? 'bg-gradient-to-r from-purple-900 to-indigo-900 text-white border-purple-700 shadow-md' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl shrink-0 ${subscriptionModelActive ? 'bg-amber-400 text-slate-900' : 'bg-slate-300 text-slate-600'}`}>
                    <Sparkles size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-base">ServiceHub Plus Subscription Model</h3>
                      <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${subscriptionModelActive ? 'bg-emerald-500 text-white' : 'bg-slate-400 text-white'}`}>
                        {subscriptionModelActive ? 'ACTIVE (ON)' : 'DISABLED (OFF)'}
                      </span>
                    </div>
                    <p className={`text-xs mt-1 ${subscriptionModelActive ? 'text-purple-200' : 'text-slate-500'}`}>
                      {subscriptionModelActive 
                        ? 'Customers can purchase 6-Month or 1-Year Plus Subscriptions for discounts & zero surge fee.'
                        : 'Paid subscriptions are turned OFF. Plus Membership page shows upcoming waitlist banner.'}
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={subscriptionModelActive}
                    onChange={e => setSubscriptionModelActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-14 h-7 bg-slate-400 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-400"></div>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* GST Tax Rate */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                  GST Tax Rate (%)
                </label>
                <input
                  type="number"
                  value={gstRate}
                  onChange={e => setGstRate(Number(e.target.value))}
                  placeholder="18"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
                <p className="text-[11px] text-slate-400 mt-1">Applied to invoices and platform service charges</p>
              </div>

              {/* Booking Convenience Fee */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                  Booking Platform Fee ({currencySymbol})
                </label>
                <input
                  type="number"
                  value={platformFee}
                  onChange={e => setPlatformFee(Number(e.target.value))}
                  placeholder="49"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
                <p className="text-[11px] text-slate-400 mt-1">Flat convenience fee per customer booking</p>
              </div>

              {/* Plus 6-Months Plan Price */}
              <div>
                <label className="block text-xs font-extrabold text-purple-700 uppercase tracking-wider mb-2">
                  Plus 6-Month Plan Price ({currencySymbol})
                </label>
                <input
                  type="number"
                  value={plusPrice6Months}
                  onChange={e => setPlusPrice6Months(Number(e.target.value))}
                  placeholder="299"
                  className="w-full px-4 py-3 bg-purple-50 border border-purple-200 rounded-2xl text-sm font-bold text-purple-900 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                />
                <p className="text-[11px] text-purple-600 mt-1">Standard 6-month membership price</p>
              </div>

              {/* Plus 1-Year VIP Plan Price */}
              <div>
                <label className="block text-xs font-extrabold text-amber-700 uppercase tracking-wider mb-2">
                  Plus 1-Year VIP Plan Price ({currencySymbol})
                </label>
                <input
                  type="number"
                  value={plusPrice1Year}
                  onChange={e => setPlusPrice1Year(Number(e.target.value))}
                  placeholder="499"
                  className="w-full px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl text-sm font-bold text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                />
                <p className="text-[11px] text-amber-600 mt-1">Annual VIP membership price</p>
              </div>

            </div>
          </div>
        )}

        {/* ── TAB: CATEGORY CUSTOM BANNERS & HERO IMAGES ── */}
        {activeTab === 'catbanners' && (
          <div className="space-y-6">
            
            {/* Form to Add or Update Category Banner */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-2">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Image className="text-primary-600" size={20} /> Custom Category Hero Image & Banner Manager
                </h2>
                <span className="text-xs text-primary-700 bg-primary-50 px-3 py-1 rounded-full font-bold">
                  ⚡ Overrides category tiles & header hero banners in app
                </span>
              </div>

              <form onSubmit={handleAddCategoryBanner} className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Category Dropdown */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                    Select Target Service Category
                  </label>
                  <select
                    value={newCatBanner.category}
                    onChange={e => setNewCatBanner({ ...newCatBanner, category: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  >
                    {[
                      'AC Repair', 'Cleaning', 'Washing Machine', 'Fridge & Cooler',
                      'Plumbing', 'Electrical', 'Pest Control', 'Carpentry',
                      'Painting', 'Salon', 'Appliance Repair', 'Home Automation'
                    ].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">Select category to attach custom banner image & offer subtitle.</p>
                </div>

                {/* Badge Tag */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                    Promo Badge Tag (e.g. 🔥 Summer Special)
                  </label>
                  <input
                    type="text"
                    value={newCatBanner.badge}
                    onChange={e => setNewCatBanner({ ...newCatBanner, badge: e.target.value })}
                    placeholder="e.g. 🔥 Summer Sale or ⚡ 30-Min Dispatch"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  />
                </div>

                {/* Hero Image File Upload or URL */}
                <div className="md:col-span-2 space-y-2">
                  <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                    Category Hero Banner Image (Upload File or Enter Image URL)
                  </label>
                  
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <label className="cursor-pointer px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md shadow-primary-600/20 transition-all shrink-0">
                      <Upload size={16} />
                      <span>Upload Banner File</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setNewCatBanner(prev => ({ ...prev, heroImage: reader.result }));
                              toast.success('Banner image loaded into preview!');
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>

                    <div className="flex-1">
                      <input
                        type="text"
                        required
                        value={newCatBanner.heroImage}
                        onChange={e => setNewCatBanner({ ...newCatBanner, heroImage: e.target.value })}
                        placeholder="https://images.unsplash.com/... or upload a file"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Custom Banner Title */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                    Custom Hero Headline Title (Optional)
                  </label>
                  <input
                    type="text"
                    value={newCatBanner.title}
                    onChange={e => setNewCatBanner({ ...newCatBanner, title: e.target.value })}
                    placeholder={`e.g. Premium ${newCatBanner.category} Services`}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  />
                </div>

                {/* Custom Banner Subtitle */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                    Custom Subtitle / Offer Text (Optional)
                  </label>
                  <input
                    type="text"
                    value={newCatBanner.subtitle}
                    onChange={e => setNewCatBanner({ ...newCatBanner, subtitle: e.target.value })}
                    placeholder="e.g. Up to 30% OFF on Foam Jet Wash & Gas Leak check"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  />
                </div>

                {/* Live Card Preview */}
                {newCatBanner.heroImage && (
                  <div className="md:col-span-2 space-y-2 pt-2">
                    <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Live Customer Category Hero Preview</span>
                    <div className="relative h-44 rounded-2xl overflow-hidden shadow-lg border border-slate-800 bg-slate-900">
                      <img src={newCatBanner.heroImage} alt="Banner Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
                      <div className="absolute inset-0 flex flex-col justify-end p-5">
                        <span className="bg-amber-400 text-slate-900 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full w-max mb-2">
                          {newCatBanner.badge || '🔥 Featured Offer'}
                        </span>
                        <h3 className="text-xl font-extrabold text-white">{newCatBanner.title || newCatBanner.category}</h3>
                        <p className="text-xs text-white/80 mt-0.5">{newCatBanner.subtitle || 'Book verified professionals with 30-day service warranty'}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="md:col-span-2 flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-sm flex items-center gap-2 transition-all shadow-md"
                  >
                    <Plus size={16} /> Save Banner to List
                  </button>
                </div>

              </form>
            </div>

            {/* Configured Category Banners List */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Image className="text-primary-600" size={20} /> Active Category Custom Banners ({categoryBanners.length})
                </h2>
              </div>

              {categoryBanners.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Image size={40} className="mx-auto text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-600">No custom category banners added yet</p>
                  <p className="text-xs text-slate-400 mt-1">Default UI category themes are currently displayed to customers.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {categoryBanners.map((b, i) => (
                    <div key={i} className="bg-slate-900 text-white rounded-2xl overflow-hidden border border-slate-800 relative flex flex-col justify-between">
                      <div className="h-32 relative">
                        <img src={b.heroImage} alt={b.category} className="w-full h-full object-cover opacity-80" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                        <div className="absolute top-3 left-3 flex items-center gap-2">
                          <span className="text-[10px] font-extrabold bg-blue-600 text-white uppercase px-2.5 py-0.5 rounded-full">
                            {b.category}
                          </span>
                          {b.badge && (
                            <span className="text-[10px] font-extrabold bg-amber-400 text-slate-900 uppercase px-2.5 py-0.5 rounded-full">
                              {b.badge}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategoryBanner(i)}
                          className="absolute top-3 right-3 p-2 rounded-xl bg-slate-900/80 hover:bg-red-600 text-slate-300 hover:text-white transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="p-4 space-y-1">
                        <h4 className="font-bold text-sm text-white">{b.title || b.category}</h4>
                        {b.subtitle && <p className="text-xs text-slate-400 line-clamp-1">{b.subtitle}</p>}
                        
                        <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={b.active !== false}
                              onChange={() => handleToggleCategoryBannerActive(i)}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-0"
                            />
                            <span className={b.active !== false ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                              {b.active !== false ? 'Active on App' : 'Hidden'}
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ── TAB 4: SOCIAL MEDIA & MOBILE APPS ── */}
        {activeTab === 'social' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
              <Share2 className="text-primary-600" size={20} /> Social Links & Mobile App Downloads
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* WhatsApp Support */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                  WhatsApp Support Number
                </label>
                <input
                  type="text"
                  value={whatsappNumber}
                  onChange={e => setWhatsappNumber(e.target.value)}
                  placeholder="+91 9876543210"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
              </div>

              {/* Android APK Download Path */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                  Android APK Direct Download URL
                </label>
                <input
                  type="text"
                  value={apkDownloadUrl}
                  onChange={e => setApkDownloadUrl(e.target.value)}
                  placeholder="/downloads/servicehub.apk"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
              </div>

              {/* Instagram URL */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                  Instagram Profile URL
                </label>
                <input
                  type="text"
                  value={instagramUrl}
                  onChange={e => setInstagramUrl(e.target.value)}
                  placeholder="https://instagram.com/servicehub"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
              </div>

              {/* Facebook URL */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                  Facebook Page URL
                </label>
                <input
                  type="text"
                  value={facebookUrl}
                  onChange={e => setFacebookUrl(e.target.value)}
                  placeholder="https://facebook.com/servicehub"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
              </div>

              {/* Twitter URL */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                  Twitter / X Profile URL
                </label>
                <input
                  type="text"
                  value={twitterUrl}
                  onChange={e => setTwitterUrl(e.target.value)}
                  placeholder="https://twitter.com/servicehub"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
              </div>

              {/* YouTube Channel URL */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                  YouTube Channel URL
                </label>
                <input
                  type="text"
                  value={youtubeUrl}
                  onChange={e => setYoutubeUrl(e.target.value)}
                  placeholder="https://youtube.com/@servicehub"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
              </div>

              {/* Play Store URL */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                  Google Play Store Listing URL
                </label>
                <input
                  type="text"
                  value={playStoreUrl}
                  onChange={e => setPlayStoreUrl(e.target.value)}
                  placeholder="https://play.google.com/store/apps/details?id=com.servicehub.app"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
              </div>

              {/* App Store URL */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                  Apple App Store Listing URL
                </label>
                <input
                  type="text"
                  value={appStoreUrl}
                  onChange={e => setAppStoreUrl(e.target.value)}
                  placeholder="https://apps.apple.com/app/servicehub/id12345678"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
              </div>

            </div>
          </div>
        )}

        {/* ── TAB 5: PROVIDER RULES & COMMISSION ── */}
        {activeTab === 'providers' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
              <Users className="text-primary-600" size={20} /> Provider Commission & Payout Controls
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Default Commission Rate */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                  Platform Commission Rate (%)
                </label>
                <input
                  type="number"
                  value={defaultCommissionRate}
                  onChange={e => setDefaultCommissionRate(Number(e.target.value))}
                  placeholder="20"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
                <p className="text-[11px] text-slate-400 mt-1">% commission deducted per completed job</p>
              </div>

              {/* Min Settlement Threshold */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                  Min Wallet Payout Threshold ({currencySymbol})
                </label>
                <input
                  type="number"
                  value={minSettlementAmount}
                  onChange={e => setMinSettlementAmount(Number(e.target.value))}
                  placeholder="500"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
                <p className="text-[11px] text-slate-400 mt-1">Minimum wallet balance required for bank transfer</p>
              </div>

              {/* Max Commission Debt Limit */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                  Max Debt Limit Before Hold ({currencySymbol})
                </label>
                <input
                  type="number"
                  value={maxCommissionDebtLimit}
                  onChange={e => setMaxCommissionDebtLimit(Number(e.target.value))}
                  placeholder="2000"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
                <p className="text-[11px] text-slate-400 mt-1">Unpaid commission cap before job assignment freeze</p>
              </div>

            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Auto-Approve Provider KYC</h3>
                <p className="text-xs text-slate-500">Bypass manual admin approval for newly registered service providers</p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoApproveKyc}
                  onChange={e => setAutoApproveKyc(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          </div>
        )}

        {/* ── TAB 6: SEO & METADATA ── */}
        {activeTab === 'seo' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
              <Search className="text-primary-600" size={20} /> SEO Meta Tags & Analytics Measurement
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                  Meta Title Tag
                </label>
                <input
                  type="text"
                  value={metaTitle}
                  onChange={e => setMetaTitle(e.target.value)}
                  placeholder="ServiceHub — On-Demand Home Services & Maintenance"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                  Meta Description
                </label>
                <textarea
                  rows={3}
                  value={metaDescription}
                  onChange={e => setMetaDescription(e.target.value)}
                  placeholder="Book verified electricians, plumbers, AC technicians..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                  Keywords Tag (Comma-separated)
                </label>
                <input
                  type="text"
                  value={metaKeywords}
                  onChange={e => setMetaKeywords(e.target.value)}
                  placeholder="home services, electrician, plumber, AC repair, cleaning"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                  Google Analytics Measurement ID (G-XXXXXXX)
                </label>
                <input
                  type="text"
                  value={googleAnalyticsId}
                  onChange={e => setGoogleAnalyticsId(e.target.value)}
                  placeholder="G-1234567890"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 7: LEGAL POLICIES ── */}
        {activeTab === 'legal' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
              <FileText className="text-primary-600" size={20} /> Legal Policies & Customer Terms
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                  Terms of Service Text
                </label>
                <textarea
                  rows={4}
                  value={termsContent}
                  onChange={e => setTermsContent(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                  Privacy Policy Text
                </label>
                <textarea
                  rows={4}
                  value={privacyContent}
                  onChange={e => setPrivacyContent(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                  Cancellation & Refund Policy Text
                </label>
                <textarea
                  rows={3}
                  value={refundContent}
                  onChange={e => setRefundContent(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 4: BANNERS & VIDEO SPOTLIGHTS ── */}
        {activeTab === 'announcements' && (
          <div className="space-y-6">
            
            {/* Announcement Banner Bar */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
                <Megaphone className="text-primary-600" size={20} /> Top Announcement Banner Bar
              </h2>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                  Banner Text / Offer Message
                </label>
                <input
                  type="text"
                  value={announcementText}
                  onChange={e => setAnnouncementText(e.target.value)}
                  placeholder="🎉 Special Offer: 20% OFF on your first booking!"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={announcementActive}
                    onChange={e => setAnnouncementActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
                <span className="text-sm font-bold text-slate-700">Display Top Announcement Banner to Users</span>
              </div>
            </div>

            {/* Video Manager */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 space-y-6">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
                <Video className="text-primary-600" size={20} /> Add Promotional Service Video
              </h2>

              <form onSubmit={handleAddVideo} className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                    Video Title
                  </label>
                  <input
                    type="text"
                    required
                    value={newVideo.title}
                    onChange={e => setNewVideo({ ...newVideo, title: e.target.value })}
                    placeholder="e.g. AC Deep Cleaning in Action"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                    Video URL (YouTube Link or MP4 URL)
                  </label>
                  <input
                    type="text"
                    required
                    value={newVideo.video}
                    onChange={e => setNewVideo({ ...newVideo, video: e.target.value })}
                    placeholder="https://youtu.be/ge0suSTOVvg or https://.../video.mp4"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                    Category
                  </label>
                  <select
                    value={newVideo.category}
                    onChange={e => setNewVideo({ ...newVideo, category: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  >
                    {['AC Repair', 'Cleaning', 'Washing Machine', 'Plumbing', 'Electrical', 'Painting', 'Salon'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                    Badge Tag
                  </label>
                  <input
                    type="text"
                    value={newVideo.badge}
                    onChange={e => setNewVideo({ ...newVideo, badge: e.target.value })}
                    placeholder="🔥 Most Booked"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                    Short Description
                  </label>
                  <input
                    type="text"
                    value={newVideo.desc}
                    onChange={e => setNewVideo({ ...newVideo, desc: e.target.value })}
                    placeholder="Certified technicians at your home in 60 mins"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  />
                </div>

                <div className="md:col-span-2 flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-sm flex items-center gap-2 transition-all shadow-md"
                  >
                    <Plus size={16} /> Add Video to List
                  </button>
                </div>
              </form>
            </div>

            {/* Video List */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Video className="text-primary-600" size={20} /> Active Video Spotlights ({videoSpotlights.length})
                </h2>
              </div>

              {videoSpotlights.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Video size={40} className="mx-auto text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-600">No videos added yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {videoSpotlights.map((v, i) => (
                    <div key={i} className="bg-slate-900 text-white rounded-2xl overflow-hidden border border-slate-800 p-4 relative flex flex-col justify-between">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{v.badge} · {v.category}</span>
                          <h3 className="font-bold text-base leading-tight mt-0.5">{v.title}</h3>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{v.desc}</p>
                        </div>
                        
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setPreviewVideo(v.video)}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white transition-colors"
                          >
                            <Eye size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteVideo(i)}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={v.active !== false}
                            onChange={() => handleToggleVideoActive(i)}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-0"
                          />
                          <span className={v.active !== false ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                            {v.active !== false ? 'Visible in UI' : 'Hidden'}
                          </span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ── TAB 5: SYSTEM OPERATIONS & MAINTENANCE ── */}
        {activeTab === 'ops' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
              <Wrench className="text-primary-600" size={20} /> Operational Controls & Maintenance Mode
            </h2>

            <div className="space-y-6">
              
              {/* Maintenance Mode */}
              <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                <div className="flex items-center gap-3">
                  <ShieldAlert size={24} className="text-amber-600 shrink-0" />
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">System Maintenance Mode</h3>
                    <p className="text-xs text-slate-500">Show maintenance banner to customers during upgrades</p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={maintenanceMode}
                    onChange={e => setMaintenanceMode(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>

              {/* Allow New Bookings */}
              <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-2xl">
                <div className="flex items-center gap-3">
                  <Check size={24} className="text-blue-600 shrink-0" />
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Allow New Customer Bookings</h3>
                    <p className="text-xs text-slate-500">Enable or pause incoming service bookings across all categories</p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowBookings}
                    onChange={e => setAllowBookings(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* Floating Save Settings Action Bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-md text-white px-6 py-3.5 rounded-full shadow-2xl border border-slate-700/80 flex items-center gap-6 max-w-lg w-[92%] sm:w-auto justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <div className="text-xs">
            <p className="font-extrabold text-white">Admin Settings Panel</p>
            <p className="text-[10px] text-slate-400">Click Save to publish changes platform-wide</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveSettings}
          disabled={saving}
          className="px-5 py-2.5 bg-primary-600 hover:bg-primary-500 text-white font-extrabold rounded-full text-xs flex items-center gap-2 shadow-lg transition-all shrink-0 hover:scale-105 active:scale-95"
        >
          {saving ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={15} />}
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Video Preview Modal */}
      {previewVideo && (
        <div 
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setPreviewVideo(null)}
        >
          <div 
            className="w-full max-w-xl bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 relative"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-800 text-white">
              <h3 className="font-bold text-sm">Video Preview</h3>
              <button onClick={() => setPreviewVideo(null)} className="text-slate-400 hover:text-white font-bold">✕</button>
            </div>
            <div className="aspect-video bg-black">
              <video src={previewVideo} controls autoPlay className="w-full h-full object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
