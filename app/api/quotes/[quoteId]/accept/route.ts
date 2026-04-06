import { NextResponse } from "next/server";
import type { AcceptQuoteResponse, QuoteApiErrorCode } from "@/lib/api/quotes";
import { acceptQuoteDraft } from "@/lib/server/quoteWrites";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

const toErrorResponse = (status: number, code: QuoteApiErrorCode, message: string, details?: string) =>
  NextResponse.json({ ok: false, code, message, details }, { status });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) return toErrorResponse(authResult.status, "UNAUTHORIZED", authResult.message);

  const { quoteId } = await params;
  if (!quoteId?.trim()) return toErrorResponse(400, "INVALID_PAYLOAD", "quoteId path parameter is required.");

  const admin = createSupabaseAdminClient();
  const userClient = createSupabaseUserServerClient(authResult.auth.accessToken);
  const dbClient = admin || userClient;
  if (!dbClient) {
    return toErrorResponse(500, "CONFIG", "Supabase server credentials are missing.");
  }

  const result = await acceptQuoteDraft({
    db: dbClient,
    userId: authResult.auth.userId,
    quoteId,
  });

  if (!result.ok) {
    if (result.forbidden) return toErrorResponse(403, "FORBIDDEN", result.message);
    if (result.notFound) return toErrorResponse(404, "NOT_FOUND", result.message);
    if (result.invalid) return toErrorResponse(409, "INVALID_PAYLOAD", result.message);
    return toErrorResponse(500, "DB", result.message, result.details ?? undefined);
  }

  return NextResponse.json(result satisfies AcceptQuoteResponse);
}
