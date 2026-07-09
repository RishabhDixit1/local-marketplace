import { NextResponse } from "next/server";
import { createSupabaseAnonServerClient } from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

export type FeaturedZone = {
  id: string;
  name: string;
  slug: string;
  provider_count: number;
};

export type MarketZoneResponse = {
  ok: boolean;
  area_name?: string;
  city?: string;
  state?: string;
  phase?: number;
  phase1_societies?: number;
  phase1_markets?: number;
  active_providers?: number;
  service_categories?: {
    id: string;
    name: string;
    slug: string;
    icon_slug: string;
    description: string;
    base_price_min: number;
    base_price_max: number;
  }[];
  featured_zones?: FeaturedZone[];
  code?: string;
  message?: string;
};

type MarketZone = {
  id: string;
  name: string;
  city: string;
  state: string;
  phase: number;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = createSupabaseAnonServerClient();

  if (!supabase) {
    return NextResponse.json(
      { ok: false, code: "CONFIG", message: "Supabase anon environment variables are missing." } satisfies MarketZoneResponse,
      { status: 500 }
    );
  }

  const { data: directZone } = await supabase
    .from("market_zones")
    .select("id, name, city, state, phase")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  let zone: MarketZone | null = directZone as MarketZone | null;

  if (!zone) {
    const { data: allZones } = await supabase
      .from("market_zones")
      .select("id, name, city, state, phase")
      .eq("is_active", true);

    const zones = (allZones ?? []) as MarketZone[];
    zone = zones.find(
      (z) => z.name.toLowerCase().replace(/\s+/g, "-") === slug
    ) ?? null;
  }

  if (!zone) {
    return NextResponse.json(
      { ok: false, code: "NOT_FOUND", message: `Unknown market zone "${slug}".` } satisfies MarketZoneResponse,
      { status: 404 }
    );
  }

  try {
    const [societiesResult, marketsResult, categoriesResult, providersResult, zonesResult] =
      await Promise.all([
        supabase
          .from("localities")
          .select("id", { count: "exact", head: true })
          .eq("zone_id", zone.id)
          .eq("zone_type", "society")
          .eq("phase", 1),
        supabase
          .from("localities")
          .select("id", { count: "exact", head: true })
          .eq("zone_id", zone.id)
          .eq("zone_type", "market")
          .eq("phase", 1),
        supabase
          .from("service_categories")
          .select("id, name, slug, icon_slug, description, base_price_min, base_price_max")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "provider")
          .not("locality_id", "is", null),
        supabase
          .from("localities")
          .select("id, name, slug")
          .eq("zone_id", zone.id)
          .eq("zone_type", "society")
          .eq("phase", 1)
          .order("name", { ascending: true })
          .limit(5),
      ]);

    const rawZones = (zonesResult.data || []) as Array<{ id: string; name: string; slug: string }>;
    const localityIds = rawZones.map((z) => z.id);
    const providerCounts: Record<string, number> = {};

    if (localityIds.length > 0) {
      const counts = await Promise.all(
        localityIds.map(async (locId) => {
          const { count } = await supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("role", "provider")
            .eq("locality_id", locId);
          return { locId, count: count ?? 0 };
        })
      );
      counts.forEach((c) => { providerCounts[c.locId] = c.count; });
    }

    const featuredZones: FeaturedZone[] = rawZones.map((z) => ({
      id: z.id,
      name: z.name,
      slug: z.slug,
      provider_count: providerCounts[z.id] || 0,
    }));

    return NextResponse.json({
      ok: true,
      area_name: zone.name,
      city: zone.city,
      state: zone.state,
      phase: zone.phase,
      phase1_societies: societiesResult.count ?? 0,
      phase1_markets: marketsResult.count ?? 0,
      active_providers: providersResult.count ?? 0,
      service_categories: categoriesResult.data || [],
      featured_zones: featuredZones,
    } satisfies MarketZoneResponse, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "DB",
        message: error instanceof Error ? error.message : "Unable to load market data.",
      } satisfies MarketZoneResponse,
      { status: 500 }
    );
  }
}
