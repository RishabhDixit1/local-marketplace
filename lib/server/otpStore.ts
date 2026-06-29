import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";

const TTL_SECONDS = 10 * 60;

export async function createOtp(email: string): Promise<{ otp: string; userId: string }> {
  const db = createSupabaseAdminClient();
  if (!db) throw new Error("OTP store: Supabase admin client unavailable");

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const userId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString();

  const { error } = await db.from("otp_codes").insert({
    email,
    otp,
    user_id: userId,
    expires_at: expiresAt,
  });

  if (error) throw new Error(`Failed to store OTP: ${error.message}`);

  return { otp, userId };
}

export async function verifyOtp(email: string, otp: string): Promise<{ userId: string } | null> {
  const db = createSupabaseAdminClient();
  if (!db) return null;

  const { data, error } = await db
    .from("otp_codes")
    .select("id, user_id")
    .eq("email", email)
    .eq("otp", otp)
    .eq("used", false)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data) return null;

  await db.from("otp_codes").update({ used: true }).eq("id", data.id);

  return { userId: data.user_id };
}

export async function clearOtp(email: string): Promise<void> {
  const db = createSupabaseAdminClient();
  if (!db) return;

  await db.from("otp_codes").update({ used: true }).eq("email", email).eq("used", false);
}
