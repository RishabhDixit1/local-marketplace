import { NextResponse } from "next/server";
import type {
  GetLaunchpadDraftResponse,
  LaunchpadApiErrorCode,
  SaveLaunchpadDraftRequest,
  SaveLaunchpadDraftResponse,
} from "@/lib/api/launchpad";
import { normalizeLaunchpadInputSource } from "@/lib/launchpad/validation";
import { loadLaunchpadWorkspace, saveLaunchpadDraft } from "@/lib/server/launchpadWrites";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

const toError = (status: number, code: LaunchpadApiErrorCode, message: string, details?: string) =>
  NextResponse.json({ ok: false, code, message, details }, { status });

const noCache = { headers: { "Cache-Control": "no-store" } };

export async function GET(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) return toError(authResult.status, "UNAUTHORIZED", authResult.message);

  const admin = createSupabaseAdminClient();
  const userClient = createSupabaseUserServerClient(authResult.auth.accessToken);
  const db = admin || userClient;
  if (!db) return toError(500, "CONFIG", "Supabase server credentials are missing.");

  const result = await loadLaunchpadWorkspace({
    db,
    userId: authResult.auth.userId,
    userEmail: authResult.auth.email,
  });

  if (!result.ok) return toError(500, "DB", result.message, result.details ?? undefined);

  return NextResponse.json(
    { ok: true, draft: result.draft, summary: result.summary } satisfies GetLaunchpadDraftResponse,
    noCache
  );
}

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) return toError(authResult.status, "UNAUTHORIZED", authResult.message);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toError(400, "INVALID_PAYLOAD", "Invalid JSON payload.");
  }

  if (!body || typeof body !== "object" || !("answers" in body)) {
    return toError(400, "INVALID_PAYLOAD", "Request body must include an `answers` object.");
  }

  const typed = body as SaveLaunchpadDraftRequest;

  const admin = createSupabaseAdminClient();
  const userClient = createSupabaseUserServerClient(authResult.auth.accessToken);
  const db = admin || userClient;
  if (!db) return toError(500, "CONFIG", "Supabase server credentials are missing.");

  const result = await saveLaunchpadDraft({
    db,
    userId: authResult.auth.userId,
    answers: typed.answers,
    inputSource: normalizeLaunchpadInputSource(typed.inputSource),
  });

  if (!result.ok) {
    const code: LaunchpadApiErrorCode = result.missingTable ? "DB" : "DB";
    return toError(400, code, result.message, result.details ?? undefined);
  }

  return NextResponse.json({ ok: true, draft: result.draft } satisfies SaveLaunchpadDraftResponse, noCache);
}
