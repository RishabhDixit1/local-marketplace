import { NextResponse } from "next/server";
import type { PublishNeedRequest, PublishNeedResponse, PublishApiErrorCode } from "@/lib/api/publish";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { insertHelpRequestRow, insertPostRow, linkNeedPublishRows, runImmediateMatching } from "@/lib/server/publishWrites";

export const runtime = "nodejs";

const toErrorResponse = (status: number, code: PublishApiErrorCode, message: string, details?: string) =>
  NextResponse.json(
    {
      ok: false,
      code,
      message,
      details,
    },
    { status }
  );

const isPublishNeedRequest = (payload: unknown): payload is PublishNeedRequest => {
  if (!payload || typeof payload !== "object") return false;
  const record = payload as Record<string, unknown>;
  return (
    record.postType === "need" &&
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
    Array.isArray(record.media) &&
    (typeof record.latitude === "number" || record.latitude === null || record.latitude === undefined) &&
    (typeof record.longitude === "number" || record.longitude === null || record.longitude === undefined)
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

  if (!isPublishNeedRequest(body)) {
    return toErrorResponse(400, "INVALID_PAYLOAD", "Request body does not match publish need schema.");
  }

  const normalizedPayload: PublishNeedRequest = {
    ...body,
    title: body.title.trim(),
    details: body.details.trim(),
    category: body.category.trim() || "Need",
    locationLabel: body.locationLabel.trim() || "Nearby",
  };

  if (!normalizedPayload.title) {
    return toErrorResponse(400, "INVALID_PAYLOAD", "Title is required.");
  }

  const [postWriteResult, helpRequestWriteResult] = await Promise.all([
    insertPostRow({
      admin: dbClient,
      userId: authResult.auth.userId,
      email: authResult.auth.email,
      postType: "need",
      payload: normalizedPayload,
    }),
    insertHelpRequestRow({
      admin: dbClient,
      userId: authResult.auth.userId,
      payload: normalizedPayload,
      latitude: typeof normalizedPayload.latitude === "number" ? normalizedPayload.latitude : null,
      longitude: typeof normalizedPayload.longitude === "number" ? normalizedPayload.longitude : null,
    }),
  ]);

  const postId = postWriteResult.id;
  const helpRequestId = helpRequestWriteResult.id;

  if (!postId && !helpRequestId) {
    const details = `posts: ${postWriteResult.errorMessage || "unknown"}\nhelp_requests: ${helpRequestWriteResult.errorMessage || "unknown"}`;
    const missingSchema = !!postWriteResult.missingTable || !!helpRequestWriteResult.missingTable;
    return toErrorResponse(
      missingSchema ? 503 : 500,
      missingSchema ? "NOT_FOUND" : "DB",
      "Failed to publish request.",
      details
    );
  }

  if (postId && helpRequestId) {
    await linkNeedPublishRows({
      admin: dbClient,
      postId,
      helpRequestId,
    });
  }

  let matchedCount = 0;
  let notifiedProviders = 0;
  let firstNotificationLatencyMs = 0;

  if (helpRequestId) {
    const matchingResult = await runImmediateMatching(dbClient, helpRequestId);
    matchedCount = matchingResult.matchedCount;
    notifiedProviders = matchingResult.notifiedProviders;
    firstNotificationLatencyMs = matchingResult.firstNotificationLatencyMs;

    const isUrgentNeed = normalizedPayload.mode === "urgent";
    if (isUrgentNeed && matchedCount === 0) {
      const { data: requesterProfile } = await dbClient
        .from("profiles")
        .select("phone,email")
        .eq("id", authResult.auth.userId)
        .maybeSingle();

      const phoneValue = (requesterProfile as { phone?: string | null } | null)?.phone?.trim() || "";
      const escalationRows = [
        {
          help_request_id: helpRequestId,
          requester_id: authResult.auth.userId,
          channel: "push",
          target: authResult.auth.userId,
          metadata: {
            reason: "no_immediate_match",
            priority: "urgent",
          },
        },
        ...(phoneValue
          ? [
              {
                help_request_id: helpRequestId,
                requester_id: authResult.auth.userId,
                channel: "whatsapp",
                target: phoneValue,
                metadata: {
                  reason: "no_immediate_match",
                  priority: "urgent",
                },
              },
              {
                help_request_id: helpRequestId,
                requester_id: authResult.auth.userId,
                channel: "sms",
                target: phoneValue,
                metadata: {
                  reason: "no_immediate_match",
                  priority: "urgent",
                },
              },
            ]
          : []),
      ];

      const { error: escalationError } = await dbClient.from("notification_escalations").insert(escalationRows);
      if (escalationError && !/notification_escalations|does not exist|schema cache/i.test(escalationError.message)) {
        console.warn("Urgent escalation queue insert failed:", escalationError.message);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    postId,
    helpRequestId,
    matchedCount,
    notifiedProviders,
    firstNotificationLatencyMs,
  } satisfies PublishNeedResponse);
}
