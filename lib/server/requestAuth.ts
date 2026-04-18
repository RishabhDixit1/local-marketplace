import type { User } from "@supabase/supabase-js";
import { createSupabaseAnonServerClient } from "@/lib/server/supabaseClients";

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
    return {
      ok: false,
      status: 401,
      message: "Invalid or expired session token.",
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

  const allowlist = process.env.ADMIN_EMAIL_ALLOWLIST || process.env.NEXT_PUBLIC_ADMIN_EMAILS || "";
  if (!allowlist.trim()) return false;

  const admins = parseEmailList(allowlist);
  return admins.includes(normalizedEmail);
};
