import jwt from "jsonwebtoken";

const getSecret = () =>
  process.env.SERVIQ_INTERNAL_PUSH_KEY || "serviq-local-dev-fallback-secret";

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
    name: "supabase.auth.token",
    value: encoded,
    options: {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      maxAge: SESSION_EXPIRY_SECONDS,
    },
  };
}
