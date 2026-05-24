import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { isAdminEmail, requireRequestAuth } from "@/lib/server/requestAuth";

export const runtime = "nodejs";

const EXPECTED_TABLES = [
  "profiles", "orders", "reviews", "help_requests", "feed_card_feedback",
  "trust_scores", "trust_artifacts", "business_launchpad_drafts",
  "user_settings", "notification_escalations", "workspaces", "workspace_members",
];

export async function GET(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }
  if (!isAdminEmail(auth.auth.email)) {
    return NextResponse.json({ ok: false, code: "FORBIDDEN", message: "Admin access required." }, { status: 403 });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, code: "CONFIG", message: "No DB client." }, { status: 500 });
  }

  const tableChecks = await Promise.all(
    EXPECTED_TABLES.map(async (table) => {
      try {
        const { count, error } = await db.from(table as never).select("*", { head: true, count: "exact" });
        return { table, exists: !error, rowCount: error ? null : (count ?? 0), error: error?.message ?? null };
      } catch {
        return { table, exists: false, rowCount: null, error: "Query failed" };
      }
    })
  );

  const missingTables = tableChecks.filter((t) => !t.exists);

  return NextResponse.json({
    ok: true,
    healthy: missingTables.length === 0,
    tables: tableChecks,
    summary: {
      total: tableChecks.length,
      present: tableChecks.filter((t) => t.exists).length,
      missing: missingTables.length,
    },
  });
}
