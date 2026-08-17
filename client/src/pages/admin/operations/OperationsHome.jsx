import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import { getSocket } from '@/services/socket';

const SEVERITY_COLOR = { critical: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };
const STATUS_COLOR = { pending: '#f59e0b', assigned: '#3b82f6', accepted: '#8b5cf6', in_progress: '#f97316', completed: '#22c55e', paid: '#22c55e', cancelled: '#6b7280', disputed: '#ef4444' };

function StatCard({ title, value, sub, color = '#3b82f6', icon }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        <span>{icon}</span>{title}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value != null ? value.toLocaleString() : '—'}</div>
      {sub && <div style={{ fontSize: 11, color: '#64748b' }}>{sub}</div>}
    </div>
  );
}

function AlertBadge({ severity, count }) {
  if (!count) return null;
  return <span style={{ background: SEVERITY_COLOR[severity] || '#6b7280', color: '#fff', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{count}</span>;
}

export default function OperationsHome() {
  const nav = useNavigate();
  const [overview, setOverview] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [liveMetrics, setLiveMetrics] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const load = useCallback(async () => {
    try {
      const [ov, al] = await Promise.all([
        api.get('/operations/overview'),
        api.get('/operations/alerts?limit=5'),
      ]);
      setOverview(ov.data.data);
      setAlerts(al.data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const sock = getSocket();
    if (sock) {
      sock.on('ops:live_metrics', data => setLiveMetrics(data));
      sock.on('ops:alert', alert => setAlerts(prev => [alert, ...prev].slice(0, 10)));
    }
    return () => { if (sock) { sock.off('ops:live_metrics'); sock.off('ops:alert'); } };
  }, [load]);

  const resolveAlert = async (id) => {
    await api.post(`/operations/alerts/${id}/resolve`);
    setAlerts(prev => prev.filter(a => a._id !== id));
  };

  const ov = overview || {};
  const active = liveMetrics.activeBookings ?? ov.activeBookings;
  const onlineProv = liveMetrics.onlineProviders ?? ov.onlineProviders;

  const tabs = [
    { id: 'overview', label: '🏠 Overview' },
    { id: 'heatmap', label: '🌡️ Heatmap', path: '/admin/operations/heatmap' },
    { id: 'regions', label: '📍 Regions', path: '/admin/operations/regions' },
    { id: 'staff', label: '👥 Staff', path: '/admin/operations/staff' },
    { id: 'coverage', label: '📊 Coverage', path: '/admin/operations/coverage' },
    { id: 'alerts', label: '🔔 Alerts', path: '/admin/operations/alerts' },
    { id: 'compare', label: '🔍 Compare', path: '/admin/operations/compare' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)', color: '#e2e8f0', fontFamily: "'Inter', sans-serif", padding: '0 0 40px 0' }}>
      {/* Header */}
      <div style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)', padding: '20px 32px', borderBottom: '1px solid rgba(255,255,255,0.1)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, background: 'linear-gradient(90deg, #60a5fa, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              🇮🇳 India Operations Command Center
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b', marginTop: 2 }}>
              OneWayFix — Nationwide Real-Time Operations Dashboard
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 20, padding: '4px 12px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: 12, color: '#22c55e' }}>Live</span>
            </div>
            <button onClick={load} style={{ background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}>
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* Nav Tabs */}
        <div style={{ display: 'flex', gap: 4, marginTop: 16, flexWrap: 'wrap' }}>
          {tabs.map(t => (
            <button key={t.id}
              onClick={() => t.path ? nav(t.path) : setActiveTab(t.id)}
              style={{ background: activeTab === t.id ? 'rgba(96,165,250,0.2)' : 'transparent', border: activeTab === t.id ? '1px solid rgba(96,165,250,0.5)' : '1px solid transparent', color: activeTab === t.id ? '#60a5fa' : '#94a3b8', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'all 0.2s' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200, color: '#64748b' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12, animation: 'spin 1s linear infinite' }}>⚙️</div>
              Loading operations data...
            </div>
          </div>
        ) : (
          <>
            {/* Live Metrics Banner */}
            {(liveMetrics.timestamp) && (
              <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, padding: '10px 18px', marginBottom: 20, display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 600 }}>⚡ LIVE UPDATE</span>
                <span style={{ fontSize: 13, color: '#a7f3d0' }}>Active Bookings: <strong>{liveMetrics.activeBookings}</strong></span>
                <span style={{ fontSize: 13, color: '#a7f3d0' }}>Online Providers: <strong>{liveMetrics.onlineProviders}</strong></span>
                <span style={{ fontSize: 13, color: '#a7f3d0' }}>Unassigned: <strong style={{ color: liveMetrics.unassigned > 10 ? '#f87171' : '#a7f3d0' }}>{liveMetrics.unassigned}</strong></span>
                <span style={{ fontSize: 11, color: '#64748b', marginLeft: 'auto' }}>Updated {new Date(liveMetrics.timestamp).toLocaleTimeString()}</span>
              </div>
            )}

            {/* Alerts Panel */}
            {alerts.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#94a3b8', fontWeight: 600 }}>🔔 Active Alerts</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {alerts.slice(0, 5).map(a => (
                    <div key={a._id} style={{ background: `${SEVERITY_COLOR[a.severity]}15`, border: `1px solid ${SEVERITY_COLOR[a.severity]}40`, borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <span style={{ fontSize: 18 }}>{a.severity === 'critical' ? '🔴' : a.severity === 'warning' ? '🟡' : 'ℹ️'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{a.title}</div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{a.message}</div>
                      </div>
                      <button onClick={() => resolveAlert(a._id)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#94a3b8', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>Resolve</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* KPI Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 28 }}>
              <StatCard icon="📋" title="Active Bookings" value={active} color="#f97316" sub="Right now" />
              <StatCard icon="⏳" title="Unassigned" value={liveMetrics.unassigned ?? ov.unassignedBookings} color={ov.unassignedBookings > 10 ? '#ef4444' : '#f59e0b'} sub="Need provider" />
              <StatCard icon="✅" title="Completed Today" value={ov.todayCompleted} color="#22c55e" sub="Since midnight" />
              <StatCard icon="🔧" title="Online Providers" value={onlineProv} color="#60a5fa" sub={`of ${ov.approvedProviders} approved`} />
              <StatCard icon="👥" title="Total Providers" value={ov.totalProviders} color="#8b5cf6" sub={`${ov.pendingApplications} pending`} />
              <StatCard icon="🛒" title="Total Customers" value={ov.totalCustomers} color="#ec4899" sub="Registered" />
              <StatCard icon="💰" title="Today Revenue" value={ov.todayRevenue ? `₹${(ov.todayRevenue/100).toLocaleString()}` : '₹0'} color="#22c55e" />
              <StatCard icon="⚠️" title="Open Complaints" value={ov.openComplaints} color={ov.openComplaints > 20 ? '#ef4444' : '#f59e0b'} />
              <StatCard icon="📍" title="Active Regions" value={ov.activeRegions} color="#0ea5e9" sub="Operational zones" />
              <StatCard icon="🔔" title="Unread Alerts" value={liveMetrics.alertCount ?? ov.activeAlerts} color="#f59e0b" />
            </div>

            {/* Top States & All India State Matrix */}
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 24, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>🇮🇳 India Operational State Matrix (36 States & UTs)</h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#64748b', marginTop: 2 }}>Click any state to launch state-level operations dashboard</p>
                </div>
                <button onClick={() => nav('/admin/operations/heatmap')} style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)', color: '#f97316', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  🌡️ Launch Full Heatmap →
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                {[
                  { code: 'AP', name: 'Andhra Pradesh' }, { code: 'TG', name: 'Telangana' }, { code: 'KA', name: 'Karnataka' },
                  { code: 'MH', name: 'Maharashtra' }, { code: 'GJ', name: 'Gujarat' }, { code: 'RJ', name: 'Rajasthan' },
                  { code: 'UP', name: 'Uttar Pradesh' }, { code: 'DL', name: 'Delhi NCR' }, { code: 'TN', name: 'Tamil Nadu' },
                  { code: 'WB', name: 'West Bengal' }, { code: 'BR', name: 'Bihar' }, { code: 'HR', name: 'Haryana' },
                  { code: 'PB', name: 'Punjab' }, { code: 'MP', name: 'Madhya Pradesh' }, { code: 'OD', name: 'Odisha' },
                  { code: 'KL', name: 'Kerala' }, { code: 'JH', name: 'Jharkhand' }, { code: 'CG', name: 'Chhattisgarh' },
                  { code: 'AS', name: 'Assam' }, { code: 'HP', name: 'Himachal' }, { code: 'UK', name: 'Uttarakhand' },
                  { code: 'GA', name: 'Goa' }, { code: 'JK', name: 'J&K' }, { code: 'LA', name: 'Ladakh' },
                  { code: 'CH', name: 'Chandigarh' }, { code: 'PY', name: 'Puducherry' }, { code: 'SK', name: 'Sikkim' },
                  { code: 'TR', name: 'Tripura' }, { code: 'MN', name: 'Manipur' }, { code: 'MZ', name: 'Mizoram' },
                  { code: 'NL', name: 'Nagaland' }, { code: 'AR', name: 'Arunachal' }, { code: 'ML', name: 'Meghalaya' },
                  { code: 'AN', name: 'Andaman & Nicobar' }, { code: 'DN', name: 'Dadra & Nagar Haveli' }, { code: 'LD', name: 'Lakshadweep' }
                ].map((s) => {
                  const stateData = (ov.topStates || []).find(st => st._id?.toLowerCase() === s.name.toLowerCase() || st._id?.toLowerCase() === s.code.toLowerCase());
                  const count = stateData?.count || 0;
                  return (
                    <div key={s.code} onClick={() => nav(`/admin/operations/state/${s.code}`)}
                      style={{ background: count > 0 ? 'rgba(249,115,22,0.12)' : 'rgba(255,255,255,0.03)', border: count > 0 ? '1px solid rgba(249,115,22,0.3)' : '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', transition: 'all 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa' }}>{s.code}</span>
                        {count > 0 && <span style={{ background: 'rgba(249,115,22,0.3)', color: '#f97316', fontSize: 10, fontWeight: 700, borderRadius: 10, padding: '1px 6px' }}>{count} live</span>}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                      <div style={{ fontSize: 10, color: count > 0 ? '#22c55e' : '#64748b', marginTop: 2 }}>{count > 0 ? `${count} Active Jobs` : 'Coverage Ready'}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {[
                { label: '🗺️ Booking Heatmap', desc: 'Live demand visualization', path: '/admin/operations/heatmap', color: '#f97316' },
                { label: '🔧 Provider Map', desc: 'Live provider positions', path: '/admin/operations/heatmap?layer=providers', color: '#3b82f6' },
                { label: '🏴 State Analytics', desc: 'Per-state dashboards', path: '/admin/operations/compare', color: '#8b5cf6' },
                { label: '📍 Manage Regions', desc: '289 configurable zones', path: '/admin/operations/regions', color: '#22c55e' },
                { label: '👥 Staff Accounts', desc: 'Geographic assignments', path: '/admin/operations/staff', color: '#ec4899' },
                { label: '📈 D/S Coverage', desc: 'Demand/Supply ratios', path: '/admin/operations/coverage', color: '#f59e0b' },
              ].map(a => (
                <div key={a.path} onClick={() => nav(a.path)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '18px 20px', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${a.color}15`; e.currentTarget.style.borderColor = `${a.color}40`; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{a.label}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{a.desc}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  );
}
