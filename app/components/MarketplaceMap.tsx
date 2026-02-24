"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

type MapItem = {
  id: string;
  title: string;
  lat: number;
  lng: number;
};

type Props = {
  items: MapItem[];
};

// Fix default marker icon issue
type LeafletIconDefaultPrototype = typeof L.Icon.Default.prototype & {
  _getIconUrl?: string;
};

delete (L.Icon.Default.prototype as LeafletIconDefaultPrototype)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

export default function MarketplaceMap({ items }: Props) {
  return (
    <div className="h-72 w-full rounded-xl overflow-hidden">
      <MapContainer
        center={[28.6139, 77.209]}
        zoom={12}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap contributors"
        />

        {items.map((item) => (
          <Marker
            key={item.id}
            position={[item.lat, item.lng]}
          >
            <Popup>
              <div className="text-sm font-semibold">
                {item.title}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
