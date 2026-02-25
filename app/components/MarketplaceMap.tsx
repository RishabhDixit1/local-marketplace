"use client";

import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";

type MapItem = {
  id: string;
  title: string;
  lat: number;
  lng: number;
};

type Props = {
  items: MapItem[];
  center?: {
    lat: number;
    lng: number;
  } | null;
};

function MapResizeHandler() {
  const map = useMap();

  useEffect(() => {
    const refresh = () => map.invalidateSize();
    const raf = window.requestAnimationFrame(refresh);

    window.addEventListener("resize", refresh);
    window.addEventListener("orientationchange", refresh);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", refresh);
      window.removeEventListener("orientationchange", refresh);
    };
  }, [map]);

  return null;
}

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

export default function MarketplaceMap({ items, center }: Props) {
  return (
    <div className="relative isolate z-0 h-full min-h-[14rem] w-full overflow-hidden rounded-xl">
      <MapContainer
        className="h-full w-full"
        center={[center?.lat || 12.9716, center?.lng || 77.5946]}
        zoom={12}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%", zIndex: 0 }}
      >
        <MapResizeHandler />
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
