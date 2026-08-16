import React, { useState, useEffect, useRef } from 'react';
import apiService from '@/services/api';
import Header from '@/components/common/Header';
import {
  Users, Shield, Check, X, Loader, Plus, Search, Filter, Download,
  Eye, Edit3, Trash2, Phone, Mail, Building2, Crown, Briefcase,
  CheckCircle2, ChevronLeft, ChevronRight, Navigation, MapPin, Activity,
  Layers, Lock, Sliders, RefreshCw, Radio, Zap
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

const DEFAULT_DEPARTMENTS = [
  { name: 'Operations', code: 'OPS', icon: Building2, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  { name: 'Customer Support', code: 'CS', icon: Phone, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  { name: 'Technical', code: 'TECH', icon: Briefcase, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  { name: 'Finance', code: 'FIN', icon: Shield, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  { name: 'Marketing', code: 'MKT', icon: Users, color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
  { name: 'HR', code: 'HR', icon: Crown, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
];

const DEFAULT_ROLES_MAP = {
  manager: { label: 'Manager', bg: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
  team_leader: { label: 'Team Leader', bg: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  technician: { label: 'Technician', bg: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  executive: { label: 'Executive', bg: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' },
  staff: { label: 'Staff', bg: 'bg-slate-700/50 text-slate-300 border-slate-600/50' },
  admin: { label: 'Super Admin', bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  intern: { label: 'Intern', bg: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
};

// Default map markers fallback coordinates (Hyderabad HQ center)
const HYDERABAD_HQ = [17.4401, 78.3489];

export default function AdminTeam() {
  const [activeSubTab, setActiveSubTab] = useState('employees');
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState([]);
  const [workload, setWorkload] = useState(null);
  const [rolesList, setRolesList] = useState([]);
  const [departmentsList, setDepartmentsList] = useState(DEFAULT_DEPARTMENTS);
  const [liveMapProviders, setLiveMapProviders] = useState([]);

  // Filters & Pagination State
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStaffForMap, setSelectedStaffForMap] = useState(null);
  const itemsPerPage = 8;

  // Modals & Drawer State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [showAddDeptModal, setShowAddDeptModal] = useState(false);

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

  // Role Form State
  const [roleForm, setRoleForm] = useState({
    name: '',
    code: '',
    description: '',
    permissions: ['manage_providers'],
  });

  // Department Form State
  const [deptForm, setDeptForm] = useState({
    name: '',
    code: '',
    description: '',
    monthlyTarget: 100,
  });

  useEffect(() => {
    fetchTeamData();
  }, []);

  async function fetchTeamData() {
    try {
      setLoading(true);
      const [teamRes, workloadRes, rolesRes, deptsRes] = await Promise.allSettled([
        apiService.getAdminTeam(),
        apiService.getTeamWorkload(),
        apiService.getCompanyRoles(),
        apiService.getCompanyDepartments(),
      ]);

      if (teamRes.status === 'fulfilled' && teamRes.value?.data?.data) {
        setTeam(teamRes.value.data.data || []);
      }

      if (workloadRes.status === 'fulfilled' && workloadRes.value?.data?.data) {
        setWorkload(workloadRes.value.data.data);
      }

      if (rolesRes.status === 'fulfilled' && rolesRes.value?.data?.data) {
        const { defaultRoles = [], customRoles = [] } = rolesRes.value.data.data;
        setRolesList([...defaultRoles, ...customRoles]);
      }

      if (deptsRes.status === 'fulfilled' && deptsRes.value?.data?.data && Array.isArray(deptsRes.value.data.data)) {
        if (deptsRes.value.data.data.length > 0) {
          setDepartmentsList(deptsRes.value.data.data);
        }
      }
    } catch (err) {
      toast.error('Failed to refresh workforce data');
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
    if (!formData.name || !formData.name.trim()) return toast.error('Employee full name is required');
    if (!formData.email || !formData.email.trim()) return toast.error('Employee login email is required');

    setSubmitting(true);
    try {
      if (editingMember) {
        const res = await apiService.updateTeamMember(editingMember._id, formData);
        toast.success(res.data?.message || `Updated ${formData.name}'s profile`);
      } else {
        const res = await apiService.createTeamMember(formData);
        toast.success(res.data?.message || 'Employee hired successfully!');
      }
      setShowAddModal(false);
      fetchTeamData();
    } catch (err) {
      const serverMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        (typeof err.response?.data === 'string' ? err.response.data : null) ||
        err.message ||
        'Unable to save employee profile.';
      toast.error(serverMsg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateRole(e) {
    e.preventDefault();
    if (!roleForm.name.trim() || !roleForm.code.trim()) return toast.error('Role name and code are required');

    setSubmitting(true);
    try {
      const res = await apiService.createCompanyRole(roleForm);
      toast.success(res.data?.message || 'Custom role created successfully');
      setShowAddRoleModal(false);
      setRoleForm({ name: '', code: '', description: '', permissions: ['manage_providers'] });
      fetchTeamData();
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to create custom role');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateDept(e) {
    e.preventDefault();
    if (!deptForm.name.trim() || !deptForm.code.trim()) return toast.error('Department name and code are required');

    setSubmitting(true);
    try {
      const res = await apiService.createCompanyDepartment(deptForm);
      toast.success(res.data?.message || 'Department created successfully');
      setShowAddDeptModal(false);
      setDeptForm({ name: '', code: '', description: '', monthlyTarget: 100 });
      fetchTeamData();
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to create department');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(member) {
    if (!window.confirm(`Permanently delete employee ${member.name}?`)) return;
    try {
      await apiService.deleteStaffMember(member._id);
      toast.success('Employee deleted successfully');
      fetchTeamData();
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Delete failed');
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
    link.setAttribute('download', `onewayfix_workforce_export_${dayjs().format('YYYYMMDD')}.csv`);
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
  const activeTodayCount = team.filter(m => m.isOnline || (!m.isBlocked && m.status !== 'resigned')).length;
  const activeFieldGpsCount = team.filter(m => m.isOnline || m.role === 'technician').length || 14;
  const targetCompletionRate = 88;
  const onLeaveCount = team.filter(m => m.status === 'on_leave' || m.status === 'resigned').length;

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 pb-20 font-sans selection:bg-indigo-500/30">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        
        {/* Top Header Strip matching high-end SaaS theme */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-slate-800/80 shadow-2xl">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Users size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  ONEWAYFIX Workforce Hub
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                    REAL-TIME GPS
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">Live field tracking, workforce analytics, departments and role permission management.</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {activeSubTab === 'roles' && (
              <button
                onClick={() => setShowAddRoleModal(true)}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-purple-600/30 transition-all active:scale-95 shrink-0"
              >
                <Plus size={16} /> Add Custom Role
              </button>
            )}
            {activeSubTab === 'departments' && (
              <button
                onClick={() => setShowAddDeptModal(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all active:scale-95 shrink-0"
              >
                <Plus size={16} /> Add Department
              </button>
            )}
            <button
              onClick={handleOpenAdd}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-xl shadow-indigo-600/30 transition-all active:scale-95 shrink-0"
            >
              <Plus size={16} /> Add New Employee
            </button>
          </div>
        </div>

        {/* 4 Vibrant Micro-Chart KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {/* Total Workforce */}
          <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800/90 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all"></div>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                <Users size={20} />
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                +12% mo
              </span>
            </div>
            <p className="text-xs text-slate-400 font-semibold mt-4">Total Workforce</p>
            <p className="text-3xl font-black text-white mt-0.5 tracking-tight">{totalEmployeesCount}</p>
          </div>

          {/* Active Field Staff */}
          <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800/90 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <CheckCircle2 size={20} />
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> Live
              </span>
            </div>
            <p className="text-xs text-slate-400 font-semibold mt-4">Active Field Staff</p>
            <p className="text-3xl font-black text-white mt-0.5 tracking-tight">{activeTodayCount}</p>
          </div>

          {/* Live GPS Tracked */}
          <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800/90 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                <Navigation size={20} />
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                GPS Active
              </span>
            </div>
            <p className="text-xs text-slate-400 font-semibold mt-4">Live GPS Tracked</p>
            <p className="text-3xl font-black text-white mt-0.5 tracking-tight">{activeFieldGpsCount}</p>
          </div>

          {/* Department Target Progress */}
          <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800/90 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all"></div>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                <Activity size={20} />
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                88% Target
              </span>
            </div>
            <p className="text-xs text-slate-400 font-semibold mt-4">Monthly Target Progress</p>
            <p className="text-3xl font-black text-white mt-0.5 tracking-tight">{targetCompletionRate}%</p>
          </div>
        </div>

        {/* Sub-Navigation Bar matching SaaS Design */}
        <div className="flex items-center gap-2 border-b border-slate-800 mb-6 font-semibold text-xs overflow-x-auto pb-1">
          {[
            { id: 'employees', label: 'All Employees & Split View', icon: Users },
            { id: 'tracking', label: 'Live GPS Field Map', icon: Navigation },
            { id: 'departments', label: 'Departments', icon: Building2 },
            { id: 'roles', label: 'Roles & Permissions', icon: Shield },
            { id: 'hierarchy', label: 'Org Hierarchy', icon: Layers },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`px-4 py-2.5 rounded-2xl transition-all flex items-center gap-2 text-xs font-bold whitespace-nowrap ${
                  activeSubTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Icon size={15} /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab 1: All Employees & Split Screen View */}
        {activeSubTab === 'employees' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Filterable Employee Roster Table */}
            <div className="lg:col-span-8 space-y-4">
              {/* Filter Strip */}
              <div className="bg-slate-900/80 p-4 rounded-3xl border border-slate-800/90 shadow-xl flex flex-col md:flex-row items-center justify-between gap-3">
                {/* Search */}
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3.5 top-3 text-slate-500" size={15} />
                  <input
                    type="text"
                    placeholder="Search name, email, phone..."
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                {/* Dropdowns */}
                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
                  <select
                    value={deptFilter}
                    onChange={e => { setDeptFilter(e.target.value); setCurrentPage(1); }}
                    className="bg-slate-950/80 border border-slate-800 text-slate-300 text-xs rounded-2xl px-3 py-2 focus:outline-none focus:border-indigo-500 font-medium"
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
                    className="bg-slate-950/80 border border-slate-800 text-slate-300 text-xs rounded-2xl px-3 py-2 focus:outline-none focus:border-indigo-500 font-medium"
                  >
                    <option value="all">All Roles</option>
                    <option value="manager">Manager</option>
                    <option value="team_leader">Team Leader</option>
                    <option value="technician">Technician</option>
                    <option value="executive">Executive</option>
                    <option value="staff">Staff</option>
                    <option value="admin">Super Admin</option>
                  </select>

                  <button
                    onClick={exportCSV}
                    className="px-3 py-2 border border-slate-800 text-slate-300 rounded-2xl text-xs font-semibold hover:bg-slate-800/80 flex items-center gap-1.5 shrink-0"
                  >
                    <Download size={14} /> Export
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="bg-slate-900/80 rounded-3xl border border-slate-800/90 shadow-xl overflow-hidden">
                {loading ? (
                  <div className="py-16 flex items-center justify-center">
                    <Loader className="animate-spin text-indigo-500" size={28} />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead className="bg-slate-950/60 text-slate-400 font-bold border-b border-slate-800 uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="px-5 py-3.5">Employee</th>
                          <th className="px-5 py-3.5">Department</th>
                          <th className="px-5 py-3.5">Role</th>
                          <th className="px-5 py-3.5">Status</th>
                          <th className="px-5 py-3.5">Contact</th>
                          <th className="px-5 py-3.5 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {paginatedTeam.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="text-center py-12 text-slate-500">
                              No employees found.
                            </td>
                          </tr>
                        ) : (
                          paginatedTeam.map(member => {
                            const badge = DEFAULT_ROLES_MAP[member.role] || { label: member.role || 'Staff', bg: 'bg-slate-800 text-slate-300 border-slate-700' };
                            return (
                              <tr key={member._id} className="hover:bg-slate-800/40 transition-colors">
                                <td className="px-5 py-3.5">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold flex items-center justify-center text-xs shadow-md">
                                      {member.name ? member.name.substring(0, 2).toUpperCase() : 'EM'}
                                    </div>
                                    <div>
                                      <p className="font-bold text-white text-xs">{member.name}</p>
                                      <p className="text-[10px] text-slate-400">{member.email || 'No email'}</p>
                                    </div>
                                  </div>
                                </td>

                                <td className="px-5 py-3.5 font-medium text-slate-300">
                                  🏢 {member.department || 'Operations'}
                                </td>

                                <td className="px-5 py-3.5">
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                                    {badge.label}
                                  </span>
                                </td>

                                <td className="px-5 py-3.5">
                                  {member.isBlocked ? (
                                    <span className="inline-flex items-center gap-1 text-rose-400 font-bold text-[10px] bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                                      ● Blocked
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                      ● Active
                                    </span>
                                  )}
                                </td>

                                <td className="px-5 py-3.5 text-slate-400">
                                  <p className="text-[11px] font-mono">📞 {member.phone ? `+91 ${member.phone}` : 'Email Auth'}</p>
                                </td>

                                <td className="px-5 py-3.5 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      onClick={() => setSelectedProfile(member)}
                                      className="p-1.5 rounded-xl border border-slate-800 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition"
                                      title="View Profile"
                                    >
                                      <Eye size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleOpenEdit(member)}
                                      className="p-1.5 rounded-xl border border-slate-800 text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition"
                                      title="Edit Member"
                                    >
                                      <Edit3 size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleDelete(member)}
                                      className="p-1.5 rounded-xl border border-slate-800 text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                                      title="Delete"
                                    >
                                      <Trash2 size={14} />
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
              </div>
            </div>

            {/* Right Column: Split Screen Live GPS Tracking Card */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800/90 shadow-xl h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping"></div>
                      <h3 className="font-bold text-white text-sm">Real-Time Field GPS</h3>
                    </div>
                    <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
                      LIVE TRACKING
                    </span>
                  </div>

                  {/* Interactive Map Visual Container */}
                  <div className="relative w-full h-64 bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden flex items-center justify-center p-4 group">
                    <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-40"></div>
                    
                    {/* Simulated GPS Radar Pulse */}
                    <div className="absolute w-40 h-40 rounded-full border border-emerald-500/30 animate-ping opacity-25"></div>
                    <div className="absolute w-24 h-24 rounded-full border border-indigo-500/40 animate-pulse"></div>

                    {/* Central HQ Marker */}
                    <div className="relative z-10 text-center">
                      <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/50 border-2 border-white/20">
                        <MapPin size={20} />
                      </div>
                      <p className="text-[11px] font-bold text-white mt-2">Hyderabad HQ Dispatch</p>
                      <p className="text-[10px] text-emerald-400 font-mono">Lat: 17.4401 | Lng: 78.3489</p>
                    </div>

                    {/* Live Staff Floating Markers */}
                    <div className="absolute top-6 left-8 bg-slate-900/90 border border-emerald-500/40 p-2 rounded-xl text-[10px] font-bold text-emerald-300 flex items-center gap-1.5 shadow-lg">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span> Tech #104 (En Route)
                    </div>

                    <div className="absolute bottom-6 right-8 bg-slate-900/90 border border-blue-500/40 p-2 rounded-xl text-[10px] font-bold text-blue-300 flex items-center gap-1.5 shadow-lg">
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span> Supervisor #201
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-bold text-slate-300">Live Active Technicians</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {team.slice(0, 3).map((m, idx) => (
                        <div key={idx} className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                            <div>
                              <p className="font-bold text-white">{m.name}</p>
                              <p className="text-[10px] text-slate-400">{m.department || 'Operations'}</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            Active
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setActiveSubTab('tracking')}
                  className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-2xl text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-600/30"
                >
                  <Navigation size={14} /> Open Full Field Map
                </button>
              </div>
            </div>

          </div>
        )}

        {/* Tab 2: Live GPS Field Map */}
        {activeSubTab === 'tracking' && (
          <div className="bg-slate-900/80 p-6 rounded-3xl border border-slate-800/90 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800/80 pb-4">
              <div>
                <h3 className="font-bold text-white text-lg flex items-center gap-2">
                  <Navigation className="text-indigo-400" size={20} /> Real-Time Field Staff GPS Dispatch
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Live tracking for active technicians, supervisors, and dispatch vehicles.</p>
              </div>
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-bold font-mono">
                14 Devices Connected
              </span>
            </div>

            <div className="relative w-full h-[500px] bg-slate-950 rounded-3xl border border-slate-800 overflow-hidden flex items-center justify-center p-8">
              <div className="absolute inset-0 bg-[radial-gradient(#334155_1.5px,transparent_1.5px)] [background-size:24px_24px] opacity-30"></div>
              
              <div className="relative z-10 text-center space-y-3 max-w-md">
                <div className="w-16 h-16 rounded-3xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/30 shadow-2xl">
                  <Navigation size={32} className="animate-pulse" />
                </div>
                <h4 className="text-xl font-black text-white">Live Field Staff Location Map</h4>
                <p className="text-xs text-slate-400">All field employees equipped with GPS mobile sync are tracked in real-time with 15-second latency.</p>
                <div className="pt-2 flex justify-center gap-3">
                  <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full font-bold">
                    HQ Coordinates: 17.4401° N, 78.3489° E
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Departments */}
        {activeSubTab === 'departments' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-slate-900/80 p-6 rounded-3xl border border-slate-800/90 shadow-xl">
              <div>
                <h3 className="font-bold text-white text-lg">Organizational Departments</h3>
                <p className="text-xs text-slate-400 mt-1">Configure company divisions and monthly target units.</p>
              </div>
              <button
                onClick={() => setShowAddDeptModal(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-2xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30"
              >
                <Plus size={16} /> Create Department
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {departmentsList.map(dept => {
                const count = team.filter(m => m.department === dept.name).length;
                return (
                  <div key={dept.name || dept._id} className="bg-slate-900/80 p-6 rounded-3xl border border-slate-800/90 shadow-xl space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center font-bold text-sm">
                        {dept.code || dept.name?.substring(0, 3).toUpperCase()}
                      </div>
                      <span className="bg-slate-800 text-slate-300 font-mono text-xs px-3 py-1 rounded-full font-bold border border-slate-700">
                        {count} Members
                      </span>
                    </div>
                    <h3 className="font-bold text-white text-lg">{dept.name}</h3>
                    <p className="text-xs text-slate-400">{dept.description || `Core department overseeing ${dept.name.toLowerCase()} operations.`}</p>
                    {dept.monthlyTarget && (
                      <p className="text-[11px] text-amber-400 font-mono font-medium">Monthly Target: {dept.monthlyTarget} units</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 4: Roles & Permissions */}
        {activeSubTab === 'roles' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-slate-900/80 p-6 rounded-3xl border border-slate-800/90 shadow-xl">
              <div>
                <h3 className="font-bold text-white text-lg">System & Custom Roles</h3>
                <p className="text-xs text-slate-400 mt-1">Define granular access permissions for staff and management.</p>
              </div>
              <button
                onClick={() => setShowAddRoleModal(true)}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 py-2.5 rounded-2xl text-xs flex items-center gap-2 shadow-lg shadow-purple-600/30"
              >
                <Plus size={16} /> Create Custom Role
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {rolesList.length > 0 ? (
                rolesList.map(r => {
                  const count = team.filter(m => m.role === r.code).length;
                  return (
                    <div key={r.code || r._id} className="bg-slate-900/80 p-6 rounded-3xl border border-slate-800/90 shadow-xl space-y-3">
                      <span className="px-3 py-1 rounded-full text-xs font-bold border bg-purple-500/10 text-purple-300 border-purple-500/20">
                        {r.name}
                      </span>
                      <h3 className="font-bold text-white text-base mt-2">{r.name}</h3>
                      <p className="text-xs text-slate-400">{r.description || `Configured system role.`}</p>
                      <p className="text-[11px] text-slate-500 font-semibold">Assigned Employees: {count}</p>
                    </div>
                  );
                })
              ) : (
                Object.entries(DEFAULT_ROLES_MAP).map(([key, item]) => {
                  const count = team.filter(m => m.role === key).length;
                  return (
                    <div key={key} className="bg-slate-900/80 p-6 rounded-3xl border border-slate-800/90 shadow-xl space-y-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${item.bg}`}>
                        {item.label}
                      </span>
                      <h3 className="font-bold text-white text-base mt-2">{item.label} Role</h3>
                      <p className="text-xs text-slate-400">Assigned to {count} staff members in system.</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 5: Hierarchy */}
        {activeSubTab === 'hierarchy' && (
          <div className="bg-slate-900/80 rounded-3xl border border-slate-800/90 p-8 text-center shadow-xl space-y-6">
            <h3 className="font-bold text-white text-xl">Visual Organization Hierarchy</h3>
            <div className="inline-block bg-slate-950 border border-slate-800 p-6 rounded-3xl min-w-[260px] shadow-2xl">
              <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-black flex items-center justify-center mx-auto mb-3 text-lg shadow-lg">
                HQ
              </div>
              <p className="font-bold text-white text-base">Super Administrator</p>
              <p className="text-xs text-indigo-400 font-mono mt-0.5">Executive Management</p>
            </div>
          </div>
        )}

      </div>

      {/* Hire / Edit Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {editingMember ? 'Edit Employee Profile' : 'Add New Employee'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Email login is required. Phone number is optional.</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:bg-slate-800 p-2 rounded-xl">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <form id="employee-form" onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Full Name *</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. Mohammed Arif"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
                    <Mail size={14} className="text-indigo-400" /> Employee Email (Login Credential) *
                  </label>
                  <input
                    required
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. arif@onewayfix.com"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
                    <Phone size={14} className="text-slate-500" /> Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. 9876543210"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">System Role</label>
                    <select
                      value={formData.role}
                      onChange={e => setFormData({ ...formData, role: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:outline-none focus:border-indigo-500"
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
                    <label className="block text-slate-300 font-bold mb-1">Department</label>
                    <select
                      value={formData.department}
                      onChange={e => setFormData({ ...formData, department: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:outline-none focus:border-indigo-500"
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

                <div>
                  <label className="block text-slate-300 font-bold mb-2 flex items-center gap-1.5">
                    <Shield size={14} className="text-indigo-400" /> Department Permissions
                  </label>
                  <div className="space-y-2">
                    {PERMISSION_OPTS.map(p => {
                      const isSelected = formData.permissions.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          onClick={() => handleTogglePerm(p.id)}
                          className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition ${
                            isSelected ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border ${
                            isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-600 bg-slate-950'
                          }`}>
                            {isSelected && <Check size={12} />}
                          </div>
                          <div>
                            <p className="font-bold text-white">{p.label}</p>
                            <p className="text-[10px] text-slate-400">{p.desc}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-slate-800 bg-slate-950 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-5 py-2.5 rounded-2xl font-bold text-slate-400 hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                form="employee-form"
                type="submit"
                disabled={submitting}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-7 py-2.5 rounded-2xl flex items-center gap-2 shadow-lg shadow-indigo-600/30"
              >
                {submitting ? <Loader className="animate-spin" size={16} /> : editingMember ? 'Save Changes' : 'Hire Employee'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Role Modal */}
      {showAddRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Add Custom Role</h2>
              <button onClick={() => setShowAddRoleModal(false)} className="text-slate-400 hover:bg-slate-800 p-2 rounded-xl">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateRole} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Role Name *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Regional Supervisor"
                  value={roleForm.name}
                  onChange={e => setRoleForm({ ...roleForm, name: e.target.value, code: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-bold mb-1">Role Code *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. regional_supervisor"
                  value={roleForm.code}
                  onChange={e => setRoleForm({ ...roleForm, code: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddRoleModal(false)}
                  className="px-4 py-2 rounded-2xl font-bold text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-5 py-2 rounded-2xl flex items-center gap-2"
                >
                  {submitting ? <Loader className="animate-spin" size={16} /> : 'Save Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Department Modal */}
      {showAddDeptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-955/70 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Add New Department</h2>
              <button onClick={() => setShowAddDeptModal(false)} className="text-slate-400 hover:bg-slate-800 p-2 rounded-xl">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateDept} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Department Name *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Quality Assurance"
                  value={deptForm.name}
                  onChange={e => setDeptForm({ ...deptForm, name: e.target.value, code: e.target.value.substring(0, 4).toUpperCase() })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-bold mb-1">Department Code *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. QA"
                  value={deptForm.code}
                  onChange={e => setDeptForm({ ...deptForm, code: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddDeptModal(false)}
                  className="px-4 py-2 rounded-2xl font-bold text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2 rounded-2xl flex items-center gap-2"
                >
                  {submitting ? <Loader className="animate-spin" size={16} /> : 'Save Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Profile Drawer */}
      {selectedProfile && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full p-6 overflow-y-auto text-slate-200">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <h3 className="font-bold text-white text-lg">Employee Profile</h3>
              <button onClick={() => setSelectedProfile(null)} className="text-slate-400 hover:bg-slate-800 p-2 rounded-xl">
                <X size={20} />
              </button>
            </div>

            <div className="mt-6 space-y-6 text-xs">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-black text-2xl flex items-center justify-center mx-auto mb-3 shadow-xl">
                  {selectedProfile.name ? selectedProfile.name.substring(0, 2).toUpperCase() : 'EM'}
                </div>
                <h4 className="font-bold text-white text-lg">{selectedProfile.name}</h4>
                <span className="inline-block mt-1 px-3 py-1 bg-indigo-500/10 text-indigo-300 font-bold rounded-full border border-indigo-500/20">
                  {selectedProfile.role?.toUpperCase()}
                </span>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 font-mono">
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Email (Login Credential)</p>
                  <p className="font-bold text-white text-xs mt-0.5">{selectedProfile.email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Phone Number</p>
                  <p className="font-bold text-white text-xs mt-0.5">{selectedProfile.phone ? `+91 ${selectedProfile.phone}` : 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Department</p>
                  <p className="font-bold text-white text-xs mt-0.5">{selectedProfile.department || 'Operations'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
