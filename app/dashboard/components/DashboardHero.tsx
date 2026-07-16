"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { MapPin, Store, Users, X } from "lucide-react";

type MarketZone = { slug: string; name: string; location: string };
const FALLBACK_ZONE: MarketZone = { slug: "crossing-republik", name: "Crossing Republik", location: "Ghaziabad" };

interface DashboardHeroProps {
  activeCategory: string | null;
  providerCount: number;
}

export default function DashboardHero({ activeCategory, providerCount }: DashboardHeroProps) {
  const [zones, setZones] = useState<MarketZone[]>([FALLBACK_ZONE]);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? zones : zones.slice(0, 3);

  useEffect(() => {
    fetch("/api/market/zones")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.zones?.length) {
          setZones(
            data.zones.map((z: { slug: string; name: string; city: string; state: string }) => ({
              slug: z.slug,
              name: z.name,
              location: [z.city, z.state].filter(Boolean).join(", "),
            }))
          );
        }
      })
      .catch((err) => { console.error("[DashboardHero] failed to load zones:", err); });
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--brand-200)] bg-gradient-to-br from-[var(--brand-50)] to-white px-5 py-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -inset-32 opacity-20"
          style={{
            background:
              "radial-gradient(800px circle at 0% 50%, var(--brand-200), transparent 50%), radial-gradient(600px circle at 100% 50%, var(--brand-300), transparent 50%)",
          }}
          animate={{
            x: [0, 30, 0],
            y: [0, -20, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand-100)]">
          <MapPin className="h-5 w-5 text-[var(--brand-700)]" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {visible.map((zone) => (
              <Link
                key={zone.slug}
                href={`/market/zone/${zone.slug}`}
                className="inline-flex items-center gap-1 rounded-lg bg-[var(--brand-100)]/80 px-2 py-0.5 text-xs font-semibold text-[var(--brand-700)] transition hover:bg-[var(--brand-100)]"
              >
                <MapPin className="h-2.5 w-2.5" />
                {zone.name}
              </Link>
            ))}
            {zones.length > 3 && (
              <button
                type="button"
                onClick={() => setShowAll(!showAll)}
                className="text-[10px] font-semibold text-[var(--brand-600)] hover:text-[var(--brand-800)]"
              >
                {showAll ? "Show less" : `+${zones.length - 3} more`}
              </button>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">Hyperlocal marketplace — multiple zones</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link
          href="/market"
          className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-900)] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--brand-800)]"
        >
          <Store className="h-3.5 w-3.5" />
          View Market
        </Link>
        <Link
          href="/dashboard/providers"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300"
        >
          <Users className="h-3.5 w-3.5" />
          Browse All Providers
        </Link>
      </div>

      {activeCategory && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--brand-200)] bg-white/70 px-4 py-2.5">
          <p className="text-xs font-semibold text-slate-700">
            {providerCount > 0
              ? `${providerCount} ${activeCategory} provider${providerCount === 1 ? "" : "s"} near you`
              : `Showing results for ${activeCategory}`}
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600 transition hover:border-slate-300"
          >
            <X className="h-3 w-3" />
            Clear
          </Link>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
        <MapPin className="h-3 w-3 shrink-0" />
        <span>
          Active zones: {zones.map((z) => z.name).join(", ")}
        </span>
      </div>
    </div>
  );
}
