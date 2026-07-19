import { NextResponse } from "next/server";
import { createSupabaseAnonServerClient } from "@/lib/server/supabaseClients";
import { resolveProfileAvatarUrl } from "@/lib/mediaUrl";

export const runtime = "nodejs";

export type LocalityProvider = {
  id: string;
  full_name: string;
  avatar_url: string;
  locality_id: string;
  locality_name: string;
  service_category_ids: string[];
  trust_score: number;
  completed_jobs: number;
  response_time_minutes: number;
};

export type LocalityProvidersResponse = {
  ok: boolean;
  providers?: LocalityProvider[];
  total?: number;
  code?: string;
  message?: string;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get("category_id");
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  const supabase = createSupabaseAnonServerClient();

  if (!supabase) {
    return NextResponse.json(
      { ok: false, code: "CONFIG", message: "Supabase anon environment variables are missing." } satisfies LocalityProvidersResponse,
      { status: 500 }
    );
  }

  try {
    const { data, error } = await supabase.rpc("providers_near_locality", {
      p_locality_id: id,
      p_category_id: categoryId || null,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      return NextResponse.json(
        { ok: false, code: "DB", message: error.message } satisfies LocalityProvidersResponse,
        { status: 500 }
      );
    }

    const mapped = (data || []).map((row: Record<string, unknown>) => ({
      id: row.id,
      name: row.full_name || "",
      location: row.locality_name || "",
      avatar_url: resolveProfileAvatarUrl(row.avatar_url as string) || "",
      bio: "",
      services: [],
      avg_rating: null as number | null,
      review_count: 0,
      completed_jobs: row.completed_jobs ?? 0,
      response_minutes: row.response_time_minutes ?? null,
      price_min: null as number | null,
      price_max: null as number | null,
      verified: false,
    }));

    return NextResponse.json({
      ok: true,
      providers: mapped as LocalityProvider[],
      total: mapped.length,
    } satisfies LocalityProvidersResponse);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "DB",
        message: error instanceof Error ? error.message : "Unable to load locality providers.",
      } satisfies LocalityProvidersResponse,
      { status: 500 }
    );
  }
}
