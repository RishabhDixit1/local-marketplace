import { NextResponse } from "next/server";
import type {
  LaunchpadApiErrorCode,
  PublishLaunchpadDraftRequest,
  PublishLaunchpadDraftResponse,
} from "@/lib/api/launchpad";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { publishLaunchpadDraft } from "@/lib/server/launchpadWrites";

export const runtime = "nodejs";

const toErrorResponse = (
  status: number,
  code: LaunchpadApiErrorCode,
  message: string,
  details?: string
) =>
  NextResponse.json(
    {
      ok: false,
      code,
      message,
      details,
    } satisfies PublishLaunchpadDraftResponse,
    { status }
  );

const isPublishLaunchpadDraftRequest = (payload: unknown): payload is PublishLaunchpadDraftRequest => {
  if (!payload || typeof payload !== "object") return true;
  const record = payload as Record<string, unknown>;
  return typeof record.draftId === "undefined" || typeof record.draftId === "string";
};

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return toErrorResponse(authResult.status, "UNAUTHORIZED", authResult.message);
  }

  const admin = createSupabaseAdminClient();
  const dbClient = admin || createSupabaseUserServerClient(authResult.auth.accessToken);
  if (!dbClient) {
    return toErrorResponse(500, "CONFIG", "Supabase server credentials are missing.");
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  if (!isPublishLaunchpadDraftRequest(body)) {
    return toErrorResponse(400, "INVALID_PAYLOAD", "Request body does not match launchpad publish schema.");
  }

  const result = await publishLaunchpadDraft({
    db: dbClient,
    userId: authResult.auth.userId,
    userEmail: authResult.auth.email,
    draftId: body.draftId,
  });

  if (!result.ok) {
    const code: LaunchpadApiErrorCode =
      result.message.toLowerCase().includes("not found")
        ? "NOT_FOUND"
        : result.message.toLowerCase().includes("missing") || result.message.toLowerCase().includes("ready")
        ? "INVALID_PAYLOAD"
        : result.missingTable
        ? "NOT_FOUND"
        : "DB";

    return toErrorResponse(
      result.missingTable ? 503 : code === "INVALID_PAYLOAD" ? 400 : code === "NOT_FOUND" ? 404 : 500,
      code,
      result.message,
      result.details || undefined
    );
  }

  return NextResponse.json({
    ok: true,
    draft: result.draft,
    publishedServices: result.publishedServices,
    publishedProducts: result.publishedProducts,
    profilePath: result.profilePath,
    businessPath: result.businessPath,
  } satisfies PublishLaunchpadDraftResponse);
}
