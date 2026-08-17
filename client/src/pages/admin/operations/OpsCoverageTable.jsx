import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';

const INDIA_STATES = [
  { code: 'AP', name: 'Andhra Pradesh' }, { code: 'TG', name: 'Telangana' }, { code: 'KA', name: 'Karnataka' },
  { code: 'MH', name: 'Maharashtra' }, { code: 'GJ', name: 'Gujarat' }, { code: 'RJ', name: 'Rajasthan' },
  { code: 'UP', name: 'Uttar Pradesh' }, { code: 'DL', name: 'Delhi' }, { code: 'TN', name: 'Tamil Nadu' },
  { code: 'WB', name: 'West Bengal' }, { code: 'BR', name: 'Bihar' }, { code: 'HR', name: 'Haryana' },
  { code: 'PB', name: 'Punjab' }, { code: 'MP', name: 'Madhya Pradesh' }, { code: 'OD', name: 'Odisha' },
  { code: 'KL', name: 'Kerala' }, { code: 'JH', name: 'Jharkhand' }, { code: 'CG', name: 'Chhattisgarh' },
];

function CoverageBar({ value, max = 100 }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : pct >= 20 ? '#f97316' : '#ef4444';
  return (
    <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.5s' }} />
    </div>
  );
}

function RatioBadge({ ratio }) {
  const status = ratio >= 5 ? 'CRITICAL' : ratio >= 3 ? 'HIGH' : ratio >= 1.5 ? 'MODERATE' : 'HEALTHY';
  const color = { CRITICAL: '#ef4444', HIGH: '#f97316', MODERATE: '#f59e0b', HEALTHY: '#22c55e' }[status];
  return <span style={{ background: `${color}20`, border: `1px solid ${color}40`, color, borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{status} {ratio?.toFixed(1)}x</span>;
}

export default function OpsCoverageTable() {
  const nav = useNavigate();
  const [data, setData] = useState([]);
  const [states, setStates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('demand');
  const [sortDir, setSortDir] = useState('desc');
  const [tab, setTab] = useState('cities');

  const load = useCallback(async () => {
    try {
      const [cov, st] = await Promise.all([
        api.get('/operations/coverage'),
        api.get('/operations/geo/states'),
      ]);
      setData(cov.data.data || []);
      setStates(st.data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sortedData = [...data].sort((a, b) => sortDir === 'desc' ? b[sort] - a[sort] : a[sort] - b[sort]);
  const sortedStates = [...states].sort((a, b) => sortDir === 'desc' ? b[sort] - a[sort] : a[sort] - b[sort]);

  const handleSort = (col) => {
    if (sort === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSort(col); setSortDir('desc'); }
  };

  const thStyle = (col) => ({
    padding: '10px 12px', textAlign: 'left', cursor: 'pointer',
    color: sort === col ? '#60a5fa' : '#64748b', fontSize: 12, fontWeight: 600,
    background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.1)',
    userSelect: 'none', whiteSpace: 'nowrap',
  });
  const tdStyle = { padding: '10px 12px', fontSize: 13, color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.05)' };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={() => nav('/admin/operations')} style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: 13 }}>← Back</button>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>📊 Demand vs Supply Coverage</h2>
        <div style={{ display: 'flex', gap: 4, marginLeft: 24 }}>
          {[['cities','City Coverage'], ['states','State Overview']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ background: tab === id ? 'rgba(96,165,250,0.2)' : 'transparent', border: tab === id ? '1px solid rgba(96,165,250,0.4)' : '1px solid transparent', color: tab === id ? '#60a5fa' : '#94a3b8', borderRadius: 8, padding: '5px 14px', cursor: 'pointer', fontSize: 13 }}>{label}</button>
          ))}
        </div>
        <button onClick={load} style={{ marginLeft: 'auto', background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}>↻ Refresh</button>
      </div>

      <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            ['🔴 Critical Zones', data.filter(d => d.status === 'critical').length, '#ef4444'],
            ['🟠 High Demand', data.filter(d => d.status === 'high_demand').length, '#f97316'],
            ['🟡 Moderate', data.filter(d => d.status === 'moderate').length, '#f59e0b'],
            ['🟢 Healthy', data.filter(d => d.status === 'healthy').length, '#22c55e'],
            ['Total Cities', data.length, '#60a5fa'],
          ].map(([label, val, color]) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color }}>{val}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: 80, color: '#64748b' }}>Loading coverage data...</div> : (
          <>
            {tab === 'cities' && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {[['city','City'], ['state','State'], ['demand','Active Demand'], ['onlineProviders','Online Providers'], ['totalProviders','Total Providers'], ['demandSupplyRatio','D/S Ratio'], ['coverageScore','Coverage']].map(([col, label]) => (
                          <th key={col} style={thStyle(col)} onClick={() => handleSort(col)}>{label} {sort === col ? (sortDir === 'desc' ? '↓' : '↑') : ''}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedData.map((row, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{row.city || '—'}</td>
                          <td style={{ ...tdStyle, color: '#64748b' }}>{row.state}</td>
                          <td style={{ ...tdStyle, color: '#f97316', fontWeight: 700 }}>{row.demand}</td>
                          <td style={{ ...tdStyle, color: '#22c55e' }}>{row.onlineProviders}</td>
                          <td style={{ ...tdStyle }}>{row.totalProviders}</td>
                          <td style={tdStyle}><RatioBadge ratio={row.demandSupplyRatio} /></td>
                          <td style={{ ...tdStyle, minWidth: 120 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <CoverageBar value={row.coverageScore} />
                              <span style={{ fontSize: 12, color: '#94a3b8', minWidth: 32 }}>{row.coverageScore}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'states' && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {[['stateName','State'], ['providers','Providers'], ['onlineProviders','Online'], ['totalBookings','Bookings'], ['activeBookings','Active'], ['revenue','Revenue'], ['demandSupplyRatio','D/S Ratio'], ['coverageScore','Coverage']].map(([col, label]) => (
                          <th key={col} style={thStyle(col)} onClick={() => handleSort(col)}>{label} {sort === col ? (sortDir === 'desc' ? '↓' : '↑') : ''}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedStates.map((s, i) => (
                        <tr key={i} onClick={() => nav(`/admin/operations/state/${s.code}`)} style={{ cursor: 'pointer', background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(96,165,250,0.05)'}
                          onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent'}>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{s.name} <span style={{ fontSize: 11, color: '#64748b' }}>({s.code})</span></td>
                          <td style={tdStyle}>{s.providers || 0}</td>
                          <td style={{ ...tdStyle, color: '#22c55e' }}>{s.onlineProviders || 0}</td>
                          <td style={tdStyle}>{s.totalBookings || 0}</td>
                          <td style={{ ...tdStyle, color: '#f97316' }}>{s.activeBookings || 0}</td>
                          <td style={{ ...tdStyle, color: '#22c55e' }}>{s.revenue ? `₹${(s.revenue/100).toFixed(0)}` : '—'}</td>
                          <td style={tdStyle}><RatioBadge ratio={s.demandSupplyRatio} /></td>
                          <td style={{ ...tdStyle, minWidth: 120 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <CoverageBar value={s.coverageScore || 0} />
                              <span style={{ fontSize: 12, color: '#94a3b8', minWidth: 32 }}>{s.coverageScore || 0}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
