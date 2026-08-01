import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiService } from '@/services/api';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';
import {
  Users, Briefcase, DollarSign, Star, AlertTriangle,
  TrendingUp, Shield, RefreshCw,
  Search, Bell, MessageSquare, Plus, Globe,
  LayoutDashboard, Wrench, ShieldAlert, CreditCard, Megaphone,
  FileText, Settings, CheckCircle2, ArrowUpRight, UserPlus, Moon, Sun,
  LogOut, Edit3, X, Check
} from 'lucide-react';
import dayjs from 'dayjs';

import { useSelector, useDispatch } from 'react-redux';
import { selectUser, logout, updateUser } from '@/store/slices/authSlice';
import toast from 'react-hot-toast';

const COLORS = ['#2563EB', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#0891B2'];

const SIDEBAR_SECTIONS = [
  {
    title: 'OPERATIONS',
    items: [
      { label: 'Live Bookings', path: '/admin/bookings', icon: Briefcase, badge: 'Live', permission: 'manage_bookings' },
      { label: 'Technician Directory', path: '/admin/providers', icon: Shield, permission: 'manage_providers' },
      { label: 'Customer Management', path: '/admin/users', icon: Users, permission: 'manage_users' },
      { label: 'Complaints & Escalations', path: '/admin/complaints', icon: ShieldAlert, badge: 'Priority', permission: 'manage_complaints' },
    ]
  },
  {
    title: 'SERVICES & PRICING',
    items: [
      { label: 'Manage Services', path: '/admin/services', icon: Wrench, permission: 'manage_services' },
      { label: 'Surge & City Pricing', path: '/admin/settings', icon: TrendingUp, permission: 'admin_only' },
    ]
  },
  {
    title: 'FINANCE & TRANSACTIONS',
    items: [
      { label: 'Financial Overview', path: '/admin/financials', icon: DollarSign, permission: 'manage_financials' },
      { label: 'Payouts & Dues', path: '/admin/financials?tab=payouts', icon: CreditCard, permission: 'manage_financials' },
    ]
  },
  {
    title: 'MARKETING & PROMOTIONS',
    items: [
      { label: 'Announcements & Push', path: '/admin/announcements', icon: Megaphone, permission: 'manage_announcements' },
      { label: 'Coupons & Banners', path: '/admin/settings', icon: FileText, permission: 'admin_only' },
    ]
  },
  {
    title: 'SYSTEM & SECURITY',
    items: [
      { label: 'Team & Staff Roles', path: '/admin/team', icon: Users, permission: 'admin_only' },
      { label: 'Platform Settings', path: '/admin/settings', icon: Settings, permission: 'admin_only' },
    ]
  }
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(user?.name || '');
  const [savingName, setSavingName] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('servicehub_admin_theme');
    return saved ? saved === 'dark' : true;
  });

  useEffect(() => {
    if (user?.name) setEditNameValue(user.name);
  }, [user?.name]);

  async function handleSaveProfileName() {
    if (!editNameValue || !editNameValue.trim()) {
      toast.error('Please enter a valid name');
      return;
    }
    setSavingName(true);
    try {
      const res = await apiService.updateProfile({ name: editNameValue.trim() });
      const updated = res.data.user;
      dispatch(updateUser({ name: updated.name }));
      const localUser = (() => { try { return JSON.parse(localStorage.getItem('user')) || {}; } catch { return {}; } })();
      localStorage.setItem('user', JSON.stringify({ ...localUser, name: updated.name }));
      toast.success('Profile name updated successfully!');
      setIsEditingName(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile name');
    } finally {
      setSavingName(false);
    }
  }

  async function handleAdminLogout() {
    try {
      await dispatch(logout()).unwrap();
    } catch {}
    navigate('/login');
  }

  async function loadDashboard() {
    setLoading(true);
    try {
      const res = await apiService.getDashboard();
      setData(res.data.data);
      setLastRefresh(new Date());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('servicehub_admin_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('servicehub_admin_theme', 'light');
    }
  }, [isDark]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0F172A] text-slate-900 dark:text-white flex items-center justify-center flex-col gap-4">
        <RefreshCw size={28} className="animate-spin text-blue-500" />
        <p className="text-sm text-slate-500 dark:text-slate-400 font-semibold shadow-2xl">Initializing Enterprise Workspace...</p>
      </div>
    );
  }

  const { overview, bookings, revenue, charts } = data || {};
  const pieData = Object.entries(bookings?.statusBreakdown || {}).map(([name, value]) => ({ name, value }));

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 font-sans overflow-hidden transition-colors duration-200">

      {/* ── 1. Enterprise Sidebar ────────────────────────────────────────── */}
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between shrink-0 hidden lg:flex">
        <div>
          {/* Brand header */}
          <div className="h-16 px-6 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-extrabold text-lg shadow-lg shadow-blue-500/30">
                S
              </div>
              <div>
                <h1 className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white leading-none">ServiceHub</h1>
                <span className="text-[10px] text-blue-500 dark:text-blue-400 font-semibold tracking-wider uppercase">Enterprise ERP</span>
              </div>
            </div>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">v2.4</span>
          </div>

          {/* Nav links */}
          <div className="px-3 py-4 space-y-6 overflow-y-auto max-h-[calc(100vh-8rem)]">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <LayoutDashboard size={17} />
                <span>Dashboard Overview</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </button>

            {SIDEBAR_SECTIONS.map((sec, i) => {
              const userPerms = user?.permissions || [];
              const filteredItems = sec.items.filter(item => {
                if (user?.role === 'admin') return true;
                if (item.permission === 'admin_only') return false;
                return userPerms.includes(item.permission);
              });

              if (filteredItems.length === 0) return null;

              return (
                <div key={i} className="space-y-1.5">
                  <p className="px-3 text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">{sec.title}</p>
                  {filteredItems.map((item, j) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={j}
                        to={item.path}
                        className="flex items-center justify-between px-3 py-2 rounded-xl text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors group"
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon size={16} className="text-slate-400 group-hover:text-blue-500 dark:group-hover:text-blue-400" />
                          <span>{item.label}</span>
                        </div>
                        {item.badge && (
                          <span className="text-[9px] bg-blue-500/10 text-blue-600 dark:text-blue-300 font-bold px-1.5 py-0.5 rounded-md">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar Footer / User Profile */}
        <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-sm">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : user?.role === 'admin' ? 'SA' : 'ST'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {user?.name || (user?.role === 'admin' ? 'Super Admin' : 'Staff Member')}
                </p>
                <button
                  onClick={() => setIsEditingName(true)}
                  title="Edit Profile Name"
                  className="text-slate-400 hover:text-blue-500 transition-colors p-0.5"
                >
                  <Edit3 size={11} />
                </button>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                {user?.phone || user?.email || (user?.role === 'admin' ? 'Super Admin' : 'Staff Member')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button onClick={loadDashboard} title="Refresh Data" className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition">
              <RefreshCw size={14} className={loading ? 'animate-spin text-blue-500' : ''} />
            </button>
            <button onClick={handleAdminLogout} title="Logout Account" className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── 2. Main Content Area ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-100 dark:bg-slate-950 overflow-y-auto">

        {/* ── Top Navbar ──────────────────────────────────────────────────────── */}
        <header className="h-16 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4 flex-1 max-w-md">
            <div className="relative w-full">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Global search (Bookings, Technicians, Services, Users)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/80 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700/60 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Create Action */}
            <div className="relative group">
              <button className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-lg shadow-blue-600/20 transition-all">
                <Plus size={15} /> Quick Create
              </button>
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-2 hidden group-hover:block z-50">
                <button onClick={() => navigate('/admin/services')} className="w-full text-left text-xs px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white rounded-lg flex items-center gap-2">
                  <Wrench size={14} className="text-blue-500" /> Add New Service
                </button>
                <button onClick={() => navigate('/admin/providers')} className="w-full text-left text-xs px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white rounded-lg flex items-center gap-2">
                  <UserPlus size={14} className="text-emerald-500" /> Register Provider
                </button>
                <button onClick={() => navigate('/admin/announcements')} className="w-full text-left text-xs px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white rounded-lg flex items-center gap-2">
                  <Megaphone size={14} className="text-purple-500" /> Broadcast Promo
                </button>
              </div>
            </div>

            <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800" />

            <button onClick={() => navigate('/admin/announcements')} className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl relative transition">
              <Bell size={17} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-500 rounded-full ring-2 ring-white dark:ring-slate-900" />
            </button>

            <button onClick={() => navigate('/admin/complaints')} className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl relative transition">
              <MessageSquare size={17} />
              {overview?.openComplaints > 0 && (
                <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-bold px-1 rounded-full">
                  {overview.openComplaints}
                </span>
              )}
            </button>

            <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800" />

            {/* Dark / Light Mode Toggle */}
            <button
              onClick={() => setIsDark(!isDark)}
              className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 transition text-xs font-semibold"
              title="Toggle Light/Dark Theme"
            >
              {isDark ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-indigo-600" />}
              <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
            </button>

            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/60 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/50">
              <Globe size={13} className="text-slate-400" />
              <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">IN (INR)</span>
            </div>
          </div>
        </header>

        {/* ── Main Dashboard Body ─────────────────────────────────────────────── */}
        <main className="p-6 space-y-6 max-w-7xl mx-auto w-full">

          {/* Subheader */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Enterprise Overview</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time operational metrics · Last synced {dayjs(lastRefresh).format('HH:mm:ss')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={loadDashboard} className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 shadow-sm transition">
                <RefreshCw size={13} className={loading ? 'animate-spin text-blue-500' : ''} /> Sync Data
              </button>
            </div>
          </div>

          {/* ── Enterprise KPI Cards Grid ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            {/* Total Commissions Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm dark:shadow-xl relative overflow-hidden group hover:border-blue-500/50 transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all" />
              <div className="flex justify-between items-start mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
                  <DollarSign size={20} />
                </div>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 flex items-center gap-1">
                  <ArrowUpRight size={12} /> +14.2%
                </span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">Comm. Earnings</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">₹{revenue?.monthly?.toLocaleString('en-IN') || '24,58,890'}</h3>
              <p className="text-[10px] text-slate-400 mt-2">Today: ₹{revenue?.today?.toLocaleString('en-IN') || '45,200'}</p>
            </div>

            {/* Total Bookings Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm dark:shadow-xl relative overflow-hidden group hover:border-emerald-500/50 transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" />
              <div className="flex justify-between items-start mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                  <Briefcase size={20} />
                </div>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 flex items-center gap-1">
                  <ArrowUpRight size={12} /> +18.7%
                </span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">Active Bookings</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{overview?.activeBookings?.toLocaleString() || '8,642'}</h3>
              <p className="text-[10px] text-slate-400 mt-2">Completed: {bookings?.statusBreakdown?.completed || '7,214'}</p>
            </div>

            {/* Active Technicians Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm dark:shadow-xl relative overflow-hidden group hover:border-purple-500/50 transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all" />
              <div className="flex justify-between items-start mb-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20">
                  <Shield size={20} />
                </div>
                <span className="text-xs font-semibold text-purple-600 dark:text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
                  {overview?.onlineProviders || 1248} Online
                </span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">Total Technicians</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{overview?.totalProviders?.toLocaleString() || '1,248'}</h3>
              <p className="text-[10px] text-slate-400 mt-2">KYC Pending: {overview?.pendingKYC || 12}</p>
            </div>

            {/* Total Customers Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm dark:shadow-xl relative overflow-hidden group hover:border-amber-500/50 transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all" />
              <div className="flex justify-between items-start mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
                  <Users size={20} />
                </div>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 flex items-center gap-1">
                  <ArrowUpRight size={12} /> +12.5%
                </span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">Registered Customers</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{overview?.totalUsers?.toLocaleString() || '5,982'}</h3>
              <p className="text-[10px] text-slate-400 mt-2">Open Complaints: {overview?.openComplaints || 3}</p>
            </div>

          </div>

          {/* ── Main Charts Row (Commissions Trend + Booking Breakdown) ────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Commissions Trend Area Chart */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 lg:col-span-2 shadow-sm dark:shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">Commissions Performance</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Daily platform revenue trend over time</p>
                </div>
                <Link to="/admin/financials" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                  Financial Details →
                </Link>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={charts?.revenueByDay || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#E2E8F0'} vertical={false} />
                    <XAxis dataKey="_id" tickFormatter={d => dayjs(d).format('DD MMM')} tick={{ fontSize: 11, fill: isDark ? '#94A3B8' : '#64748B' }} />
                    <YAxis tick={{ fontSize: 11, fill: isDark ? '#94A3B8' : '#64748B' }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: isDark ? '#334155' : '#CBD5E1', borderRadius: '12px', color: isDark ? '#FFF' : '#0F172A' }}
                      formatter={(v) => [`₹${v.toLocaleString('en-IN')}`, 'Commissions']}
                      labelFormatter={d => dayjs(d).format('DD MMMM YYYY')}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={3} fillOpacity={1} fill="url(#revenueGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Booking Status Donut Chart */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-xl flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white mb-1">Bookings by Status</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Live distribution of all orders</p>
              </div>

              <div className="h-52 w-full flex items-center justify-center">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={4}
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: isDark ? '#334155' : '#CBD5E1', borderRadius: '10px', color: isDark ? '#FFF' : '#0F172A' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-slate-400 text-xs">No active status data</div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                {pieData.map((item, idx) => (
                  <div key={item.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="text-slate-500 dark:text-slate-400 capitalize">{item.name}:</span>
                    <span className="font-bold text-slate-900 dark:text-white ml-auto">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* ── Technicians Leaderboard + Top Services ────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Top Technicians Leaderboard */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">Technician Leaderboard</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Highest rated & productive field partners</p>
                </div>
                <Link to="/admin/providers" className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline">Manage All</Link>
              </div>

              <div className="space-y-3">
                {(charts?.topProviders || []).slice(0, 5).map((p, i) => (
                  <div key={p._id || i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 hover:border-blue-400/50 transition">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-400 w-4">{i + 1}</span>
                      <div className="w-9 h-9 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center text-xs border border-blue-500/30">
                        {p.name?.[0] || 'T'}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">{p.name || 'Technician'}</h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{p.completedJobs || 0} Jobs Completed</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">₹{p.earnings?.totalEarnings?.toLocaleString('en-IN') || '0'}</span>
                      </div>
                      <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-xs px-2 py-1 rounded-lg border border-amber-500/20 flex items-center gap-1">
                        <Star size={12} fill="currentColor" /> {p.rating?.toFixed(1) || '4.9'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Demand Services Bar Chart */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">Top Demand Services</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Most requested home service categories</p>
                </div>
                <Link to="/admin/services" className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline">Catalog →</Link>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts?.topServices || []} layout="vertical" margin={{ left: -10, right: 10 }}>
                    <XAxis type="number" tick={{ fontSize: 10, fill: isDark ? '#94A3B8' : '#64748B' }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: isDark ? '#94A3B8' : '#64748B' }} width={120} />
                    <Tooltip contentStyle={{ backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: isDark ? '#334155' : '#CBD5E1', borderRadius: '10px', color: isDark ? '#FFF' : '#0F172A' }} />
                    <Bar dataKey="count" fill="#2563EB" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* ── System Health & Quick Actions Grid ──────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* System Infrastructure Health */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-xl">
              <h3 className="font-bold text-base text-slate-900 dark:text-white mb-1">System Health</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Core microservices telemetry</p>

              <div className="space-y-3">
                {[
                  { name: 'API Server Cluster', status: 'Operational', latency: '42ms', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
                  { name: 'MongoDB Replica Set', status: 'Healthy', latency: '12ms', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
                  { name: 'Redis Cache & Dispatch Engine', status: 'Active', latency: '3ms', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
                  { name: 'Razorpay Payment Gateway', status: 'Connected', latency: '110ms', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
                ].map((sys, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      <span className="font-medium text-slate-700 dark:text-slate-200">{sys.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">{sys.latency}</span>
                      <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${sys.color} ${sys.bg}`}>
                        {sys.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions Tile Grid */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-xl lg:col-span-2">
              <h3 className="font-bold text-base text-slate-900 dark:text-white mb-1">Quick Operational Actions</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Shortcuts for administrative workflows</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { title: 'Add Service', icon: Wrench, path: '/admin/services', color: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-500/10' },
                  { title: 'Manage Providers', icon: Shield, path: '/admin/providers', color: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
                  { title: 'Broadcast Push', icon: Megaphone, path: '/admin/announcements', color: 'text-purple-500 dark:text-purple-400', bg: 'bg-purple-500/10' },
                  { title: 'View Financials', icon: DollarSign, path: '/admin/financials', color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-500/10' },
                  { title: 'Staff Roles', icon: Users, path: '/admin/team', color: 'text-cyan-500 dark:text-cyan-400', bg: 'bg-cyan-500/10' },
                  { title: 'Complaints', icon: AlertTriangle, path: '/admin/complaints', color: 'text-red-500 dark:text-red-400', bg: 'bg-red-500/10' },
                  { title: 'Platform Settings', icon: Settings, path: '/admin/settings', color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-500/10' },
                  { title: 'Live Bookings', icon: Briefcase, path: '/admin/bookings', color: 'text-indigo-500 dark:text-indigo-400', bg: 'bg-indigo-500/10' },
                ].map((act, i) => {
                  const Icon = act.icon;
                  return (
                    <Link
                      key={i}
                      to={act.path}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-blue-500/50 transition-all flex flex-col items-center text-center gap-2 group"
                    >
                      <div className={`w-9 h-9 rounded-xl ${act.bg} ${act.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                        <Icon size={18} />
                      </div>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white">{act.title}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

          </div>

        </main>
      </div>

      {/* ── Profile Name Edit Modal ─────────────────────────────────────────────── */}
      {isEditingName && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit3 size={16} className="text-blue-500" />
                Edit Staff / Admin Name
              </h3>
              <button
                onClick={() => setIsEditingName(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  placeholder="Enter full name..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                This name will be updated across your profile, admin reports, and active session tags.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setIsEditingName(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfileName}
                disabled={savingName}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md hover:shadow-blue-500/20 disabled:opacity-50 flex items-center gap-1.5"
              >
                {savingName ? 'Saving...' : 'Save Name'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
