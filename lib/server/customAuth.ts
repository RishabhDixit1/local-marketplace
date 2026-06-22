import jwt from "jsonwebtoken";
import { getSupabaseAuthCookieName } from "@/lib/supabaseAuthCookie";

const getSecret = (): string => {
  const key = process.env.SERVIQ_INTERNAL_PUSH_KEY;
  if (!key) {
    throw new Error(
      "SERVIQ_INTERNAL_PUSH_KEY is not set. This variable is required for local auth token creation. " +
      "Set it to a long random string in your environment."
    );
  }
  return key;
};

const SESSION_EXPIRY_SECONDS = 400 * 24 * 60 * 60;

export function createLocalAuthToken(userId: string, email: string): string {
  return jwt.sign(
    {
      sub: userId,
      email,
      role: "authenticated",
      aud: "authenticated",
      app_metadata: { provider: "email" },
      user_metadata: { email },
    },
    getSecret(),
    { expiresIn: SESSION_EXPIRY_SECONDS }
  );
}

export function verifyLocalAuthToken(
  token: string,
): { sub: string; email: string } | null {
  try {
    const payload = jwt.verify(token, getSecret()) as jwt.JwtPayload & {
      sub: string;
      email?: string;
    };
    if (!payload.sub) return null;
    return { sub: payload.sub, email: payload.email || "" };
  } catch {
    return null;
  }
}

export function parseLocalSessionCookie(
  cookieValue: string,
): { access_token: string; user: { id: string; email: string } } | null {
  try {
    if (!cookieValue.startsWith("base64-")) return null;
    const json = Buffer.from(
      cookieValue.replace("base64-", ""),
      "base64url",
    ).toString();
    const session = JSON.parse(json);
    if (!session.access_token || !session.user?.id) return null;
    return session;
  } catch {
    return null;
  }
}

function base64url(data: string): string {
  return Buffer.from(data).toString("base64url");
}

export function buildSupabaseSessionCookieValue(
  userId: string,
  email: string
): { name: string; value: string; options: Record<string, unknown> } {
  const accessToken = createLocalAuthToken(userId, email);

  const now = Math.floor(Date.now() / 1000);
  const session = {
    access_token: accessToken,
    refresh_token: userId + "-local-refresh",
    user: {
      id: userId,
      aud: "authenticated",
      role: "authenticated",
      email,
      app_metadata: { provider: "email" },
      user_metadata: { email },
      confirmed_at: new Date().toISOString(),
    },
    expires_in: SESSION_EXPIRY_SECONDS,
    expires_at: now + SESSION_EXPIRY_SECONDS,
    token_type: "bearer",
  };

  const encoded = "base64-" + base64url(JSON.stringify(session));

  return {
    name: getSupabaseAuthCookieName(),
    value: encoded,
    options: {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      maxAge: SESSION_EXPIRY_SECONDS,
    },
  };
}
