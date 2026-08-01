import React, { useEffect, useState } from 'react';
import { apiService } from '@/services/api';
import { useSelector } from 'react-redux';
import { selectServices, selectPublicSettings } from '@/store/slices/serviceSlice';
import Header from '@/components/common/Header';
import { 
  Save, Upload, CreditCard, Star, Shield, ChevronDown, ChevronUp, 
  Edit3, CheckCircle, AlertTriangle, Image as ImageIcon, Sparkles, Check, Info
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProviderProfile() {
  const allServices = useSelector(selectServices);
  const settings = useSelector(selectPublicSettings);
  const siteName = settings?.siteName || 'ServiceHub';

  const [profile, setProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [openSections, setOpenSections] = useState({ profile: true, services: true, kyc: true, bank: true });
  
  const [form, setForm] = useState({ name: '', experience: '', serviceRadius: 10 });
  const [selectedServices, setSelectedServices] = useState([]);
  const [bank, setBank] = useState({ accountNumber: '', ifscCode: '', bankName: '', accountHolder: '' });
  const [kycFiles, setKycFiles] = useState({ selfie: null, aadhaarDoc: null, panDoc: null });
  const [kycPreviews, setKycPreviews] = useState({ selfie: null, aadhaarDoc: null, panDoc: null });
  
  const [editingBank, setEditingBank] = useState(false);
  const [forceEditKyc, setForceEditKyc] = useState(false);

  useEffect(() => {
    apiService.getMyProfile().then(res => {
      const p = res.data.data;
      setProfile(p);
      setForm({ name: p.name || '', experience: p.experience || 0, serviceRadius: p.serviceRadius || 10 });
      setSelectedServices(p.services?.map(s => s._id || s) || []);
      
      if (p.earnings?.bankAccount?.accountNumber) {
        setBank({
          accountNumber: p.earnings.bankAccount.accountNumber,
          ifscCode: p.earnings.bankAccount.ifscCode || '',
          bankName: p.earnings.bankAccount.bankName || '',
          accountHolder: p.earnings.bankAccount.accountHolder || '',
        });
      }

      // If approved, collapse sections for clean view; if pending/rejected, open all required
      if (p.approvalStatus === 'approved') {
        setOpenSections({ profile: true, services: false, kyc: false, bank: false });
      } else {
        setOpenSections({ profile: true, services: true, kyc: true, bank: true });
      }
    });
  }, []);

  const toggleSection = (id) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleFileChange = (key, file) => {
    if (!file) return;
    setKycFiles(prev => ({ ...prev, [key]: file }));
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setKycPreviews(prev => ({ ...prev, [key]: url }));
    } else {
      setKycPreviews(prev => ({ ...prev, [key]: null }));
    }
  };

  async function saveProfile() {
    if (!form.name || form.name.trim().length < 2) {
      return toast.error('Please enter a valid full name');
    }
    setSaving(true);
    try {
      await apiService.updateProfile(form);
      toast.success('Basic profile details saved!');
    } catch { 
      toast.error('Failed to update profile'); 
    }
    setSaving(false);
  }

  async function saveServices() {
    if (!selectedServices || selectedServices.length === 0) {
      return toast.error('Please select at least 1 service you provide');
    }
    setSaving(true);
    try {
      await apiService.updateServices(selectedServices);
      toast.success('Service offerings updated!');
    } catch { 
      toast.error('Failed to update services'); 
    }
    setSaving(false);
  }

  async function saveBank() {
    if (!bank.accountHolder || !bank.accountNumber || !bank.ifscCode || !bank.bankName) {
      return toast.error('All bank account fields are mandatory');
    }
    setSaving(true);
    try {
      await apiService.updateBankAccount(bank);
      toast.success('Bank details saved and submitted for verification!');
      setEditingBank(false);
      setProfile(p => ({ ...p, earnings: { ...p?.earnings, bankAccount: { ...bank, verified: false } } }));
    } catch { 
      toast.error('Failed to save bank account details'); 
    }
    setSaving(false);
  }

  async function uploadKYC() {
    if (!kycFiles.selfie && !kycFiles.aadhaarDoc && !kycFiles.panDoc) {
      return toast.error('Please select at least one document file to upload');
    }
    setSaving(true);
    try {
      const fd = new FormData();
      if (kycFiles.aadhaarDoc) fd.append('aadhaarDoc', kycFiles.aadhaarDoc);
      if (kycFiles.panDoc) fd.append('panDoc', kycFiles.panDoc);
      if (kycFiles.selfie) fd.append('selfie', kycFiles.selfie);

      await apiService.uploadKYC(fd);
      toast.success('KYC documents uploaded & submitted for verification!');
      setForceEditKyc(false);
      setKycFiles({ selfie: null, aadhaarDoc: null, panDoc: null });
      setProfile(p => ({
        ...p,
        kyc: { ...p?.kyc, status: 'submitted' },
        approvalStatus: p?.approvalStatus === 'rejected' ? 'pending' : p?.approvalStatus,
      }));
    } catch (err) { 
      toast.error(err.response?.data?.error || 'Upload failed. Please check file sizes and formats.'); 
    }
    setSaving(false);
  }

  const hasSavedBank = !!profile?.earnings?.bankAccount?.accountNumber;
  const bankVerified = profile?.earnings?.bankAccount?.verified;
  const hasServices = selectedServices && selectedServices.length > 0;
  const kycStatus = profile?.kyc?.status || 'pending';

  // Completion step indicators
  const stepProfileDone = !!(form.name && form.name.length > 1);
  const stepServicesDone = hasServices;
  const stepKycDone = kycStatus === 'verified' || kycStatus === 'submitted';
  const stepBankDone = hasSavedBank;

  const completedStepsCount = [stepProfileDone, stepServicesDone, stepKycDone, stepBankDone].filter(Boolean).length;
  const totalSteps = 4;
  const completionPercent = Math.round((completedStepsCount / totalSteps) * 100);

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header />
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        
        {/* Page Title & Status Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                {siteName} Pro Verification
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900">Technician Onboarding Profile</h1>
            <p className="text-xs text-slate-500 mt-1">Complete mandatory verification details to start accepting customer job requests.</p>
          </div>

          <div className="text-right sm:text-right shrink-0">
            <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">Profile Setup</span>
            <span className="text-2xl font-black text-blue-600">{completionPercent}%</span>
            <span className="text-xs text-slate-500 block">({completedStepsCount}/{totalSteps} Steps Complete)</span>
          </div>
        </div>

        {/* Verification Progress Bar */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-3">
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
            <div 
              className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full transition-all duration-500" 
              style={{ width: `${completionPercent}%` }}
            />
          </div>

          {/* Step badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <div className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 ${stepProfileDone ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              {stepProfileDone ? <Check size={14} /> : <span className="w-3.5 h-3.5 rounded-full bg-slate-300 inline-block" />} Profile Info
            </div>
            <div className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 ${stepServicesDone ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
              {stepServicesDone ? <Check size={14} /> : <AlertTriangle size={14} />} 1+ Services *
            </div>
            <div className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 ${stepKycDone ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
              {stepKycDone ? <Check size={14} /> : <AlertTriangle size={14} />} KYC Docs *
            </div>
            <div className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 ${stepBankDone ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
              {stepBankDone ? <Check size={14} /> : <AlertTriangle size={14} />} Bank Payout *
            </div>
          </div>
        </div>

        {/* Global Approval Status Alert Banner */}
        {profile && (
          <div className={`p-5 rounded-3xl border flex items-start gap-4 shadow-sm ${
            profile.approvalStatus === 'approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
            profile.approvalStatus === 'rejected' ? 'bg-rose-50 border-rose-200 text-rose-900' :
            'bg-amber-50 border-amber-200 text-amber-900'
          }`}>
            <span className="text-3xl shrink-0">
              {profile.approvalStatus === 'approved' ? '✅' : profile.approvalStatus === 'rejected' ? '🚨' : '⏳'}
            </span>
            <div className="flex-1">
              <h3 className="font-extrabold text-base leading-tight">
                {profile.approvalStatus === 'approved' ? 'Account Fully Approved & Active!' :
                 profile.approvalStatus === 'rejected' ? 'Verification Action Required: Documents Rejected' :
                 'Verification Pending Admin Review'}
              </h3>
              <p className="text-xs mt-1 leading-relaxed opacity-90">
                {profile.approvalStatus === 'approved' ? `You are active on the ${siteName} technician dispatch network. Tier: ${profile.tier?.toUpperCase()} (${profile.completedJobs} jobs completed).` :
                 profile.approvalStatus === 'rejected' ? 'Please re-upload clear photos of your Aadhaar Card, PAN Card, and Selfie below to request instant admin re-approval.' :
                 'Please complete all mandatory sections below (Services, KYC Documents, and Bank Details). Our verification team will review your account within 12-24 hours.'}
              </p>
            </div>
          </div>
        )}

        {/* ── SECTION 1: BASIC PROFILE ── */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <button
            onClick={() => toggleSection('profile')}
            className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50/80 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Star size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">1. Basic Profile & Experience</h3>
                <p className="text-xs text-slate-400">Full name, work experience, and travel service radius</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {stepProfileDone ? (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">✓ Filled</span>
              ) : (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">Required</span>
              )}
              {openSections.profile ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
            </div>
          </button>

          {openSections.profile && (
            <div className="border-t border-slate-100 p-6 space-y-4 bg-slate-50/40">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                  Full Legal Name *
                </label>
                <input 
                  type="text"
                  value={form.name} 
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} 
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  placeholder="e.g. Rahul Sharma" 
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                    Years of Experience *
                  </label>
                  <input 
                    type="number" 
                    value={form.experience} 
                    onChange={e => setForm(f => ({ ...f, experience: e.target.value }))} 
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    min={0}
                    placeholder="e.g. 5"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                    Matching Radius (KM) *
                  </label>
                  <input 
                    type="number" 
                    value={form.serviceRadius} 
                    onChange={e => setForm(f => ({ ...f, serviceRadius: e.target.value }))} 
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    min={1} 
                    max={50} 
                  />
                </div>
              </div>

              <button 
                onClick={saveProfile} 
                disabled={saving} 
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-md transition-all"
              >
                <Save size={17} /> {saving ? 'Saving Profile…' : 'Save Basic Profile'}
              </button>
            </div>
          )}
        </div>

        {/* ── SECTION 2: MY SERVICES (MANDATORY) ── */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <button
            onClick={() => toggleSection('services')}
            className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50/80 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Shield size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  2. Select Offered Services <span className="text-xs font-extrabold text-rose-500 uppercase">*Mandatory</span>
                </h3>
                <p className="text-xs text-slate-400">Choose all repair & maintenance services you are qualified to perform</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {stepServicesDone ? (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
                  ✓ {selectedServices.length} Selected
                </span>
              ) : (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-100 text-rose-700">
                  Select 1+
                </span>
              )}
              {openSections.services ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
            </div>
          </button>

          {openSections.services && (
            <div className="border-t border-slate-100 p-6 space-y-5 bg-slate-50/40">
              {!hasServices && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                  <span>You have not selected any services. You will not receive any customer job alerts until you check at least 1 service below.</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                {allServices.map(s => {
                  const isChecked = selectedServices.includes(s._id);
                  return (
                    <label 
                      key={s._id} 
                      className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                        isChecked 
                          ? 'border-blue-600 bg-blue-50/80 shadow-sm' 
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={e => setSelectedServices(prev => 
                          e.target.checked ? [...prev, s._id] : prev.filter(id => id !== s._id)
                        )}
                        className="w-4 h-4 accent-blue-600 rounded"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-bold text-slate-800 leading-tight block">
                          {s.icon || '🔧'} {s.name}
                        </span>
                        <span className="text-[11px] text-slate-400 block">{s.category} · Base ₹{s.basePrice}</span>
                      </div>
                    </label>
                  );
                })}
              </div>

              <button 
                onClick={saveServices} 
                disabled={saving} 
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-md transition-all"
              >
                <Save size={17} /> {saving ? 'Updating Services…' : `Save Services (${selectedServices.length} Selected)`}
              </button>
            </div>
          )}
        </div>

        {/* ── SECTION 3: KYC DOCUMENTS UPLOAD (MANDATORY WITH PREVIEWS) ── */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <button
            onClick={() => toggleSection('kyc')}
            className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50/80 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Upload size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  3. Upload KYC Identity Documents <span className="text-xs font-extrabold text-rose-500 uppercase">*Mandatory</span>
                </h3>
                <p className="text-xs text-slate-400">Upload Selfie, Aadhaar Card, and PAN Card for background check</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                kycStatus === 'verified' ? 'bg-emerald-100 text-emerald-700' :
                kycStatus === 'submitted' ? 'bg-blue-100 text-blue-700' :
                kycStatus === 'rejected' ? 'bg-rose-100 text-rose-700' :
                'bg-amber-100 text-amber-700'
              }`}>
                {kycStatus === 'verified' ? '✓ Verified' : kycStatus === 'submitted' ? '⏳ Under Review' : 'Upload Needed'}
              </span>
              {openSections.kyc ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
            </div>
          </button>

          {openSections.kyc && (
            <div className="border-t border-slate-100 p-6 space-y-6 bg-slate-50/40">
              
              {kycStatus === 'verified' && !forceEditKyc ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle size={24} className="text-emerald-600 shrink-0" />
                    <div>
                      <h4 className="font-bold text-emerald-900 text-sm">Identity Verified</h4>
                      <p className="text-xs text-emerald-700">Your KYC documents have passed background check verification.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setForceEditKyc(true)}
                    className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-all flex items-center gap-1 shrink-0"
                  >
                    <Edit3 size={12} /> Update Docs
                  </button>
                </div>
              ) : (
                <>
                  {kycStatus === 'rejected' && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-900 p-4 rounded-2xl text-xs font-medium space-y-1">
                      <p className="font-bold">❌ KYC Verification Rejected</p>
                      <p>Your uploaded document photos were blurry or invalid. Please re-select clear photos below and click Submit.</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    
                    {/* 1. Selfie Upload Card */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col items-center text-center space-y-2 relative">
                      <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">1. Profile Selfie *</span>
                      <label className="relative flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-blue-300 rounded-full bg-blue-50/50 cursor-pointer overflow-hidden group hover:border-blue-500 hover:bg-blue-100/50 transition-all">
                        {kycPreviews.selfie ? (
                          <img src={kycPreviews.selfie} alt="Selfie preview" className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-blue-600">
                            <Upload size={20} className="mb-1" />
                            <span className="text-[10px] font-bold">Upload Face</span>
                          </div>
                        )}
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={e => handleFileChange('selfie', e.target.files[0])} 
                          className="hidden" 
                        />
                      </label>
                      <span className="text-[10px] text-slate-400">Clear face photo</span>
                      {kycFiles.selfie && <span className="text-[10px] font-bold text-emerald-600">✓ Photo Selected</span>}
                    </div>

                    {/* 2. Aadhaar Upload Card */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col items-center text-center space-y-2">
                      <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">2. Aadhaar Card *</span>
                      <label className="relative flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-blue-300 rounded-2xl bg-blue-50/50 cursor-pointer overflow-hidden group hover:border-blue-500 hover:bg-blue-100/50 transition-all">
                        {kycPreviews.aadhaarDoc ? (
                          <img src={kycPreviews.aadhaarDoc} alt="Aadhaar preview" className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-blue-600">
                            <ImageIcon size={20} className="mb-1" />
                            <span className="text-[10px] font-bold">Upload Aadhaar</span>
                          </div>
                        )}
                        <input 
                          type="file" 
                          accept="image/*,.pdf" 
                          onChange={e => handleFileChange('aadhaarDoc', e.target.files[0])} 
                          className="hidden" 
                        />
                      </label>
                      <span className="text-[10px] text-slate-400">Front & Back image</span>
                      {kycFiles.aadhaarDoc && <span className="text-[10px] font-bold text-emerald-600">✓ File Selected</span>}
                    </div>

                    {/* 3. PAN Card Upload Card */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col items-center text-center space-y-2">
                      <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">3. PAN Card *</span>
                      <label className="relative flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-blue-300 rounded-2xl bg-blue-50/50 cursor-pointer overflow-hidden group hover:border-blue-500 hover:bg-blue-100/50 transition-all">
                        {kycPreviews.panDoc ? (
                          <img src={kycPreviews.panDoc} alt="PAN preview" className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-blue-600">
                            <ImageIcon size={20} className="mb-1" />
                            <span className="text-[10px] font-bold">Upload PAN</span>
                          </div>
                        )}
                        <input 
                          type="file" 
                          accept="image/*,.pdf" 
                          onChange={e => handleFileChange('panDoc', e.target.files[0])} 
                          className="hidden" 
                        />
                      </label>
                      <span className="text-[10px] text-slate-400">PAN ID photo</span>
                      {kycFiles.panDoc && <span className="text-[10px] font-bold text-emerald-600">✓ File Selected</span>}
                    </div>

                  </div>

                  <button 
                    onClick={uploadKYC} 
                    disabled={saving} 
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-md transition-all"
                  >
                    <Upload size={17} /> {saving ? 'Uploading Documents…' : 'Submit KYC Documents for Verification'}
                  </button>
                </>
              )}

            </div>
          )}
        </div>

        {/* ── SECTION 4: BANK ACCOUNT FOR PAYOUTS (MANDATORY) ── */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <button
            onClick={() => toggleSection('bank')}
            className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50/80 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <CreditCard size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  4. Bank Account for Weekly Payouts <span className="text-xs font-extrabold text-rose-500 uppercase">*Mandatory</span>
                </h3>
                <p className="text-xs text-slate-400">Enter bank account details to receive your job earnings directly</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                bankVerified ? 'bg-emerald-100 text-emerald-700' :
                hasSavedBank ? 'bg-blue-100 text-blue-700' :
                'bg-amber-100 text-amber-700'
              }`}>
                {bankVerified ? '✓ Bank Verified' : hasSavedBank ? '⏳ Pending Review' : 'Details Needed'}
              </span>
              {openSections.bank ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
            </div>
          </button>

          {openSections.bank && (
            <div className="border-t border-slate-100 p-6 space-y-4 bg-slate-50/40">
              
              {hasSavedBank && !editingBank ? (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <span className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <CreditCard size={16} className="text-emerald-600" /> Saved Bank Details
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      bankVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {bankVerified ? 'Verified Payout Account' : 'Verification Pending'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block">Account Holder</span>
                      <span className="font-bold text-slate-800">{profile.earnings.bankAccount.accountHolder}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Bank Name</span>
                      <span className="font-bold text-slate-800">{profile.earnings.bankAccount.bankName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Account Number</span>
                      <span className="font-bold text-slate-800 font-mono">
                        •••• {profile.earnings.bankAccount.accountNumber?.slice(-4)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">IFSC Code</span>
                      <span className="font-bold text-slate-800 font-mono">{profile.earnings.bankAccount.ifscCode}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setEditingBank(true)}
                    className="w-full mt-2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Edit3 size={14} /> Change Bank Details
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                      Account Holder Name *
                    </label>
                    <input
                      type="text"
                      value={bank.accountHolder}
                      onChange={e => setBank(b => ({ ...b, accountHolder: e.target.value }))}
                      placeholder="Full name as printed on Bank Passbook / Cheque"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                        Bank Account Number *
                      </label>
                      <input
                        type="text"
                        value={bank.accountNumber}
                        onChange={e => setBank(b => ({ ...b, accountNumber: e.target.value }))}
                        placeholder="Enter Bank Account Number"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                        Bank IFSC Code *
                      </label>
                      <input
                        type="text"
                        value={bank.ifscCode}
                        onChange={e => setBank(b => ({ ...b, ifscCode: e.target.value.toUpperCase() }))}
                        placeholder="e.g. SBIN0001234"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                      Bank Name *
                    </label>
                    <input
                      type="text"
                      value={bank.bankName}
                      onChange={e => setBank(b => ({ ...b, bankName: e.target.value }))}
                      placeholder="e.g. State Bank of India, HDFC Bank, ICICI"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <button 
                    onClick={saveBank} 
                    disabled={saving} 
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-md transition-all"
                  >
                    <Save size={17} /> {saving ? 'Saving Bank Details…' : 'Save Bank Account for Payouts'}
                  </button>

                  {editingBank && (
                    <button 
                      onClick={() => setEditingBank(false)} 
                      className="w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-600"
                    >
                      Cancel Edit
                    </button>
                  )}
                </>
              )}

            </div>
          )}
        </div>

      </div>
    </div>
  );
}
