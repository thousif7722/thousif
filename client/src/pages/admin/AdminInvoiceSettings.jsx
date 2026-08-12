import React, { useEffect, useState } from 'react';
import { apiService } from '@/services/api';
import Header from '@/components/common/Header';
import {
  FileText, Percent, DollarSign, Hash, Palette, Layers, UserCheck,
  ShieldCheck, HelpCircle, Eye, Sliders, Save, RotateCcw, Download,
  CheckCircle, Plus, Trash2, ArrowUp, ArrowDown, Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminInvoiceSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloadingSample, setDownloadingSample] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  // Form State initialized with defaults matching OneWayFix system
  const [settings, setSettings] = useState({
    companyName: 'ONEWAYFIX',
    brandTagline: 'Premium Home Services',
    website: 'www.onewayfix.com',
    supportEmail: 'support@onewayfix.com',
    supportPhone: '+91 9876543210',
    companyAddress: 'OneWayFix HQ, Hitech City, Hyderabad, TG 500081',
    gstin: '36ABCDE1234F1Z5',
    cin: 'U74999TG2026PTC123456',
    logoUrl: '/logo.png',
    invoiceTitle: 'INVOICE',

    gstEnabled: true,
    gstMode: 'included',
    taxCalculationMode: 'percentage',
    gstPercentage: 18,
    cgstPercentage: 9,
    sgstPercentage: 9,
    igstPercentage: 18,

    gstAppliesTo: {
      serviceCharge: true,
      platformFee: true,
      technicianCharge: true,
      partsMaterials: true,
      convenienceFee: false,
      emergencyFee: false,
      otherCharges: false,
    },

    showGst: true,
    showCgst: true,
    showSgst: true,
    showIgst: false,
    showGstin: true,

    labelGst: 'GST',
    labelCgst: 'CGST',
    labelSgst: 'SGST',
    labelIgst: 'IGST',
    labelTax: 'Tax',

    charges: [
      { id: 'service_charge', name: 'Service Charge', enabled: true, type: 'actual', value: 0, order: 1 },
      { id: 'platform_fee', name: 'Platform / Service Fee', enabled: true, type: 'fixed', value: 100, order: 2 },
      { id: 'parts_materials', name: 'Parts / Materials', enabled: true, type: 'actual', value: 0, order: 3 },
      { id: 'additional_charges', name: 'Additional Charges', enabled: true, type: 'actual', value: 0, order: 4 },
      { id: 'discount', name: 'Discount', enabled: true, type: 'actual', value: 0, order: 5 },
    ],

    numbering: {
      prefix: 'OWF-INV-',
      startingNumber: 100001,
      numberLength: 6,
      includeYear: false,
      includeMonth: false,
      nextNumber: 100001,
    },

    design: {
      layout: 'modern',
      paperSize: 'A4',
      orientation: 'portrait',
      primaryColor: '#0f766e',
      secondaryColor: '#0d9488',
      headerBg: '#ccfbf1',
      footerBg: '#ccfbf1',
      tableHeaderColor: '#1e293b',
      tableBorderColor: '#cbd5e1',
      totalHighlightColor: '#0f766e',
      guaranteeCardBg: '#ecfdf5',
      guaranteeBorderColor: '#059669',
      textColor: '#1e293b',
      fontFamily: 'Helvetica',
      logoWidth: 120,
      logoAlignment: 'right',
    },

    sections: [
      { id: 'header', title: 'Invoice Header', enabled: true, order: 1 },
      { id: 'metadata', title: 'Invoice Metadata', enabled: true, order: 2 },
      { id: 'parties', title: 'Customer & Technician Details', enabled: true, order: 3 },
      { id: 'items', title: 'Items / Service Table', enabled: true, order: 4 },
      { id: 'breakdown', title: 'Subtotal & Tax Breakdown', enabled: true, order: 5 },
      { id: 'guarantee', title: 'Service Guarantee Card', enabled: true, order: 6 },
      { id: 'support', title: 'Booking & Support Info', enabled: true, order: 7 },
      { id: 'thankyou', title: 'Thank You Footer', enabled: true, order: 8 },
    ],

    technicianFields: {
      showName: true,
      showEmployeeId: true,
      showPhone: true,
      showCategory: true,
      showRating: true,
      showGstin: false,
    },
    customerFields: {
      showName: true,
      showPhone: true,
      showEmail: true,
      showAddress: true,
      showCustomerId: false,
      showGstin: false,
    },

    guarantee: {
      enabled: true,
      duration: 1,
      unit: 'Months',
      title: '1-MONTH SERVICE GUARANTEE',
      description: 'Your completed service is covered by a 1-month service guarantee, subject to OneWayFix service terms and applicable conditions.',
    },

    footer: {
      thankYouTitle: 'THANK YOU!',
      thankYouMessage: 'Thank you for choosing OneWayFix for your home service needs. We appreciate your trust and look forward to serving you again.',
      termsText: 'This is a computer-generated invoice. No signature required. Terms & conditions apply.',
    },

    settingsVersion: 1,
  });

  useEffect(() => {
    fetchInvoiceSettings();
  }, []);

  async function fetchInvoiceSettings() {
    try {
      setLoading(true);
      const res = await apiService.getAdminInvoiceSettings();
      if (res.data?.data) {
        setSettings(prev => ({ ...prev, ...res.data.data }));
      }
    } catch (err) {
      toast.error('Failed to load invoice settings');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSettings(e) {
    if (e) e.preventDefault();
    try {
      setSaving(true);
      await apiService.updateAdminInvoiceSettings(settings);
      toast.success('Invoice & GST Settings saved successfully! 🎉');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update invoice settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleResetDefault() {
    if (!window.confirm('Are you sure you want to reset all Invoice & GST settings to original default values?')) return;
    try {
      setSaving(true);
      const res = await apiService.resetAdminInvoiceSettings();
      if (res.data?.data) {
        setSettings(res.data.data);
        toast.success('Invoice settings reset to original defaults');
      }
    } catch (err) {
      toast.error('Failed to reset settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadSamplePdf() {
    try {
      setDownloadingSample(true);
      const blob = await apiService.downloadSampleInvoicePdf(settings);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Sample-Invoice-${settings.companyName || 'OneWayFix'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success('Sample PDF Invoice downloaded!');
    } catch (err) {
      toast.error('Failed to download sample PDF');
    } finally {
      setDownloadingSample(false);
    }
  }

  const updateNestedSetting = (category, field, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value,
      },
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 pt-20 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header />

      <main className="py-6 px-4 max-w-6xl mx-auto space-y-6">
        
        {/* Page Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-teal-700 uppercase tracking-widest mb-1">
              <FileText size={16} /> Admin Settings & Dynamic Engine
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">Invoice & GST Customization System</h1>
            <p className="text-slate-500 text-sm mt-0.5">Control company details, GST rules, fees, PDF layout, guarantee card, and live preview</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadSamplePdf}
              disabled={downloadingSample}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-2xl text-xs flex items-center gap-2 transition-all border border-slate-200"
            >
              {downloadingSample ? <div className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" /> : <Download size={15} />}
              <span>Sample PDF</span>
            </button>

            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl text-xs flex items-center gap-2 transition-all shadow-lg shadow-teal-600/20"
            >
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={15} />}
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>

        {/* 11 Tabs Navigation Header */}
        <div className="flex overflow-x-auto bg-white rounded-2xl p-1.5 shadow-sm border border-slate-100 gap-1 scrollbar-hide">
          {[
            { id: 'general', label: '1. General', icon: FileText },
            { id: 'gst', label: '2. GST & Taxes', icon: Percent },
            { id: 'charges', label: '3. Charges', icon: DollarSign },
            { id: 'numbering', label: '4. Numbering', icon: Hash },
            { id: 'design', label: '5. PDF Design', icon: Palette },
            { id: 'sections', label: '6. Sections', icon: Layers },
            { id: 'technician', label: '7. Technician', icon: UserCheck },
            { id: 'guarantee', label: '8. Guarantee', icon: ShieldCheck },
            { id: 'footer', label: '9. Footer', icon: HelpCircle },
            { id: 'preview', label: '10. Live Preview', icon: Eye },
            { id: 'advanced', label: '11. Advanced', icon: Sliders },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-teal-700 text-white shadow-md'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── TAB 1: GENERAL COMPANY DETAILS ── */}
        {activeTab === 'general' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
              <FileText className="text-teal-600" size={20} /> Company & Invoice Header Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Company Legal Name</label>
                <input
                  type="text"
                  value={settings.companyName}
                  onChange={e => setSettings({ ...settings, companyName: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Brand Tagline / Subtitle</label>
                <input
                  type="text"
                  value={settings.brandTagline}
                  onChange={e => setSettings({ ...settings, brandTagline: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Support Email</label>
                <input
                  type="email"
                  value={settings.supportEmail}
                  onChange={e => setSettings({ ...settings, supportEmail: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Support Phone Number</label>
                <input
                  type="text"
                  value={settings.supportPhone}
                  onChange={e => setSettings({ ...settings, supportPhone: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Company Headquarters Address</label>
                <input
                  type="text"
                  value={settings.companyAddress}
                  onChange={e => setSettings({ ...settings, companyAddress: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">GSTIN Registration Number</label>
                <input
                  type="text"
                  value={settings.gstin}
                  onChange={e => setSettings({ ...settings, gstin: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">CIN (Corporate Identity Number)</label>
                <input
                  type="text"
                  value={settings.cin}
                  onChange={e => setSettings({ ...settings, cin: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Document Title Label</label>
                <input
                  type="text"
                  value={settings.invoiceTitle}
                  onChange={e => setSettings({ ...settings, invoiceTitle: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Official Website URL</label>
                <input
                  type="text"
                  value={settings.website}
                  onChange={e => setSettings({ ...settings, website: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: GST & TAX SETTINGS ── */}
        {activeTab === 'gst' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Percent className="text-teal-600" size={20} /> GST & Tax Calculation Configuration
              </h2>

              <label className="flex items-center gap-3 cursor-pointer">
                <span className="text-xs font-bold text-slate-700">Enable GST Calculation</span>
                <input
                  type="checkbox"
                  checked={settings.gstEnabled}
                  onChange={e => setSettings({ ...settings, gstEnabled: e.target.checked })}
                  className="w-5 h-5 accent-teal-600 rounded"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">GST Mode</label>
                <select
                  value={settings.gstMode}
                  onChange={e => setSettings({ ...settings, gstMode: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                >
                  <option value="included">GST Included in Price (Inclusive)</option>
                  <option value="added_separately">GST Added Separately (Exclusive)</option>
                  <option value="no_gst">No GST (Exempted / Zero Tax)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">GST Percentage (%)</label>
                <input
                  type="number"
                  value={settings.gstPercentage}
                  onChange={e => {
                    const val = Number(e.target.value);
                    setSettings({
                      ...settings,
                      gstPercentage: val,
                      cgstPercentage: val / 2,
                      sgstPercentage: val / 2,
                    });
                  }}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">CGST Rate (%)</label>
                <input
                  type="number"
                  value={settings.cgstPercentage}
                  onChange={e => setSettings({ ...settings, cgstPercentage: Number(e.target.value) })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">SGST Rate (%)</label>
                <input
                  type="number"
                  value={settings.sgstPercentage}
                  onChange={e => setSettings({ ...settings, sgstPercentage: Number(e.target.value) })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Display Flags */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">PDF Tax Display Options</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { key: 'showGst', label: 'Show GST Line' },
                  { key: 'showCgst', label: 'Show CGST Split' },
                  { key: 'showSgst', label: 'Show SGST Split' },
                  { key: 'showGstin', label: 'Show GSTIN No.' },
                ].map(flag => (
                  <label key={flag.key} className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings[flag.key]}
                      onChange={e => setSettings({ ...settings, [flag.key]: e.target.checked })}
                      className="w-4 h-4 accent-teal-600 rounded"
                    />
                    {flag.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: CHARGES CONFIGURATION ── */}
        {activeTab === 'charges' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
              <DollarSign className="text-teal-600" size={20} /> Configurable Charges & Pricing Table
            </h2>

            <div className="space-y-4">
              {settings.charges.map((charge, idx) => (
                <div key={charge.id} className="flex flex-col sm:flex-row items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200 gap-4">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <input
                      type="checkbox"
                      checked={charge.enabled}
                      onChange={e => {
                        const updated = [...settings.charges];
                        updated[idx].enabled = e.target.checked;
                        setSettings({ ...settings, charges: updated });
                      }}
                      className="w-5 h-5 accent-teal-600 rounded"
                    />
                    <input
                      type="text"
                      value={charge.name}
                      onChange={e => {
                        const updated = [...settings.charges];
                        updated[idx].name = e.target.value;
                        setSettings({ ...settings, charges: updated });
                      }}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800"
                    />
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <select
                      value={charge.type}
                      onChange={e => {
                        const updated = [...settings.charges];
                        updated[idx].type = e.target.value;
                        setSettings({ ...settings, charges: updated });
                      }}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                    >
                      <option value="actual">Actual Value from Booking</option>
                      <option value="fixed">Fixed Amount (₹)</option>
                      <option value="percentage">Percentage (%)</option>
                    </select>

                    {charge.type !== 'actual' && (
                      <input
                        type="number"
                        value={charge.value}
                        onChange={e => {
                          const updated = [...settings.charges];
                          updated[idx].value = Number(e.target.value);
                          setSettings({ ...settings, charges: updated });
                        }}
                        className="w-24 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 4: INVOICE NUMBERING ── */}
        {activeTab === 'numbering' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
              <Hash className="text-teal-600" size={20} /> Sequential Invoice Numbering System
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Invoice Prefix</label>
                <input
                  type="text"
                  value={settings.numbering.prefix}
                  onChange={e => updateNestedSetting('numbering', 'prefix', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Starting Number</label>
                <input
                  type="number"
                  value={settings.numbering.startingNumber}
                  onChange={e => updateNestedSetting('numbering', 'startingNumber', Number(e.target.value))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Minimum Digit Length</label>
                <input
                  type="number"
                  value={settings.numbering.numberLength}
                  onChange={e => updateNestedSetting('numbering', 'numberLength', Number(e.target.value))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Next Number in Counter</label>
                <input
                  type="number"
                  value={settings.numbering.nextNumber}
                  onChange={e => updateNestedSetting('numbering', 'nextNumber', Number(e.target.value))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-teal-700 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl">
              <div className="text-xs font-bold text-teal-800 uppercase tracking-wider">Generated Sample Format:</div>
              <div className="text-xl font-extrabold text-teal-900 mt-1">
                {settings.numbering.prefix}{String(settings.numbering.nextNumber || settings.numbering.startingNumber).padStart(settings.numbering.numberLength || 6, '0')}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 5: PDF DESIGN & COLORS ── */}
        {activeTab === 'design' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
              <Palette className="text-teal-600" size={20} /> Visual PDF Styling & Theme Colors
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Primary Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={settings.design.primaryColor}
                    onChange={e => updateNestedSetting('design', 'primaryColor', e.target.value)}
                    className="w-10 h-10 rounded-xl cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.design.primaryColor}
                    onChange={e => updateNestedSetting('design', 'primaryColor', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Header Background (Mint Light)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={settings.design.headerBg}
                    onChange={e => updateNestedSetting('design', 'headerBg', e.target.value)}
                    className="w-10 h-10 rounded-xl cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.design.headerBg}
                    onChange={e => updateNestedSetting('design', 'headerBg', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Guarantee Card Background</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={settings.design.guaranteeCardBg}
                    onChange={e => updateNestedSetting('design', 'guaranteeCardBg', e.target.value)}
                    className="w-10 h-10 rounded-xl cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.design.guaranteeCardBg}
                    onChange={e => updateNestedSetting('design', 'guaranteeCardBg', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 6: SECTIONS ORDER & TOGGLE ── */}
        {activeTab === 'sections' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
              <Layers className="text-teal-600" size={20} /> Invoice Section Visibility & Order
            </h2>

            <div className="space-y-3">
              {settings.sections.map((sec, idx) => (
                <div key={sec.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sec.enabled}
                      onChange={e => {
                        const updated = [...settings.sections];
                        updated[idx].enabled = e.target.checked;
                        setSettings({ ...settings, sections: updated });
                      }}
                      className="w-5 h-5 accent-teal-600 rounded"
                    />
                    <span className="text-sm font-bold text-slate-800">{sec.title}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 7: TECHNICIAN & CUSTOMER FIELDS ── */}
        {activeTab === 'technician' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
              <UserCheck className="text-teal-600" size={20} /> Technician & Customer Bill Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3 p-5 bg-slate-50 rounded-2xl border border-slate-200">
                <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Bill From — Technician Fields</h3>
                {[
                  { key: 'showName', label: 'Technician Name' },
                  { key: 'showEmployeeId', label: 'Employee ID (OWF-TECH-XXXX)' },
                  { key: 'showPhone', label: 'Phone Number' },
                  { key: 'showCategory', label: 'Service Category' },
                  { key: 'showRating', label: 'Star Rating' },
                ].map(field => (
                  <label key={field.key} className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.technicianFields[field.key]}
                      onChange={e => updateNestedSetting('technicianFields', field.key, e.target.checked)}
                      className="w-4 h-4 accent-teal-600 rounded"
                    />
                    {field.label}
                  </label>
                ))}
              </div>

              <div className="space-y-3 p-5 bg-slate-50 rounded-2xl border border-slate-200">
                <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Bill To — Customer Fields</h3>
                {[
                  { key: 'showName', label: 'Customer Name' },
                  { key: 'showPhone', label: 'Customer Phone' },
                  { key: 'showEmail', label: 'Customer Email' },
                  { key: 'showAddress', label: 'Service Address' },
                ].map(field => (
                  <label key={field.key} className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.customerFields[field.key]}
                      onChange={e => updateNestedSetting('customerFields', field.key, e.target.checked)}
                      className="w-4 h-4 accent-teal-600 rounded"
                    />
                    {field.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 8: GUARANTEE SETTINGS ── */}
        {activeTab === 'guarantee' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="text-teal-600" size={20} /> Service Guarantee Card Configuration
              </h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs font-bold text-slate-700">Enable Guarantee Card</span>
                <input
                  type="checkbox"
                  checked={settings.guarantee.enabled}
                  onChange={e => updateNestedSetting('guarantee', 'enabled', e.target.checked)}
                  className="w-5 h-5 accent-teal-600 rounded"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Card Title Header</label>
                <input
                  type="text"
                  value={settings.guarantee.title}
                  onChange={e => updateNestedSetting('guarantee', 'title', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Duration & Unit</label>
                <div className="flex gap-3">
                  <input
                    type="number"
                    value={settings.guarantee.duration}
                    onChange={e => updateNestedSetting('guarantee', 'duration', Number(e.target.value))}
                    className="w-24 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800"
                  />
                  <select
                    value={settings.guarantee.unit}
                    onChange={e => updateNestedSetting('guarantee', 'unit', e.target.value)}
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800"
                  >
                    <option value="Days">Days</option>
                    <option value="Weeks">Weeks</option>
                    <option value="Months">Months</option>
                  </select>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Guarantee Terms Description</label>
                <textarea
                  rows={3}
                  value={settings.guarantee.description}
                  onChange={e => updateNestedSetting('guarantee', 'description', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 9: FOOTER & SUPPORT ── */}
        {activeTab === 'footer' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
              <HelpCircle className="text-teal-600" size={20} /> Footer & Thank You Notes
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Thank You Title</label>
                <input
                  type="text"
                  value={settings.footer.thankYouTitle}
                  onChange={e => updateNestedSetting('footer', 'thankYouTitle', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Appreciation Message</label>
                <textarea
                  rows={2}
                  value={settings.footer.thankYouMessage}
                  onChange={e => updateNestedSetting('footer', 'thankYouMessage', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Computer Generated Terms Disclaimer</label>
                <input
                  type="text"
                  value={settings.footer.termsText}
                  onChange={e => updateNestedSetting('footer', 'termsText', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 10: LIVE INTERACTIVE PREVIEW ── */}
        {activeTab === 'preview' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Eye className="text-teal-600" size={20} /> Live Visual Preview
              </h2>
              <button
                onClick={handleDownloadSamplePdf}
                disabled={downloadingSample}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs flex items-center gap-2"
              >
                <Download size={14} /> Download Sample PDF
              </button>
            </div>

            {/* Pixel-Perfect Render Matching Reference Image */}
            <div className="max-w-2xl mx-auto bg-white border border-slate-300 rounded-2xl shadow-xl overflow-hidden text-slate-800 font-sans text-xs">
              
              {/* Header Banner */}
              <div style={{ backgroundColor: settings.design.headerBg || '#ccfbf1' }} className="p-6 flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{settings.invoiceTitle || 'INVOICE'}</h1>
                  <p className="text-sm font-medium text-slate-600 mt-0.5">{settings.companyName || 'OneWayFix'}</p>
                </div>
                <div className="text-right">
                  <h2 className="text-base font-extrabold text-slate-900">{settings.companyName || 'ONEWAYFIX'}</h2>
                  <p className="text-xs text-slate-600 font-medium">{settings.brandTagline || 'Premium Home Services'}</p>
                </div>
              </div>

              {/* Metadata Bar */}
              <div className="grid grid-cols-4 p-4 border-b border-slate-200 bg-slate-50 text-[11px]">
                <div>
                  <span className="block text-[9px] font-bold text-slate-400 uppercase">INVOICE NO.</span>
                  <span className="font-extrabold text-slate-800">OWF-INV-100001</span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-slate-400 uppercase">DATE</span>
                  <span className="font-extrabold text-slate-800">12 AUG 2026</span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-slate-400 uppercase">PAYMENT METHOD</span>
                  <span className="font-extrabold text-slate-800">ONLINE / UPI</span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-slate-400 uppercase">AMOUNT DUE</span>
                  <span className="font-extrabold text-slate-900">₹0.00</span>
                </div>
              </div>

              {/* Parties Box */}
              <div className="p-4 bg-teal-50/50 m-4 rounded-xl border border-teal-100 grid grid-cols-2 gap-4 text-[11px]">
                <div>
                  <h4 className="font-extrabold text-slate-900 uppercase text-[10px] mb-1">BILL TO — CUSTOMER</h4>
                  <p className="font-semibold text-slate-800">Demo Customer</p>
                  <p className="text-slate-600">+91 98765 43210</p>
                  <p className="text-slate-600">customer@onewayfix.com</p>
                  <p className="text-slate-600">Hitech City Main Rd, Hyderabad</p>
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 uppercase text-[10px] mb-1">BILL FROM — TECHNICIAN</h4>
                  <p className="font-semibold text-slate-800">Vishnu Vardhan Reddy</p>
                  <p className="text-slate-600">ID: OWF-TECH-000123</p>
                  <p className="text-slate-600">+91 91234 56789</p>
                  <p className="text-slate-600">AC Repair Expert (★ 4.9)</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="p-4">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="bg-slate-900 text-white font-bold">
                      <th className="p-2.5 rounded-l-lg">ITEMS / SERVICE</th>
                      <th className="p-2.5 text-center">QTY</th>
                      <th className="p-2.5 text-right">PRICE</th>
                      <th className="p-2.5 text-right rounded-r-lg">TOTAL AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="p-2.5 font-medium">AC Repair - Gas Charging</td>
                      <td className="p-2.5 text-center">1</td>
                      <td className="p-2.5 text-right">₹501.00</td>
                      <td className="p-2.5 text-right font-bold">₹501.00</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium">Platform / Service Fee</td>
                      <td className="p-2.5 text-center">1</td>
                      <td className="p-2.5 text-right">₹100.00</td>
                      <td className="p-2.5 text-right font-bold">₹100.00</td>
                    </tr>
                  </tbody>
                </table>

                {/* Summary */}
                <div className="mt-4 pt-3 border-t border-slate-200 space-y-1.5 text-[11px] text-right">
                  <div className="flex justify-between font-bold">
                    <span>SUBTOTAL</span>
                    <span>₹601.00</span>
                  </div>
                  {settings.gstEnabled && (
                    <div className="flex justify-between text-slate-600">
                      <span>GST ({settings.gstMode === 'included' ? 'Included' : '18%'})</span>
                      <span>₹91.68</span>
                    </div>
                  )}
                  <div className="flex justify-between font-extrabold text-sm pt-2 border-t border-slate-900 text-slate-900">
                    <span>TOTAL</span>
                    <span>₹601.00</span>
                  </div>
                </div>
              </div>

              {/* Guarantee Card */}
              {settings.guarantee.enabled && (
                <div style={{ backgroundColor: settings.design.guaranteeCardBg || '#ecfdf5' }} className="m-4 p-3.5 rounded-xl border border-emerald-600 text-emerald-900">
                  <div className="font-extrabold flex items-center gap-1.5 text-xs">
                    <CheckCircle size={14} className="text-emerald-600" />
                    {settings.guarantee.title}
                  </div>
                  <p className="text-[10px] text-emerald-700 mt-1">{settings.guarantee.description}</p>
                </div>
              )}

              {/* Footer */}
              <div style={{ backgroundColor: settings.design.footerBg || '#ccfbf1' }} className="p-4 text-center text-slate-700">
                <h4 className="font-extrabold text-xs">{settings.footer.thankYouTitle}</h4>
                <p className="text-[10px] text-slate-600 mt-0.5">{settings.footer.thankYouMessage}</p>
                <p className="text-[9px] text-slate-400 mt-2">{settings.footer.termsText}</p>
              </div>

            </div>
          </div>
        )}

        {/* ── TAB 11: ADVANCED CONTROLS ── */}
        {activeTab === 'advanced' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
              <Sliders className="text-teal-600" size={20} /> Advanced Administrative Controls
            </h2>

            <div className="p-6 bg-red-50 border border-red-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-extrabold text-red-900 text-sm">Reset Settings to Factory Defaults</h3>
                <p className="text-xs text-red-700 mt-0.5">Resets company, GST, design, and guarantee parameters back to original OneWayFix template settings.</p>
              </div>

              <button
                onClick={handleResetDefault}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shrink-0 shadow-md shadow-red-600/20"
              >
                <RotateCcw size={14} /> Reset Settings
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
