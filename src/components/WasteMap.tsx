import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons in bundled environments
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface WasteMarker {
  id: number;
  latitude: number;
  longitude: number;
  waste_type: string | null;
  grade: string | null;
  weight_kg: number;
  image_url: string | null;
}

interface WasteMapProps {
  markers: WasteMarker[];
  language: string;
}

const DEFAULT_CENTER: L.LatLngTuple = [-2.5, 118.0];
const DEFAULT_ZOOM = 5;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const buildPopupHtml = (marker: WasteMarker) => {
  const wasteType = marker.waste_type ? escapeHtml(marker.waste_type) : '-';
  const gradeBadge = marker.grade
    ? `<span style="display:inline-block;background:#ede9fe;color:#6d28d9;font-size:12px;font-weight:700;padding:2px 8px;border-radius:999px;">Grade ${escapeHtml(marker.grade)}</span>`
    : '';

  return `
    <div style="min-width:180px;">
      ${marker.image_url ? `<img src="${escapeHtml(marker.image_url)}" alt="Waste" style="width:100%;height:96px;object-fit:cover;border-radius:6px;margin-bottom:8px;" loading="lazy" />` : ''}
      <div style="display:flex;flex-direction:column;gap:6px;font-size:13px;color:#1f2937;">
        <div style="font-weight:600;">${wasteType}</div>
        ${gradeBadge}
        <div style="color:#4b5563;">${escapeHtml(String(marker.weight_kg))} kg</div>
      </div>
    </div>
  `;
};

export default function WasteMap({ markers, language }: WasteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const validMarkers = useMemo(
    () => markers.filter((m) => m.latitude != null && m.longitude != null && !isNaN(m.latitude) && !isNaN(m.longitude)),
    [markers]
  );

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      scrollWheelZoom: false,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    mapRef.current = map;
    markersLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const markerLayer = markersLayerRef.current;
    if (!map || !markerLayer) return;

    markerLayer.clearLayers();

    if (validMarkers.length === 0) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      return;
    }

    const bounds = L.latLngBounds(validMarkers.map((m) => [m.latitude, m.longitude] as L.LatLngTuple));

    validMarkers.forEach((marker) => {
      const leafletMarker = L.marker([marker.latitude, marker.longitude]);
      leafletMarker.bindPopup(buildPopupHtml(marker));
      leafletMarker.addTo(markerLayer);
    });

    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }, [validMarkers]);

  return (
    <div className="bg-white rounded-2xl shadow-md overflow-hidden mb-6">
      <div className="p-4 border-b border-gray-100">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          📍 {language === 'en' ? 'Waste Collection Map' : 'Peta Lokasi Limbah'}
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          {language === 'en'
            ? `${validMarkers.length} submissions with GPS data`
            : `${validMarkers.length} setoran dengan data GPS`}
        </p>
      </div>
      <div ref={mapContainerRef} className="h-72 w-full z-0" />
    </div>
  );
}

