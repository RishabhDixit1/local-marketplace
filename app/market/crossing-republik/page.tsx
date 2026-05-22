import Link from "next/link";
import { Building2, MapPin, Store, Users } from "lucide-react";
import type { LocalityResponse } from "@/app/api/localities/route";
import { createSupabaseAnonServerClient } from "@/lib/server/supabaseClients";
import ZoneBrowser from "@/app/components/locality/ZoneBrowser";
import ServiceCategoryGrid from "@/app/components/services/ServiceCategoryGrid";

export const dynamic = 'force-dynamic';

type LocalityWithCount = LocalityResponse & { provider_count: number };

async function getMarketData() {
  const supabase = createSupabaseAnonServerClient();
  if (!supabase) return null;

  const [localitiesResult, categoriesResult, providersResult] = await Promise.all([
    supabase
      .from("localities")
      .select("id, name, slug, zone_type, phase, lat, lng, radius_km, city, state")
      .order("zone_type", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("service_categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, locality_id")
      .eq("role", "provider")
      .not("locality_id", "is", null),
  ]);

  const rawLocalities = (localitiesResult.data || []) as LocalityResponse[];
  const localities: LocalityWithCount[] = rawLocalities.map((l) => ({
    ...l,
    provider_count: 0,
  }));

  const counts: Record<string, number> = {};
  for (const p of providersResult.data || []) {
    const locId = (p as Record<string, unknown>).locality_id as string;
    if (locId) counts[locId] = (counts[locId] || 0) + 1;
  }
  for (const l of localities) {
    l.provider_count = counts[l.id] || 0;
  }

  const societies = localities.filter((l) => l.zone_type === "society" && l.phase === 1);
  const markets = localities.filter((l) => l.zone_type === "market" && l.phase === 1);

  return {
    societies,
    markets,
    activeProviders: Object.keys(counts).length,
    categories: categoriesResult.data || [],
    allLocalities: localities,
  };
}

export default async function CrossingRepublikPage() {
  const data = await getMarketData();

  if (!data) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center justify-center px-4 py-20 text-center">
        <MapPin className="mb-4 h-12 w-12 text-slate-300" />
        <h1 className="text-xl font-bold text-slate-900">Market data unavailable</h1>
        <p className="mt-2 text-sm text-slate-500">
          Could not load Crossing Republik market information. Please try again later.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-20 pt-6 sm:px-6 sm:pt-10">
      <section className="mb-10 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--brand-100)]">
          <MapPin className="h-8 w-8 text-[var(--brand-700)]" />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
          ServiQ is live in <span className="text-[var(--brand-700)]">Crossing Republik</span>
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
          Ghaziabad&apos;s local marketplace — find trusted service providers in your neighbourhood.
          Repairs, installations, and home services at your doorstep.
        </p>

        <div className="mx-auto mt-6 grid max-w-lg grid-cols-3 divide-x divide-slate-200 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col items-center py-3">
            <Building2 className="mb-1 h-4 w-4 text-[var(--brand-600)]" />
            <span className="text-lg font-bold text-slate-900">{data.societies.length}</span>
            <span className="text-[10px] text-slate-500">Societies</span>
          </div>
          <div className="flex flex-col items-center py-3">
            <Store className="mb-1 h-4 w-4 text-[var(--brand-600)]" />
            <span className="text-lg font-bold text-slate-900">{data.markets.length}</span>
            <span className="text-[10px] text-slate-500">Markets</span>
          </div>
          <div className="flex flex-col items-center py-3">
            <Users className="mb-1 h-4 w-4 text-[var(--brand-600)]" />
            <span className="text-lg font-bold text-slate-900">{data.activeProviders}</span>
            <span className="text-[10px] text-slate-500">Providers</span>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Browse Local Zones</h2>
        </div>
        <ZoneBrowser initialLocalities={data.allLocalities} />
      </section>

      <section className="mb-10">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">Services Available</h2>
          <p className="text-xs text-slate-500">
            Browse by category — standard pricing for Crossing Republik
          </p>
        </div>
        <ServiceCategoryGrid categories={data.categories} />
      </section>

      <section className="mx-auto max-w-lg space-y-3">
        <Link
          href="/dashboard"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand-900)] px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[var(--brand-800)]"
        >
          Book a Service
        </Link>
        <Link
          href="/dashboard"
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition hover:border-slate-300"
        >
          Join as Provider
        </Link>
      </section>
    </div>
  );
}
