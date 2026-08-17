import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '@/services/api';
import { getSocket } from '@/services/socket';

const STATUS_COLOR = {
  pending: '#f59e0b', assigned: '#3b82f6', accepted: '#8b5cf6',
  in_progress: '#f97316', completed: '#22c55e', paid: '#22c55e',
  cancelled: '#6b7280', disputed: '#ef4444',
};

const SEVERITY_GRADIENT = {
  critical: 'rgba(239,68,68,0.15)',
  high: 'rgba(249,115,22,0.15)',
  medium: 'rgba(234,179,8,0.15)',
  low: 'rgba(34,197,94,0.10)',
};

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
  const [liveProviders, setLiveProviders] = useState([]);
  const [liveMetrics, setLiveMetrics] = useState({});
  const mapRef = useRef(null);
  const googleMapRef = useRef(null);
  const heatmapLayerRef = useRef(null);
  const markersRef = useRef([]);
  const [mapReady, setMapReady] = useState(false);

  const loadBookingHeatmap = useCallback(async () => {
    try {
      const res = await api.get(`/operations/heatmap/bookings?timeRange=${timeRange}&status=${selectedStatus}`);
      setBookingPoints(res.data.data.points || []);
      setCityBreakdown(res.data.data.cityBreakdown || []);
    } catch (e) { console.error(e); }
  }, [timeRange, selectedStatus]);

  const loadProviderHeatmap = useCallback(async () => {
    try {
      const res = await api.get('/operations/heatmap/providers?lat=20.5937&lng=78.9629&radiusKm=2000');
      setProviderPoints(res.data.data.providers || []);
    } catch (e) { console.error(e); }
  }, []);

  const loadLiveBookings = useCallback(async () => {
    try {
      const res = await api.get('/operations/live/bookings?status=active');
      setBookingMarkers(res.data.data.markers || []);
    } catch (e) { console.error(e); }
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

  // Initialize Google Maps
  useEffect(() => {
    if (!mapRef.current || mapReady) return;
    const gKey = window.__GMAPS_KEY__ || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_MAPS_KEY);
    if (!gKey && !window.google?.maps) {
      setMapReady(false);
      return;
    }
    const initMap = () => {
      if (!mapRef.current) return;
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: 20.5937, lng: 78.9629 },
        zoom: 5,
        mapTypeId: 'roadmap',
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#334155' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
          { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#60a5fa' }] },
        ],
      });
      googleMapRef.current = map;
      setMapReady(true);
    };

    if (window.google?.maps) { initMap(); }
    else if (gKey) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${gKey}&libraries=visualization`;
      script.onload = initMap;
      document.head.appendChild(script);
    }
  }, [mapRef, mapReady]);

  // Update heatmap layer when data changes
  useEffect(() => {
    if (!mapReady || !googleMapRef.current) return;
    const map = googleMapRef.current;

    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    if (heatmapLayerRef.current) heatmapLayerRef.current.setMap(null);

    if (layer === 'bookings') {
      const points = bookingPoints.filter(p => p.lat && p.lng).map(p => ({
        location: new window.google.maps.LatLng(p.lat, p.lng),
        weight: p.count || 1,
      }));
      if (window.google.maps.visualization) {
        heatmapLayerRef.current = new window.google.maps.visualization.HeatmapLayer({
          data: points, map, radius: 40, opacity: 0.8,
          gradient: ['rgba(0,0,0,0)', 'rgba(0,255,0,0.6)', 'rgba(255,255,0,0.8)', 'rgba(255,128,0,0.9)', 'rgba(255,0,0,1)'],
        });
      }
    } else if (layer === 'live_bookings') {
      bookingMarkers.forEach(bm => {
        if (!bm.lat || !bm.lng) return;
        const color = STATUS_COLOR[bm.status] || '#94a3b8';
        const marker = new window.google.maps.Marker({
          position: { lat: bm.lat, lng: bm.lng },
          map,
          icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: color, fillOpacity: 0.9, strokeColor: '#fff', strokeWeight: 1.5 },
          title: `${bm.bookingNumber} - ${bm.status}`,
        });
        marker.addListener('click', () => setSelectedBooking(bm));
        markersRef.current.push(marker);
      });
    } else if (layer === 'providers') {
      providerPoints.forEach(pp => {
        if (!pp.lat || !pp.lng) return;
        const color = pp.busy ? '#8b5cf6' : '#22c55e';
        const marker = new window.google.maps.Marker({
          position: { lat: pp.lat, lng: pp.lng },
          map,
          icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: color, fillOpacity: 0.9, strokeColor: '#fff', strokeWeight: 1.5 },
          title: pp.name || 'Provider',
        });
        marker.addListener('click', () => setSelectedProvider(pp));
        markersRef.current.push(marker);
      });
    }
  }, [bookingPoints, bookingMarkers, providerPoints, layer, mapReady]);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f172a', color: '#e2e8f0', fontFamily: "'Inter', sans-serif" }}>
      {/* Top Control Bar */}
      <div style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(20px)', padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <button onClick={() => nav('/admin/operations')} style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: 13 }}>← Back</button>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>🌡️ Live Operations Heatmap</h2>

        {/* Layer selector */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 16 }}>
          {[
            { id: 'bookings', label: '🔥 Booking Demand' },
            { id: 'live_bookings', label: '📍 Live Bookings' },
            { id: 'providers', label: '🔧 Providers' },
          ].map(l => (
            <button key={l.id} onClick={() => setLayer(l.id)} style={{ background: layer === l.id ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.05)', border: layer === l.id ? '1px solid rgba(96,165,250,0.5)' : '1px solid rgba(255,255,255,0.1)', color: layer === l.id ? '#60a5fa' : '#94a3b8', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
              {l.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        {layer === 'bookings' && (
          <>
            <select value={timeRange} onChange={e => setTimeRange(e.target.value)} style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.15)', color: '#e2e8f0', borderRadius: 8, padding: '5px 10px', fontSize: 12 }}>
              {[['live','Live'],['1h','Last 1h'],['6h','Last 6h'],['today','Today'],['yesterday','Yesterday'],['7d','Last 7 days']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)} style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.15)', color: '#e2e8f0', borderRadius: 8, padding: '5px 10px', fontSize: 12 }}>
              {[['all','All Status'],['pending','Pending'],['assigned','Assigned'],['in_progress','In Progress'],['completed','Completed']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button onClick={loadBookingHeatmap} style={{ background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>Apply</button>
          </>
        )}

        {/* Live indicator */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, alignItems: 'center', fontSize: 12 }}>
          <span style={{ color: '#94a3b8' }}>Active: <strong style={{ color: '#f97316' }}>{liveMetrics.activeBookings ?? '—'}</strong></span>
          <span style={{ color: '#94a3b8' }}>Online: <strong style={{ color: '#22c55e' }}>{providerPoints.length}</strong></span>
          <span style={{ color: '#94a3b8' }}>Unassigned: <strong style={{ color: liveMetrics.unassigned > 10 ? '#ef4444' : '#f59e0b' }}>{liveMetrics.unassigned ?? '—'}</strong></span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Map Container */}
        <div style={{ flex: 1, position: 'relative' }}>
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

          {/* No Google Maps API fallback */}
          {!mapReady && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🗺️</div>
              <div style={{ fontSize: 16, color: '#94a3b8', marginBottom: 8 }}>Map loading...</div>
              <div style={{ fontSize: 12, color: '#475569', maxWidth: 400, textAlign: 'center', lineHeight: 1.6 }}>
                Add <code style={{ background: '#1e293b', padding: '2px 6px', borderRadius: 4 }}>VITE_GOOGLE_MAPS_KEY</code> to your <code style={{ background: '#1e293b', padding: '2px 6px', borderRadius: 4 }}>.env</code> for the interactive map.<br />
                Showing data tables below.
              </div>

              {/* Fallback: City Table */}
              {cityBreakdown.length > 0 && (
                <div style={{ marginTop: 24, width: '90%', maxWidth: 700, maxHeight: 300, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead><tr>{['City','State','Bookings'].map(h => <th key={h} style={{ padding: '8px 12px', background: '#1e293b', color: '#94a3b8', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>{h}</th>)}</tr></thead>
                    <tbody>
                      {cityBreakdown.map((c, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '8px 12px' }}>{c._id?.city || '—'}</td>
                          <td style={{ padding: '8px 12px', color: '#64748b' }}>{c._id?.state || '—'}</td>
                          <td style={{ padding: '8px 12px', color: '#f97316', fontWeight: 700 }}>{c.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Legend */}
          {mapReady && (
            <div style={{ position: 'absolute', bottom: 20, left: 16, background: 'rgba(0,0,0,0.85)', borderRadius: 10, padding: '12px 16px', fontSize: 12 }}>
              {layer === 'bookings' && (
                <>
                  <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: 8 }}>🔥 Demand Intensity</div>
                  {[['🟢 Low','#22c55e'],['🟡 Medium','#eab308'],['🟠 High','#f97316'],['🔴 Critical','#ef4444']].map(([l,c]) => <div key={l} style={{ color: c, marginBottom: 4 }}>{l}</div>)}
                </>
              )}
              {layer === 'providers' && (
                <>
                  <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: 8 }}>🔧 Provider Status</div>
                  {[['🟢 Available','#22c55e'],['🟣 Busy','#8b5cf6'],['⚫ Offline','#6b7280']].map(([l,c]) => <div key={l} style={{ color: c, marginBottom: 4 }}>{l}</div>)}
                </>
              )}
              {layer === 'live_bookings' && (
                <>
                  <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: 8 }}>📍 Booking Status</div>
                  {[['🟡 Pending','#f59e0b'],['🔵 Assigned','#3b82f6'],['🟠 In Progress','#f97316'],['🟢 Completed','#22c55e']].map(([l,c]) => <div key={l} style={{ color: c, marginBottom: 4 }}>{l}</div>)}
                </>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ width: 300, background: 'rgba(15,23,42,0.95)', borderLeft: '1px solid rgba(255,255,255,0.1)', overflowY: 'auto', padding: 16 }}>
          {selectedBooking ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Booking Details</h3>
                <button onClick={() => setSelectedBooking(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18 }}>×</button>
              </div>
              {[
                ['Booking #', selectedBooking.bookingNumber],
                ['Status', selectedBooking.status],
                ['Service', selectedBooking.service],
                ['City', selectedBooking.city],
                ['Amount', selectedBooking.amount ? `₹${selectedBooking.amount}` : '—'],
                ['Customer', selectedBooking.customer?.name],
                ['Provider', selectedBooking.provider?.name || 'Unassigned'],
              ].map(([k,v]) => v && (
                <div key={k} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{k}</div>
                  <div style={{ fontSize: 13, color: '#e2e8f0' }}>{v}</div>
                </div>
              ))}
            </div>
          ) : selectedProvider ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Provider Details</h3>
                <button onClick={() => setSelectedProvider(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18 }}>×</button>
              </div>
              {[
                ['Name', selectedProvider.name],
                ['Status', selectedProvider.busy ? '🟣 Busy' : '🟢 Available'],
                ['City', selectedProvider.city],
                ['Rating', selectedProvider.rating ? `⭐ ${selectedProvider.rating}` : '—'],
                ['Completed Jobs', selectedProvider.completedJobs],
              ].map(([k,v]) => v && (
                <div key={k} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{k}</div>
                  <div style={{ fontSize: 13, color: '#e2e8f0' }}>{v}</div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#94a3b8' }}>Top Cities</h3>
              {cityBreakdown.slice(0, 15).map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{c._id?.city || '—'}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{c._id?.state}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#f97316' }}>{c.count}</div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
