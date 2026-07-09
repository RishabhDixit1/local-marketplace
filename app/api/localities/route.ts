import { NextResponse } from "next/server";
import { createSupabaseAnonServerClient } from "@/lib/server/supabaseClients";
import { withCache, queryCacheKey } from "@/lib/cache/withCache";

export const runtime = "nodejs";

export type LocalityResponse = {
  id: string;
  name: string;
  slug: string;
  zone_type: string;
  phase: number;
  lat: number | null;
  lng: number | null;
  radius_km: number;
  city: string;
  state: string;
  zone_id: string | null;
  zone_slug: string | null;
};

export type LocalitiesApiResponse = {
  ok: boolean;
  localities?: LocalityResponse[];
  code?: string;
  message?: string;
};

type RawLocality = {
  id: string;
  name: string;
  slug: string;
  zone_type: string;
  phase: number;
  lat: number | null;
  lng: number | null;
  radius_km: number;
  city: string;
  state: string;
  zone_id: string | null;
  market_zones: { slug: string } | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const zoneType = searchParams.get("zone_type");
  const phase = searchParams.get("phase");
  const zoneSlug = searchParams.get("zone_slug");

  const supabase = createSupabaseAnonServerClient();

  if (!supabase) {
    return NextResponse.json(
      { ok: false, code: "CONFIG", message: "Supabase anon environment variables are missing." } satisfies LocalitiesApiResponse,
      { status: 500 }
    );
  }

  try {
    const cacheKey = queryCacheKey("localities", zoneType ?? "all", phase ?? "all", zoneSlug ?? "all");
    const result = await withCache<LocalityResponse[]>(
      async () => {
        let query = supabase
          .from("localities")
          .select("*, market_zones!left(slug)")
          .order("zone_type", { ascending: true })
          .order("name", { ascending: true });

        if (zoneType) {
          query = query.eq("zone_type", zoneType);
        }

        if (phase) {
          query = query.eq("phase", parseInt(phase, 10));
        }

        if (zoneSlug) {
          query = query.eq("market_zones.slug", zoneSlug);
        }

        const { data, error } = await query;

        if (error) throw new Error(error.message);

        return ((data ?? []) as RawLocality[]).map((r) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
          zone_type: r.zone_type,
          phase: r.phase,
          lat: r.lat,
          lng: r.lng,
          radius_km: r.radius_km,
          city: r.city,
          state: r.state,
          zone_id: r.zone_id,
          zone_slug: r.market_zones?.slug ?? null,
        }));
      },
      { key: cacheKey, ttlSeconds: 3600 },
    );

    return NextResponse.json({
      ok: true,
      localities: result,
    } satisfies LocalitiesApiResponse);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "DB",
        message: error instanceof Error ? error.message : "Unable to load localities.",
      } satisfies LocalitiesApiResponse,
      { status: 500 }
    );
  }
}
