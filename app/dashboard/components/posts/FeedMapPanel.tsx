"use client";

import dynamic from "next/dynamic";
import { LocateFixed } from "lucide-react";
import type { MarketplaceFeedStats } from "@/lib/marketplaceFeed";

const MarketplaceMap = dynamic(() => import("@/app/components/MarketplaceMap").then((mod) => mod.default), {
  ssr: false,
});

type FeedMapPanelProps = {
  items: Array<{
    id: string;
    title: string;
    lat: number;
    lng: number;
    creatorName: string;
    locationLabel: string;
    category: string;
    timeLabel: string;
    priceLabel: string;
  }>;
  center: { lat: number; lng: number };
  stats: MarketplaceFeedStats;
  realtime: {
    label: string;
    className: string;
    dotClassName: string;
  };
  locationStatus: "idle" | "locating" | "ready" | "denied" | "unsupported" | "error";
  activeItemId: string | null;
  selectedItemId: string | null;
  onSelectItem: (itemId: string) => void;
};

export default function FeedMapPanel({
  items,
  center,
  stats,
  realtime,
  locationStatus,
  activeItemId,
  selectedItemId,
  onSelectItem,
}: FeedMapPanelProps) {
  const selectedItem = items.find((item) => item.id === selectedItemId || item.id === activeItemId) || items[0] || null;
  const locationMeta =
    locationStatus === "ready"
      ? { label: "Near you", className: "border-sky-400/35 bg-sky-500/16 text-sky-100" }
      : locationStatus === "locating"
        ? { label: "Locating", className: "border-cyan-400/30 bg-cyan-500/14 text-cyan-100" }
        : locationStatus === "denied"
          ? { label: "Location off", className: "border-amber-400/30 bg-amber-500/14 text-amber-100" }
          : locationStatus === "unsupported"
            ? { label: "No GPS", className: "border-slate-400/25 bg-slate-500/12 text-slate-200" }
            : locationStatus === "error"
              ? { label: "Signal weak", className: "border-amber-400/30 bg-amber-500/14 text-amber-100" }
              : { label: "Location standby", className: "border-slate-400/25 bg-slate-500/12 text-slate-200" };

  return (
    <section className="rounded-[2rem] border border-slate-200/80 bg-white p-3 shadow-[0_24px_48px_-34px_rgba(15,23,42,0.5)] sm:p-4">
      <div className="relative overflow-hidden rounded-[1.6rem] border border-slate-800/90 bg-slate-950 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex items-start justify-between gap-2 p-3 sm:p-5">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium shadow-sm backdrop-blur-[16px] ${locationMeta.className}`}
          >
            <LocateFixed className="h-3.5 w-3.5" />
            {locationMeta.label}
          </span>

          <div className="flex max-w-[70%] flex-wrap items-center justify-end gap-1.5 sm:max-w-none sm:gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-semibold shadow-sm backdrop-blur-[16px] ${realtime.className}`}
            >
              <span className={`h-2 w-2 rounded-full ${realtime.dotClassName}`} />
              {realtime.label}
            </span>
            <span className="rounded-full border border-white/10 bg-slate-950/58 px-3 py-1.5 text-[11px] font-semibold text-white/88 shadow-sm backdrop-blur-[16px]">
              {items.length} mapped pins
            </span>
            <span className="hidden rounded-full border border-white/10 bg-slate-950/58 px-3 py-1.5 text-[11px] font-semibold text-white/88 shadow-sm backdrop-blur-[16px] sm:inline-flex">
              {stats.urgent} urgent
            </span>
            <span className="hidden rounded-full border border-white/10 bg-slate-950/58 px-3 py-1.5 text-[11px] font-semibold text-white/88 shadow-sm backdrop-blur-[16px] sm:inline-flex">
              {stats.total} live cards
            </span>
          </div>
        </div>

        <div className="h-[16.5rem] sm:h-[18rem] lg:h-[20.5rem] xl:h-[21rem]">
          <MarketplaceMap
            items={items}
            center={center}
            activeItemId={activeItemId}
            selectedItemId={selectedItemId}
            onSelectItem={onSelectItem}
          />
        </div>

        <div className="grid gap-2 border-t border-slate-800/80 bg-slate-950/82 p-3 text-white/92 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-4">
          {selectedItem ? (
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200/80">Selected pin</p>
              <h3 className="truncate text-sm font-semibold text-white">{selectedItem.title}</h3>
              <p className="mt-0.5 truncate text-[11px] text-white/65">
                {selectedItem.creatorName} · {selectedItem.locationLabel}
              </p>
            </div>
          ) : (
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200/80">Selected pin</p>
              <p className="text-sm font-semibold text-white">Tap any pin to surface its details here</p>
            </div>
          )}

          {selectedItem ? (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
              <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-white/88">{selectedItem.category}</span>
              <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-white/88">{selectedItem.priceLabel}</span>
              <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-white/88">{selectedItem.timeLabel}</span>
            </div>
          ) : null}
        </div>

        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-slate-950/26 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-slate-950/26 to-transparent" />
        <div className="pointer-events-none absolute -bottom-12 right-8 h-28 w-28 rounded-full bg-sky-400/14 blur-3xl [animation:marketOrbFloat_7.2s_ease-in-out_infinite]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-950/56 via-slate-950/14 to-transparent" />
      </div>
    </section>
  );
}
