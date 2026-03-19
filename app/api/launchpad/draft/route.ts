import { NextResponse } from "next/server";
import type {
  GetLaunchpadDraftResponse,
  LaunchpadApiErrorCode,
  SaveLaunchpadDraftRequest,
  SaveLaunchpadDraftResponse,
} from "@/lib/api/launchpad";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { loadLatestLaunchpadDraft, saveLaunchpadDraft } from "@/lib/server/launchpadWrites";

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
    } satisfies GetLaunchpadDraftResponse | SaveLaunchpadDraftResponse,
    { status }
  );

const isSaveLaunchpadDraftRequest = (payload: unknown): payload is SaveLaunchpadDraftRequest => {
  if (!payload || typeof payload !== "object") return false;
  const record = payload as Record<string, unknown>;
  return !!record.answers && typeof record.answers === "object";
};

export async function GET(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return toErrorResponse(authResult.status, "UNAUTHORIZED", authResult.message);
  }

  const admin = createSupabaseAdminClient();
  const dbClient = admin || createSupabaseUserServerClient(authResult.auth.accessToken);
  if (!dbClient) {
    return toErrorResponse(500, "CONFIG", "Supabase server credentials are missing.");
  }

  const result = await loadLatestLaunchpadDraft(dbClient, authResult.auth.userId);
  if (!result.ok) {
    return toErrorResponse(
      result.missingTable ? 503 : 500,
      result.missingTable ? "NOT_FOUND" : "DB",
      result.message,
      result.details || undefined
    );
  }

  return NextResponse.json({
    ok: true,
    draft: result.draft,
  } satisfies GetLaunchpadDraftResponse, {
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

  const admin = createSupabaseAdminClient();
  const dbClient = admin || createSupabaseUserServerClient(authResult.auth.accessToken);
  if (!dbClient) {
    return toErrorResponse(500, "CONFIG", "Supabase server credentials are missing.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toErrorResponse(400, "INVALID_PAYLOAD", "Invalid JSON payload.");
  }

  if (!isSaveLaunchpadDraftRequest(body)) {
    return toErrorResponse(400, "INVALID_PAYLOAD", "Request body does not match launchpad draft schema.");
  }

  const result = await saveLaunchpadDraft({
    db: dbClient,
    userId: authResult.auth.userId,
    answers: body.answers,
    inputSource: body.inputSource,
  });

  if (!result.ok) {
    const code: LaunchpadApiErrorCode =
      result.message.toLowerCase().includes("invalid") || result.message.toLowerCase().includes("required")
        ? "INVALID_PAYLOAD"
        : result.missingTable
        ? "NOT_FOUND"
        : "DB";

    return toErrorResponse(result.missingTable ? 503 : code === "INVALID_PAYLOAD" ? 400 : 500, code, result.message, result.details || undefined);
  }

  return NextResponse.json({
    ok: true,
    draft: result.draft,
  } satisfies SaveLaunchpadDraftResponse);
}
