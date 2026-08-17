import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import toast from 'react-hot-toast';

export default function OperationalRegions() {
  const nav = useNavigate();
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterState, setFilterState] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editRegion, setEditRegion] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', stateCode: '', stateName: '', districtCode: '', districtName: '', description: '', targetProviders: 10, status: 'planned', serviceCategories: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page, limit: 30 });
      if (filterState) params.set('stateCode', filterState);
      if (filterStatus) params.set('status', filterStatus);
      const res = await api.get(`/operations/regions?${params}`);
      setRegions(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, filterState, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = { ...form, serviceCategories: form.serviceCategories ? form.serviceCategories.split(',').map(s => s.trim()) : [] };
      if (editRegion) { await api.put(`/operations/regions/${editRegion._id}`, payload); toast.success('Region updated'); }
      else { await api.post('/operations/regions', payload); toast.success('Region created'); }
      setShowCreate(false); setEditRegion(null);
      setForm({ name: '', code: '', stateCode: '', stateName: '', districtCode: '', districtName: '', description: '', targetProviders: 10, status: 'planned', serviceCategories: '' });
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to save region'); }
    finally { setSaving(false); }
  };

  const handleEdit = (r) => {
    setEditRegion(r);
    setForm({ name: r.name, code: r.code, stateCode: r.stateCode, stateName: r.stateName || '', districtCode: r.districtCode || '', districtName: r.districtName || '', description: r.description || '', targetProviders: r.targetProviders || 10, status: r.status, serviceCategories: (r.serviceCategories || []).join(', ') });
    setShowCreate(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this region?')) return;
    try { await api.delete(`/operations/regions/${id}`); toast.success('Region deleted'); load(); }
    catch (e) { toast.error(e.response?.data?.message || 'Cannot delete'); }
  };

  const STATUS_COLOR = { planned: '#64748b', active: '#22c55e', paused: '#f59e0b', closed: '#ef4444' };
  const COVERAGE_COLOR = { not_available: '#475569', launching: '#0ea5e9', limited: '#f59e0b', active: '#22c55e', high_demand: '#f97316', full_coverage: '#8b5cf6' };

  const inputStyle = { background: '#1e293b', border: '1px solid rgba(255,255,255,0.15)', color: '#e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, width: '100%', boxSizing: 'border-box' };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <button onClick={() => nav('/admin/operations')} style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: 13 }}>← Back</button>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>📍 Operational Regions ({total})</h2>
        <select value={filterState} onChange={e => setFilterState(e.target.value)} style={{ ...inputStyle, width: 140 }}>
          <option value=''>All States</option>
          {['AP','TG','KA','MH','GJ','UP','DL','TN','WB','BR','HR','PB'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inputStyle, width: 130 }}>
          <option value=''>All Status</option>
          {['planned','active','paused','closed'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => { setEditRegion(null); setForm({ name:'',code:'',stateCode:'',stateName:'',districtCode:'',districtName:'',description:'',targetProviders:10,status:'planned',serviceCategories:'' }); setShowCreate(true); }} style={{ marginLeft: 'auto', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>+ New Region</button>
      </div>

      <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
        {loading ? <div style={{ textAlign: 'center', padding: 80, color: '#64748b' }}>Loading regions...</div> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
            {regions.map(r => (
              <div key={r._id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Code: <strong style={{ color: '#94a3b8' }}>{r.code}</strong></div>
                  </div>
                  <span style={{ background: `${STATUS_COLOR[r.status]}20`, border: `1px solid ${STATUS_COLOR[r.status]}40`, color: STATUS_COLOR[r.status], borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{r.status.toUpperCase()}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: '#60a5fa' }}>📍 {r.stateName || r.stateCode}</span>
                  {r.districtName && <span style={{ fontSize: 12, color: '#94a3b8' }}>/ {r.districtName}</span>}
                  {r.cityName && <span style={{ fontSize: 12, color: '#94a3b8' }}>/ {r.cityName}</span>}
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ background: `${COVERAGE_COLOR[r.coverageLevel || 'not_available']}20`, border: `1px solid ${COVERAGE_COLOR[r.coverageLevel || 'not_available']}40`, color: COVERAGE_COLOR[r.coverageLevel || 'not_available'], borderRadius: 20, padding: '2px 8px', fontSize: 11 }}>{(r.coverageLevel || 'not_available').replace(/_/g,' ')}</span>
                  <span style={{ fontSize: 12, color: '#64748b' }}>Target: {r.targetProviders} providers</span>
                </div>
                {r.managerId && <div style={{ fontSize: 12, color: '#94a3b8' }}>Manager: {r.managerId.name}</div>}
                {r.metrics?.lastUpdated && (
                  <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                    <span style={{ color: '#22c55e' }}>🔧 {r.metrics.onlineProviders} online</span>
                    <span style={{ color: '#f97316' }}>📋 {r.metrics.activeBookings} active</span>
                    <span style={{ color: '#60a5fa' }}>💰 ₹{r.metrics.todayRevenue}</span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button onClick={() => handleEdit(r)} style={{ flex: 1, background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa', borderRadius: 8, padding: '6px', cursor: 'pointer', fontSize: 12 }}>✏️ Edit</button>
                  <button onClick={() => handleDelete(r._id)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > 30 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#e2e8f0', borderRadius: 8, padding: '6px 16px', cursor: 'pointer' }}>← Prev</button>
            <span style={{ color: '#94a3b8', alignSelf: 'center', fontSize: 13 }}>Page {page} of {Math.ceil(total/30)}</span>
            <button onClick={() => setPage(p => p+1)} disabled={regions.length < 30} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#e2e8f0', borderRadius: 8, padding: '6px 16px', cursor: 'pointer' }}>Next →</button>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>{editRegion ? '✏️ Edit Region' : '➕ New Operational Region'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[['name','Region Name *','text'],['code','Region Code *','text'],['stateCode','State Code (e.g. TG) *','text'],['stateName','State Full Name','text'],['districtCode','District Code','text'],['districtName','District Name','text'],['cityCode','City Code','text'],['cityName','City Name','text']].map(([key, label, type]) => (
                <div key={key} style={{ gridColumn: ['name','stateCode','stateName'].includes(key) ? 'span 2' : 'span 1' }}>
                  <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>{label}</label>
                  <input type={type} value={form[key] || ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={inputStyle} />
                </div>
              ))}
              <div style={{ gridColumn: 'span 1' }}>
                <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
                  {['planned','active','paused','closed'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: 'span 1' }}>
                <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>Target Providers</label>
                <input type="number" min="1" value={form.targetProviders} onChange={e => setForm(f => ({ ...f, targetProviders: parseInt(e.target.value) }))} style={inputStyle} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>Service Categories (comma separated)</label>
                <input value={form.serviceCategories} onChange={e => setForm(f => ({ ...f, serviceCategories: e.target.value }))} placeholder="AC Repair, Cleaning, Plumbing" style={inputStyle} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>Notes</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button onClick={handleSave} disabled={saving} style={{ flex: 1, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', borderRadius: 10, padding: '10px', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                {saving ? 'Saving...' : editRegion ? 'Update Region' : 'Create Region'}
              </button>
              <button onClick={() => { setShowCreate(false); setEditRegion(null); }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
