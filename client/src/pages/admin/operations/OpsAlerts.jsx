import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import toast from 'react-hot-toast';

export default function OpsAlerts() {
  const nav = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const [severity, setSeverity] = useState('');
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ resolved: showResolved, limit: 100 });
      if (severity) params.set('severity', severity);
      const res = await api.get(`/operations/alerts?${params}`);
      setAlerts(res.data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [showResolved, severity]);

  useEffect(() => { load(); }, [load]);

  const handleResolve = async (id) => {
    try { await api.post(`/operations/alerts/${id}/resolve`); toast.success('Alert resolved'); load(); }
    catch (e) { toast.error('Failed'); }
  };

  const handleRead = async (id) => {
    try { await api.post(`/operations/alerts/${id}/read`); load(); }
    catch (e) { /* silent */ }
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      const res = await api.post('/operations/alerts/generate');
      toast.success(`Generated ${res.data.data?.length || 0} new alerts`);
      load();
    } catch (e) { toast.error('Failed to generate alerts'); }
    finally { setGenerating(false); }
  };

  const SEVERITY = {
    critical: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', color: '#ef4444', icon: '🔴', label: 'CRITICAL' },
    warning: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', color: '#f59e0b', icon: '🟡', label: 'WARNING' },
    info: { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)', color: '#3b82f6', icon: 'ℹ️', label: 'INFO' },
  };

  const TYPE_ICON = {
    unassigned_spike: '📋', provider_shortage: '🔧', high_demand: '🔥', complaint_spike: '⚠️',
    slow_response: '⏱️', staff_offline: '👤', system: '⚙️', provider_shortage_recruit: '🎯',
  };

  const criticalCount = alerts.filter(a => a.severity === 'critical' && !a.isResolved).length;
  const warningCount = alerts.filter(a => a.severity === 'warning' && !a.isResolved).length;

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <button onClick={() => nav('/admin/operations')} style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: 13 }}>← Back</button>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>🔔 Operations Alerts</h2>
        {criticalCount > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>{criticalCount} CRITICAL</span>}
        {warningCount > 0 && <span style={{ background: '#f59e0b', color: '#000', borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>{warningCount} WARNINGS</span>}

        <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
          <select value={severity} onChange={e => setSeverity(e.target.value)} style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.15)', color: '#e2e8f0', borderRadius: 8, padding: '5px 10px', fontSize: 12 }}>
            <option value=''>All Severity</option>
            <option value='critical'>Critical</option>
            <option value='warning'>Warning</option>
            <option value='info'>Info</option>
          </select>
          <button onClick={() => setShowResolved(r => !r)} style={{ background: showResolved ? 'rgba(100,116,139,0.2)' : 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#94a3b8', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>
            {showResolved ? 'Hide Resolved' : 'Show Resolved'}
          </button>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={handleGenerate} disabled={generating} style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            {generating ? '⚙️ Generating...' : '⚡ Run Alert Engine'}
          </button>
          <button onClick={load} style={{ background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13 }}>↻</button>
        </div>
      </div>

      <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
        {loading ? <div style={{ textAlign: 'center', padding: 80, color: '#64748b' }}>Loading alerts...</div> :
          alerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 80 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <div style={{ color: '#22c55e', fontSize: 16, fontWeight: 600 }}>No active alerts</div>
              <div style={{ color: '#64748b', fontSize: 13, marginTop: 8 }}>All operations are running smoothly</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {alerts.map(a => {
                const sev = SEVERITY[a.severity] || SEVERITY.info;
                return (
                  <div key={a._id} onClick={() => !a.isRead && handleRead(a._id)} style={{ background: sev.bg, border: `1px solid ${sev.border}`, borderRadius: 14, padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'flex-start', opacity: a.isResolved ? 0.6 : 1, cursor: !a.isRead ? 'pointer' : 'default' }}>
                    <div style={{ fontSize: 24, flexShrink: 0 }}>{TYPE_ICON[a.type] || '🔔'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: '#e2e8f0' }}>{a.title}</span>
                        <span style={{ background: `${sev.color}20`, border: `1px solid ${sev.color}40`, color: sev.color, borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>{sev.label}</span>
                        {!a.isRead && !a.isResolved && <span style={{ background: '#3b82f680', borderRadius: 20, padding: '1px 8px', fontSize: 11, color: '#93c5fd' }}>NEW</span>}
                        {a.isResolved && <span style={{ background: '#22c55e20', borderRadius: 20, padding: '1px 8px', fontSize: 11, color: '#22c55e' }}>✅ RESOLVED</span>}
                      </div>
                      <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>{a.message}</div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                        {a.stateName && <span style={{ fontSize: 12, color: '#60a5fa' }}>📍 {a.stateName}</span>}
                        {a.districtName && <span style={{ fontSize: 12, color: '#94a3b8' }}>/ {a.districtName}</span>}
                        <span style={{ fontSize: 12, color: '#475569' }}>{new Date(a.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                        {a.data && typeof a.data === 'object' && (
                          <span style={{ fontSize: 12, color: '#64748b' }}>
                            {Object.entries(a.data).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                          </span>
                        )}
                      </div>
                    </div>
                    {!a.isResolved && (
                      <button onClick={e => { e.stopPropagation(); handleResolve(a._id); }} style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>Resolve</button>
                    )}
                  </div>
                );
              })}
            </div>
          )
        }
      </div>
    </div>
  );
}
