import { NextResponse } from "next/server";
import type {
  ConnectionMutationResponse,
  ConnectionsListResponse,
  SendConnectionRequestPayload,
} from "@/lib/api/connections";
import { CONNECTION_SCHEMA_UNAVAILABLE_MESSAGE } from "@/lib/connectionErrors";
import { createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import {
  hasConnectionRequestSchema,
  listViewerConnectionRows,
  sendViewerConnectionRequest,
} from "@/lib/server/connectionRequests";

export const runtime = "nodejs";

const toErrorResponse = (
  status: number,
  code: Extract<ConnectionMutationResponse | ConnectionsListResponse, { ok: false }>["code"],
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

const isSendConnectionRequestPayload = (value: unknown): value is SendConnectionRequestPayload => {
  if (!value || typeof value !== "object") return false;

  const targetUserId = (value as Record<string, unknown>).targetUserId;
  return typeof targetUserId === "string" && targetUserId.trim().length > 0;
};

export async function GET(request: Request) {
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
      return NextResponse.json({
        ok: true,
        viewerId: authResult.auth.userId,
        rows: [],
        schemaReady: false,
        schemaMessage: CONNECTION_SCHEMA_UNAVAILABLE_MESSAGE,
      } satisfies ConnectionsListResponse);
    }

    const rows = await listViewerConnectionRows(dbClient, authResult.auth.userId);
    return NextResponse.json({
      ok: true,
      viewerId: authResult.auth.userId,
      rows,
      schemaReady: true,
      schemaMessage: null,
    } satisfies ConnectionsListResponse);
  } catch (error) {
    return toErrorResponse(500, "DB", error instanceof Error ? error.message : "Unable to load connections.");
  }
}

export async function POST(request: Request) {
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

  if (!isSendConnectionRequestPayload(body)) {
    return toErrorResponse(400, "INVALID_PAYLOAD", "targetUserId is required.");
  }

  try {
    const result = await sendViewerConnectionRequest(dbClient, authResult.auth.userId, body.targetUserId.trim());
    return NextResponse.json({
      ok: true,
      viewerId: authResult.auth.userId,
      requestId: result.requestId,
      rows: result.rows,
    } satisfies ConnectionMutationResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send connection request.";
    const status = /not found/i.test(message) ? 404 : /invalid|required|yourself/i.test(message) ? 400 : 500;
    const code = status === 404 ? "NOT_FOUND" : status === 400 ? "INVALID_PAYLOAD" : "DB";
    return toErrorResponse(status, code, message);
  }
}
