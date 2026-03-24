"use client";

import dynamic from "next/dynamic";
import { Compass, MapPin } from "lucide-react";
import type { ProviderCard as ProviderCardModel } from "../types";

const MarketplaceMap = dynamic(() => import("@/app/components/MarketplaceMap").then((mod) => mod.default), {
  ssr: false,
});

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
  center: {
    lat: number;
    lng: number;
  } | null;
  activeProvider: ProviderCardModel | null;
  onSelectProvider: (providerId: string) => void;
};

export default function PeopleMapPanel({
  items,
  center,
  activeProvider,
  onSelectProvider,
}: Props) {
  return (
    <section className="overflow-hidden rounded-[1.6rem] border border-white/70 bg-white/88 p-3 shadow-[0_24px_80px_-54px_rgba(15,23,42,0.48)] backdrop-blur sm:rounded-[2rem] sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-700)]">Local Visibility</p>
          <h2 className="mt-1 text-base font-semibold leading-tight text-slate-950 sm:text-xl">
            Discover nearby professionals and businesses
          </h2>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-700 sm:text-xs">
          <Compass className="h-3.5 w-3.5" />
          {items.length} mapped profiles
        </span>
      </div>

      {items.length > 0 ? (
        <div className="h-[240px] sm:h-[340px]">
          <MarketplaceMap
            items={items}
            center={center}
            activeItemId={activeProvider?.id || null}
            onSelectItem={onSelectProvider}
          />
        </div>
      ) : (
        <div className="grid h-[240px] place-items-center rounded-[1.3rem] border border-dashed border-slate-200 bg-slate-50 px-5 text-center sm:h-[340px] sm:rounded-[1.6rem] sm:px-6">
          <div className="max-w-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-[var(--brand-700)] shadow-sm">
              <MapPin className="h-6 w-6" />
            </div>
            <p className="mt-4 text-base font-semibold text-slate-900">Location pins will appear here automatically</p>
            <p className="mt-1 text-sm text-slate-500">
              ServiQ uses precise coordinates when they exist and falls back to city-level placement when they do not.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
