import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Radio, Target } from 'lucide-react';
import { apiService } from '../../services/api';
import toast from 'react-hot-toast';
import 'leaflet/dist/leaflet.css';

/**
 * DutyZoneMap — Rapido-style zone radius map for ServiceHub providers.
 *
 * Shows an interactive map with:
 *  • Provider's live GPS pin / profile location
 *  • Animated pulsing radius circle (service zone boundary)
 *  • Zone info overlay (city name + radius)
 *  • Live location refresh action
 */
export default function DutyZoneMap({ isOnline, radiusKm = 10, initialCoords = null, onLocationSaved }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const circleRef = useRef(null);
  const markerRef = useRef(null);

  // Helper to parse coordinates [lng, lat] or {lat, lng}
  const parseCoords = (c) => {
    if (!c) return null;
    if (Array.isArray(c) && c.length === 2 && (c[0] !== 0 || c[1] !== 0)) {
      return { lat: Number(c[1]), lng: Number(c[0]) };
    }
    if (c.lat && c.lng && (c.lat !== 0 || c.lng !== 0)) {
      return { lat: Number(c.lat), lng: Number(c.lng) };
    }
    return null;
  };

  const [coords, setCoords] = useState(() => parseCoords(initialCoords));
  const [gpsError, setGpsError] = useState(false);
  const [cityName, setCityName] = useState('Your Zone');
  const [visible, setVisible] = useState(false);
  const [locating, setLocating] = useState(false);

  // Sync initialCoords if profile loads or updates
  useEffect(() => {
    const parsed = parseCoords(initialCoords);
    if (parsed) {
      setCoords((prev) => {
        if (!prev) return parsed;
        if (Math.abs(prev.lat - parsed.lat) > 0.0001 || Math.abs(prev.lng - parsed.lng) > 0.0001) {
          return parsed;
        }
        return prev;
      });
      setGpsError(false);
    }
  }, [initialCoords]);

  // ── animate in/out whenever isOnline changes ──
  useEffect(() => {
    if (isOnline) {
      const t = setTimeout(() => setVisible(true), 80);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [isOnline]);

  // ── get GPS coords live via browser Geolocation ──
  useEffect(() => {
    if (!isOnline) return;
    if (!navigator.geolocation) {
      setCoords((current) => current || parseCoords(initialCoords));
      return;
    }

    const id = navigator.geolocation.watchPosition(
      ({ coords: c }) => {
        setCoords({ lat: c.latitude, lng: c.longitude });
        setGpsError(false);
      },
      (err) => {
        console.warn('GPS watchPosition warning:', err?.message);
        setCoords((current) => current || parseCoords(initialCoords));
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 15000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [isOnline, initialCoords]);

  // ── Manual GPS Locate & Sync with Server ──
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      const fallback = coords || parseCoords(initialCoords);
      if (fallback) setCoords(fallback);
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setLocating(true);

    const saveLocation = async (newCoords, isGps = true) => {
      setCoords(newCoords);
      setGpsError(false);
      try {
        await apiService.updateProviderLocation({
          lat: newCoords.lat,
          lng: newCoords.lng,
          serviceRadius: radiusKm,
        });
        toast.success(isGps ? 'Updated location to current GPS position!' : 'Using saved profile location!');
        if (onLocationSaved) onLocationSaved(newCoords);
      } catch (e) {
        console.warn('Location save error:', e);
      } finally {
        setLocating(false);
      }
    };

    // Stage 1: Try high accuracy (3s timeout). If fail/timeout on desktop, Stage 2: low accuracy (8s).
    navigator.geolocation.getCurrentPosition(
      (pos) => saveLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }, true),
      (err) => {
        console.warn('High-accuracy GPS timed out/failed, trying network location...', err.message);
        navigator.geolocation.getCurrentPosition(
          (pos) => saveLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }, true),
          (err2) => {
            console.warn('Low-accuracy GPS also failed:', err2.message);
            const fallback = coords || parseCoords(initialCoords);
            if (fallback) {
              saveLocation(fallback, false);
            } else {
              toast.error('Could not detect GPS location. Please ensure location is enabled.');
              setLocating(false);
            }
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 }
        );
      },
      { enableHighAccuracy: true, timeout: 3000, maximumAge: 10000 }
    );
  };

  // ── boot Leaflet map once we have coords ──
  useEffect(() => {
    if (!coords || !mapContainerRef.current) return;

    import('leaflet').then((L) => {
      if (!mapContainerRef.current) return;

      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([coords.lat, coords.lng]);
        if (circleRef.current) {
          circleRef.current.setLatLng([coords.lat, coords.lng]);
          circleRef.current.setRadius(radiusKm * 1000);
        }
        if (markerRef.current) {
          markerRef.current.setLatLng([coords.lat, coords.lng]);
        }
        mapInstanceRef.current.invalidateSize();
        return;
      }

      const map = L.map(mapContainerRef.current, {
        center: [coords.lat, coords.lng],
        zoom: 12,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
        dragging: true,
        doubleClickZoom: false,
      });

      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        { maxZoom: 19, attribution: '© CARTO' }
      ).addTo(map);

      // Zone circle (Rapido-style boundary)
      const circle = L.circle([coords.lat, coords.lng], {
        radius: radiusKm * 1000,   // metres
        color: '#1a56db',
        weight: 2.5,
        dashArray: '8 6',
        fillColor: '#3b82f6',
        fillOpacity: 0.12,
      }).addTo(map);

      // Provider location marker
      const providerIcon = L.divIcon({
        html: `
          <div style="position:relative;width:40px;height:40px">
            <div style="
              position:absolute;inset:0;
              background:rgba(59,130,246,0.3);
              border-radius:50%;
              animation:pulse-ring 1.8s ease-out infinite;
            "></div>
            <div style="
              position:absolute;top:50%;left:50%;
              transform:translate(-50%,-50%);
              width:18px;height:18px;
              background:#1a56db;
              border:3px solid #fff;
              border-radius:50%;
              box-shadow:0 2px 8px rgba(26,86,219,0.5);
            "></div>
          </div>`,
        className: '',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const marker = L.marker([coords.lat, coords.lng], { icon: providerIcon }).addTo(map);

      map.fitBounds(circle.getBounds(), { padding: [24, 24] });

      mapInstanceRef.current = map;
      circleRef.current = circle;
      markerRef.current = marker;

      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 250);

      // Reverse-geocode city name
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lng}&format=json`)
        .then((r) => r.json())
        .then((d) => {
          const name =
            d.address?.city ||
            d.address?.town ||
            d.address?.village ||
            d.address?.suburb ||
            d.address?.county ||
            'Your Zone';
          setCityName(name);
        })
        .catch(() => {});
    });
  }, [coords]);

  // ── update circle/marker when radius changes live ──
  useEffect(() => {
    if (!mapInstanceRef.current || !circleRef.current || !coords) return;
    circleRef.current.setLatLng([coords.lat, coords.lng]);
    circleRef.current.setRadius(radiusKm * 1000);
    markerRef.current?.setLatLng([coords.lat, coords.lng]);
    mapInstanceRef.current.fitBounds(circleRef.current.getBounds(), { padding: [24, 24] });
    mapInstanceRef.current.invalidateSize();
  }, [coords, radiusKm]);

  // ── destroy map when going offline ──
  useEffect(() => {
    if (!isOnline && mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      circleRef.current = null;
      markerRef.current = null;
    }
  }, [isOnline]);

  if (!isOnline) return null;

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.98)',
        transition: 'opacity 0.4s ease, transform 0.4s ease',
      }}
      className="card overflow-hidden"
    >
      {/* ─── Header ─── */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <Radio size={15} className="text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 text-sm leading-tight">Duty Zone</h3>
            <p className="text-xs text-slate-400 leading-tight">Active service area</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Relocate / Sync GPS Button */}
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={locating}
            title="Update to current GPS location"
            className="flex items-center gap-1 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 text-xs font-medium px-2.5 py-1 rounded-lg transition-all border border-slate-200"
          >
            <Target size={13} className={locating ? 'animate-spin text-blue-600' : ''} />
            <span>{locating ? 'Locating…' : 'Locate Me'}</span>
          </button>

          {/* Zone pill */}
          <span className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse inline-block" />
            ON DUTY
          </span>
        </div>
      </div>

      {/* ─── Map canvas ─── */}
      <div className="relative mx-3 mb-3 rounded-xl overflow-hidden bg-slate-100" style={{ height: 220 }}>
        {gpsError && !coords && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 text-slate-400 z-10 gap-2">
            <Navigation size={28} className="opacity-40" />
            <p className="text-xs font-medium">Enable GPS or click Locate Me to view zone</p>
          </div>
        )}
        {!coords && !gpsError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 text-slate-400 z-10 gap-2">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-400">Locating duty zone…</p>
          </div>
        )}
        {/* Leaflet map container */}
        <div ref={mapContainerRef} className="w-full h-full min-h-[220px]" style={{ zIndex: 1 }} />

        {/* ─── Zone info overlay (bottom-left) ─── */}
        {coords && (
          <div
            className="absolute bottom-2 left-2 z-[400] bg-white/90 backdrop-blur-sm
                        rounded-xl px-3 py-2 shadow-md flex items-center gap-2"
          >
            <MapPin size={13} className="text-blue-600 shrink-0" />
            <div>
              <p className="text-xs font-bold text-slate-800 leading-tight">{cityName}</p>
              <p className="text-[10px] text-slate-400 leading-tight">{radiusKm} km radius active</p>
            </div>
          </div>
        )}
      </div>

      {/* ─── Bottom note ─── */}
      <p className="px-4 pb-4 text-xs text-slate-400 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse inline-block shrink-0" />
        Jobs within <strong className="text-slate-600">{radiusKm} km</strong> of your location will be assigned to you.
      </p>

      {/* Pulse-ring keyframe */}
      <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(0.7); opacity: 0.8; }
          70%  { transform: scale(2.2); opacity: 0;   }
          100% { transform: scale(2.2); opacity: 0;   }
        }
      `}</style>
    </div>
  );
}
