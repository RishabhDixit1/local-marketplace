import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { withErrorHandling } from "@/lib/server/errorHandler";
import { exchangeGoogleCode } from "@/lib/server/oauth/google";

export const runtime = "nodejs";

async function getHandler(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const stateRaw = url.searchParams.get("state");

  if (error || !code) {
    const reason = error || "No code provided";
    return redirectWithError(stateRaw, `Google auth failed: ${reason}`);
  }

  let userId: string | null = null;
  let redirectTo = "/dashboard/settings";
  if (stateRaw) {
    try {
      const state = JSON.parse(stateRaw);
      userId = state.userId || null;
      redirectTo = state.redirectTo || "/dashboard/settings";
    } catch { /* ignore invalid state */ }
  }

  if (!userId) {
    return redirectWithError(stateRaw, "Missing user ID in state");
  }

  const tokenResult = await exchangeGoogleCode(code);
  if (!tokenResult.ok) {
    return redirectWithError(stateRaw, tokenResult.error);
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return redirectWithError(stateRaw, "No DB client");
  }

  const { error: upsertError } = await db.from("google_business_tokens").upsert({
    provider_id: userId,
    access_token: tokenResult.tokens.accessToken,
    refresh_token: tokenResult.tokens.refreshToken,
    token_expires_at: new Date(tokenResult.tokens.expiryDate).toISOString(),
    is_active: true,
  }, {
    onConflict: "provider_id",
    ignoreDuplicates: false,
  });

  if (upsertError) {
    return redirectWithError(stateRaw, `Token storage failed: ${upsertError.message}`);
  }

  return NextResponse.redirect(new URL(redirectTo, request.url));
}

export const GET = withErrorHandling(getHandler, "auth:google-callback");

function redirectWithError(stateRaw: string | null, message: string) {
  let redirectTo = "/dashboard/settings";
  if (stateRaw) {
    try {
      const state = JSON.parse(stateRaw);
      redirectTo = state.redirectTo || "/dashboard/settings";
    } catch { /* ignore */ }
  }
  return NextResponse.redirect(
    new URL(`${redirectTo}?error=${encodeURIComponent(message)}`, "https://www.serviq.in")
  );
}
