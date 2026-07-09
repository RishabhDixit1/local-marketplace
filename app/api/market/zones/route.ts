import { NextResponse } from "next/server";
import { createSupabaseAnonServerClient } from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

export type MarketZoneSummary = {
  id: string;
  slug: string;
  name: string;
  city: string;
  state: string;
  phase: number;
  is_active: boolean;
  societies: number;
  markets: number;
};

export type MarketZonesResponse = {
  ok: boolean;
  zones: MarketZoneSummary[];
  code?: string;
  message?: string;
};

export async function GET() {
  const supabase = createSupabaseAnonServerClient();

  if (!supabase) {
    return NextResponse.json(
      { ok: false, zones: [], code: "CONFIG", message: "Supabase anon environment variables are missing." } satisfies MarketZonesResponse,
      { status: 500 }
    );
  }

  try {
    const { data: zones, error } = await supabase
      .from("market_zones")
      .select("id, slug, name, city, state, phase, is_active")
      .eq("is_active", true)
      .order("phase", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw new Error(error.message);

    const zoneIds = (zones ?? []).map((z) => z.id);

    const countMap: Record<string, { societies: number; markets: number }> = {};
    if (zoneIds.length > 0) {
      const { data: localities } = await supabase
        .from("localities")
        .select("zone_id, zone_type")
        .in("zone_id", zoneIds);

      for (const loc of localities ?? []) {
        if (!countMap[loc.zone_id]) {
          countMap[loc.zone_id] = { societies: 0, markets: 0 };
        }
        if (loc.zone_type === "society") countMap[loc.zone_id].societies++;
        if (loc.zone_type === "market") countMap[loc.zone_id].markets++;
      }
    }

    const result: MarketZoneSummary[] = (zones ?? []).map((z) => ({
      id: z.id,
      slug: z.slug,
      name: z.name,
      city: z.city,
      state: z.state,
      phase: z.phase,
      is_active: z.is_active,
      societies: countMap[z.id]?.societies ?? 0,
      markets: countMap[z.id]?.markets ?? 0,
    }));

    return NextResponse.json({ ok: true, zones: result } satisfies MarketZonesResponse);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        zones: [],
        code: "DB",
        message: error instanceof Error ? error.message : "Failed to load market zones.",
      } satisfies MarketZonesResponse,
      { status: 500 }
    );
  }
}
