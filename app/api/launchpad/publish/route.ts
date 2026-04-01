import { NextResponse } from "next/server";
import type {
  LaunchpadApiErrorCode,
  PublishLaunchpadDraftRequest,
  PublishLaunchpadDraftResponse,
} from "@/lib/api/launchpad";
import { publishLaunchpadDraft } from "@/lib/server/launchpadWrites";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

const toError = (status: number, code: LaunchpadApiErrorCode, message: string, details?: string) =>
  NextResponse.json({ ok: false, code, message, details }, { status });

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) return toError(authResult.status, "UNAUTHORIZED", authResult.message);

  let body: PublishLaunchpadDraftRequest = {};
  try {
    const raw = await request.json().catch(() => ({}));
    if (raw && typeof raw === "object") body = raw as PublishLaunchpadDraftRequest;
  } catch {
    // body stays as empty object — draftId is optional
  }

  const admin = createSupabaseAdminClient();
  const userClient = createSupabaseUserServerClient(authResult.auth.accessToken);
  const db = admin || userClient;
  if (!db) return toError(500, "CONFIG", "Supabase server credentials are missing.");

  const result = await publishLaunchpadDraft({
    db,
    userId: authResult.auth.userId,
    userEmail: authResult.auth.email,
    draftId: body.draftId,
  });

  if (!result.ok) {
    const status = result.message.includes("not found") || result.message.includes("No launchpad") ? 404 : 400;
    return toError(status, "DB", result.message, result.details ?? undefined);
  }

  return NextResponse.json(
    {
      ok: true,
      draft: result.draft,
      publishedServices: result.publishedServices,
      publishedProducts: result.publishedProducts,
      profilePath: result.profilePath,
      businessPath: result.businessPath,
    } satisfies PublishLaunchpadDraftResponse,
    { headers: { "Cache-Control": "no-store" } }
  );
}
