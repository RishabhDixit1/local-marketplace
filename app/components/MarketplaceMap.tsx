"use client";

import { useMemo } from "react";
import MapCanvas from "@/app/components/maps/MapCanvas";
import type { MarketplaceMapItem } from "@/app/components/maps/types";

type Props = {
  items: MarketplaceMapItem[];
  center?: {
    lat: number;
    lng: number;
  } | null;
  activeItemId?: string | null;
  selectedItemId?: string | null;
  onSelectItem?: (itemId: string) => void;
};

export default function MarketplaceMap({
  items,
  center,
  activeItemId = null,
  selectedItemId = null,
  onSelectItem,
}: Props) {
  const normalizedItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        urgent: item.urgent ?? /urgent|asap|today/i.test(`${item.title} ${item.timeLabel} ${item.priceLabel}`),
      })),
    [items]
  );

  return (
    <div className="relative isolate z-0 h-full min-h-[12rem] w-full overflow-hidden rounded-[1.5rem] border border-slate-800/90 bg-[#020617] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
      <MapCanvas
        items={normalizedItems}
        center={center}
        activeItemId={activeItemId}
        selectedItemId={selectedItemId}
        onSelectItem={onSelectItem}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-slate-950/24 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950/48 via-slate-950/12 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,_rgba(56,189,248,0.14),_transparent_24%),radial-gradient(circle_at_14%_86%,_rgba(37,99,235,0.16),_transparent_28%)]" />
    </div>
  );
}

