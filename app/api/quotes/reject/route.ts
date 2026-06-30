import { NextResponse } from "next/server";
import type { RejectQuoteRequest, QuoteApiErrorCode } from "@/lib/api/quotes";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

const toErrorResponse = (status: number, code: QuoteApiErrorCode, message: string, details?: string) =>
  NextResponse.json({ ok: false, code, message, details }, { status });

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) return toErrorResponse(authResult.status, "UNAUTHORIZED", authResult.message);

  let payload: RejectQuoteRequest;
  try {
    payload = await request.json() as RejectQuoteRequest;
  } catch {
    return toErrorResponse(400, "INVALID_PAYLOAD", "Invalid JSON body.");
  }

  const { quoteId, reason, counterRequest, counterAmount } = payload;

  if (!quoteId || typeof quoteId !== "string" || quoteId.trim().length === 0) {
    return toErrorResponse(400, "INVALID_PAYLOAD", "quoteId is required.");
  }

  const admin = createSupabaseAdminClient();
  const userClient = createSupabaseUserServerClient(authResult.auth.accessToken);
  const db = admin || userClient;
  if (!db) {
    return toErrorResponse(500, "CONFIG", "Supabase server credentials are missing.");
  }

  try {
    const userId = authResult.auth.userId;

    const quoteResult = await db
      .from("quote_drafts")
      .select("id,provider_id,consumer_id,status,metadata")
      .eq("id", quoteId)
      .maybeSingle();

    if (quoteResult.error) {
      return toErrorResponse(500, "UNKNOWN", quoteResult.error.message);
    }

    if (!quoteResult.data) {
      return toErrorResponse(404, "NOT_FOUND", "Quote not found.");
    }

    const quote = quoteResult.data;

    if (quote.consumer_id !== userId) {
      return toErrorResponse(403, "FORBIDDEN", "Only the consumer can reject this quote.");
    }

    if (quote.status !== "sent") {
      return toErrorResponse(400, "INVALID_STATE", "Quote must be sent before it can be rejected.");
    }

    const newStatus = counterRequest ? "countered" : "rejected";

    const updateResult = await db
      .from("quote_drafts")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
        metadata: {
          ...((quote.metadata as Record<string, unknown>) || {}),
          rejected_reason: reason || null,
          rejected_at: new Date().toISOString(),
          rejected_by: userId,
          is_counter_request: counterRequest || false,
          counter_amount: counterRequest ? counterAmount : null,
        },
      })
      .eq("id", quoteId)
      .select("id,status,metadata")
      .maybeSingle();

    if (updateResult.error) {
      return toErrorResponse(500, "UNKNOWN", updateResult.error.message);
    }

    return NextResponse.json({
      ok: true,
      quoteId,
      status: newStatus,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(500, "UNKNOWN", error instanceof Error ? error.message : "Failed to reject quote.");
  }
}
