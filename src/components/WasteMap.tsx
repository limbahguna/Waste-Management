import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Package, Scale } from 'lucide-react';

// Fix default marker icons in bundled environments
delete (L.Icon.Default.prototype as any)._getIconUrl;
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

function FitBounds({ markers }: { markers: WasteMarker[] }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length === 0) return;
    const bounds = L.latLngBounds(markers.map(m => [m.latitude, m.longitude]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }, [markers, map]);
  return null;
}

export default function WasteMap({ markers, language }: WasteMapProps) {
  const validMarkers = useMemo(
    () => markers.filter(m => m.latitude != null && m.longitude != null && !isNaN(m.latitude) && !isNaN(m.longitude)),
    [markers]
  );

  const defaultCenter: [number, number] = [-2.5, 118.0]; // Indonesia center

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
      <div className="h-72 w-full">
        <MapContainer
          center={defaultCenter}
          zoom={5}
          className="h-full w-full z-0"
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {validMarkers.length > 0 && <FitBounds markers={validMarkers} />}
          {validMarkers.map(m => (
            <Marker key={m.id} position={[m.latitude, m.longitude]}>
              <Popup>
                <div className="min-w-[180px]">
                  {m.image_url && (
                    <img
                      src={m.image_url}
                      alt="Waste"
                      className="w-full h-24 object-cover rounded mb-2"
                    />
                  )}
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-1 font-semibold text-gray-800">
                      <Package className="w-3 h-3" />
                      {m.waste_type || '-'}
                    </div>
                    {m.grade && (
                      <span className="inline-block bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full">
                        Grade {m.grade}
                      </span>
                    )}
                    <div className="flex items-center gap-1 text-gray-600">
                      <Scale className="w-3 h-3" />
                      {m.weight_kg} kg
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
