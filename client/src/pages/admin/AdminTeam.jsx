import React, { useState, useEffect } from 'react';
import apiService from '@/services/api';
import Header from '@/components/common/Header';
import {
  Users, Shield, Check, X, Loader, Plus, UserPlus, Search, Filter, Download,
  Eye, Edit3, Trash2, Phone, Mail, Calendar, Building2, Crown, Briefcase,
  UserCheck, AlertCircle, CheckCircle2, Clock, ChevronLeft, ChevronRight, Lock
} from 'lucide-react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

const PERMISSION_OPTS = [
  { id: 'manage_providers', label: 'KYC & Technicians', desc: 'Approve docs, verify provider profiles' },
  { id: 'manage_bookings', label: 'Operations & Dispatch', desc: 'Monitor active jobs, reassign providers' },
  { id: 'manage_complaints', label: 'Customer Support', desc: 'Resolve disputes & generate OTPs' },
  { id: 'manage_financials', label: 'Finance & Wallet', desc: 'Process refunds, payouts & clear dues' },
  { id: 'manage_services', label: 'Catalog & Pricing', desc: 'Manage services & surge pricing' },
  { id: 'manage_users', label: 'User Operations', desc: 'Block/unblock users & subscriptions' },
];

const DEPARTMENT_OPTS = [
  { name: 'Operations', icon: Building2, color: 'text-blue-600 bg-blue-50' },
  { name: 'Customer Support', icon: Phone, color: 'text-emerald-600 bg-emerald-50' },
  { name: 'Technical', icon: Briefcase, color: 'text-amber-600 bg-amber-50' },
  { name: 'Finance', icon: Shield, color: 'text-purple-600 bg-purple-50' },
  { name: 'Marketing', icon: Users, color: 'text-rose-600 bg-rose-50' },
  { name: 'HR', icon: Crown, color: 'text-indigo-600 bg-indigo-50' },
];

