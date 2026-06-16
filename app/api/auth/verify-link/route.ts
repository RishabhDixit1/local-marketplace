import { NextResponse } from "next/server";
import { verifyOtp } from "@/lib/server/otpStore";
import {
  createSupabaseAdminClient,
  createSupabaseAnonServerClient,
} from "@/lib/server/supabaseClients";
import { buildSupabaseSessionCookieValue } from "@/lib/server/customAuth";
import { withErrorHandling } from "@/lib/server/errorHandler";

export const runtime = "nodejs";

async function getHandler(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.trim().toLowerCase() ?? "";
  const otp = searchParams.get("otp")?.trim() ?? "";

  if (!email || !otp) {
    return NextResponse.redirect(new URL("/?error=missing_params", request.url));
  }

  const result = verifyOtp(email, otp);
  if (!result) {
    return NextResponse.redirect(new URL("/?error=invalid_or_expired_code", request.url));
  }

  const cookie = buildSupabaseSessionCookieValue(result.userId, email);
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set(cookie.name, cookie.value, cookie.options as Parameters<typeof response.cookies.set>[2]);

  return response;
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

  const result = verifyOtp(email, otp);
  if (!result) {
    return NextResponse.json({ ok: false, error: "Invalid or expired code." }, { status: 401 });
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

  // Fallback: buildSupabaseSessionCookieValue if GoTrue admin API is unavailable
  const { name, value, options } = buildSupabaseSessionCookieValue(result.userId, emailLowered);

  const sessionData = JSON.parse(
    Buffer.from(value.replace("base64-", ""), "base64url").toString(),
  ) as {
    access_token: string;
    refresh_token: string;
    user: { id: string; email: string };
  };

  const response = NextResponse.json({
    ok: true,
    user: { id: result.userId, email: emailLowered },
    accessToken: sessionData.access_token,
    refreshToken: sessionData.refresh_token,
    session: {
      access_token: sessionData.access_token,
      refresh_token: sessionData.refresh_token,
      token_type: "bearer",
      expires_in: 34560000,
      user: {
        id: result.userId,
        email: emailLowered,
        role: "authenticated",
      },
    },
  });
  response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);

  return response;
}

export const GET = withErrorHandling(getHandler, "auth:verify-link");
export const POST = withErrorHandling(postHandler, "auth:verify-link");
