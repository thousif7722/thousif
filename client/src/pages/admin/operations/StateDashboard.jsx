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
  const stateInfo = INDIA_STATES.find(s => s.code === stateCode?.toUpperCase()) || { code: stateCode, name: stateCode };

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/operations/analytics/state/${stateCode}`);
      setStateData(res.data.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [stateCode]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#64748b', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 40, marginBottom: 12 }}>🏴</div>Loading state data...</div>
    </div>
  );

  const d = stateData || {};

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={() => nav('/admin/operations')} style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: 13 }}>← Operations</button>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>🏴 {stateInfo.name} — State Dashboard</h2>
        <span style={{ background: 'rgba(96,165,250,0.2)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>{stateCode?.toUpperCase()}</span>
        <button onClick={() => nav(`/admin/operations/heatmap`)} style={{ marginLeft: 'auto', background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)', color: '#f97316', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}>🌡️ Heatmap</button>
        <button onClick={load} style={{ background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}>↻</button>
      </div>

      <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
        {/* Providers */}
        <h3 style={{ fontSize: 13, color: '#64748b', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Providers</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 24 }}>
          {[
            ['Total Providers', d.providers?.total, '#60a5fa'],
            ['Approved', d.providers?.approved, '#22c55e'],
            ['🟢 Online Now', d.providers?.online, '#22c55e'],
            ['⏳ Pending KYC', d.providers?.pending, '#f59e0b'],
          ].map(([label, value, color]) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color }}>{value ?? '—'}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Bookings */}
        <h3 style={{ fontSize: 13, color: '#64748b', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Today's Bookings</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 24 }}>
          {[
            ['Active Now', d.bookings?.active, '#f97316'],
            ['Completed', d.bookings?.completedToday, '#22c55e'],
            ['Cancelled', d.bookings?.cancelledToday, '#ef4444'],
            ['Revenue', d.revenue ? `₹${(d.revenue/100).toFixed(0)}` : '₹0', '#22c55e'],
            ['Open Complaints', d.openComplaints, '#f59e0b'],
            ['D/S Ratio', d.demandSupplyRatio ? `${d.demandSupplyRatio}x` : '—', d.demandSupplyRatio >= 3 ? '#ef4444' : '#22c55e'],
          ].map(([label, value, color]) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color }}>{value ?? '—'}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20 }}>
            <TrendChart data={d.bookingTrend} label="Bookings" />
          </div>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>Top Service Categories</div>
            {(d.topServices || []).map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: 13 }}>{s._id || 'Other'}</div>
                <div style={{ fontSize: 13, color: '#f97316', fontWeight: 700 }}>{s.count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Active Regions */}
        {d.regions?.length > 0 && (
          <>
            <h3 style={{ fontSize: 13, color: '#64748b', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Active Regions in {stateInfo.name}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
              {d.regions.map(r => (
                <div key={r._id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 16px' }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{r.code}</div>
                  <div style={{ fontSize: 12, color: '#22c55e', marginTop: 6 }}>{r.coverageLevel?.replace(/_/g, ' ')}</div>
                  {r.metrics && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 10, fontSize: 12 }}>
                      <span style={{ color: '#60a5fa' }}>🔧 {r.metrics.onlineProviders}</span>
                      <span style={{ color: '#f97316' }}>📋 {r.metrics.activeBookings}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