const ROLE_BADGES = {
  manager: { label: 'Manager', bg: 'bg-purple-100 text-purple-700 border-purple-200' },
  team_leader: { label: 'Team Leader', bg: 'bg-blue-100 text-blue-700 border-blue-200' },
  technician: { label: 'Technician', bg: 'bg-amber-100 text-amber-700 border-amber-200' },
  executive: { label: 'Executive', bg: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  staff: { label: 'Staff', bg: 'bg-slate-100 text-slate-700 border-slate-200' },
  admin: { label: 'Super Admin', bg: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

export default function AdminTeam() {
  const [activeSubTab, setActiveSubTab] = useState('employees');
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState([]);
  const [workload, setWorkload] = useState(null);

  // Filters & Pagination State
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modals & Drawer State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State — EMAIL IS REQUIRED, PHONE IS OPTIONAL
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'staff',
    department: 'Operations',
    designation: 'Staff Associate',
    permissions: [],
  });

  useEffect(() => {
    fetchTeamData();
  }, []);

  async function fetchTeamData() {
    try {
      setLoading(true);
      const [teamRes, workloadRes] = await Promise.all([
        apiService.getAdminTeam().catch(() => ({ data: { data: [] } })),
        apiService.getTeamWorkload().catch(() => ({ data: { data: null } })),
      ]);

      const staffList = teamRes.data?.data || [];
      setTeam(staffList);
      if (workloadRes?.data?.data) {
        setWorkload(workloadRes.data.data);
      }
    } catch (err) {
      toast.error('Failed to load team data');
    } finally {
      setLoading(false);
    }
  }

  function handleOpenAdd() {
    setEditingMember(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      role: 'staff',
      department: 'Operations',
      designation: 'Staff Associate',
      permissions: ['manage_providers', 'manage_bookings'],
    });
    setShowAddModal(true);
  }

  function handleOpenEdit(member) {
    setEditingMember(member);
    setFormData({
      name: member.name || '',
      email: member.email || '',
      phone: member.phone || '',
      role: member.role || 'staff',
      department: member.department || 'Operations',
      designation: member.designation || 'Staff Associate',
      permissions: member.permissions || [],
    });
    setShowAddModal(true);
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
    if (!formData.name.trim()) return toast.error('Employee full name is required');
    if (!formData.email.trim()) return toast.error('Employee login email is required');

    setSubmitting(true);
    try {
      if (editingMember) {
        await apiService.updateTeamMember(editingMember._id, formData);
        toast.success(`Updated ${formData.name}'s profile & permissions`);
      } else {
        const res = await apiService.createTeamMember(formData);
        toast.success(res.data?.message || 'Employee hired successfully!');
      }
      setShowAddModal(false);
      fetchTeamData();
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleBlock(member) {
    const actionText = member.isBlocked ? 'unblock' : 'block';
    if (!window.confirm(`Are you sure you want to ${actionText} ${member.name}?`)) return;

    try {
      await apiService.updateTeamMember(member._id, { isBlocked: !member.isBlocked });
      toast.success(`Employee ${member.name} ${member.isBlocked ? 'unblocked' : 'blocked'}`);
      fetchTeamData();
    } catch (err) {
      toast.error('Failed to update status');
    }
  }

  async function handleResign(member) {
    if (!window.confirm(`Mark ${member.name} as RESIGNED? This revokes access and auto-redistributes their tasks.`)) return;
    try {
      const res = await apiService.markStaffResigned(member._id);
      toast.success(res.data?.message || 'Employee marked as resigned');
      fetchTeamData();
    } catch (err) {
      toast.error('Failed to process resignation');
    }
  }

  async function handleDelete(member) {
    if (!window.confirm(`Permanently delete employee ${member.name}?`)) return;
    try {
      await apiService.deleteStaffMember(member._id);
      toast.success('Employee deleted');
      fetchTeamData();
    } catch (err) {
      toast.error('Delete failed');
    }
  }

  function exportCSV() {
    if (team.length === 0) return toast.error('No employee data to export');
    const headers = ['Name', 'Email', 'Phone', 'Role', 'Department', 'Designation', 'Status', 'Joined Date'];
    const rows = team.map(m => [
      `"${m.name || ''}"`,
      `"${m.email || ''}"`,
      `"${m.phone || ''}"`,
      `"${m.role || ''}"`,
      `"${m.department || ''}"`,
      `"${m.designation || ''}"`,
      `"${m.status || 'active'}"`,
      `"${dayjs(m.createdAt).format('YYYY-MM-DD')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `onewayfix_team_export_${dayjs().format('YYYYMMDD')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Filtered staff computation
  const filteredTeam = team.filter(m => {
    const matchesSearch =
      (m.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.phone || '').includes(searchQuery);

    const matchesDept = deptFilter === 'all' || m.department === deptFilter;
    const matchesRole = roleFilter === 'all' || m.role === roleFilter;
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && !m.isBlocked && m.status !== 'resigned') ||
      (statusFilter === 'on_leave' && m.status === 'on_leave') ||
      (statusFilter === 'blocked' && m.isBlocked);

    return matchesSearch && matchesDept && matchesRole && matchesStatus;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredTeam.length / itemsPerPage) || 1;
  const paginatedTeam = filteredTeam.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Summary KPIs
  const totalEmployeesCount = team.length;
  const activeTodayCount = team.filter(m => m.isOnline || !m.isBlocked).length;
  const departmentsCount = new Set(team.map(m => m.department).filter(Boolean)).size || 6;
  const rolesCount = new Set(team.map(m => m.role).filter(Boolean)).size || 5;
  const onLeaveCount = team.filter(m => m.status === 'on_leave' || m.status === 'resigned').length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 font-sans">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        
        {/* Top Header Strip matching uploaded design reference */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Team Management</h1>
            <p className="text-sm text-slate-500 mt-1">Manage your team members, roles, departments and permissions.</p>
          </div>
          <button
            onClick={handleOpenAdd}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-3 rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all active:scale-95 shrink-0"
          >
            <Plus size={18} /> Add New Employee
          </button>
        </div>

        {/* 5 Top KPI Cards matching reference design */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {/* Total Employees */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
              <Users size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold">Total Employees</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{totalEmployeesCount}</p>
              <p className="text-[11px] text-slate-400">All Team Members</p>
            </div>
          </div>

          {/* Active Today */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold">Active Today</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{activeTodayCount}</p>
              <p className="text-[11px] text-emerald-600 font-medium">Currently Active</p>
            </div>
          </div>

          {/* Departments */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <Building2 size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold">Departments</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{departmentsCount}</p>
              <p className="text-[11px] text-slate-400">Organization Units</p>
            </div>
          </div>

          {/* Roles */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
              <Crown size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold">Roles</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{rolesCount}</p>
              <p className="text-[11px] text-slate-400">System Roles</p>
            </div>
          </div>

          {/* On Leave */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <Briefcase size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold">On Leave</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{onLeaveCount}</p>
              <p className="text-[11px] text-rose-500 font-medium">Currently Out</p>
            </div>
          </div>
        </div>

        {/* Sub-Navigation Tabs matching image */}
        <div className="flex items-center gap-8 border-b border-slate-200 mb-6 font-semibold text-sm">
          {[
            { id: 'employees', label: 'All Employees' },
            { id: 'departments', label: 'Departments' },
            { id: 'roles', label: 'Roles' },
            { id: 'permissions', label: 'Permissions' },
            { id: 'hierarchy', label: 'Hierarchy' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`pb-3 transition-colors relative ${
                activeSubTab === tab.id
                  ? 'text-indigo-600 font-bold border-b-2 border-indigo-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: All Employees */}
        {activeSubTab === 'employees' && (
          <div className="space-y-4">
            {/* Filter Strip */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
              {/* Search */}
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3.5 top-3 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search employees by name, email or phone..."
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                />
              </div>

              {/* Dropdowns */}
              <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto">
                <select
                  value={deptFilter}
                  onChange={e => { setDeptFilter(e.target.value); setCurrentPage(1); }}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 font-medium"
                >
                  <option value="all">All Departments</option>
                  <option value="Operations">Operations</option>
                  <option value="Customer Support">Customer Support</option>
                  <option value="Technical">Technical</option>
                  <option value="Finance">Finance</option>
                  <option value="Marketing">Marketing</option>
                  <option value="HR">HR</option>
                </select>

                <select
                  value={roleFilter}
                  onChange={e => { setRoleFilter(e.target.value); setCurrentPage(1); }}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 font-medium"
                >
                  <option value="all">All Roles</option>
                  <option value="manager">Manager</option>
                  <option value="team_leader">Team Leader</option>
                  <option value="technician">Technician</option>
                  <option value="executive">Executive</option>
                  <option value="staff">Staff</option>
                  <option value="admin">Super Admin</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 font-medium"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="on_leave">On Leave</option>
                  <option value="blocked">Blocked</option>
                </select>

                <button
                  onClick={() => { setSearchQuery(''); setDeptFilter('all'); setRoleFilter('all'); setStatusFilter('all'); }}
                  className="px-3.5 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5 shrink-0"
                >
                  <Filter size={14} /> Reset
                </button>

                <button
                  onClick={exportCSV}
                  className="px-3.5 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5 shrink-0"
                >
                  <Download size={14} /> Export
                </button>
              </div>
            </div>

            {/* Table matching reference screenshot */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {loading ? (
                <div className="py-16 flex items-center justify-center">
                  <Loader className="animate-spin text-indigo-600" size={28} />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                      <tr>
                        <th className="px-6 py-4">Employee</th>
                        <th className="px-6 py-4">Department</th>
                        <th className="px-6 py-4">Role</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Contact</th>
                        <th className="px-6 py-4">Joined Date</th>
                        <th className="px-6 py-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedTeam.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="text-center py-12 text-slate-400">
                            No team members found matching search query.
                          </td>
                        </tr>
                      ) : (
                        paginatedTeam.map(member => {
                          const badge = ROLE_BADGES[member.role] || ROLE_BADGES.staff;
                          return (
                            <tr key={member._id} className="hover:bg-slate-50/80 transition-colors">
                              {/* Employee Column */}
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center text-xs shadow-sm">
                                    {member.name ? member.name.substring(0, 2).toUpperCase() : 'EM'}
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-900 text-sm">{member.name}</p>
                                    <p className="text-[11px] text-slate-400">{member.email || 'No email'}</p>
                                  </div>
                                </div>
                              </td>

                              {/* Department Column */}
                              <td className="px-6 py-4 font-semibold text-slate-700">
                                <span className="inline-flex items-center gap-1.5">
                                  🏢 {member.department || 'Operations'}
                                </span>
                              </td>

                              {/* Role Column */}
                              <td className="px-6 py-4">
                                <span className={`px-3 py-1 rounded-full text-[11px] font-bold border ${badge.bg}`}>
                                  {badge.label}
                                </span>
                              </td>

                              {/* Status Column */}
                              <td className="px-6 py-4">
                                {member.isBlocked ? (
                                  <span className="inline-flex items-center gap-1.5 text-rose-600 font-bold text-[11px] bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                                    ● Blocked
                                  </span>
                                ) : member.status === 'on_leave' ? (
                                  <span className="inline-flex items-center gap-1.5 text-amber-600 font-bold text-[11px] bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                                    ● On Leave
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold text-[11px] bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                                    ● Active
                                  </span>
                                )}
                              </td>

                              {/* Contact Column */}
                              <td className="px-6 py-4 text-slate-600">
                                <div className="space-y-0.5">
                                  <p className="flex items-center gap-1 font-mono text-[11px]">
                                    📞 {member.phone ? `+91 ${member.phone}` : 'N/A (Email Auth)'}
                                  </p>
                                  <p className="text-[10px] text-slate-400">{member.email}</p>
                                </div>
                              </td>

                              {/* Joined Date */}
                              <td className="px-6 py-4 text-slate-500 font-medium">
                                <span className="inline-flex items-center gap-1.5">
                                  🗓️ {dayjs(member.createdAt).format('DD MMM YYYY')}
                                </span>
                              </td>

                              {/* Actions Column */}
                              <td className="px-6 py-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => setSelectedProfile(member)}
                                    title="View Profile"
                                    className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-slate-50 transition"
                                  >
                                    <Eye size={15} />
                                  </button>
                                  <button
                                    onClick={() => handleOpenEdit(member)}
                                    title="Edit Employee"
                                    className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition"
                                  >
                                    <Edit3 size={15} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(member)}
                                    title="Delete Employee"
                                    className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-slate-50 transition"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination Bar */}
              <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
                <p>
                  Showing {filteredTeam.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to{' '}
                  {Math.min(currentPage * itemsPerPage, filteredTeam.length)} of {filteredTeam.length} results
                </p>

                <div className="flex items-center gap-1.5">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="p-2 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded-lg font-bold text-xs transition ${
                        currentPage === page
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}

                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="p-2 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Departments */}
        {activeSubTab === 'departments' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {DEPARTMENT_OPTS.map(dept => {
              const count = team.filter(m => m.department === dept.name).length;
              const Icon = dept.icon;
              return (
                <div key={dept.name} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${dept.color}`}>
                      <Icon size={24} />
                    </div>
                    <span className="bg-slate-100 text-slate-700 font-mono text-xs px-2.5 py-1 rounded-full font-bold">
                      {count} Members
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-lg mt-4">{dept.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">Core operational unit managing {dept.name.toLowerCase()} workflows.</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 3: Roles */}
        {activeSubTab === 'roles' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(ROLE_BADGES).map(([key, item]) => {
              const count = team.filter(m => m.role === key).length;
              return (
                <div key={key} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${item.bg}`}>
                    {item.label}
                  </span>
                  <h3 className="font-bold text-slate-900 text-base mt-3">{item.label} Role</h3>
                  <p className="text-xs text-slate-500 mt-1">Assigned to {count} active staff members in system.</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 4: Permissions */}
        {activeSubTab === 'permissions' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-bold text-slate-900 text-lg mb-4">Permission Keys Matrix</h3>
            <div className="space-y-3">
              {PERMISSION_OPTS.map(p => (
                <div key={p.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{p.label}</p>
                    <p className="text-xs text-slate-500">{p.desc}</p>
                  </div>
                  <span className="font-mono text-xs bg-slate-200 text-slate-700 px-3 py-1 rounded-md">
                    {p.id}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 5: Hierarchy */}
        {activeSubTab === 'hierarchy' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
            <h3 className="font-bold text-slate-900 text-xl mb-6">Visual Organization Structure</h3>
            <div className="inline-block bg-indigo-50 border border-indigo-200 p-6 rounded-2xl min-w-[240px]">
              <div className="w-12 h-12 rounded-full bg-indigo-600 text-white font-black flex items-center justify-center mx-auto mb-2 text-base">
                HQ
              </div>
              <p className="font-bold text-indigo-950">Super Administrator</p>
              <p className="text-xs text-indigo-600">Executive HQ</p>
            </div>
          </div>
        )}

      </div>

      {/* Hire / Edit Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editingMember ? 'Edit Employee Profile' : 'Add New Employee'}
                </h2>
                <p className="text-xs text-slate-500">Email authentication is required for staff login.</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:bg-slate-100 p-2 rounded-xl">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <form id="employee-form" onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Full Name *</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                    placeholder="e.g. Mohammed Arif"
                  />
                </div>

                {/* EMAIL LOGIN — REQUIRED */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1 flex items-center gap-1.5">
                    <Mail size={14} className="text-indigo-600" /> Employee Email (Login Credential) *
                  </label>
                  <input
                    required
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                    placeholder="e.g. arif@onewayfix.com"
                  />
                </div>

                {/* PHONE NUMBER — OPTIONAL */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1 flex items-center gap-1.5">
                    <Phone size={14} className="text-slate-400" /> Phone Number (Optional - for calling)
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                    placeholder="e.g. 9876543210"
                  />
                </div>

                {/* Role & Department */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">System Role</label>
                    <select
                      value={formData.role}
                      onChange={e => setFormData({ ...formData, role: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="staff">Staff</option>
                      <option value="executive">Executive</option>
                      <option value="technician">Technician</option>
                      <option value="team_leader">Team Leader</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Super Admin</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Department</label>
                    <select
                      value={formData.department}
                      onChange={e => setFormData({ ...formData, department: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Operations">Operations</option>
                      <option value="Customer Support">Customer Support</option>
                      <option value="Technical">Technical</option>
                      <option value="Finance">Finance</option>
                      <option value="Marketing">Marketing</option>
                      <option value="HR">HR</option>
                    </select>
                  </div>
                </div>

                {/* Permissions Selection */}
                <div>
                  <label className="block text-slate-700 font-bold mb-2 flex items-center gap-1.5">
                    <Shield size={14} className="text-indigo-600" /> Department Permissions
                  </label>
                  <div className="space-y-2">
                    {PERMISSION_OPTS.map(p => {
                      const isSelected = formData.permissions.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          onClick={() => handleTogglePerm(p.id)}
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                            isSelected ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border ${
                            isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                          }`}>
                            {isSelected && <Check size={12} />}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{p.label}</p>
                            <p className="text-[10px] text-slate-500">{p.desc}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                form="employee-form"
                type="submit"
                disabled={submitting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-7 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-600/20"
              >
                {submitting ? <Loader className="animate-spin" size={16} /> : editingMember ? 'Save Changes' : 'Hire Employee'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-Out Profile Detail Drawer */}
      {selectedProfile && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white border-l border-slate-200 h-full p-6 overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h3 className="font-bold text-slate-900 text-lg">Employee Details</h3>
              <button onClick={() => setSelectedProfile(null)} className="text-slate-400 hover:bg-slate-100 p-2 rounded-xl">
                <X size={20} />
              </button>
            </div>

            <div className="mt-6 space-y-6 text-xs">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-2xl flex items-center justify-center mx-auto mb-3 shadow-md">
                  {selectedProfile.name ? selectedProfile.name.substring(0, 2).toUpperCase() : 'EM'}
                </div>
                <h4 className="font-bold text-slate-900 text-lg">{selectedProfile.name}</h4>
                <span className="inline-block mt-1 px-3 py-1 bg-indigo-50 text-indigo-700 font-bold rounded-full border border-indigo-100">
                  {selectedProfile.role?.toUpperCase()}
                </span>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Email (Login Credential)</p>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">{selectedProfile.email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Phone Number</p>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">{selectedProfile.phone ? `+91 ${selectedProfile.phone}` : 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Department</p>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">{selectedProfile.department || 'Operations'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Joined Date</p>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">{dayjs(selectedProfile.createdAt).format('DD MMMM YYYY')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
