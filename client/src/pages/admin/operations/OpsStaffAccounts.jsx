import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import toast from 'react-hot-toast';

export default function OpsStaffAccounts() {
  const nav = useNavigate();
  const [staff, setStaff] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [assignModal, setAssignModal] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'staff', department: '', geoRole: 'ops_staff', geoScope: 'state', stateCodes: '' });
  const [assignForm, setAssignForm] = useState({ geoRole: 'ops_staff', geoScope: 'state', stateCodes: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/operations/staff?page=${page}&limit=30`);
      setStaff(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    try {
      setSaving(true);
      const payload = { ...form, stateCodes: form.stateCodes ? form.stateCodes.split(',').map(s => s.trim().toUpperCase()) : [] };
      await api.post('/operations/staff', payload);
      toast.success('Staff account created');
      setShowCreate(false);
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleAssign = async () => {
    try {
      setSaving(true);
      const payload = { ...assignForm, stateCodes: assignForm.stateCodes ? assignForm.stateCodes.split(',').map(s => s.trim().toUpperCase()) : [] };
      await api.put(`/operations/staff/${assignModal._id}/assign`, payload);
      toast.success('Geographic access updated');
      setAssignModal(null);
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleStatus = async (id, status) => {
    try {
      await api.put(`/operations/staff/${id}/status`, { status });
      toast.success(`Status updated to ${status}`);
      load();
    } catch (e) { toast.error('Failed'); }
  };

  const ROLE_COLOR = { admin: '#8b5cf6', manager: '#3b82f6', team_leader: '#0ea5e9', staff: '#22c55e', executive: '#f59e0b', technician: '#f97316', intern: '#64748b' };
  const STATUS_DOT = { active: '#22c55e', resigned: '#ef4444', blocked: '#f59e0b' };
  const inputStyle = { background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', color: '#e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, width: '100%', boxSizing: 'border-box' };
  const thStyle = { padding: '10px 14px', textAlign: 'left', color: '#64748b', fontSize: 12, fontWeight: 600, background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap' };
  const tdStyle = { padding: '10px 14px', fontSize: 13, color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.05)' };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <button onClick={() => nav('/admin/operations')} style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: 13 }}>← Back</button>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>👥 Operations Staff Accounts ({total})</h2>
        <button onClick={() => setShowCreate(true)} style={{ marginLeft: 'auto', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>+ Create Staff</button>
      </div>

      <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
        {loading ? <div style={{ textAlign: 'center', padding: 80, color: '#64748b' }}>Loading staff...</div> : (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Name','Role','Department','Status','Geo Scope','States','Last Active','Actions'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {staff.map(s => (
                    <tr key={s._id}>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600 }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{s.email}</div>
                        {s.phone && <div style={{ fontSize: 11, color: '#64748b' }}>{s.phone}</div>}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ background: `${ROLE_COLOR[s.role] || '#64748b'}20`, border: `1px solid ${ROLE_COLOR[s.role] || '#64748b'}40`, color: ROLE_COLOR[s.role] || '#64748b', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{s.role}</span>
                      </td>
                      <td style={{ ...tdStyle, color: '#94a3b8' }}>{s.department || '—'}</td>
                      <td style={tdStyle}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_DOT[s.status] || '#64748b' }} />
                          {s.status || 'active'}
                        </span>
                      </td>
                      <td style={tdStyle}>{s.geoAssignment ? <span style={{ color: '#60a5fa' }}>{s.geoAssignment.scope}</span> : <span style={{ color: '#475569' }}>Not assigned</span>}</td>
                      <td style={{ ...tdStyle, maxWidth: 200 }}>
                        {s.geoAssignment?.stateCodes?.length ? <span style={{ fontSize: 12, color: '#94a3b8' }}>{s.geoAssignment.stateCodes.join(', ')}</span> : s.geoAssignment?.scope === 'country' ? <span style={{ color: '#22c55e', fontSize: 12 }}>All India</span> : <span style={{ color: '#475569', fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ ...tdStyle, color: '#64748b', fontSize: 12 }}>
                        {s.lastActiveAt ? new Date(s.lastActiveAt).toLocaleDateString() : 'Never'}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => { setAssignModal(s); setAssignForm({ geoRole: s.geoAssignment?.role || 'ops_staff', geoScope: s.geoAssignment?.scope || 'state', stateCodes: (s.geoAssignment?.stateCodes || []).join(', ') }); }} style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11 }}>Assign</button>
                          {s.status === 'active' ? (
                            <button onClick={() => handleStatus(s._id, 'blocked')} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11 }}>Suspend</button>
                          ) : (
                            <button onClick={() => handleStatus(s._id, 'active')} style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11 }}>Activate</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create Staff Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>➕ Create Staff Account</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[['name','Full Name *'],['email','Email *'],['phone','Phone'],['department','Department']].map(([key, label]) => (
                <div key={key} style={{ gridColumn: ['name','email'].includes(key) ? 'span 2' : 'span 1' }}>
                  <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>{label}</label>
                  <input value={form[key] || ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={inputStyle} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>System Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={inputStyle}>
                  {['admin','manager','team_leader','staff','executive','intern'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>Geo Role</label>
                <select value={form.geoRole} onChange={e => setForm(f => ({ ...f, geoRole: e.target.value }))} style={inputStyle}>
                  {['super_admin','state_manager','regional_manager','district_manager','city_manager','ops_staff','support_staff','finance_staff','kyc_staff'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>Geo Scope</label>
                <select value={form.geoScope} onChange={e => setForm(f => ({ ...f, geoScope: e.target.value }))} style={inputStyle}>
                  {['country','state','district','city','region'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>State Codes (e.g. TG,KA)</label>
                <input value={form.stateCodes} onChange={e => setForm(f => ({ ...f, stateCodes: e.target.value }))} placeholder="TG, KA, MH" style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button onClick={handleCreate} disabled={saving} style={{ flex: 1, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', borderRadius: 10, padding: '10px', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>{saving ? 'Creating...' : 'Create Account'}</button>
              <button onClick={() => setShowCreate(false)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Geo Modal */}
      {assignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>📍 Assign Geographic Access</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748b' }}>Staff: <strong style={{ color: '#e2e8f0' }}>{assignModal.name}</strong></p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>Geo Role</label>
                <select value={assignForm.geoRole} onChange={e => setAssignForm(f => ({ ...f, geoRole: e.target.value }))} style={inputStyle}>
                  {['super_admin','state_manager','regional_manager','district_manager','city_manager','ops_staff','support_staff','finance_staff','kyc_staff'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>Scope</label>
                <select value={assignForm.geoScope} onChange={e => setAssignForm(f => ({ ...f, geoScope: e.target.value }))} style={inputStyle}>
                  {['country','state','district','city','region'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {assignForm.geoScope !== 'country' && (
                <div>
                  <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>State Codes (comma separated, e.g. TG,KA)</label>
                  <input value={assignForm.stateCodes} onChange={e => setAssignForm(f => ({ ...f, stateCodes: e.target.value }))} placeholder="TG, KA, MH" style={inputStyle} />
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button onClick={handleAssign} disabled={saving} style={{ flex: 1, background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa', borderRadius: 10, padding: '10px', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>{saving ? 'Saving...' : 'Update Access'}</button>
              <button onClick={() => setAssignModal(null)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
