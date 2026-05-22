import { NextResponse } from "next/server";
import { createSupabaseAnonServerClient } from "@/lib/server/supabaseClients";

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
};

export type LocalitiesApiResponse = {
  ok: boolean;
  localities?: LocalityResponse[];
  code?: string;
  message?: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const zoneType = searchParams.get("zone_type");
  const phase = searchParams.get("phase");

  const supabase = createSupabaseAnonServerClient();

  if (!supabase) {
    return NextResponse.json(
      { ok: false, code: "CONFIG", message: "Supabase anon environment variables are missing." } satisfies LocalitiesApiResponse,
      { status: 500 }
    );
  }

  try {
    let query = supabase
      .from("localities")
      .select("*")
      .order("zone_type", { ascending: true })
      .order("name", { ascending: true });

    if (zoneType) {
      query = query.eq("zone_type", zoneType);
    }

    if (phase) {
      query = query.eq("phase", parseInt(phase, 10));
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { ok: false, code: "DB", message: error.message } satisfies LocalitiesApiResponse,
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      localities: data as LocalityResponse[],
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
