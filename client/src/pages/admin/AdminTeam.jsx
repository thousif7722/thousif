import React, { useState, useEffect } from 'react';
import { apiService } from '@/services/api';
import Header from '@/components/common/Header';
import { UserPlus, Shield, Check, X, Loader, Users, Ban } from 'lucide-react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

const PERMISSION_OPTS = [
  { id: 'manage_providers', label: 'KYC & Providers', desc: 'Approve docs, verify technicians' },
  { id: 'manage_bookings', label: 'Operations & Dispatch', desc: 'Monitor active jobs, reassign' },
  { id: 'manage_complaints', label: 'Customer Support', desc: 'Resolve disputes, handle reviews' },
  { id: 'manage_financials', label: 'Finance Team', desc: 'Refunds, wallet payouts, dues' },
  { id: 'manage_services', label: 'Catalog Team', desc: 'Add services, edit pricing & surge' },
  { id: 'manage_users', label: 'User Marketing', desc: 'Block users, handle subscriptions' },
];

export default function AdminTeam() {
  const [team, setTeam] = useState([]);
  const [workload, setWorkload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', permissions: [] });
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [rebalancing, setRebalancing] = useState(false);

  useEffect(() => {
    fetchTeam();
  }, []);

  async function fetchTeam() {
    try {
      setLoading(true);
      const [teamRes, workloadRes] = await Promise.all([
        apiService.getAdminTeam(),
        apiService.getTeamWorkload().catch(() => null),
      ]);
      setTeam(teamRes.data.data);
      if (workloadRes?.data?.data) {
        setWorkload(workloadRes.data.data);
      }
    } catch (err) {
      toast.error('Failed to load team');
    } finally {
      setLoading(false);
    }
  }

  async function handleAutoDistribute() {
    setRebalancing(true);
    try {
      const res = await apiService.autoDistributeKyc();
      toast.success(res.data.message);
      fetchTeam();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Rebalance failed');
    } finally {
      setRebalancing(false);
    }
  }

  function handleTogglePerm(permId) {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter(p => p !== permId)
        : [...prev.permissions, permId]
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        await apiService.updateTeamMember(editingId, { permissions: formData.permissions });
        toast.success('Permissions updated');
      } else {
        const res = await apiService.createTeamMember(formData);
        toast.success(res.data?.message || 'Team member added');
      }
      setShowModal(false);
      fetchTeam();
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleBlock(id, currentStatus) {
    try {
      await apiService.updateTeamMember(id, { isBlocked: !currentStatus });
      toast.success(currentStatus ? 'Unblocked' : 'Blocked');
      fetchTeam();
    } catch (err) {
      toast.error('Failed to update status');
    }
  }

  function openEdit(member) {
    setEditingId(member._id);
    setFormData({ name: member.name, phone: member.phone, email: member.email || '', permissions: member.permissions || [] });
    setShowModal(true);
  }

  function openNew() {
    setEditingId(null);
    setFormData({ name: '', phone: '', email: '', permissions: [] });
    setShowModal(true);
  }

  const summary = workload?.summary;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header />
      <div className="py-6 max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Users className="text-primary-600" /> Team & Workload Management
            </h1>
            <p className="text-sm text-slate-500">Manage 30+ staff members, track KYC queues & rebalance verification workload.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleAutoDistribute}
              disabled={rebalancing}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 transition shadow-sm"
            >
              ⚡ {rebalancing ? 'Rebalancing…' : 'Smart Load Rebalance'}
            </button>
            <button onClick={openNew} className="btn-primary flex items-center gap-2 text-sm">
              <UserPlus size={16} /> Add Employee
            </button>
          </div>
        </div>

        {/* Live Workload Metrics Strip */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs text-slate-400 font-semibold uppercase">Total Staff Members</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{summary.totalStaff}</p>
              <p className="text-[11px] text-emerald-600 mt-0.5">Active team members</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs text-slate-400 font-semibold uppercase">Pending KYC Applications</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{summary.totalPendingKyc}</p>
              <p className="text-[11px] text-amber-600 mt-0.5">Awaiting staff verification</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs text-slate-400 font-semibold uppercase">Target Queue / Staff</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">~{summary.avgPendingPerStaff}</p>
              <p className="text-[11px] text-blue-600 mt-0.5">Evenly balanced queue target</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs text-slate-400 font-semibold uppercase">Unassigned Applications</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{summary.unassignedKyc}</p>
              <p className="text-[11px] text-purple-600 mt-0.5">Ready for auto-routing</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="h-40 flex items-center justify-center"><Loader className="animate-spin text-primary-600" /></div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Employee</th>
                    <th className="px-6 py-4">Online Status</th>
                    <th className="px-6 py-4">Assigned KYC Queue</th>
                    <th className="px-6 py-4">Verified Today</th>
                    <th className="px-6 py-4">Open Complaints</th>
                    <th className="px-6 py-4">Workload Status</th>
                    <th className="px-6 py-4">Permissions</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {team.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-8 text-center text-slate-400">No team members hired yet.</td>
                    </tr>
                  ) : team.map(member => {
                    const wl = workload?.staffWorkload?.find(w => w._id === member._id);
                    const isRecentlyActive = member.isOnline || (member.lastActiveAt && (new Date() - new Date(member.lastActiveAt)) < 5 * 60 * 1000);
                    const isResigned = member.status === 'resigned';

                    async function handleResign() {
                      if (!window.confirm(`Mark ${member.name} as RESIGNED? This revokes access and auto-redistributes their pending queue.`)) return;
                      try {
                        const res = await apiService.markStaffResigned(member._id);
                        toast.success(res.data.message);
                        fetchTeam();
                      } catch (err) {
                        toast.error(err.response?.data?.error || 'Failed to process resignation');
                      }
                    }

                    async function handleDelete() {
                      if (!window.confirm(`Permanently DELETE staff member ${member.name}? Unassigned tasks will be redistributed.`)) return;
                      try {
                        const res = await apiService.deleteStaffMember(member._id);
                        toast.success(res.data.message);
                        fetchTeam();
                      } catch (err) {
                        toast.error(err.response?.data?.error || 'Delete failed');
                      }
                    }

                    return (
                      <tr key={member._id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="font-semibold text-slate-800">{member.name}</div>
                            {isResigned && <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-bold">Resigned</span>}
                          </div>
                          <div className="text-xs text-slate-400">{member.phone} • {member.email || 'No email'}</div>
                        </td>
                        <td className="px-6 py-4">
                          {isResigned ? (
                            <span className="text-xs text-slate-400 font-medium">⚪ Inactive</span>
                          ) : isRecentlyActive ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Active Online
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                              ⚪ Offline ({member.lastActiveAt ? dayjs(member.lastActiveAt).format('HH:mm') : '—'})
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-bold text-amber-600">
                          {wl?.pendingKyc ?? 0} applications
                        </td>
                        <td className="px-6 py-4 text-emerald-600 font-semibold">
                          {wl?.verifiedToday ?? 0} approved
                        </td>
                        <td className="px-6 py-4 text-slate-700">
                          {wl?.openComplaints ?? 0}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                            wl?.status === 'Heavy' ? 'bg-red-100 text-red-700' :
                            wl?.status === 'Light' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {wl?.status || 'Balanced'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {member.permissions?.map(p => (
                              <span key={p} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                                {p.replace('manage_', '')}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button onClick={() => openEdit(member)} className="text-xs font-semibold text-primary-600 hover:underline">Edit</button>
                            {!isResigned && (
                              <button onClick={handleResign} className="text-xs font-semibold text-amber-600 hover:underline">Resign</button>
                            )}
                            <button onClick={() => toggleBlock(member._id, member.isBlocked)} className={`text-xs font-semibold ${member.isBlocked ? 'text-emerald-600' : 'text-slate-500'} hover:underline`}>
                              {member.isBlocked ? 'Unblock' : 'Block'}
                            </button>
                            <button onClick={handleDelete} className="text-xs font-semibold text-red-600 hover:underline">Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">{editingId ? 'Edit Permissions' : 'Hire Employee'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:bg-slate-100 p-2 rounded-xl">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <form id="team-form" onSubmit={handleSubmit} className="space-y-5">
                {!editingId && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                      <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="input-field" placeholder="John Doe" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Phone (10 digits)</label>
                        <input required type="tel" pattern="[6-9][0-9]{9}" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="input-field" placeholder="9876543210" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="input-field" placeholder="john@startup.com" />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <Shield size={16} className="text-primary-600"/> Assign Departments (Permissions)
                  </label>
                  <div className="space-y-3">
                    {PERMISSION_OPTS.map(opt => {
                      const isSelected = formData.permissions.includes(opt.id);
                      return (
                        <label key={opt.id} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${isSelected ? 'border-primary-500 bg-primary-50' : 'border-slate-100 hover:border-slate-200'}`}>
                          <input 
                            type="checkbox" 
                            className="hidden" 
                            checked={isSelected} 
                            onChange={() => handleTogglePerm(opt.id)} 
                          />
                          <div className={`w-5 h-5 rounded mt-0.5 flex items-center justify-center shrink-0 border ${isSelected ? 'bg-primary-600 border-primary-600 text-white' : 'border-slate-300 bg-white'}`}>
                            {isSelected && <Check size={14} />}
                          </div>
                          <div>
                            <p className={`text-sm font-semibold ${isSelected ? 'text-primary-900' : 'text-slate-700'}`}>{opt.label}</p>
                            <p className="text-xs text-slate-500">{opt.desc}</p>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              </form>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3 justify-end shrink-0">
              <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-colors">Cancel</button>
              <button form="team-form" type="submit" disabled={submitting} className="btn-primary px-8 flex items-center gap-2">
                {submitting ? <Loader className="animate-spin" size={18} /> : 'Save Employee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
