import { NextResponse } from "next/server";
import type { ConnectionMutationResponse, RespondToConnectionRequestPayload } from "@/lib/api/connections";
import { CONNECTION_SCHEMA_UNAVAILABLE_MESSAGE } from "@/lib/connectionErrors";
import { createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { hasConnectionRequestSchema, respondViewerConnectionRequest } from "@/lib/server/connectionRequests";

export const runtime = "nodejs";

const validDecisions = new Set(["accepted", "rejected", "cancelled"]);

const toErrorResponse = (
  status: number,
  code: Extract<ConnectionMutationResponse, { ok: false }>["code"],
  message: string
) =>
  NextResponse.json(
    {
      ok: false,
      code,
      message,
    },
    { status }
  );

const isRespondPayload = (value: unknown): value is RespondToConnectionRequestPayload => {
  if (!value || typeof value !== "object") return false;

  const decision = (value as Record<string, unknown>).decision;
  return typeof decision === "string" && validDecisions.has(decision);
};

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ requestId: string }>;
  }
) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return toErrorResponse(authResult.status, "UNAUTHORIZED", authResult.message);
  }

  const dbClient = createSupabaseUserServerClient(authResult.auth.accessToken);
  if (!dbClient) {
    return toErrorResponse(500, "DB", "Supabase auth client is unavailable.");
  }

  try {
    const schemaReady = await hasConnectionRequestSchema(dbClient);
    if (!schemaReady) {
      return toErrorResponse(503, "DB", CONNECTION_SCHEMA_UNAVAILABLE_MESSAGE);
    }
  } catch (error) {
    return toErrorResponse(500, "DB", error instanceof Error ? error.message : "Unable to load connections.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toErrorResponse(400, "INVALID_PAYLOAD", "Invalid JSON payload.");
  }

  if (!isRespondPayload(body)) {
    return toErrorResponse(400, "INVALID_PAYLOAD", "decision must be accepted, rejected, or cancelled.");
  }

  const { requestId } = await context.params;
  if (!requestId?.trim()) {
    return toErrorResponse(400, "INVALID_PAYLOAD", "requestId is required.");
  }

  try {
    const result = await respondViewerConnectionRequest(dbClient, authResult.auth.userId, requestId.trim(), body.decision);
    return NextResponse.json({
      ok: true,
      viewerId: authResult.auth.userId,
      requestId: result.requestId,
      rows: result.rows,
    } satisfies ConnectionMutationResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update connection request.";
    const status = /not found/i.test(message) ? 404 : /only the|invalid|required/i.test(message) ? 400 : 500;
    const code = status === 404 ? "NOT_FOUND" : status === 400 ? "INVALID_PAYLOAD" : "DB";
    return toErrorResponse(status, code, message);
  }
}
