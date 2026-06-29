import { NextResponse } from "next/server";
import { verifyOtp } from "@/lib/server/otpStore";
import {
  createSupabaseAdminClient,
  createSupabaseAnonServerClient,
} from "@/lib/server/supabaseClients";
import { buildSupabaseSessionCookieValue } from "@/lib/server/customAuth";
import { withErrorHandling } from "@/lib/server/errorHandler";
import { applyRateLimit, AUTH_ROUTE_CONFIG } from "@/lib/server/rateLimit";

export const runtime = "nodejs";

async function ensureGoTrueUser(
  email: string,
): Promise<{ id: string; email: string } | null> {
  try {
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) return null;

    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (data?.user) {
      return { id: data.user.id, email: data.user.email! };
    }
    if (error && /already.+(registered|exists)/i.test(error.message)) {
      const { data: users } = await adminClient.auth.admin.listUsers();
      const existing = users?.users.find((u) => u.email?.toLowerCase() === email);
      if (existing) return { id: existing.id, email: existing.email! };
    }
    return null;
  } catch {
    return null;
  }
}

async function buildGoTrueSession(
  email: string,
): Promise<{
  session: Record<string, unknown>;
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string };
} | null> {
  try {
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) return null;

    // Ensure user exists in GoTrue (idempotent — ignores "already exists")
    const { error: createError } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (createError && !/already.+(registered|exists)/i.test(createError.message)) {
      return null;
    }

    // Generate a valid magic link token
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    const emailOtp = linkData?.properties?.email_otp;
    if (linkError || !emailOtp) return null;

    // Exchange the token for a real GoTrue session
    const anonClient = createSupabaseAnonServerClient();
    if (!anonClient) return null;

    const { data: verifyData, error: verifyError } = await anonClient.auth.verifyOtp({
      email,
      token: emailOtp,
      type: "magiclink",
    });

    if (verifyError || !verifyData?.session?.access_token) return null;

    const s = verifyData.session;
    return {
      accessToken: s.access_token,
      refreshToken: s.refresh_token,
      user: { id: s.user.id, email: s.user.email! },
      session: {
        access_token: s.access_token,
        refresh_token: s.refresh_token,
        token_type: s.token_type,
        expires_in: s.expires_in,
        expires_at: s.expires_at,
        user: {
          id: s.user.id,
          email: s.user.email,
          role: s.user.role,
          aud: s.user.aud,
          app_metadata: s.user.app_metadata,
          user_metadata: s.user.user_metadata,
        },
      },
    };
  } catch {
    return null;
  }
}

async function postHandler(request: Request) {
  let body: { email?: string; otp?: string };
  try {
    body = (await request.json()) as { email?: string; otp?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request payload." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const otp = body.otp?.trim() ?? "";

  if (!email || !otp) {
    return NextResponse.json({ ok: false, error: "Email and code are required." }, { status: 400 });
  }

  const result = await verifyOtp(email, otp);
  if (!result) {
    return NextResponse.json({ ok: false, error: "Invalid or expired code." }, { status: 401 });
  }

  // Rate-limit user creation
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const rateLimitCheck = await applyRateLimit(ip, "auth:verify-link-user-create", AUTH_ROUTE_CONFIG);
  if (rateLimitCheck.limited) {
    return rateLimitCheck.response as NextResponse;
  }

  // Domain allowlist check when AUTH_ALLOWED_DOMAINS is set
  const allowedDomains = process.env.AUTH_ALLOWED_DOMAINS;
  if (allowedDomains) {
    const domains = allowedDomains.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
    const emailDomain = email.split("@")[1]?.toLowerCase() ?? "";
    if (domains.length > 0 && !domains.includes(emailDomain)) {
      return NextResponse.json({ ok: false, error: "This email domain is not allowed." }, { status: 403 });
    }
  }

  const emailLowered = email;
  const session = await buildGoTrueSession(emailLowered);

  if (session) {
    const response = NextResponse.json({
      ok: true,
      ...session,
    });

    return response;
  }

  // Fallback: ensure user exists in auth.users, then create local JWT
  const goTrueUser = await ensureGoTrueUser(emailLowered);
  const fallbackUserId = goTrueUser?.id ?? result.userId;

  const { name, value, options } = buildSupabaseSessionCookieValue(fallbackUserId, emailLowered);

  const sessionData = JSON.parse(
    Buffer.from(value.replace("base64-", ""), "base64url").toString(),
  ) as {
    access_token: string;
    refresh_token: string;
    user: { id: string; email: string };
  };

  const expiresAt = Math.floor(Date.now() / 1000) + 34560000;

  const response = NextResponse.json({
    ok: true,
    user: { id: fallbackUserId, email: emailLowered },
    accessToken: sessionData.access_token,
    refreshToken: sessionData.refresh_token,
    session: {
      access_token: sessionData.access_token,
      refresh_token: sessionData.refresh_token,
      token_type: "bearer",
      expires_in: 34560000,
      expires_at: expiresAt,
      user: {
        id: fallbackUserId,
        email: emailLowered,
        role: "authenticated",
      },
    },
  });
  response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);

  return response;
}

export const POST = withErrorHandling(postHandler, "auth:verify-link");
