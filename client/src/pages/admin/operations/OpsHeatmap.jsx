import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '@/services/api';
import { getSocket } from '@/services/socket';

// Fix Leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const STATUS_COLOR = {
  pending: '#f59e0b', assigned: '#3b82f6', accepted: '#8b5cf6',
  in_progress: '#f97316', completed: '#22c55e', paid: '#22c55e',
  cancelled: '#6b7280', disputed: '#ef4444',
};

const CITY_STATE_MAP = {
  'Delhi': 'DL', 'New Delhi': 'DL', 'Mumbai': 'MH', 'Pune': 'MH', 'Bengaluru': 'KA', 'Bangalore': 'KA',
  'Hyderabad': 'TG', 'Chennai': 'TN', 'Kolkata': 'WB', 'Ahmedabad': 'GJ', 'Jaipur': 'RJ', 'Lucknow': 'UP',
  'Chandigarh': 'CH', 'Patna': 'BR', 'Kochi': 'KL', 'Guwahati': 'AS', 'Bhubaneswar': 'OD', 'Ranchi': 'JH',
  'Noida': 'UP', 'Gurugram': 'HR', 'Ghaziabad': 'UP', 'Faridabad': 'HR', 'Surat': 'GJ', 'Vadodara': 'GJ'
};

function MapViewUpdater({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, zoom || map.getZoom());
  }, [center, zoom, map]);
  return null;
}

