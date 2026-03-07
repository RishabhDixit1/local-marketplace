import { NextResponse } from "next/server";
import type { PublishApiErrorCode, PublishPostRequest, PublishPostResponse } from "@/lib/api/publish";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { insertPostRow } from "@/lib/server/publishWrites";

export const runtime = "nodejs";

const toErrorResponse = (
  status: number,
  code: PublishApiErrorCode,
  message: string,
  details?: string
) =>
  NextResponse.json(
    {
      ok: false,
      code,
      message,
      details,
    },
    { status }
  );

const isPublishPostRequest = (payload: unknown): payload is PublishPostRequest => {
  if (!payload || typeof payload !== "object") return false;
  const record = payload as Record<string, unknown>;
  const postType = record.postType;
  return (
    (postType === "service" || postType === "product") &&
    typeof record.title === "string" &&
    typeof record.details === "string" &&
    typeof record.category === "string" &&
    (typeof record.budget === "number" || record.budget === null) &&
    typeof record.locationLabel === "string" &&
    typeof record.radiusKm === "number" &&
    (record.mode === "urgent" || record.mode === "schedule") &&
    typeof record.neededWithin === "string" &&
    typeof record.scheduleDate === "string" &&
    typeof record.scheduleTime === "string" &&
    typeof record.flexibleTiming === "boolean" &&
    Array.isArray(record.media)
  );
};

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return toErrorResponse(authResult.status, "UNAUTHORIZED", authResult.message);
  }

  const admin = createSupabaseAdminClient();
  const dbClient = admin || createSupabaseUserServerClient(authResult.auth.accessToken);
  if (!dbClient) {
    return toErrorResponse(
      500,
      "CONFIG",
      "Supabase server credentials are missing. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toErrorResponse(400, "INVALID_PAYLOAD", "Invalid JSON payload.");
  }

  if (!isPublishPostRequest(body)) {
    return toErrorResponse(400, "INVALID_PAYLOAD", "Request body does not match publish post schema.");
  }

  const title = body.title.trim();
  if (!title) {
    return toErrorResponse(400, "INVALID_PAYLOAD", "Title is required.");
  }

  const writeResult = await insertPostRow({
    admin: dbClient,
    userId: authResult.auth.userId,
    email: authResult.auth.email,
    postType: body.postType,
    payload: {
      ...body,
      title,
      details: body.details.trim(),
      category: body.category.trim() || "General",
      locationLabel: body.locationLabel.trim() || "Nearby",
    },
  });

  if (!writeResult.id) {
    const missingTable = writeResult.missingTable;
    return toErrorResponse(
      missingTable ? 503 : 500,
      missingTable ? "NOT_FOUND" : "DB",
      writeResult.errorMessage || "Failed to publish post.",
      writeResult.details || undefined
    );
  }

  return NextResponse.json({
    ok: true,
    postId: writeResult.id,
    postType: body.postType,
  } satisfies PublishPostResponse);
}
