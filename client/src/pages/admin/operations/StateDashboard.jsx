import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '@/services/api';
import { getSocket } from '@/services/socket';

const INDIA_STATES = [
  { code: 'AP', name: 'Andhra Pradesh' }, { code: 'TG', name: 'Telangana' }, { code: 'KA', name: 'Karnataka' },
  { code: 'MH', name: 'Maharashtra' }, { code: 'GJ', name: 'Gujarat' }, { code: 'RJ', name: 'Rajasthan' },
  { code: 'UP', name: 'Uttar Pradesh' }, { code: 'DL', name: 'Delhi' }, { code: 'TN', name: 'Tamil Nadu' },
  { code: 'WB', name: 'West Bengal' }, { code: 'BR', name: 'Bihar' }, { code: 'HR', name: 'Haryana' },
  { code: 'PB', name: 'Punjab' }, { code: 'MP', name: 'Madhya Pradesh' }, { code: 'OD', name: 'Odisha' },
  { code: 'KL', name: 'Kerala' }, { code: 'JH', name: 'Jharkhand' }, { code: 'CG', name: 'Chhattisgarh' },
  { code: 'AS', name: 'Assam' }, { code: 'HP', name: 'Himachal Pradesh' }, { code: 'UK', name: 'Uttarakhand' },
  { code: 'GA', name: 'Goa' }, { code: 'MN', name: 'Manipur' }, { code: 'MZ', name: 'Mizoram' },
  { code: 'NL', name: 'Nagaland' }, { code: 'SK', name: 'Sikkim' }, { code: 'TR', name: 'Tripura' },
  { code: 'AR', name: 'Arunachal Pradesh' }, { code: 'ML', name: 'Meghalaya' },
  { code: 'AN', name: 'Andaman & Nicobar' }, { code: 'CH', name: 'Chandigarh' },
  { code: 'DN', name: 'Dadra & NH' }, { code: 'JK', name: 'J&K' }, { code: 'LA', name: 'Ladakh' },
  { code: 'LD', name: 'Lakshadweep' }, { code: 'PY', name: 'Puducherry' },
];

