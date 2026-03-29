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

const sortByCreatedAtDesc = (rows: HelpRequestRow[]) =>
  rows.sort((left, right) => {
    const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0;
    const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0;
    return rightTime - leftTime;
  });

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
    const selectClause =
      "id,requester_id,accepted_provider_id,title,details,category,budget_min,budget_max,location_label,status,metadata,created_at";
    const [visibleResult, cancelledHistoryResult] = await Promise.all([
      dbClient
        .from("help_requests")
        .select(selectClause)
        .or(`requester_id.eq.${authResult.auth.userId},accepted_provider_id.eq.${authResult.auth.userId}`)
        .order("created_at", { ascending: false })
        .limit(120),
      dbClient
        .from("help_requests")
        .select(selectClause)
        .eq("status", "cancelled")
        .contains("metadata", {
          relist_after_decline: true,
          last_declined_provider_id: authResult.auth.userId,
        })
        .order("created_at", { ascending: false })
        .limit(120),
    ]);

    const error = visibleResult.error || cancelledHistoryResult.error;
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

    const combined = new Map<string, HelpRequestRow>();
    for (const row of (cancelledHistoryResult.data as HelpRequestRow[] | null) || []) {
      combined.set(row.id, row);
    }
    for (const row of (visibleResult.data as HelpRequestRow[] | null) || []) {
      combined.set(row.id, row);
    }

    return NextResponse.json(
      {
        ok: true,
        requests: sortByCreatedAtDesc(Array.from(combined.values())).slice(0, 120),
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
