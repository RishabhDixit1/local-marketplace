import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
import { sendPushToUser } from "@/lib/server/pushNotifications";
import { withErrorHandling } from "@/lib/server/errorHandler";

export const runtime = "nodejs";

const toError = (status: number, code: string, message: string) =>
  NextResponse.json({ ok: false, code, message }, { status });

const generateCode = (length = 8) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

async function getHandler(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return toError(401, "UNAUTHORIZED", auth.message);

  const db = createSupabaseAdminClient() || createSupabaseUserServerClient(auth.auth.accessToken);
  if (!db) return toError(500, "CONFIG", "No DB client");

  const [codesData, eventsData] = await Promise.all([
    db.from("referral_codes").select("*").eq("user_id", auth.auth.userId).order("created_at", { ascending: false }),
    db.from("referral_events").select("*, profiles!referral_events_referred_id_fkey(full_name)").eq("referrer_id", auth.auth.userId).order("created_at", { ascending: false }).limit(50),
  ]);

  const totalRewards = (eventsData.data || []).reduce((sum, e: { reward_points: number }) => sum + (e.reward_points || 0), 0);

  return NextResponse.json({
    ok: true,
    codes: codesData.data || [],
    referrals: eventsData.data || [],
    totalRewards,
  });
}

async function postHandler(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return toError(401, "UNAUTHORIZED", auth.message);

  const db = createSupabaseAdminClient() || createSupabaseUserServerClient(auth.auth.accessToken);
  if (!db) return toError(500, "CONFIG", "No DB client");

  const code = generateCode();

  const { data, error } = await db.from("referral_codes").insert({
    user_id: auth.auth.userId,
    code,
  }).select().single();

  if (error) return toError(400, "DB", error.message);
  return NextResponse.json({ ok: true, code: data });
}

export async function PATCH(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return toError(401, "UNAUTHORIZED", auth.message);

  const db = createSupabaseAdminClient() || createSupabaseUserServerClient(auth.auth.accessToken);
  if (!db) return toError(500, "CONFIG", "No DB client");

  const url = new URL(request.url);
  const referralCode = url.searchParams.get("code");
  if (!referralCode) return toError(400, "INVALID_PAYLOAD", "Referral code required.");

  const { data: codeData, error: codeError } = await db.from("referral_codes")
    .select("id, user_id, reward_points").eq("code", referralCode.toUpperCase()).eq("is_active", true).maybeSingle();

  if (codeError || !codeData) return toError(404, "NOT_FOUND", "Invalid or inactive referral code.");
  if (codeData.user_id === auth.auth.userId) return toError(400, "INVALID_STATE", "Cannot refer yourself.");

  const { error: eventError } = await db.from("referral_events").insert({
    referrer_id: codeData.user_id,
    referred_id: auth.auth.userId,
    reward_points: codeData.reward_points,
  }).select().single();

  if (eventError?.message?.includes("duplicate")) {
    return toError(400, "INVALID_STATE", "Already referred by this code.");
  }
  if (eventError) return toError(500, "DB", eventError.message);

  await db.from("referral_codes").update({ times_used: db.rpc("increment", { x: 1 }) }).eq("id", codeData.id);

  void sendPushToUser(db, codeData.user_id, {
    title: "Someone used your referral code!",
    body: `You earned ${codeData.reward_points} reward points.`,
    data: { url: "/dashboard/referrals" },
  });

  return NextResponse.json({ ok: true, rewardPoints: codeData.reward_points });
}

export const GET = withErrorHandling(getHandler, "referrals:info");
export const POST = withErrorHandling(postHandler, "referrals:redeem");
