import { NextResponse } from "next/server";
import type { QuoteApiErrorCode, GetQuoteDraftResponse, SaveQuoteDraftResponse } from "@/lib/api/quotes";
import { loadQuoteDraft, saveQuoteDraft } from "@/lib/server/quoteWrites";
import { mapQuoteRouteError, parseQuoteDraftInput } from "@/lib/server/quoteRoute";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

const toErrorResponse = (status: number, code: QuoteApiErrorCode, message: string, details?: string) =>
  NextResponse.json(
    {
      ok: false,
      code,
      message,
      details,
    },
    { status }
  );

export async function GET(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return toErrorResponse(authResult.status, "UNAUTHORIZED", authResult.message);
  }

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId")?.trim() || undefined;
  const helpRequestId = searchParams.get("helpRequestId")?.trim() || undefined;

  if (!orderId && !helpRequestId) {
    return toErrorResponse(400, "INVALID_PAYLOAD", "orderId or helpRequestId is required.");
  }

  const admin = createSupabaseAdminClient();
  const userClient = createSupabaseUserServerClient(authResult.auth.accessToken);
  const dbClient = admin || userClient;
  if (!dbClient) {
    return toErrorResponse(
      500,
      "CONFIG",
      "Supabase server credentials are missing. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  const result = await loadQuoteDraft({
    db: dbClient,
    userId: authResult.auth.userId,
    orderId,
    helpRequestId,
  });

  if (!result.ok) {
    const error = mapQuoteRouteError(result);
    return toErrorResponse(error.status, error.code, error.message, error.details);
  }

  return NextResponse.json(result satisfies GetQuoteDraftResponse, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return toErrorResponse(authResult.status, "UNAUTHORIZED", authResult.message);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toErrorResponse(400, "INVALID_PAYLOAD", "Invalid JSON payload.");
  }

  const input = parseQuoteDraftInput(body);
  if (!input) {
    return toErrorResponse(400, "INVALID_PAYLOAD", "Request body does not match the quote draft schema.");
  }

  if (!input.orderId && !input.helpRequestId) {
    return toErrorResponse(400, "INVALID_PAYLOAD", "orderId or helpRequestId is required.");
  }

  const admin = createSupabaseAdminClient();
  const userClient = createSupabaseUserServerClient(authResult.auth.accessToken);
  const dbClient = admin || userClient;
  if (!dbClient) {
    return toErrorResponse(
      500,
      "CONFIG",
      "Supabase server credentials are missing. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  const result = await saveQuoteDraft({
    db: dbClient,
    userId: authResult.auth.userId,
    input,
  });

  if (!result.ok) {
    const error = mapQuoteRouteError(result);
    return toErrorResponse(error.status, error.code, error.message, error.details);
  }

  return NextResponse.json(result satisfies SaveQuoteDraftResponse, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
