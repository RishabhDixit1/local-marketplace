import { NextResponse } from "next/server";
import { createSupabaseAnonServerClient } from "@/lib/server/supabaseClients";

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

    return NextResponse.json({
      ok: true,
      providers: (data || []) as LocalityProvider[],
      total: (data || []).length,
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
