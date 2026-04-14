import { NextResponse } from "next/server";
import type { UploadProfileAvatarResponse, ProfileApiErrorCode } from "@/lib/api/profile";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { uploadProfileAvatarFile } from "@/lib/server/profileWrites";
import { PROFILE_IMAGE_MAX_BYTES, formatUploadLimit } from "@/lib/mediaLimits";

export const runtime = "nodejs";

const toErrorResponse = (status: number, code: ProfileApiErrorCode, message: string, details?: string) =>
  NextResponse.json(
    {
      ok: false,
      code,
      message,
      details,
    } satisfies UploadProfileAvatarResponse,
    { status }
  );

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return toErrorResponse(authResult.status, "UNAUTHORIZED", authResult.message);
  }

  let body: FormData;
  try {
    body = await request.formData();
  } catch {
    return toErrorResponse(400, "INVALID_PAYLOAD", "Avatar upload must be sent as multipart form data.");
  }

  const file = body.get("file");
  if (!(file instanceof File)) {
    return toErrorResponse(400, "INVALID_PAYLOAD", "Avatar file is missing.");
  }

  if (file.size > PROFILE_IMAGE_MAX_BYTES) {
    return toErrorResponse(400, "INVALID_PAYLOAD", `Profile image must be ${formatUploadLimit(PROFILE_IMAGE_MAX_BYTES)} or smaller.`);
  }

  const admin = createSupabaseAdminClient();
  const dbClient = admin || createSupabaseUserServerClient(authResult.auth.accessToken);
  if (!dbClient) {
    return toErrorResponse(
      500,
      "CONFIG",
      "Avatar upload requires Supabase server credentials or bucket policies. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  const result = await uploadProfileAvatarFile({
    db: dbClient,
    userId: authResult.auth.userId,
    file,
    usingAdminClient: Boolean(admin),
  });

  if (!result.ok) {
    const status = result.code === "FORBIDDEN" ? 403 : result.code === "NOT_FOUND" ? 404 : 500;
    return toErrorResponse(status, status === 403 ? "FORBIDDEN" : status === 404 ? "NOT_FOUND" : "DB", result.message, result.details || undefined);
  }

  return NextResponse.json({
    ok: true,
    publicUrl: result.publicUrl,
    compatibilityMode: result.compatibilityMode,
  } satisfies UploadProfileAvatarResponse);
}
