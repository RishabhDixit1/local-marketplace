"use client";

import { useEffect, useMemo } from "react";
import { Circle, MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";

type MapItem = {
  id: string;
  title: string;
  lat: number;
  lng: number;
  creatorName?: string;
  locationLabel?: string;
  category?: string;
  timeLabel?: string;
  priceLabel?: string;
};

type Props = {
  items: MapItem[];
  center?: {
    lat: number;
    lng: number;
  } | null;
  activeItemId?: string | null;
  onSelectItem?: (itemId: string) => void;
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

function MapViewportController({
  items,
  center,
}: {
  items: MapItem[];
  center?: { lat: number; lng: number } | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (items.length > 1) {
      const bounds = L.latLngBounds(items.map((item) => [item.lat, item.lng] as [number, number]));
      map.fitBounds(bounds.pad(0.25), {
        animate: true,
        duration: 0.8,
      });
      return;
    }

    if (items.length === 1) {
      map.setView([items[0].lat, items[0].lng], 13, {
        animate: true,
        duration: 0.8,
      });
      return;
    }

    map.setView([center?.lat || 12.9716, center?.lng || 77.5946], 11, {
      animate: true,
      duration: 0.8,
    });
  }, [center?.lat, center?.lng, items, map]);

  return null;
}

type LeafletIconDefaultPrototype = typeof L.Icon.Default.prototype & {
  _getIconUrl?: string;
};

delete (L.Icon.Default.prototype as LeafletIconDefaultPrototype)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

const createPulseIcon = (isActive: boolean) =>
  L.divIcon({
    html: `<span class="market-map-marker${isActive ? " is-active" : ""}"></span>`,
    className: "market-map-marker-shell",
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -14],
  });

export default function MarketplaceMap({ items, center, activeItemId = null, onSelectItem }: Props) {
  const activeIcon = useMemo(() => createPulseIcon(true), []);
  const defaultIcon = useMemo(() => createPulseIcon(false), []);

  return (
    <div className="relative isolate z-0 h-full min-h-[14rem] w-full overflow-hidden rounded-2xl border border-slate-200/80">
      <MapContainer
        className="h-full w-full"
        center={[center?.lat || 12.9716, center?.lng || 77.5946]}
        zoom={12}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%", zIndex: 0, background: "#eef2ff" }}
      >
        <MapResizeHandler />
        <MapViewportController items={items} center={center} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        {items.map((item) => (
          <Marker
            key={item.id}
            position={[item.lat, item.lng]}
            icon={item.id === activeItemId ? activeIcon : defaultIcon}
            eventHandlers={{
              click: () => {
                onSelectItem?.(item.id);
              },
            }}
          >
            <Tooltip direction="top" offset={[0, -12]} opacity={0.95}>
              <div className="text-xs font-semibold text-slate-800">{item.title}</div>
            </Tooltip>
            <Popup>
              <div className="min-w-[180px] space-y-1.5">
                <p className="line-clamp-2 text-sm font-semibold text-slate-900">{item.title}</p>
                {item.creatorName && <p className="text-xs text-slate-600">{item.creatorName}</p>}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                  {item.category && (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                      {item.category}
                    </span>
                  )}
                  {item.locationLabel && (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                      {item.locationLabel}
                    </span>
                  )}
                  {item.priceLabel && (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700">
                      {item.priceLabel}
                    </span>
                  )}
                  {item.timeLabel && <span>{item.timeLabel}</span>}
                </div>
              </div>
            </Popup>
            <Circle
              center={[item.lat, item.lng]}
              radius={item.id === activeItemId ? 220 : 120}
              pathOptions={{
                color: item.id === activeItemId ? "#2563eb" : "#60a5fa",
                weight: 1,
                fillColor: item.id === activeItemId ? "#60a5fa" : "#93c5fd",
                fillOpacity: item.id === activeItemId ? 0.18 : 0.1,
              }}
            />
          </Marker>
        ))}
      </MapContainer>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-slate-900/6 to-transparent" />
    </div>
  );
}

