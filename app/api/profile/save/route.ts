import { NextResponse } from "next/server";
import type { SaveProfileResponse, ProfileApiErrorCode } from "@/lib/api/profile";
import { validateProfileValues } from "@/lib/profile/validation";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { isProfileSaveRequest, saveProfileRow } from "@/lib/server/profileWrites";

export const runtime = "nodejs";

const toErrorResponse = (status: number, code: ProfileApiErrorCode, message: string, details?: string) =>
  NextResponse.json(
    {
      ok: false,
      code,
      message,
      details,
    } satisfies SaveProfileResponse,
    { status }
  );

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return toErrorResponse(authResult.status, "UNAUTHORIZED", authResult.message);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toErrorResponse(400, "INVALID_PAYLOAD", "Invalid JSON payload.");
  }

  if (!isProfileSaveRequest(body)) {
    return toErrorResponse(400, "INVALID_PAYLOAD", "Request body does not match the profile save schema.");
  }

  const validationErrors = validateProfileValues(body.values, { mode: "draft" });
  const firstValidationError = Object.values(validationErrors).find((value) => typeof value === "string" && value.trim());
  if (firstValidationError) {
    return toErrorResponse(400, "INVALID_PAYLOAD", firstValidationError);
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

  const result = await saveProfileRow({
    db: dbClient,
    userId: authResult.auth.userId,
    email: authResult.auth.email,
    values: body.values,
  });

  if (!result.ok || !result.profile) {
    return toErrorResponse(500, "DB", result.message || "Unable to save profile.", result.details || undefined);
  }

  return NextResponse.json({
    ok: true,
    profile: result.profile,
    compatibilityMode: result.compatibilityMode,
    strippedColumns: result.strippedColumns,
  } satisfies SaveProfileResponse);
}
