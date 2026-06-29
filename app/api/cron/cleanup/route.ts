import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { verifyCronSecret, cronAuthFailure } from "@/lib/server/requestAuth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) return cronAuthFailure();

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, error: "No DB client." }, { status: 500 });
  }

  // Delete booking_slots that have been "rescheduled" for more than 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: deleted, error } = await db
    .from("booking_slots")
    .delete()
    .eq("status", "rescheduled")
    .lt("updated_at", thirtyDaysAgo)
    .select("id");

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Also soft-delete expired OTP codes older than 24h
  const { error: otpErr } = await db.rpc("cleanup_expired_otps");

  return NextResponse.json({
    ok: true,
    deleted_rescheduled_bookings: deleted?.length ?? 0,
    otp_cleanup_triggered: !otpErr,
  });
}
