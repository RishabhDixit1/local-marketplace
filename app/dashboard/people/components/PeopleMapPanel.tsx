"use client";

import dynamic from "next/dynamic";
import { ArrowDown, Compass, MapPin, ShieldCheck, Star } from "lucide-react";
import type { ProviderCard as ProviderCardModel, PresenceTone } from "../types";

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
  activePresenceTone: PresenceTone;
  onSelectProvider: (providerId: string) => void;
  onJumpToProvider: (providerId: string) => void;
  onOpenTrustPanel: (providerId: string) => void;
};

const presencePillClassByTone: Record<PresenceTone, string> = {
  online: "border-emerald-200 bg-emerald-50 text-emerald-700",
  away: "border-amber-200 bg-amber-50 text-amber-700",
  offline: "border-slate-200 bg-slate-100 text-slate-600",
};

const presenceLabelByTone: Record<PresenceTone, string> = {
  online: "Available now",
  away: "Away",
  offline: "Offline",
};

export default function PeopleMapPanel({
  items,
  center,
  activeProvider,
  activePresenceTone,
  onSelectProvider,
  onJumpToProvider,
  onOpenTrustPanel,
}: Props) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/88 p-4 shadow-[0_24px_80px_-54px_rgba(15,23,42,0.48)] backdrop-blur sm:p-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_340px]">
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-700)]">Local Visibility</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950 sm:text-xl">Discover nearby professionals and businesses</h2>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
              <Compass className="h-3.5 w-3.5" />
              {items.length} mapped profiles
            </span>
          </div>

          {items.length > 0 ? (
            <div className="h-[300px] sm:h-[340px]">
              <MarketplaceMap
                items={items}
                center={center}
                activeItemId={activeProvider?.id || null}
                onSelectItem={onSelectProvider}
              />
            </div>
          ) : (
            <div className="grid h-[300px] place-items-center rounded-[1.6rem] border border-dashed border-slate-200 bg-slate-50 px-6 text-center sm:h-[340px]">
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
        </div>

        <aside className="rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,0.98))] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Preview</p>

          {activeProvider ? (
            <div className="mt-3 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-slate-950">{activeProvider.name}</h3>
                  <p className="mt-1 text-sm text-slate-600">{activeProvider.role}</p>
                </div>
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${presencePillClassByTone[activePresenceTone]}`}
                >
                  <span className="h-2 w-2 rounded-full bg-current" />
                  {presenceLabelByTone[activePresenceTone]}
                </span>
              </div>

              <p className="line-clamp-3 text-sm leading-6 text-slate-600">{activeProvider.bio}</p>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">
                  {activeProvider.distanceKm.toFixed(1)} km away
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">{activeProvider.location}</span>
                {activeProvider.minPriceLabel ? (
                  <span className="rounded-full border border-[var(--brand-500)]/20 bg-cyan-50 px-2.5 py-1 text-[var(--brand-700)]">
                    From {activeProvider.minPriceLabel}
                  </span>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Trust</p>
                  <p className="mt-2 inline-flex items-center gap-2 font-semibold text-slate-900">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    {activeProvider.rating.toFixed(1)} ({activeProvider.reviews})
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Response</p>
                  <p className="mt-2 font-semibold text-slate-900">~{activeProvider.responseMinutes} min</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">{activeProvider.trustBlurb}</p>
                <p className="mt-1 text-sm text-slate-500">{activeProvider.recentActivityLabel}</p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => onJumpToProvider(activeProvider.id)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--brand-900)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]"
                >
                  Jump to card
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenTrustPanel(activeProvider.id)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-[var(--brand-500)]/35 hover:text-[var(--brand-700)]"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Trust details
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-[1.4rem] border border-dashed border-slate-200 bg-white px-5 py-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <MapPin className="h-5 w-5" />
              </div>
              <p className="mt-4 text-base font-semibold text-slate-900">Select a marker to preview the profile</p>
              <p className="mt-1 text-sm text-slate-500">
                Marker taps reveal a compact summary and let you jump straight into the main discovery card.
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
