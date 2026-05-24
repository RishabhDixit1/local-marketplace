import { NextResponse } from "next/server";
import type { QuoteApiErrorCode, QuoteContextRecord, QuoteDraftRecord, SendQuoteDraftResponse } from "@/lib/api/quotes";
import { sendQuoteDraft } from "@/lib/server/quoteWrites";
import { mapQuoteRouteError, parseQuoteDraftInput } from "@/lib/server/quoteRoute";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
import { sendOrderEmail, shouldSkipOrderEmail } from "@/lib/email";

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

  const result = await sendQuoteDraft({
    db: dbClient,
    userDb: userClient,
    userId: authResult.auth.userId,
    input,
  });

  if (!result.ok) {
    const error = mapQuoteRouteError(result);
    return toErrorResponse(error.status, error.code, error.message, error.details);
  }

  // Fire-and-forget: email consumer about the quote
  void (async () => {
    try {
      const reply = result as { ok: true; context: QuoteContextRecord; draft: QuoteDraftRecord };
      const consumerId = reply.context.consumerId;
      const admin = createSupabaseAdminClient();
      if (admin && consumerId) {
        const skip = await shouldSkipOrderEmail(consumerId);
        if (skip) return;
        const { data: consumerUser } = await admin.auth.admin.getUserById(consumerId);
        const email = consumerUser?.user?.email;
        if (email) {
          await sendOrderEmail({
            type: "quote_received",
            to: email,
            recipientName: (consumerUser.user?.user_metadata?.name as string | undefined) ?? "there",
            orderId: reply.context.orderId ?? "",
            itemTitle: reply.context.taskTitle,
            providerName: reply.context.counterpartyName,
            quoteAmount: reply.draft.total,
          });
        }
      }
    } catch (err) {
      console.error("[quote-send-email] failed", err);
    }
  })();

  return NextResponse.json(result satisfies SendQuoteDraftResponse, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