export default function OpsHeatmap() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const [bookingPoints, setBookingPoints] = useState([]);
  const [providerPoints, setProviderPoints] = useState([]);
  const [bookingMarkers, setBookingMarkers] = useState([]);
  const [cityBreakdown, setCityBreakdown] = useState([]);
  const [loading, setLoading] = useState(true);
  const [layer, setLayer] = useState(searchParams.get('layer') || 'bookings');
  const [timeRange, setTimeRange] = useState('today');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [liveMetrics, setLiveMetrics] = useState({});

  const loadBookingHeatmap = useCallback(async () => {
    try {
      const res = await api.get(`/operations/heatmap/bookings?timeRange=${timeRange}&status=${selectedStatus}`);
      setBookingPoints(res.data.data.points || []);
      setCityBreakdown(res.data.data.cityBreakdown || []);
    } catch (e) { console.error('Error loading booking heatmap:', e); }
  }, [timeRange, selectedStatus]);

  const loadProviderHeatmap = useCallback(async () => {
    try {
      const res = await api.get('/operations/heatmap/providers?lat=20.5937&lng=78.9629&radiusKm=2000');
      setProviderPoints(res.data.data.providers || []);
    } catch (e) { console.error('Error loading provider heatmap:', e); }
  }, []);

  const loadLiveBookings = useCallback(async () => {
    try {
      const res = await api.get('/operations/live/bookings?status=active');
      setBookingMarkers(res.data.data.markers || []);
    } catch (e) { console.error('Error loading live bookings:', e); }
  }, []);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([loadBookingHeatmap(), loadProviderHeatmap(), loadLiveBookings()]);
      setLoading(false);
    };
    loadAll();

    const sock = getSocket();
    if (sock) {
      sock.on('ops:live_metrics', data => setLiveMetrics(data));
    }
    const interval = setInterval(() => { loadProviderHeatmap(); loadLiveBookings(); }, 15000);
    return () => {
      clearInterval(interval);
      if (sock) sock.off('ops:live_metrics');
    };
  }, [loadBookingHeatmap, loadProviderHeatmap, loadLiveBookings]);

  // Filter valid coordinate points based on selected layer
  const validBookingPoints = bookingPoints.filter(p => p && typeof p.lat === 'number' && typeof p.lng === 'number');
  const validBookingMarkers = bookingMarkers.filter(b => b && typeof b.lat === 'number' && typeof b.lng === 'number');
  const validProviderPoints = providerPoints.filter(p => p && typeof p.lat === 'number' && typeof p.lng === 'number');

  const hasCoordinates = layer === 'bookings' ? validBookingPoints.length > 0
    : layer === 'live_bookings' ? validBookingMarkers.length > 0
    : validProviderPoints.length > 0;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f172a', color: '#e2e8f0', fontFamily: "'Inter', sans-serif" }}>
      {/* Top Control Bar */}
      <div style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(20px)', padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', zIndex: 1000 }}>
        <button onClick={() => nav('/admin/operations')} style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>← Operations Home</button>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>🇮🇳 India Operations Map</h2>

        {/* Layer selector */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 16 }}>
          {[
            { id: 'bookings', label: '🔥 Booking Demand' },
            { id: 'live_bookings', label: '📍 Live Bookings' },
            { id: 'providers', label: '🔧 Providers' },
          ].map(l => (
            <button key={l.id} onClick={() => setLayer(l.id)} style={{ background: layer === l.id ? 'rgba(96,165,250,0.25)' : 'rgba(255,255,255,0.05)', border: layer === l.id ? '1px solid rgba(96,165,250,0.5)' : '1px solid rgba(255,255,255,0.1)', color: layer === l.id ? '#60a5fa' : '#94a3b8', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              {l.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        {layer === 'bookings' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={timeRange} onChange={e => setTimeRange(e.target.value)} style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.15)', color: '#e2e8f0', borderRadius: 8, padding: '5px 10px', fontSize: 12 }}>
              {[['live','Live'],['1h','Last 1h'],['6h','Last 6h'],['today','Today'],['yesterday','Yesterday'],['7d','Last 7 days']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)} style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.15)', color: '#e2e8f0', borderRadius: 8, padding: '5px 10px', fontSize: 12 }}>
              {[['all','All Status'],['pending','Pending'],['assigned','Assigned'],['in_progress','In Progress'],['completed','Completed']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button onClick={loadBookingHeatmap} style={{ background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>Apply</button>
          </div>
        )}

        {/* Live indicator */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, alignItems: 'center', fontSize: 12 }}>
          <span style={{ color: '#94a3b8' }}>Active: <strong style={{ color: '#f97316' }}>{liveMetrics.activeBookings ?? bookingMarkers.length ?? '—'}</strong></span>
          <span style={{ color: '#94a3b8' }}>Online: <strong style={{ color: '#22c55e' }}>{providerPoints.length}</strong></span>
          <span style={{ color: '#94a3b8' }}>Unassigned: <strong style={{ color: (liveMetrics.unassigned ?? 0) > 10 ? '#ef4444' : '#f59e0b' }}>{liveMetrics.unassigned ?? '—'}</strong></span>
          <button onClick={() => { loadBookingHeatmap(); loadProviderHeatmap(); loadLiveBookings(); }} style={{ background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>↻</button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Map Container */}
        <div style={{ flex: 1, position: 'relative', background: '#0f172a' }}>
          <MapContainer center={[22.5, 79.0]} zoom={5} style={{ width: '100%', height: '100%', background: '#0f172a' }} scrollWheelZoom={true}>
            <MapViewUpdater center={[22.5, 79.0]} zoom={5} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Layer 1: Booking Demand Points */}
            {layer === 'bookings' && validBookingPoints.map((p, idx) => {
              const count = p.count || 1;
              const radius = Math.min(Math.max(count * 4, 10), 30);
              const color = count > 15 ? '#ef4444' : count > 8 ? '#f97316' : count > 3 ? '#f59e0b' : '#22c55e';
              const stateCode = p.stateCode || CITY_STATE_MAP[p.city];
              return (
                <CircleMarker
                  key={idx}
                  center={[p.lat, p.lng]}
                  radius={radius}
                  pathOptions={{ color, fillColor: color, fillOpacity: 0.6, weight: 2 }}
                >
                  <Tooltip permanent={false}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>
                      🔥 {p.city || 'Region'} ({count} Bookings)
                    </div>
                    {stateCode && <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 2 }}>Click to open State Dashboard ({stateCode})</div>}
                  </Tooltip>
                  <Popup>
                    <div style={{ padding: 4, fontFamily: 'Inter, sans-serif' }}>
                      <h4 style={{ margin: '0 0 6px', fontSize: 14, color: '#0f172a' }}>📍 {p.city || 'Operational Area'}</h4>
                      <div style={{ fontSize: 12, color: '#475569', marginBottom: 8 }}>Total Bookings: <strong>{count}</strong></div>
                      {stateCode && (
                        <button onClick={() => nav(`/admin/operations/state/${stateCode}`)} style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', width: '100%' }}>
                          Open {stateCode} Dashboard →
                        </button>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}

            {/* Layer 2: Live Booking Markers */}
            {layer === 'live_bookings' && validBookingMarkers.map((b, idx) => {
              const color = STATUS_COLOR[b.status] || '#94a3b8';
              return (
                <CircleMarker
                  key={b._id || idx}
                  center={[b.lat, b.lng]}
                  radius={9}
                  pathOptions={{ color: '#ffffff', fillColor: color, fillOpacity: 0.9, weight: 2 }}
                  eventHandlers={{ click: () => setSelectedBooking(b) }}
                >
                  <Popup>
                    <div style={{ padding: 4, fontFamily: 'Inter, sans-serif' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>📋 #{b.bookingNumber || b._id}</div>
                      <div style={{ fontSize: 12, color, fontWeight: 600, marginTop: 2 }}>{b.status?.toUpperCase()}</div>
                      <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>Service: {b.service || 'Service'}</div>
                      <div style={{ fontSize: 12, color: '#475569' }}>City: {b.city || '—'}</div>
                      {b.amount && <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 700, marginTop: 4 }}>Amount: ₹{b.amount}</div>}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}

            {/* Layer 3: Provider/Technician Locations */}
            {layer === 'providers' && validProviderPoints.map((p, idx) => {
              const color = p.busy ? '#8b5cf6' : '#22c55e';
              return (
                <CircleMarker
                  key={p._id || idx}
                  center={[p.lat, p.lng]}
                  radius={8}
                  pathOptions={{ color: '#ffffff', fillColor: color, fillOpacity: 0.9, weight: 2 }}
                  eventHandlers={{ click: () => setSelectedProvider(p) }}
                >
                  <Popup>
                    <div style={{ padding: 4, fontFamily: 'Inter, sans-serif' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>🔧 {p.name || 'Provider'}</div>
                      <div style={{ fontSize: 12, color: p.busy ? '#8b5cf6' : '#22c55e', fontWeight: 600, marginTop: 2 }}>
                        {p.busy ? '🟣 Busy on job' : '🟢 Available'}
                      </div>
                      <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>City: {p.city || '—'}</div>
                      {p.rating && <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 2 }}>Rating: ⭐ {p.rating}</div>}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>

          {/* Banner if no coordinate points exist for selected layer */}
          {!hasCoordinates && !loading && (
            <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '12px 24px', zIndex: 1000, color: '#94a3b8', fontSize: 13, textAlign: 'center', backdropFilter: 'blur(10px)', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
              <span>📍 No live coordinate data available for selected layer ({layer}). Showing city summary in sidebar.</span>
            </div>
          )}

          {/* Legend */}
          <div style={{ position: 'absolute', bottom: 20, left: 16, background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px 16px', fontSize: 12, zIndex: 1000, backdropFilter: 'blur(10px)' }}>
            {layer === 'bookings' && (
              <>
                <div style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>🔥 Demand Scale</div>
                {[['🟢 Low (1–3)','#22c55e'],['🟡 Moderate (4–8)','#f59e0b'],['🟠 High (9–15)','#f97316'],['🔴 Critical (15+)','#ef4444']].map(([l,c]) => <div key={l} style={{ color: c, marginBottom: 4 }}>{l}</div>)}
              </>
            )}
            {layer === 'providers' && (
              <>
                <div style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>🔧 Technician Status</div>
                {[['🟢 Available','#22c55e'],['🟣 Busy on Job','#8b5cf6'],['⚫ Offline','#6b7280']].map(([l,c]) => <div key={l} style={{ color: c, marginBottom: 4 }}>{l}</div>)}
              </>
            )}
            {layer === 'live_bookings' && (
              <>
                <div style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>📍 Booking Status</div>
                {[['🟡 Pending','#f59e0b'],['🔵 Assigned','#3b82f6'],['🟠 In Progress','#f97316'],['🟢 Completed','#22c55e']].map(([l,c]) => <div key={l} style={{ color: c, marginBottom: 4 }}>{l}</div>)}
              </>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ width: 320, background: 'rgba(15,23,42,0.95)', borderLeft: '1px solid rgba(255,255,255,0.1)', overflowY: 'auto', padding: 16, zIndex: 1000 }}>
          {selectedBooking ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>📋 Booking Details</h3>
                <button onClick={() => setSelectedBooking(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18 }}>×</button>
              </div>
              {[
                ['Booking #', selectedBooking.bookingNumber || selectedBooking._id],
                ['Status', selectedBooking.status],
                ['Service', selectedBooking.service],
                ['City', selectedBooking.city],
                ['Amount', selectedBooking.amount ? `₹${selectedBooking.amount}` : '—'],
                ['Customer', selectedBooking.customer?.name],
                ['Provider', selectedBooking.provider?.name || 'Unassigned'],
              ].map(([k,v]) => v && (
                <div key={k} style={{ marginBottom: 10, background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{k}</div>
                  <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>{v}</div>
                </div>
              ))}
            </div>
          ) : selectedProvider ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>🔧 Provider Details</h3>
                <button onClick={() => setSelectedProvider(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18 }}>×</button>
              </div>
              {[
                ['Name', selectedProvider.name],
                ['Status', selectedProvider.busy ? '🟣 Busy' : '🟢 Available'],
                ['City', selectedProvider.city],
                ['Rating', selectedProvider.rating ? `⭐ ${selectedProvider.rating}` : '—'],
                ['Completed Jobs', selectedProvider.completedJobs || 0],
              ].map(([k,v]) => v && (
                <div key={k} style={{ marginBottom: 10, background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{k}</div>
                  <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>{v}</div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>🏙️ Top Operational Cities</span>
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>{cityBreakdown.length} cities</span>
              </h3>
              {cityBreakdown.length === 0 ? (
                <div style={{ color: '#64748b', fontSize: 12, textAlign: 'center', padding: '24px 0' }}>No live city operational data available</div>
              ) : (
                cityBreakdown.slice(0, 20).map((c, i) => {
                  const stateCode = c._id?.stateCode || CITY_STATE_MAP[c._id?.city] || c._id?.state;
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', marginBottom: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{c._id?.city || 'Unspecified'}</div>
                        {stateCode && (
                          <div onClick={() => nav(`/admin/operations/state/${stateCode}`)} style={{ fontSize: 11, color: '#60a5fa', cursor: 'pointer', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span>Open {stateCode} Dashboard →</span>
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#f97316' }}>{c.count}</div>
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
