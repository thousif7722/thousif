import React, { useState, useEffect } from 'react';
import apiService from '@/services/api';
import Header from '@/components/common/Header';
import {
  Users, Building2, Shield, Target, CheckSquare, MessageSquare, Megaphone, Calendar,
  Clock, Award, History, Settings, Plus, UserPlus, ArrowRightLeft, Search, Filter,
  Check, X, Loader, RefreshCw, Send, Paperclip, ChevronRight, FileText, Lock, AlertCircle,
  Eye, Edit3, Trash2, UserCheck, Phone, Mail, MapPin, Briefcase, Sparkles, TrendingUp
} from 'lucide-react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);

const PERMISSION_OPTS = [
  { id: 'manage_providers', label: 'KYC & Technicians', desc: 'Approve docs, verify providers' },
  { id: 'manage_bookings', label: 'Operations & Dispatch', desc: 'Monitor active jobs, reassign' },
  { id: 'manage_complaints', label: 'Customer Support', desc: 'Disputes, resolution OTPs' },
  { id: 'manage_financials', label: 'Finance & Wallet', desc: 'Refunds, payouts, dues' },
  { id: 'manage_services', label: 'Catalog & Pricing', desc: 'Services, surge pricing' },
  { id: 'manage_users', label: 'User Operations', desc: 'User blocking, subscriptions' },
];

