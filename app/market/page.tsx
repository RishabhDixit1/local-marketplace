"use client";

import { PageMeta } from "@/app/components/PageMeta";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, ChevronRight, MapPin, Store } from "lucide-react";
import ServiQLogo from "@/app/components/ServiQLogo";
import { MobileBottomNav } from "@/app/components/MobileBottomNav";
import type { MarketZoneSummary } from "@/app/api/market/zones/route";

export default function MarketHubPage() {
  const [zones, setZones] = useState<MarketZoneSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/market/zones")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setZones(data.zones);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-20 sm:px-6 lg:pb-20">
      <PageMeta title="Markets" description="Browse local markets and societies near you" path="/market" />
      <header className="sticky top-0 z-30 -mx-4 mb-6 border-b border-[var(--surface-border)]/80 bg-white/95 px-4 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between py-3">
          <ServiQLogo href="/" ariaLabel="ServiQ home" />
        </div>
      </header>

      <section className="mb-8">
        <div className="flex items-center gap-2 text-xs text-[var(--ink-500)] mb-4">
          <Link href="/" className="hover:text-[var(--brand-700)]">Home</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-[var(--ink-700)] font-semibold">Markets</span>
        </div>

        <h1 className="text-2xl font-extrabold text-[var(--ink-950)] sm:text-3xl">
          Explore Markets
        </h1>
        <p className="mt-1 text-sm text-[var(--ink-500)]">
          Browse all service zones in the ServiQ network
        </p>
      </section>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5">
              <div className="h-5 w-32 rounded bg-slate-100 mb-3" />
              <div className="h-4 w-24 rounded bg-slate-100 mb-4" />
              <div className="flex gap-3">
                <div className="h-5 w-16 rounded-full bg-slate-100" />
                <div className="h-5 w-16 rounded-full bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {zones.map((zone) => (
            <Link
              key={zone.id}
              href={`/market/zone/${zone.slug}`}
              className="group rounded-2xl border border-[var(--surface-border)] bg-white p-5 shadow-sm transition hover:border-[var(--brand-300)] hover:shadow-md active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold text-[var(--ink-950)] group-hover:text-[var(--brand-700)]">
                    {zone.name}
                  </h2>
                  <p className="mt-0.5 text-xs text-[var(--ink-500)]">
                    <MapPin className="mr-0.5 inline h-3 w-3" />
                    {zone.city}, {zone.state}
                  </p>
                </div>
                {zone.phase === 2 ? (
                  <span className="shrink-0 rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-semibold text-purple-700 border border-purple-200">
                    Coming Soon
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                    Live
                  </span>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                  <Building2 className="h-3 w-3" />
                  {zone.societies} Societies
                </div>
                <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                  <Store className="h-3 w-3" />
                  {zone.markets} Markets
                </div>
              </div>

              <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-[var(--brand-700)] opacity-0 transition group-hover:opacity-100">
                View Market <ArrowRight className="h-3 w-3" />
              </div>
            </Link>
          ))}
        </div>
      )}

      <MobileBottomNav />
    </div>
  );
}
