import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: 401 });

  const db = createSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, message: "DB config error" }, { status: 500 });

  const { data, error } = await db
    .from("profiles")
    .select("verification_status, verification_level")
    .eq("id", auth.auth.userId)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    status: data?.verification_status || "unverified",
    level: data?.verification_level || "email",
  });
}
