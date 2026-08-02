import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { requireAdminAuth } from "@/lib/server/requestAuth";
import { withErrorHandling } from "@/lib/server/errorHandler";

export const runtime = "nodejs";

async function getHandler(request: Request) {
  const auth = await requireAdminAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, code: "CONFIG", message: "No DB client." }, { status: 500 });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const roleFilter = url.searchParams.get("role") || "";
  const limit = Math.min(Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)), 100);
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10));

  let query = db
    .from("profiles")
    .select("id,full_name,name,email,phone,role,location,onboarding_completed,created_at,trust_score,abuse_reports,verification_status")
    .order("created_at", { ascending: false });

  if (roleFilter && ["provider", "business", "seeker"].includes(roleFilter)) {
    query = query.eq("role", roleFilter);
  }

  if (q) {
    query = query.or(
      `full_name.ilike.%${q}%,name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`
    );
  }

  const { data, error } = await query.range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ ok: false, code: "DB", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, users: data ?? [] });
}

export const GET = withErrorHandling(getHandler, "admin:users");
