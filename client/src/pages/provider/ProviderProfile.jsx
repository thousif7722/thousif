import React, { useEffect, useState } from 'react';
import { apiService } from '@/services/api';
import { useSelector } from 'react-redux';
import { selectServices } from '@/store/slices/serviceSlice';
import Header from '@/components/common/Header';
import { Save, Upload, CreditCard, Star, Shield, ChevronDown, ChevronUp, Edit3, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProviderProfile() {
  const allServices = useSelector(selectServices);
  const [profile, setProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState('profile');
  const [form, setForm] = useState({ name: '', experience: '', serviceRadius: 10 });
  const [selectedServices, setSelectedServices] = useState([]);
  const [bank, setBank] = useState({ accountNumber: '', ifscCode: '', bankName: '', accountHolder: '' });
  const [kycFiles, setKycFiles] = useState({});
  const [editingBank, setEditingBank] = useState(false);
  const [forceEditKyc, setForceEditKyc] = useState(false);

  useEffect(() => {
    apiService.getMyProfile().then(res => {
      const p = res.data.data;
      setProfile(p);
      setForm({ name: p.name, experience: p.experience, serviceRadius: p.serviceRadius || 10 });
      setSelectedServices(p.services?.map(s => s._id || s) || []);
      if (p.earnings?.bankAccount?.accountNumber) {
        setBank({
          accountNumber: p.earnings.bankAccount.accountNumber,
          ifscCode: p.earnings.bankAccount.ifscCode || '',
          bankName: p.earnings.bankAccount.bankName || '',
          accountHolder: p.earnings.bankAccount.accountHolder || '',
        });
      }
    });
  }, []);

  async function saveProfile() {
    setSaving(true);
    try {
      await apiService.updateProfile(form);
      toast.success('Profile updated');
    } catch { toast.error('Failed'); }
    setSaving(false);
  }

  async function saveServices() {
    setSaving(true);
    try {
      await apiService.updateServices(selectedServices);
      toast.success('Services updated');
    } catch { toast.error('Failed'); }
    setSaving(false);
  }

  async function saveBank() {
    if (!bank.accountHolder || !bank.accountNumber || !bank.ifscCode || !bank.bankName) {
      return toast.error('All bank fields are required');
    }
    setSaving(true);
    try {
      await apiService.updateBankAccount(bank);
      toast.success('Bank account submitted for verification');
      setEditingBank(false);
      setProfile(p => ({ ...p, earnings: { ...p?.earnings, bankAccount: { ...bank, verified: false } } }));
    } catch { toast.error('Failed to save bank account'); }
    setSaving(false);
  }

  async function uploadKYC() {
    if (!kycFiles.aadhaarDoc && !kycFiles.panDoc) return toast.error('Please upload at least one document');
    setSaving(true);
    try {
      const fd = new FormData();
      if (kycFiles.aadhaarDoc) fd.append('aadhaarDoc', kycFiles.aadhaarDoc);
      if (kycFiles.panDoc) fd.append('panDoc', kycFiles.panDoc);
      if (kycFiles.selfie) fd.append('selfie', kycFiles.selfie);
      await apiService.uploadKYC(fd);
      toast.success('KYC documents submitted for review');
      setForceEditKyc(false);
      setKycFiles({});
      setProfile(p => ({
        ...p,
        kyc: { ...p?.kyc, status: 'submitted' },
        approvalStatus: p?.approvalStatus === 'rejected' ? 'pending' : p?.approvalStatus,
      }));
    } catch (err) { 
      toast.error(err.response?.data?.error || 'Upload failed. Please try again.'); 
    }
    setSaving(false);
  }

  const hasSavedBank = !!profile?.earnings?.bankAccount?.accountNumber;
  const bankVerified = profile?.earnings?.bankAccount?.verified;

  const sections = [
    { id: 'profile', label: 'Profile', icon: Star },
    { id: 'services', label: 'My Services', icon: Shield },
    { id: 'kyc', label: 'KYC Documents', icon: Upload },
    { id: 'bank', label: 'Bank Account', icon: CreditCard },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header />
      <div className="pt-16 max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-5">Provider Profile</h1>

        {/* Status banner */}
        {profile && (
          <div className={`card p-4 mb-5 flex items-center gap-3 ${
            profile.approvalStatus === 'approved' ? 'bg-green-50 border-green-100' :
            profile.approvalStatus === 'rejected' ? 'bg-red-50 border-red-200' :
            'bg-amber-50 border-amber-100'
          }`}>
            <span className="text-2xl">
              {profile.approvalStatus === 'approved' ? '✅' : profile.approvalStatus === 'rejected' ? '❌' : '⏳'}
            </span>
            <div>
              <p className="font-semibold text-slate-800">
                {profile.approvalStatus === 'approved' ? 'Account Verified' :
                 profile.approvalStatus === 'rejected' ? 'Application Rejected' :
                 'Verification Pending'}
              </p>
              <p className="text-xs text-slate-500">
                {profile.approvalStatus === 'approved' ? `Tier: ${profile.tier} · ${profile.completedJobs} jobs completed` :
                 profile.approvalStatus === 'rejected' ? 'Resubmit your KYC documents below to request re-approval.' :
                 'Complete or update KYC to get approved faster'}
              </p>
            </div>
          </div>
        )}

        {/* Accordion sections */}
        <div className="space-y-3">
          {sections.map(({ id, label, icon: Icon }) => (
            <div key={id} className="card overflow-hidden">
              <button
                onClick={() => setSection(section === id ? null : id)}
                className="w-full flex items-center justify-between p-5"
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className="text-primary-600" />
                  <span className="font-semibold text-slate-800">{label}</span>
                  {/* Bank status badge */}
                  {id === 'bank' && hasSavedBank && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      bankVerified ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {bankVerified ? '✓ Verified' : '⏳ Pending'}
                    </span>
                  )}
                  {/* KYC status badge */}
                  {id === 'kyc' && profile?.kyc?.status && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      profile.kyc.status === 'verified' ? 'bg-green-100 text-green-700' :
                      profile.kyc.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
                      profile.kyc.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {profile.kyc.status}
                    </span>
                  )}
                </div>
                {section === id ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
              </button>

              {section === id && (
                <div className="border-t border-slate-100 p-5">

                  {/* ── Profile ── */}
                  {id === 'profile' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
                        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" placeholder="Your full name" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Years of Experience</label>
                        <input type="number" value={form.experience} onChange={e => setForm(f => ({ ...f, experience: e.target.value }))} className="input-field" min={0} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Service Radius (km)</label>
                        <input type="number" value={form.serviceRadius} onChange={e => setForm(f => ({ ...f, serviceRadius: e.target.value }))} className="input-field" min={1} max={50} />
                      </div>
                      <button onClick={saveProfile} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
                        <Save size={16} /> {saving ? 'Saving…' : 'Save Profile'}
                      </button>
                    </div>
                  )}

                  {/* ── My Services ── */}
                  {id === 'services' && (
                    <div className="space-y-4">
                      <p className="text-sm text-slate-500">Select the services you can provide:</p>
                      <div className="grid grid-cols-2 gap-2">
                        {allServices.map(s => (
                          <label key={s._id} className={`flex items-center gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedServices.includes(s._id) ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:border-slate-300'}`}>
                            <input
                              type="checkbox"
                              checked={selectedServices.includes(s._id)}
                              onChange={e => setSelectedServices(prev => e.target.checked ? [...prev, s._id] : prev.filter(id => id !== s._id))}
                              className="w-4 h-4 accent-primary-600"
                            />
                            <span className="text-sm font-medium text-slate-700 leading-tight">{s.icon} {s.name}</span>
                          </label>
                        ))}
                      </div>
                      <button onClick={saveServices} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
                        <Save size={16} /> {saving ? 'Saving…' : 'Save Services'}
                      </button>
                    </div>
                  )}

                  {/* ── KYC Documents ── */}
                  {id === 'kyc' && (
                    <div className="space-y-4">
                      {profile?.kyc?.status === 'verified' && !forceEditKyc ? (
                        <>
                          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                            <CheckCircle size={22} className="text-green-600 shrink-0" />
                            <div>
                              <p className="font-semibold text-green-700">KYC Verified</p>
                              <p className="text-xs text-green-600">Your identity has been successfully verified.</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setForceEditKyc(true)}
                            className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-slate-300 rounded-xl text-sm text-slate-500 hover:border-primary-400 hover:text-primary-600 transition-all"
                          >
                            <Edit3 size={14} /> Update KYC Documents
                          </button>
                        </>
                      ) : profile?.kyc?.status === 'submitted' && !forceEditKyc ? (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
                          <span className="text-2xl">⏳</span>
                          <div>
                            <p className="font-semibold text-blue-700">KYC Submitted</p>
                            <p className="text-xs text-blue-600">Your documents are under review (up to 24 hours).</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          {profile?.kyc?.status === 'rejected' && (
                            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm font-medium">
                              ❌ Your previous KYC was rejected. Please upload clearer, accurate documents.
                            </div>
                          )}
                          <p className="text-sm text-slate-500">Upload your KYC documents to verify your identity:</p>

                          {/* Circular selfie upload */}
                          <div className="flex flex-col items-center mb-2">
                            <label className="relative flex flex-col items-center justify-center w-28 h-28 border-2 border-dashed border-primary-300 rounded-full bg-primary-50 cursor-pointer overflow-hidden group hover:border-primary-500 hover:bg-primary-100 transition-all">
                              {kycFiles.selfie ? (
                                <img src={URL.createObjectURL(kycFiles.selfie)} alt="Selfie" className="w-full h-full object-cover" />
                              ) : (
                                <div className="flex flex-col items-center justify-center text-primary-500">
                                  <Upload size={20} className="mb-1" />
                                  <span className="text-[10px] font-bold text-center leading-tight">Add Selfie<br/>(Face&nbsp;Only)</span>
                                </div>
                              )}
                              <input type="file" accept="image/*" onChange={e => setKycFiles(f => ({ ...f, selfie: e.target.files[0] }))} className="hidden" />
                              {kycFiles.selfie && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <span className="text-white text-xs font-medium">Change</span>
                                </div>
                              )}
                            </label>
                            <p className="text-xs text-slate-400 mt-2">Profile photo (required)</p>
                          </div>

                          {[
                            { key: 'aadhaarDoc', label: 'Aadhaar Card (Front & Back) *' },
                            { key: 'panDoc', label: 'PAN Card *' },
                          ].map(({ key, label }) => (
                            <div key={key}>
                              <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
                              <input
                                type="file"
                                accept="image/*,.pdf"
                                onChange={e => setKycFiles(f => ({ ...f, [key]: e.target.files[0] }))}
                                className="input-field text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-primary-100 file:text-primary-700 file:text-xs file:font-medium"
                              />
                            </div>
                          ))}
                          <button onClick={uploadKYC} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2 mt-1">
                            <Upload size={16} /> {saving ? 'Uploading…' : 'Submit KYC Documents'}
                          </button>
                          {forceEditKyc && (
                            <button onClick={() => setForceEditKyc(false)} className="w-full text-xs text-slate-400 hover:text-slate-600 mt-1 py-1">
                              Cancel
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* ── Bank Account ── */}
                  {id === 'bank' && (
                    <div className="space-y-4">
                      {hasSavedBank && !editingBank ? (
                        <>
                          <div className={`rounded-xl p-4 border ${
                            bankVerified ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
                          }`}>
                            <p className="font-semibold text-slate-800 flex items-center gap-2 mb-3">
                              <CreditCard size={16} className={bankVerified ? 'text-green-600' : 'text-amber-600'} />
                              {bankVerified ? 'Bank Account Verified ✅' : 'Verification Pending ⏳'}
                            </p>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-slate-500">Account Holder</span>
                                <span className="font-medium text-slate-800">{profile.earnings.bankAccount.accountHolder}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">Account No.</span>
                                <span className="font-medium text-slate-800 font-mono">
                                  {'•'.repeat(Math.max(0, (profile.earnings.bankAccount.accountNumber || '').length - 4))}
                                  {profile.earnings.bankAccount.accountNumber?.slice(-4)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">IFSC</span>
                                <span className="font-medium text-slate-800 font-mono">{profile.earnings.bankAccount.ifscCode}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">Bank Name</span>
                                <span className="font-medium text-slate-800">{profile.earnings.bankAccount.bankName}</span>
                              </div>
                            </div>
                          </div>
                          {!bankVerified && (
                            <p className="text-xs text-slate-400 text-center">Details are pending admin verification (1–2 business days).</p>
                          )}
                          <button
                            onClick={() => setEditingBank(true)}
                            className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-slate-300 rounded-xl text-sm text-slate-500 hover:border-primary-400 hover:text-primary-600 transition-all"
                          >
                            <Edit3 size={14} /> Update Bank Account
                          </button>
                          <p className="text-xs text-amber-600 text-center font-medium">
                            ⚠️ Updating bank details requires admin re-verification before payouts resume.
                          </p>
                        </>
                      ) : (
                        <>
                          {editingBank && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700 font-medium">
                              ⚠️ Submitting new bank details requires admin re-approval before any payouts.
                            </div>
                          )}
                          {[
                            { key: 'accountHolder', label: 'Account Holder Name', placeholder: 'Full name as per bank records' },
                            { key: 'accountNumber', label: 'Account Number', placeholder: 'Enter your account number' },
                            { key: 'ifscCode', label: 'IFSC Code', placeholder: 'e.g. SBIN0001234' },
                            { key: 'bankName', label: 'Bank Name', placeholder: 'e.g. State Bank of India' },
                          ].map(({ key, label, placeholder }) => (
                            <div key={key}>
                              <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
                              <input
                                value={bank[key]}
                                onChange={e => setBank(b => ({ ...b, [key]: e.target.value }))}
                                placeholder={placeholder}
                                className="input-field"
                              />
                            </div>
                          ))}
                          <button onClick={saveBank} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
                            <Save size={16} /> {saving ? 'Saving…' : 'Save Bank Account'}
                          </button>
                          {editingBank ? (
                            <button onClick={() => setEditingBank(false)} className="w-full text-xs text-slate-400 hover:text-slate-600 py-1">
                              Cancel
                            </button>
                          ) : (
                            <p className="text-xs text-slate-400 text-center">Bank account will be verified within 1–2 business days</p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
