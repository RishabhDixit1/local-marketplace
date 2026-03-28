import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";

export const runtime = "nodejs";

type HelpRequestRow = {
  id: string;
  requester_id: string | null;
  accepted_provider_id: string | null;
  title: string | null;
  details: string | null;
  category: string | null;
  budget_min: number | null;
  budget_max: number | null;
  location_label: string | null;
  status: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
};

type HelpRequestsResponse =
  | { ok: true; requests: HelpRequestRow[] }
  | { ok: false; code: string; message: string };

export async function GET(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: "UNAUTHORIZED",
        message: authResult.message,
      } satisfies HelpRequestsResponse,
      { status: authResult.status }
    );
  }

  const admin = createSupabaseAdminClient();
  const dbClient = admin || createSupabaseUserServerClient(authResult.auth.accessToken);
  if (!dbClient) {
    return NextResponse.json(
      {
        ok: false,
        code: "CONFIG",
        message: "Supabase server credentials are missing.",
      } satisfies HelpRequestsResponse,
      { status: 500 }
    );
  }

  try {
    const { data, error } = await dbClient
      .from("help_requests")
      .select("id,requester_id,accepted_provider_id,title,details,category,budget_min,budget_max,location_label,status,metadata,created_at")
      .or(`requester_id.eq.${authResult.auth.userId},accepted_provider_id.eq.${authResult.auth.userId}`)
      .order("created_at", { ascending: false })
      .limit(120);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          code: "DB",
          message: error.message || "Could not load help requests.",
        } satisfies HelpRequestsResponse,
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        requests: (data as HelpRequestRow[] | null) || [],
      } satisfies HelpRequestsResponse,
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "DB",
        message: error instanceof Error ? error.message : "Unexpected error loading help requests.",
      } satisfies HelpRequestsResponse,
      { status: 500 }
    );
  }
}
