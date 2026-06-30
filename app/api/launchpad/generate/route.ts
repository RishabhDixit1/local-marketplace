import { NextResponse } from "next/server";
import type { GenerateLaunchpadDraftResponse, LaunchpadApiErrorCode } from "@/lib/api/launchpad";
import { generateLaunchpadDraft } from "@/lib/server/launchpadWrites";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

const toError = (status: number, code: LaunchpadApiErrorCode, message: string, details?: string) =>
  NextResponse.json({ ok: false, code, message, details }, { status });

const noCache = { headers: { "Cache-Control": "no-store" } };

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) return toError(authResult.status, "UNAUTHORIZED", authResult.message);

  let body: { draftId?: string };
  try {
    body = await request.json();
  } catch {
    return toError(400, "INVALID_PAYLOAD", "Invalid JSON payload.");
  }

  if (!body.draftId) {
    return toError(400, "INVALID_PAYLOAD", "Request body must include a `draftId`.");
  }

  const admin = createSupabaseAdminClient();
  const userClient = createSupabaseUserServerClient(authResult.auth.accessToken);
  const db = admin || userClient;
  if (!db) return toError(500, "CONFIG", "Supabase server credentials are missing.");

  const result = await generateLaunchpadDraft({
    db,
    userId: authResult.auth.userId,
    draftId: body.draftId,
  });

  if (!result.ok) {
    const code: LaunchpadApiErrorCode = "DB";
    return toError(400, code, result.message, result.details ?? undefined);
  }

  return NextResponse.json({ ok: true, draft: result.draft } satisfies GenerateLaunchpadDraftResponse, noCache);
}