function TrendChart({ data, label }) {
  if (!data || data.length === 0) return <div style={{ color: '#475569', fontSize: 12 }}>No trend data</div>;
  const max = Math.max(...data.map(d => d.count || 0), 1);
  return (
    <div>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{label} (Last 7 days)</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60 }}>
        {data.map((d, i) => {
          const h = Math.max(((d.count || 0) / max) * 56, 2);
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ width: '100%', height: h, background: 'rgba(96,165,250,0.6)', borderRadius: '3px 3px 0 0', transition: 'height 0.5s' }} title={`${d._id}: ${d.count}`} />
              <div style={{ fontSize: 10, color: '#475569', transform: 'rotate(-45deg)', transformOrigin: 'center', whiteSpace: 'nowrap' }}>{d._id?.slice(5)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function StateDashboard() {
  const { stateCode } = useParams();
  const nav = useNavigate();
  const [stateData, setStateData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('today');
  const stateInfo = INDIA_STATES.find(s => s.code === stateCode?.toUpperCase()) || { code: stateCode, name: stateCode };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/operations/analytics/state/${stateCode}?period=${period}`);
      setStateData(res.data.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [stateCode, period]);

  useEffect(() => { load(); }, [load]);

  if (loading && !stateData) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#64748b', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 40, marginBottom: 12 }}>🏴</div>Loading state data...</div>
    </div>
  );

  const d = stateData || {};
  const ratio = d.demandSupplyRatio || 0;
  const ratioColor = ratio > 3 ? '#ef4444' : ratio >= 2 ? '#f97316' : ratio >= 1 ? '#f59e0b' : '#22c55e';
  const ratioText = ratio > 3 ? 'CRITICAL' : ratio >= 2 ? 'HIGH' : ratio >= 1 ? 'MODERATE' : 'HEALTHY';

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: "'Inter', sans-serif", paddingBottom: 40 }}>
      {/* Top Bar */}
      <div style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <button onClick={() => nav('/admin/operations')} style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>← Operations</button>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>🏴 {stateInfo.name} — State Dashboard</h2>
        <span style={{ background: 'rgba(96,165,250,0.2)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>{stateCode?.toUpperCase()}</span>

        {/* Time Period Filter */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 3, marginLeft: 'auto' }}>
          {['today', '7d', '30d'].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{ background: period === p ? 'rgba(96,165,250,0.3)' : 'transparent', border: 'none', color: period === p ? '#fff' : '#94a3b8', borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {p === 'today' ? 'Today' : p === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
            </button>
          ))}
        </div>

        <button onClick={() => nav(`/admin/operations/heatmap?state=${stateCode}`)} style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)', color: '#f97316', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}>🌡️ State Heatmap</button>
        <button onClick={load} style={{ background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}>↻ Refresh</button>
      </div>

      <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>

        {/* Operational Overview Cards */}
        <h3 style={{ fontSize: 13, color: '#64748b', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>State Operational Metrics ({period.toUpperCase()})</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10, marginBottom: 24 }}>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#f97316' }}>{d.bookings?.active ?? '—'}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>📋 Active Bookings</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: d.bookings?.unassigned > 5 ? '#ef4444' : '#f59e0b' }}>{d.bookings?.unassigned ?? '—'}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>⏳ Unassigned Queue</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#22c55e' }}>{d.providers?.online ?? '—'}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>🟢 Online Technicians</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: ratioColor }}>{ratio}x <span style={{ fontSize: 11, fontWeight: 600 }}>({ratioText})</span></div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>📈 D/S Ratio</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#60a5fa' }}>{d.avgResponseTimeMin ?? 14} min</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>⏱️ Avg Response Time</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: d.cancellationRate > 15 ? '#ef4444' : '#22c55e' }}>{d.cancellationRate ?? 0}%</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>🚫 Cancellation Rate</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#22c55e' }}>{d.revenue ? `₹${(d.revenue/100).toLocaleString()}` : '₹0'}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>💰 Revenue ({period})</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#8b5cf6' }}>{d.staffCount ?? 0}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>👥 Staff Accounts</div>
          </div>
        </div>

        {/* Charts & Trends */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20 }}>
            <TrendChart data={d.bookingTrend} label="Booking Volume Trend" />
          </div>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12, fontWeight: 600 }}>Top Service Categories ({stateInfo.name})</div>
            {(!d.topServices || d.topServices.length === 0) ? (
              <div style={{ color: '#475569', fontSize: 12 }}>No live service category data available</div>
            ) : (
              d.topServices.map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: 13, textTransform: 'capitalize' }}>{s._id || 'General Service'}</div>
                  <div style={{ fontSize: 13, color: '#f97316', fontWeight: 700 }}>{s.count} bookings</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* City Operations Breakdown Table */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20, marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 700, margin: '0 0 16px' }}>🏙️ City Operational Breakdown in {stateInfo.name}</h3>
          {(!d.cities || d.cities.length === 0) ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: '#64748b', fontSize: 13 }}>No live operational city data available for this state</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#64748b', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>City Name</th>
                    <th style={{ padding: '10px 12px' }}>Active Bookings</th>
                    <th style={{ padding: '10px 12px' }}>Total Bookings</th>
                    <th style={{ padding: '10px 12px' }}>Completed</th>
                    <th style={{ padding: '10px 12px' }}>Cancelled</th>
                    <th style={{ padding: '10px 12px' }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {d.cities.map((c, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#60a5fa' }}>{c.city}</td>
                      <td style={{ padding: '10px 12px', color: c.activeBookings > 0 ? '#f97316' : '#94a3b8', fontWeight: 700 }}>{c.activeBookings}</td>
                      <td style={{ padding: '10px 12px' }}>{c.totalBookings}</td>
                      <td style={{ padding: '10px 12px', color: '#22c55e' }}>{c.completedBookings}</td>
                      <td style={{ padding: '10px 12px', color: c.cancelledBookings > 0 ? '#ef4444' : '#94a3b8' }}>{c.cancelledBookings}</td>
                      <td style={{ padding: '10px 12px', color: '#22c55e' }}>₹{(c.revenue/100).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Operational Regions */}
        <h3 style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 700, margin: '0 0 12px' }}>📍 Operational Regions ({d.regions?.length || 0})</h3>
        {(!d.regions || d.regions.length === 0) ? (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 12, padding: 24, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
            No configured operational regions for {stateInfo.name}. You can create regions in the <span onClick={() => nav('/admin/operations/regions')} style={{ color: '#60a5fa', cursor: 'pointer', textDecoration: 'underline' }}>Regions Console</span>.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {d.regions.map(r => (
              <div key={r._id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#e2e8f0' }}>{r.name}</div>
                  <span style={{ background: r.status === 'active' ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)', color: r.status === 'active' ? '#22c55e' : '#f59e0b', fontSize: 11, fontWeight: 700, borderRadius: 12, padding: '2px 8px' }}>{r.status}</span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{r.code} {r.cityName ? `• ${r.cityName}` : ''}</div>
                {r.managerId && <div style={{ fontSize: 12, color: '#60a5fa', marginTop: 6 }}>Manager: {r.managerId.name}</div>}
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>Target Providers: <strong>{r.targetProviders || 10}</strong></div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
