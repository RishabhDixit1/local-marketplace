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
      .catch((err) => { console.error("[market] failed to load zones:", err); })
      .finally(() => setLoading(false));
  }, []);

  const liveZones = zones.filter((z) => z.phase !== 2);
  const upcomingZones = zones.filter((z) => z.phase === 2);

  return (
    <div className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-6 lg:pb-20">
      <PageMeta title="Markets" description="Browse local markets and societies near you" path="/market" />
      <header className="sticky top-0 z-30 -mx-4 mb-6 border-b border-[var(--surface-border)]/80 bg-[var(--surface-elevated)]/95 px-4 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between py-3">
          <ServiQLogo href="/" ariaLabel="ServiQ home" />
        </div>
      </header>

      <section className="mb-10">
        <div className="flex items-center gap-2 text-xs text-[var(--ink-500)] mb-4">
          <Link href="/" className="hover:text-[var(--brand-700)]">Home</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-[var(--ink-700)] font-semibold">Markets</span>
        </div>

        <h1 className="text-3xl font-normal text-[var(--ink-950)] sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
          Explore Markets
        </h1>
        <p className="mt-2 text-sm text-[var(--ink-500)]">
          Find local services and providers in your neighborhood
        </p>
      </section>

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="nameplate-card animate-pulse p-5 pt-7">
              <div className="h-5 w-32 rounded bg-[var(--surface-soft)] mb-3" />
              <div className="h-4 w-24 rounded bg-[var(--surface-soft)] mb-4" />
              <div className="flex gap-3">
                <div className="h-5 w-16 rounded-full bg-[var(--surface-soft)]" />
                <div className="h-5 w-16 rounded-full bg-[var(--surface-soft)]" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {liveZones.length > 0 && (
            <section className="mb-10">
              <div className="mb-5 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[var(--marigold-400)]" style={{ boxShadow: "0 0 8px rgba(240, 180, 41, 0.5)" }} />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--ink-500)]">Live Now</h2>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {liveZones.map((zone) => (
                  <Link
                    key={zone.id}
                    href={`/market/zone/${zone.slug}`}
                    className="nameplate-card group block p-5 pt-7"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-lg font-normal text-[var(--ink-950)] group-hover:text-[var(--brand-700)] truncate" style={{ fontFamily: "var(--font-display)" }}>
                          {zone.name}
                        </h3>
                        <p className="mt-1 flex items-center gap-1 text-xs text-[var(--ink-500)]">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {zone.city}, {zone.state}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[var(--marigold-50)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--marigold-600)] border border-[var(--marigold-200)]">
                        Live
                      </span>
                    </div>

                    <div className="mt-4 flex items-center gap-4 text-xs tabular-nums">
                      <span className="flex items-center gap-1.5 text-[var(--ink-700)]">
                        <Building2 className="h-3.5 w-3.5 text-[var(--brand-600)]" />
                        <span className="font-semibold">{zone.societies}</span> Societies
                      </span>
                      <span className="flex items-center gap-1.5 text-[var(--ink-700)]">
                        <Store className="h-3.5 w-3.5 text-[var(--brand-600)]" />
                        <span className="font-semibold">{zone.markets}</span> Markets
                      </span>
                    </div>

                    <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-[var(--brand-700)] opacity-0 transition group-hover:opacity-100">
                      View Market <ArrowRight className="h-3 w-3" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {upcomingZones.length > 0 && (
            <section className="mb-10">
              <div className="mb-5 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[var(--sage-300)]" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--ink-500)]">Coming Soon</h2>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {upcomingZones.map((zone) => (
                  <Link
                    key={zone.id}
                    href={`/market/zone/${zone.slug}`}
                    className="nameplate-card group block p-5 pt-7 opacity-70 transition hover:opacity-100"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-lg font-normal text-[var(--ink-950)] truncate" style={{ fontFamily: "var(--font-display)" }}>
                          {zone.name}
                        </h3>
                        <p className="mt-1 flex items-center gap-1 text-xs text-[var(--ink-500)]">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {zone.city}, {zone.state}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[var(--sage-50)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--sage-500)] border border-[var(--sage-200)]">
                        Soon
                      </span>
                    </div>

                    <div className="mt-4 flex items-center gap-4 text-xs tabular-nums">
                      <span className="flex items-center gap-1.5 text-[var(--ink-500)]">
                        <Building2 className="h-3.5 w-3.5" />
                        <span className="font-semibold">{zone.societies}</span> Societies
                      </span>
                      <span className="flex items-center gap-1.5 text-[var(--ink-500)]">
                        <Store className="h-3.5 w-3.5" />
                        <span className="font-semibold">{zone.markets}</span> Markets
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <MobileBottomNav />
    </div>
  );
}
