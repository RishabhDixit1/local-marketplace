import type { User } from "@supabase/supabase-js";
import { createSupabaseAdminClient, createSupabaseAnonServerClient } from "@/lib/server/supabaseClients";
import { verifyLocalAuthToken } from "@/lib/server/customAuth";
import { NextResponse } from "next/server";

export type RequestAuthContext = {
  userId: string;
  email: string;
  accessToken: string;
  user: User;
};

export type AuthFailure = {
  ok: false;
  status: number;
  message: string;
};

const getBearerToken = (request: Request): string => {
  const raw = request.headers.get("authorization") || "";
  const token = raw.replace(/^Bearer\s+/i, "").trim();
  return token;
};

export const requireRequestAuth = async (
  request: Request
): Promise<{ ok: true; auth: RequestAuthContext } | AuthFailure> => {
  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return {
      ok: false,
      status: 401,
      message: "Missing bearer token.",
    };
  }

  const supabase = createSupabaseAnonServerClient();
  if (!supabase) {
    return {
      ok: false,
      status: 500,
      message: "Supabase anon environment variables are missing.",
    };
  }

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) {
    // GoTrue is unreachable — fall back to local JWT verification
    const localUser = verifyLocalAuthToken(accessToken);
    if (!localUser) {
      return {
        ok: false,
        status: 401,
        message: "Invalid or expired session token.",
      };
    }

    return {
      ok: true,
      auth: {
        userId: localUser.sub,
        email: localUser.email,
        accessToken,
        user: {
          id: localUser.sub,
          email: localUser.email,
          aud: "authenticated",
          role: "authenticated",
          app_metadata: { provider: "email" },
          user_metadata: { email: localUser.email },
          created_at: new Date().toISOString(),
        } as User,
      },
    };
  }

  // Check if user is suspended
  const admin = createSupabaseAdminClient();
  if (!admin) {
    console.error(
      "[requestAuth] Admin client unavailable — cannot verify suspension status for user",
      data.user.id,
    );
    return {
      ok: false,
      status: 500,
      message: "Auth service unavailable. Try again later.",
    };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("is_suspended")
    .eq("id", data.user.id)
    .maybeSingle<{ is_suspended: boolean | null }>();
  if (profile?.is_suspended === true) {
    return {
      ok: false,
      status: 403,
      message: "Account suspended. Contact support for assistance.",
    };
  }

  return {
    ok: true,
    auth: {
      userId: data.user.id,
      email: data.user.email || "",
      accessToken,
      user: data.user,
    },
  };
};

const parseEmailList = (raw: string): string[] =>
  raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

export const isAdminEmail = (email: string): boolean => {
  if (!email) return false;
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return false;

  const allowlist = process.env.ADMIN_EMAIL_ALLOWLIST || "";
  if (!allowlist.trim()) return false;

  const admins = parseEmailList(allowlist);
  return admins.includes(normalizedEmail);
};

export const CRON_SECRET_HEADER = "x-cron-secret";

export const verifyCronSecret = (request: Request): boolean => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron] CRON_SECRET env var is not set — denying all cron requests");
    return false;
  }
  const headerValue = request.headers.get(CRON_SECRET_HEADER) || "";
  return headerValue === secret;
};

export const cronAuthFailure = () =>
  NextResponse.json(
    { ok: false, message: "Unauthorized" },
    { status: 401 }
  );
