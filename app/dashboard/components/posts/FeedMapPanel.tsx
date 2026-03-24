"use client";

import dynamic from "next/dynamic";
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
  activeItemId: string | null;
  onSelectItem: (itemId: string) => void;
};

export default function FeedMapPanel({
  items,
  center,
  stats,
  realtime,
  activeItemId,
  onSelectItem,
}: FeedMapPanelProps) {
  return (
    <section className="rounded-[2rem] border border-slate-200/90 bg-white p-3 shadow-[0_24px_48px_-34px_rgba(15,23,42,0.5)] sm:p-4">
      <div className="relative overflow-hidden rounded-[1.6rem] border border-slate-200/80 bg-slate-950">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
          <div className="max-w-xs rounded-2xl border border-white/12 bg-slate-950/45 px-3 py-2.5 backdrop-blur-md">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70">Live market map</p>
            <p className="mt-1 text-xs font-medium text-white/90 sm:text-sm">Tap a pin to focus the matching post card below.</p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-semibold backdrop-blur-sm ${realtime.className}`}
            >
              <span className={`h-2 w-2 rounded-full ${realtime.dotClassName}`} />
              {realtime.label}
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/85 backdrop-blur-sm">
              {items.length} mapped pins
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/85 backdrop-blur-sm">
              {stats.urgent} urgent
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/85 backdrop-blur-sm">
              {stats.total} live cards
            </span>
          </div>
        </div>

        <div className="h-[12.5rem] sm:h-[14.5rem] lg:h-[16rem] xl:h-[17.5rem]">
          {items.length > 0 ? (
            <MarketplaceMap items={items} center={center} activeItemId={activeItemId} onSelectItem={onSelectItem} />
          ) : (
            <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_top,_rgba(14,165,164,0.24),_transparent_36%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(15,23,42,0.84))] text-center">
              <div className="max-w-md px-6">
                <p className="text-base font-semibold text-white">The live map will appear as soon as the feed has location data.</p>
                <p className="mt-2 text-sm leading-6 text-white/70">
                  Once posts load, the map adapts to every screen size and keeps nearby activity visible while you work
                  through the feed.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-transparent via-cyan-300/16 to-transparent [animation:marketScanSweep_7.8s_linear_infinite]" />
        <div className="pointer-events-none absolute -bottom-8 right-4 h-24 w-24 rounded-full bg-cyan-400/16 blur-3xl [animation:marketOrbFloat_6.2s_ease-in-out_infinite]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-950/80 via-slate-950/15 to-transparent" />
      </div>
    </section>
  );
}