export default function AdminTeam() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  // Core Data States
  const [analytics, setAnalytics] = useState(null);
  const [orgChart, setOrgChart] = useState(null);
  const [team, setTeam] = useState([]);
  const [workload, setWorkload] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [teamsList, setTeamsList] = useState([]);
  const [targets, setTargets] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [requests, setRequests] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [rolesData, setRolesData] = useState({ defaultRoles: [], customRoles: [] });
  const [companyConfig, setCompanyConfig] = useState(null);

  // UI Modal / Drawer States
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [chatInput, setChatInput] = useState('');

  // Form States
  const [staffForm, setStaffForm] = useState({ name: '', phone: '', email: '', designation: '', department: '', role: 'staff', permissions: [] });
  const [transferForm, setTransferForm] = useState({ userId: '', toTeamId: '', reason: '' });
  const [taskForm, setTaskForm] = useState({ title: '', description: '', assignedTo: '', priority: 'medium', dueDate: '' });
  const [targetForm, setTargetForm] = useState({ title: '', targetType: 'bookings', targetValue: 100, period: 'monthly', startDate: '', endDate: '', teamName: '' });
  const [noticeForm, setNoticeForm] = useState({ title: '', message: '', priority: 'normal', isPinned: false });
  const [meetingForm, setMeetingForm] = useState({ title: '', date: '', time: '', location: '', meetingLink: '', agenda: '' });
  const [deptForm, setDeptForm] = useState({ name: '', code: '', description: '', monthlyTarget: 0 });
  const [teamForm, setTeamForm] = useState({ name: '', code: '', department: '', monthlyTarget: 0 });
  const [roleForm, setRoleForm] = useState({ name: '', code: '', description: '', permissions: [] });

  useEffect(() => {
    fetchAllData();
  }, []);

  async function fetchAllData() {
    setLoading(true);
    try {
      const [
        analyticsRes, orgRes, teamRes, workloadRes, deptsRes, teamsRes,
        targetsRes, tasksRes, announcementsRes, meetingsRes, chatRes,
        attRes, reqsRes, logsRes, rolesRes, configRes
      ] = await Promise.all([
        apiService.getCompanyAnalytics().catch(() => ({ data: { data: null } })),
        apiService.getOrgChart().catch(() => ({ data: { data: null } })),
        apiService.getAdminTeam().catch(() => ({ data: { data: [] } })),
        apiService.getTeamWorkload().catch(() => ({ data: { data: null } })),
        apiService.getCompanyDepartments().catch(() => ({ data: { data: [] } })),
        apiService.getCompanyTeams().catch(() => ({ data: { data: [] } })),
        apiService.getCompanyTargets().catch(() => ({ data: { data: [] } })),
        apiService.getCompanyTasks().catch(() => ({ data: { data: [] } })),
        apiService.getCompanyAnnouncements().catch(() => ({ data: { data: [] } })),
        apiService.getCompanyMeetings().catch(() => ({ data: { data: [] } })),
        apiService.getCompanyChat().catch(() => ({ data: { data: [] } })),
        apiService.getCompanyAttendance().catch(() => ({ data: { data: [] } })),
        apiService.getCompanyRequests().catch(() => ({ data: { data: [] } })),
        apiService.getCompanyAuditLogs().catch(() => ({ data: { data: [] } })),
        apiService.getCompanyRoles().catch(() => ({ data: { data: { defaultRoles: [], customRoles: [] } } })),
        apiService.getCompanyConfig().catch(() => ({ data: { data: null } })),
      ]);

      setAnalytics(analyticsRes.data?.data);
      setOrgChart(orgRes.data?.data);
      setTeam(teamRes.data?.data || []);
      setWorkload(workloadRes.data?.data);
      setDepartments(deptsRes.data?.data || []);
      setTeamsList(teamsRes.data?.data || []);
      setTargets(targetsRes.data?.data || []);
      setTasks(tasksRes.data?.data || []);
      setAnnouncements(announcementsRes.data?.data || []);
      setMeetings(meetingsRes.data?.data || []);
      setChatMessages(chatRes.data?.data || []);
      setAttendance(attRes.data?.data || []);
      setRequests(reqsRes.data?.data || []);
      setAuditLogs(logsRes.data?.data || []);
      setRolesData(rolesRes.data?.data || { defaultRoles: [], customRoles: [] });
      setCompanyConfig(configRes.data?.data);
    } catch (err) {
      toast.error('Failed to load company hub data');
    } finally {
      setLoading(false);
    }
  }

  // Action Handlers
  async function handleCreateStaff(e) {
    e.preventDefault();
    try {
      await apiService.createTeamMember(staffForm);
      toast.success('Staff member hired successfully!');
      setShowStaffModal(false);
      fetchAllData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add staff');
    }
  }

  async function handleTransferMember(e) {
    e.preventDefault();
    try {
      const res = await apiService.transferCompanyMember(transferForm);
      toast.success(res.data.message);
      setShowTransferModal(false);
      fetchAllData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Transfer failed');
    }
  }

  async function handleCreateTask(e) {
    e.preventDefault();
    try {
      await apiService.createCompanyTask(taskForm);
      toast.success('Task assigned successfully!');
      setShowTaskModal(false);
      fetchAllData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create task');
    }
  }

  async function handleCreateTarget(e) {
    e.preventDefault();
    try {
      await apiService.createCompanyTarget(targetForm);
      toast.success('Target goal published!');
      setShowTargetModal(false);
      fetchAllData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to set target');
    }
  }

  async function handleCreateNotice(e) {
    e.preventDefault();
    try {
      await apiService.createCompanyAnnouncement(noticeForm);
      toast.success('Announcement broadcasted!');
      setShowNoticeModal(false);
      fetchAllData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to publish notice');
    }
  }

  async function handleCreateMeeting(e) {
    e.preventDefault();
    try {
      await apiService.createCompanyMeeting(meetingForm);
      toast.success('Meeting scheduled!');
      setShowMeetingModal(false);
      fetchAllData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Meeting setup failed');
    }
  }

  async function handleSendChat(e) {
    e.preventDefault();
    if (!chatInput.trim()) return;
    try {
      const res = await apiService.sendCompanyChat({ message: chatInput, chatType: 'announcement' });
      setChatMessages(prev => [...prev, res.data.data]);
      setChatInput('');
    } catch (err) {
      toast.error('Failed to send message');
    }
  }

  async function handleCheckIn() {
    try {
      const res = await apiService.markCompanyAttendance();
      toast.success(res.data.message);
      fetchAllData();
    } catch (err) {
      toast.error('Attendance mark failed');
    }
  }

  async function handleRequestAction(reqId, status) {
    try {
      const res = await apiService.actionCompanyRequest(reqId, { status });
      toast.success(res.data.message);
      fetchAllData();
    } catch (err) {
      toast.error('Action failed');
    }
  }

  // Search & Filter Staff
  const filteredStaff = team.filter(s => {
    const matchesSearch = (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (s.phone || '').includes(searchQuery) ||
                          (s.email || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || s.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 pb-20 font-sans">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        
        {/* Company Hub Top Banner */}
        <div className="bg-gradient-to-r from-teal-900 via-emerald-900 to-slate-900 rounded-3xl p-6 md:p-8 border border-emerald-500/20 shadow-2xl mb-8 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-3">
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                  ONEWAYFIX Enterprise
                </span>
                <span className="text-xs text-slate-400 font-mono">HQ • Hitech City</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-white mt-2 tracking-tight flex items-center gap-3">
                <Building2 className="text-emerald-400" size={36} />
                Company & Workforce Hub
              </h1>
              <p className="text-sm text-slate-300 mt-1 max-w-2xl">
                Comprehensive organization hierarchy, RBAC permissions, manager dashboards, real-time team chat, tasks, targets & performance analytics.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={handleCheckIn}
                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-transform active:scale-95 shadow-lg shadow-emerald-500/20"
              >
                <Clock size={16} /> Mark Attendance / Check In
              </button>
              <button
                onClick={() => setShowStaffModal(true)}
                className="bg-white/10 hover:bg-white/20 text-white font-semibold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 border border-white/10 backdrop-blur-sm transition"
              >
                <UserPlus size={16} /> Hire Employee
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-6 pt-6 border-t border-white/10 text-center">
            <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
              <p className="text-[11px] text-slate-400 uppercase font-semibold">Total Staff</p>
              <p className="text-xl font-black text-white mt-0.5">{analytics?.totalStaff ?? team.length}</p>
            </div>
            <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
              <p className="text-[11px] text-slate-400 uppercase font-semibold">Active Teams</p>
              <p className="text-xl font-black text-emerald-400 mt-0.5">{teamsList.length}</p>
            </div>
            <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
              <p className="text-[11px] text-slate-400 uppercase font-semibold">Departments</p>
              <p className="text-xl font-black text-blue-400 mt-0.5">{departments.length}</p>
            </div>
            <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
              <p className="text-[11px] text-slate-400 uppercase font-semibold">Active Tasks</p>
              <p className="text-xl font-black text-amber-400 mt-0.5">{tasks.filter(t => t.status !== 'completed').length}</p>
            </div>
            <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
              <p className="text-[11px] text-slate-400 uppercase font-semibold">Targets Active</p>
              <p className="text-xl font-black text-purple-400 mt-0.5">{targets.filter(t => t.status === 'active').length}</p>
            </div>
            <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
              <p className="text-[11px] text-slate-400 uppercase font-semibold">Today Check-ins</p>
              <p className="text-xl font-black text-teal-400 mt-0.5">{attendance.length}</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation Hub */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 scrollbar-none border-b border-slate-800">
          {[
            { id: 'overview', label: 'Org Chart & Summary', icon: Building2 },
            { id: 'directory', label: 'Staff Directory', icon: Users },
            { id: 'departments', label: 'Departments', icon: Briefcase },
            { id: 'teams', label: 'Teams & Transfers', icon: ArrowRightLeft },
            { id: 'targets', label: 'Targets & Goals', icon: Target },
            { id: 'tasks', label: 'Tasks (Kanban)', icon: CheckSquare },
            { id: 'chat', label: 'Team Chat', icon: MessageSquare },
            { id: 'announcements', label: 'Announcements', icon: Megaphone },
            { id: 'meetings', label: 'Meetings', icon: Calendar },
            { id: 'attendance', label: 'Attendance & Leaves', icon: Clock },
            { id: 'roles', label: 'Roles & RBAC', icon: Shield },
            { id: 'audit', label: 'Audit Logs', icon: History },
            { id: 'settings', label: 'Company Settings', icon: Settings },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  active
                    ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                    : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-700/50'
                }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab 1: Overview & Visual Org Chart */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700">
              <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <Building2 className="text-emerald-400" /> Interactive Organization Hierarchy Chart
              </h2>
              <p className="text-xs text-slate-400 mb-6">
                Visual breakdown of reportees from Executive Admin down to Managers, Team Leaders, and Operational Staff.
              </p>

              {loading ? (
                <div className="py-12 flex justify-center"><Loader className="animate-spin text-emerald-400" /></div>
              ) : (
                <div className="space-y-8">
                  {/* Top Level: Executive Leadership */}
                  <div className="text-center">
                    <p className="text-[11px] uppercase font-bold text-amber-400 tracking-wider mb-2">Executive Leadership</p>
                    <div className="inline-flex flex-wrap justify-center gap-4">
                      {orgChart?.ceo?.map(c => (
                        <div key={c._id} className="bg-gradient-to-b from-amber-500/20 to-slate-900 border-2 border-amber-500/50 p-4 rounded-2xl min-w-[200px] text-center shadow-lg">
                          <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-300 mx-auto flex items-center justify-center font-black text-lg border border-amber-400/40">
                            {c.name.substring(0, 2).toUpperCase()}
                          </div>
                          <p className="font-bold text-white mt-2">{c.name}</p>
                          <p className="text-[11px] text-amber-300 font-semibold">{c.designation || 'Chief Executive Admin'}</p>
                          <span className="inline-block bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 rounded font-mono mt-1">
                            {c.email || c.phone}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Connect Line */}
                  <div className="w-0.5 h-8 bg-slate-700 mx-auto" />

                  {/* Managers Level */}
                  <div>
                    <p className="text-[11px] uppercase font-bold text-emerald-400 tracking-wider text-center mb-3">Department Managers</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {orgChart?.managers?.length ? orgChart.managers.map(m => (
                        <div key={m._id} className="bg-slate-900 border border-emerald-500/30 p-4 rounded-2xl text-center hover:border-emerald-500 transition">
                          <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center font-bold">
                            {m.name.substring(0, 2).toUpperCase()}
                          </div>
                          <p className="font-bold text-white text-sm mt-2">{m.name}</p>
                          <p className="text-xs text-emerald-400">{m.department || 'Operations Manager'}</p>
                          <p className="text-[11px] text-slate-400 mt-1">📞 {m.phone}</p>
                        </div>
                      )) : (
                        <div className="col-span-3 text-center text-xs text-slate-500 py-4 bg-slate-900/50 rounded-xl border border-dashed border-slate-800">
                          No specific Managers configured yet. Assign role 'manager' to staff members.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Team Leaders Level */}
                  <div>
                    <p className="text-[11px] uppercase font-bold text-blue-400 tracking-wider text-center mb-3">Team Leaders</p>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      {orgChart?.teamLeads?.map(tl => (
                        <div key={tl._id} className="bg-slate-900/80 border border-blue-500/30 p-3 rounded-xl text-center">
                          <p className="font-bold text-white text-xs">{tl.name}</p>
                          <p className="text-[10px] text-blue-400">Team Lead</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Staff Directory */}
        {activeTab === 'directory' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-3 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search by name, phone, email..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <select
                  value={roleFilter}
                  onChange={e => setRoleFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-xl px-3 py-2 focus:outline-none"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Super Admin</option>
                  <option value="manager">Managers</option>
                  <option value="team_leader">Team Leaders</option>
                  <option value="staff">Staff</option>
                </select>

                <button onClick={() => setShowStaffModal(true)} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shrink-0">
                  <UserPlus size={15} /> Add Employee
                </button>
              </div>
            </div>

            <div className="bg-slate-800/80 rounded-2xl border border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-700 uppercase">
                    <tr>
                      <th className="px-5 py-3.5">Employee Name</th>
                      <th className="px-5 py-3.5">Contact Details</th>
                      <th className="px-5 py-3.5">Role & Department</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5">Permissions</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {filteredStaff.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center py-8 text-slate-500">No staff members found matching query.</td>
                      </tr>
                    ) : (
                      filteredStaff.map(member => (
                        <tr key={member._id} className="hover:bg-slate-700/30 transition">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 font-black flex items-center justify-center border border-emerald-500/30">
                                {member.name.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-white">{member.name}</p>
                                <p className="text-[10px] text-slate-400">{member.designation || 'Staff Associate'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-slate-300">
                            <p>📞 {member.phone}</p>
                            <p className="text-[10px] text-slate-400">✉️ {member.email || 'N/A'}</p>
                          </td>
                          <td className="px-5 py-4">
                            <span className="bg-slate-900 text-emerald-400 font-bold px-2.5 py-1 rounded-md border border-slate-700 text-[10px] uppercase">
                              {member.role}
                            </span>
                            <p className="text-[10px] text-slate-400 mt-1">{member.department || 'General Ops'}</p>
                          </td>
                          <td className="px-5 py-4">
                            {member.isOnline ? (
                              <span className="text-emerald-400 font-bold flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> Online
                              </span>
                            ) : (
                              <span className="text-slate-400">Offline</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {member.permissions?.map(p => (
                                <span key={p} className="bg-slate-900 text-slate-300 text-[10px] px-2 py-0.5 rounded font-mono border border-slate-700">
                                  {p.replace('manage_', '')}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              onClick={() => setSelectedStaff(member)}
                              className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold"
                            >
                              View Profile
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Departments */}
        {activeTab === 'departments' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
              <div>
                <h3 className="font-bold text-white text-base">Company Departments</h3>
                <p className="text-xs text-slate-400">Organize teams under functional departments with manager assignments.</p>
              </div>
              <button onClick={() => setShowDeptModal(true)} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5">
                <Plus size={15} /> Create Department
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {departments.length === 0 ? (
                <div className="col-span-3 text-center py-12 text-slate-500 bg-slate-800/50 rounded-2xl">No departments registered.</div>
              ) : (
                departments.map(dept => (
                  <div key={dept._id} className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold">{dept.code}</span>
                        <h4 className="font-bold text-white text-lg mt-1">{dept.name}</h4>
                      </div>
                      <span className="text-xs text-slate-400">Target: ₹{dept.monthlyTarget || 0}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">{dept.description || 'Core operational department.'}</p>
                    <div className="mt-4 pt-4 border-t border-slate-700/50 text-xs text-slate-300">
                      <p>Manager: <span className="font-bold text-white">{dept.managerId?.name || 'Unassigned'}</span></p>
                      <p className="text-[11px] text-slate-400">Branch: {dept.branch || 'Headquarters'}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Teams & Transfers */}
        {activeTab === 'teams' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
              <div>
                <h3 className="font-bold text-white text-base">Teams & Employee Rebalancing</h3>
                <p className="text-xs text-slate-400">Manage specialized teams and transfer staff with logged audit history.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowTransferModal(true)} className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5">
                  <ArrowRightLeft size={15} /> Transfer Member
                </button>
                <button onClick={() => setShowTeamModal(true)} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5">
                  <Plus size={15} /> Add Team
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {teamsList.map(t => (
                <div key={t._id} className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-white text-lg">{t.name}</h4>
                    <span className="bg-blue-500/20 text-blue-300 text-[10px] px-2 py-0.5 rounded font-mono font-bold">{t.code || 'TEAM'}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{t.department || 'Operations'}</p>
                  
                  <div className="mt-4 space-y-1 text-xs text-slate-300">
                    <p>Team Lead: <span className="font-semibold text-white">{t.teamLeaderId?.name || 'Unassigned'}</span></p>
                    <p>Members: <span className="font-bold text-emerald-400">{t.members?.length || 0} active</span></p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 5: Targets & Goals */}
        {activeTab === 'targets' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
              <div>
                <h3 className="font-bold text-white text-base">Workforce Targets & Deadlines</h3>
                <p className="text-xs text-slate-400">Set daily, weekly, or monthly operational goals for teams and staff.</p>
              </div>
              <button onClick={() => setShowTargetModal(true)} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5">
                <Plus size={15} /> Set Target Goal
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {targets.length === 0 ? (
                <div className="col-span-2 text-center py-12 text-slate-500 bg-slate-800/50 rounded-2xl">No active targets defined.</div>
              ) : (
                targets.map(trg => {
                  const pct = Math.min(100, Math.round((trg.currentValue / (trg.targetValue || 1)) * 100));
                  return (
                    <div key={trg._id} className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-bold uppercase">{trg.period}</span>
                          <h4 className="font-bold text-white text-base mt-1">{trg.title}</h4>
                        </div>
                        <span className="text-xs font-bold text-emerald-400">{pct}% Complete</span>
                      </div>

                      <div className="w-full bg-slate-900 h-2.5 rounded-full mt-4 overflow-hidden border border-slate-700">
                        <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>

                      <div className="flex justify-between items-center text-xs text-slate-400 mt-3">
                        <span>Progress: {trg.currentValue} / {trg.targetValue}</span>
                        <span>Deadline: {dayjs(trg.endDate).format('DD MMM YYYY')}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 6: Tasks Management */}
        {activeTab === 'tasks' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
              <div>
                <h3 className="font-bold text-white text-base">Internal Task Board</h3>
                <p className="text-xs text-slate-400">Assign priority tasks, track status, and monitor team deadlines.</p>
              </div>
              <button onClick={() => setShowTaskModal(true)} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5">
                <Plus size={15} /> Assign New Task
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['pending', 'in_progress', 'completed'].map(colStatus => (
                <div key={colStatus} className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                  <h4 className="font-bold text-xs uppercase text-slate-400 mb-3 flex justify-between">
                    <span>{colStatus.replace('_', ' ')}</span>
                    <span className="bg-slate-800 px-2 py-0.5 rounded text-white">{tasks.filter(t => t.status === colStatus).length}</span>
                  </h4>

                  <div className="space-y-3">
                    {tasks.filter(t => t.status === colStatus).map(tsk => (
                      <div key={tsk._id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-2">
                        <div className="flex justify-between items-start">
                          <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${
                            tsk.priority === 'urgent' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {tsk.priority}
                          </span>
                          <span className="text-[10px] text-slate-400">Due: {dayjs(tsk.dueDate).format('DD MMM')}</span>
                        </div>
                        <p className="font-bold text-white text-sm">{tsk.title}</p>
                        <p className="text-xs text-slate-400">{tsk.description}</p>
                        <div className="pt-2 border-t border-slate-700/50 flex justify-between items-center text-[10px] text-slate-400">
                          <span>Assignee: {tsk.assignedTo?.name || 'Staff'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 7: Team Chat */}
        {activeTab === 'chat' && (
          <div className="bg-slate-800/80 rounded-2xl border border-slate-700 p-6 max-w-4xl mx-auto flex flex-col h-[600px]">
            <h3 className="font-bold text-white text-base mb-2 flex items-center gap-2">
              <MessageSquare className="text-emerald-400" /> Internal Company Announcement Channel
            </h3>
            <p className="text-xs text-slate-400 mb-4">Real-time socket chat for company announcements and team coordination.</p>

            <div className="flex-1 overflow-y-auto space-y-3 p-4 bg-slate-900 rounded-xl border border-slate-800">
              {chatMessages.map(msg => (
                <div key={msg._id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 border border-emerald-500/30 text-xs">
                    {msg.senderId?.name?.substring(0, 2).toUpperCase() || 'SH'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-white">{msg.senderId?.name || 'Staff Member'}</span>
                      <span className="text-[10px] text-slate-500">{dayjs(msg.createdAt).format('HH:mm')}</span>
                    </div>
                    <div className="bg-slate-800 text-slate-200 text-xs p-3 rounded-xl mt-1 border border-slate-700 max-w-md">
                      {msg.message}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendChat} className="mt-4 flex gap-2">
              <input
                type="text"
                placeholder="Type message to broadcast to team..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 text-white text-xs rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500"
              />
              <button type="submit" className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-6 py-3 rounded-xl text-xs flex items-center gap-1.5 shrink-0">
                <Send size={15} /> Send
              </button>
            </form>
          </div>
        )}

        {/* Tab 8: Announcements */}
        {activeTab === 'announcements' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
              <div>
                <h3 className="font-bold text-white text-base">Company Announcements & Notices</h3>
                <p className="text-xs text-slate-400">Broadcast company policies, holiday notices, and urgent directives.</p>
              </div>
              <button onClick={() => setShowNoticeModal(true)} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5">
                <Megaphone size={15} /> Publish Notice
              </button>
            </div>

            <div className="space-y-4">
              {announcements.map(anc => (
                <div key={anc._id} className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-white text-lg">{anc.title}</h4>
                    <span className="text-xs text-slate-400">{dayjs(anc.createdAt).fromNow()}</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-2">{anc.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 9: Meetings */}
        {activeTab === 'meetings' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
              <div>
                <h3 className="font-bold text-white text-base">Internal Meetings Schedule</h3>
                <p className="text-xs text-slate-400">Schedule team huddles, monthly reviews, and strategic operational meetings.</p>
              </div>
              <button onClick={() => setShowMeetingModal(true)} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5">
                <Plus size={15} /> Schedule Meeting
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {meetings.map(m => (
                <div key={m._id} className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-white text-base">{m.title}</h4>
                    <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 rounded font-bold uppercase">{m.status}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">📅 Date: {m.date} at {m.time}</p>
                  <p className="text-xs text-slate-400">📍 Location: {m.location}</p>
                  {m.meetingLink && (
                    <a href={m.meetingLink} target="_blank" rel="noreferrer" className="text-xs text-emerald-400 underline mt-2 block">
                      Join Virtual Meeting →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 10: Attendance & Leaves */}
        {activeTab === 'attendance' && (
          <div className="space-y-6">
            <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700">
              <h3 className="font-bold text-white text-base mb-4">Pending Leave & WFH Requests</h3>
              <div className="space-y-3">
                {requests.length === 0 ? (
                  <p className="text-xs text-slate-500">No pending leave requests.</p>
                ) : (
                  requests.map(r => (
                    <div key={r._id} className="bg-slate-900 p-4 rounded-xl border border-slate-700 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-white text-xs">{r.userId?.name} — <span className="uppercase font-mono text-emerald-400">{r.type}</span></p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Reason: {r.reason}</p>
                        <p className="text-[10px] text-slate-500">Dates: {dayjs(r.startDate).format('DD MMM')} to {dayjs(r.endDate).format('DD MMM')}</p>
                      </div>
                      {r.status === 'pending' ? (
                        <div className="flex gap-2">
                          <button onClick={() => handleRequestAction(r._id, 'approved')} className="bg-emerald-500 text-slate-950 font-bold px-3 py-1 rounded text-xs">Approve</button>
                          <button onClick={() => handleRequestAction(r._id, 'rejected')} className="bg-red-500/20 text-red-400 font-bold px-3 py-1 rounded text-xs">Reject</button>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-slate-400 uppercase">{r.status}</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 11: Roles & RBAC */}
        {activeTab === 'roles' && (
          <div className="space-y-6">
            <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700">
              <h3 className="font-bold text-white text-base mb-2">Role-Based Access Control (RBAC)</h3>
              <p className="text-xs text-slate-400 mb-6">Manage system default and custom roles with granular permission keys.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rolesData.defaultRoles.map(r => (
                  <div key={r.code} className="bg-slate-900 border border-slate-700 p-4 rounded-xl">
                    <span className="bg-blue-500/20 text-blue-300 text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase">{r.code}</span>
                    <h4 className="font-bold text-white text-sm mt-1">{r.name}</h4>
                    <p className="text-xs text-slate-400 mt-1">{r.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 12: Audit Logs */}
        {activeTab === 'audit' && (
          <div className="bg-slate-800/80 rounded-2xl border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700 font-bold text-white text-sm">Administrative Audit Trail</div>
            <div className="divide-y divide-slate-700/50">
              {auditLogs.map(l => (
                <div key={l._id} className="p-4 text-xs flex justify-between items-center">
                  <div>
                    <p className="font-bold text-white">{l.action}</p>
                    <p className="text-[10px] text-slate-400">By: {l.performedBy?.name || 'Admin'}</p>
                  </div>
                  <span className="text-[10px] text-slate-500">{dayjs(l.createdAt).format('DD MMM YYYY HH:mm')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 13: Company Settings */}
        {activeTab === 'settings' && (
          <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700 max-w-2xl mx-auto space-y-4">
            <h3 className="font-bold text-white text-base">Company Working Hours & Policies</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Company Name</label>
              <input type="text" readOnly value={companyConfig?.companyName || 'ONEWAYFIX'} className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-3 text-xs" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Standard Working Hours</label>
              <input type="text" readOnly value={companyConfig?.workingHours || '09:00 AM - 06:00 PM'} className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-3 text-xs" />
            </div>
          </div>
        )}

      </div>

      {/* Hire Employee Modal */}
      {showStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-white text-lg">Hire New Employee</h3>
              <button onClick={() => setShowStaffModal(false)} className="text-slate-400"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateStaff} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Full Name</label>
                <input required type="text" value={staffForm.name} onChange={e => setStaffForm({...staffForm, name: e.target.value})} className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-3" placeholder="John Doe" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Phone</label>
                  <input required type="tel" value={staffForm.phone} onChange={e => setStaffForm({...staffForm, phone: e.target.value})} className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-3" placeholder="9876543210" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Role</label>
                  <select value={staffForm.role} onChange={e => setStaffForm({...staffForm, role: e.target.value})} className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-3">
                    <option value="staff">Staff</option>
                    <option value="team_leader">Team Leader</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full bg-emerald-500 text-slate-950 font-bold p-3 rounded-xl">Save & Add Staff</button>
            </form>
          </div>
        </div>
      )}

      {/* Slide-out Staff Detail Drawer */}
      {selectedStaff && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border-l border-slate-700 h-full p-6 overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <h3 className="font-bold text-white text-lg">Employee Profile</h3>
              <button onClick={() => setSelectedStaff(null)} className="text-slate-400"><X size={20} /></button>
            </div>
            <div className="mt-6 space-y-4 text-xs">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 text-xl font-bold flex items-center justify-center mx-auto mb-2 border border-emerald-500/30">
                  {selectedStaff.name.substring(0, 2).toUpperCase()}
                </div>
                <h4 className="font-bold text-white text-base">{selectedStaff.name}</h4>
                <p className="text-slate-400">{selectedStaff.designation || selectedStaff.role.toUpperCase()}</p>
              </div>

              <div className="bg-slate-800 p-4 rounded-xl space-y-2 border border-slate-700">
                <p className="text-slate-300">📞 Phone: {selectedStaff.phone}</p>
                <p className="text-slate-300">✉️ Email: {selectedStaff.email || 'N/A'}</p>
                <p className="text-slate-300">🏢 Department: {selectedStaff.department || 'Operations'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
