import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';

export default function OpsAnalytics() {
  const nav = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('revenue');
  const [sortDir, setSortDir] = useState('desc');

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/operations/analytics/compare?sort=${sort}&order=${sortDir}`);
      setData(res.data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [sort, sortDir]);

  useEffect(() => { load(); }, [load]);

  const handleSort = (col) => {
    if (sort === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSort(col); setSortDir('desc'); }
  };

  const maxRev = Math.max(...data.map(d => d.revenue || 0), 1);
  const maxBook = Math.max(...data.map(d => d.bookings || 0), 1);

  const thStyle = (col) => ({
    padding: '10px 14px', textAlign: 'left', cursor: 'pointer', fontSize: 12,
    color: sort === col ? '#60a5fa' : '#64748b', fontWeight: 600,
    background: 'rgba(0,0,0,0.4)', borderBottom: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap',
  });
  const tdStyle = { padding: '10px 14px', fontSize: 13, color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.04)' };

  const BarCell = ({ value, max, color = '#3b82f6' }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3 }}>
        <div style={{ width: `${Math.max((value / max) * 100, 1)}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.5s' }} />
      </div>
      <span style={{ fontSize: 12, color: '#94a3b8', minWidth: 40, textAlign: 'right' }}>{value?.toLocaleString() || 0}</span>
    </div>
  );

  const RatioBadge = ({ ratio }) => {
    const status = ratio >= 5 ? ['CRITICAL','#ef4444'] : ratio >= 3 ? ['HIGH','#f97316'] : ratio >= 1.5 ? ['MOD','#f59e0b'] : ['OK','#22c55e'];
    return <span style={{ background: `${status[1]}20`, color: status[1], borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{status[0]} {ratio?.toFixed(1)}x</span>;
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={() => nav('/admin/operations')} style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: 13 }}>← Back</button>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>🔍 State-by-State Comparison</h2>
        <span style={{ fontSize: 12, color: '#64748b' }}>Today's performance. Click columns to sort.</span>
        <button onClick={load} style={{ marginLeft: 'auto', background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}>↻ Refresh</button>
      </div>

      <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
        {loading ? <div style={{ textAlign: 'center', padding: 80, color: '#64748b' }}>Loading comparison data...</div> : (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                <thead>
                  <tr>
                    {[['stateName','State/UT'],['providers','Providers'],['onlineProviders','Online'],['bookings','Bookings'],['completed','Completed'],['revenue','Revenue'],['demandSupplyRatio','D/S Ratio']].map(([col, label]) => (
                      <th key={col} style={thStyle(col)} onClick={() => handleSort(col)}>{label} {sort === col ? (sortDir === 'desc' ? '↓' : '↑') : ''}</th>
                    ))}
                    <th style={{ ...thStyle('action'), cursor: 'default' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => (
                    <tr key={row.stateCode} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600 }}>{row.stateName}</div>
                        <div style={{ fontSize: 11, color: '#475569' }}>{row.stateCode} · {row.type}</div>
                      </td>
                      <td style={tdStyle}>{row.providers}</td>
                      <td style={{ ...tdStyle }}>
                        <span style={{ color: row.onlineProviders > 0 ? '#22c55e' : '#475569' }}>{row.onlineProviders}</span>
                      </td>
                      <td style={{ ...tdStyle, minWidth: 150 }}>
                        <BarCell value={row.bookings} max={maxBook} color="#3b82f6" />
                      </td>
                      <td style={{ ...tdStyle, color: '#22c55e' }}>{row.completed}</td>
                      <td style={{ ...tdStyle, minWidth: 160 }}>
                        <BarCell value={row.revenue || 0} max={maxRev} color="#22c55e" />
                      </td>
                      <td style={tdStyle}><RatioBadge ratio={row.demandSupplyRatio} /></td>
                      <td style={tdStyle}>
                        <button onClick={() => nav(`/admin/operations/state/${row.stateCode}`)} style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa', borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}>View →</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
