import { NextResponse } from "next/server";
import type { QuoteApiErrorCode, QuoteDraftInput, SendQuoteDraftResponse } from "@/lib/api/quotes";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
import { sendQuoteDraft } from "@/lib/server/quoteWrites";

export const runtime = "nodejs";

const toErrorResponse = (status: number, code: QuoteApiErrorCode, message: string, details?: string) =>
  NextResponse.json(
    {
      ok: false,
      code,
      message,
      details,
    } satisfies SendQuoteDraftResponse,
    { status }
  );

const isQuoteDraftInput = (payload: unknown): payload is QuoteDraftInput => {
  if (!payload || typeof payload !== "object") return false;
  const record = payload as Record<string, unknown>;

  const isOptionalString = (value: unknown) => typeof value === "undefined" || typeof value === "string" || value === null;
  const isLineItem = (value: unknown) => {
    if (!value || typeof value !== "object") return false;
    const lineItem = value as Record<string, unknown>;
    return (
      typeof lineItem.label === "string" &&
      typeof lineItem.description === "string" &&
      typeof lineItem.quantity === "number" &&
      typeof lineItem.unitPrice === "number"
    );
  };

  return (
    isOptionalString(record.orderId) &&
    isOptionalString(record.helpRequestId) &&
    typeof record.summary === "string" &&
    typeof record.notes === "string" &&
    typeof record.taxAmount === "number" &&
    Array.isArray(record.lineItems) &&
    record.lineItems.every(isLineItem) &&
    isOptionalString(record.expiresAt) &&
    isOptionalString(record.conversationId)
  );
};

const mapError = (message: string, extra?: { forbidden?: boolean; invalid?: boolean; notFound?: boolean; missingTable?: boolean; config?: boolean }) => {
  const normalized = message.toLowerCase();

  if (extra?.config) {
    return {
      status: 500,
      code: "CONFIG" as const,
    };
  }

  if (extra?.forbidden) {
    return {
      status: 403,
      code: "FORBIDDEN" as const,
    };
  }

  if (extra?.invalid || normalized.includes("required") || normalized.includes("invalid")) {
    return {
      status: 400,
      code: "INVALID_PAYLOAD" as const,
    };
  }

  if (extra?.notFound || extra?.missingTable || normalized.includes("not found")) {
    return {
      status: extra?.missingTable ? 503 : 404,
      code: "NOT_FOUND" as const,
    };
  }

  return {
    status: 500,
    code: "DB" as const,
  };
};

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return toErrorResponse(authResult.status, "UNAUTHORIZED", authResult.message);
  }

  const admin = createSupabaseAdminClient();
  const userDb = createSupabaseUserServerClient(authResult.auth.accessToken);
  const db = admin || userDb;

  if (!db) {
    return toErrorResponse(500, "CONFIG", "Supabase server credentials are missing.");
  }

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return toErrorResponse(400, "INVALID_PAYLOAD", "Invalid JSON payload.");
  }

  if (!isQuoteDraftInput(body)) {
    return toErrorResponse(400, "INVALID_PAYLOAD", "Request body does not match the quote send schema.");
  }

  const result = await sendQuoteDraft({
    db,
    userDb,
    userId: authResult.auth.userId,
    input: body,
  });

  if (!result.ok) {
    const mapped = mapError(result.message, result);
    return toErrorResponse(mapped.status, mapped.code, result.message, result.details || undefined);
  }

  return NextResponse.json(
    {
      ok: true,
      context: result.context,
      draft: result.draft,
      orderId: result.orderId,
      orderStatus: result.orderStatus,
      conversationId: result.conversationId,
    } satisfies SendQuoteDraftResponse,
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
