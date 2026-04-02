import type { SupabaseClient } from "@supabase/supabase-js";
import type { SaveProfileRequest } from "@/lib/api/profile";
import { PROFILE_AVATAR_BUCKET, type ProfileFormValues, type ProfileRecord } from "@/lib/profile/types";
import { createProfileSavePayload, normalizeProfileRecord } from "@/lib/profile/utils";

type ProfileWriteResult = {
  ok: boolean;
  profile?: ProfileRecord | null;
  compatibilityMode: boolean;
  strippedColumns: string[];
  message?: string;
  code?: string | null;
  details?: string | null;
};

const missingTablePattern = /relation .*profiles.* does not exist|could not find the table '.*profiles.*' in the schema cache/i;
const bucketMissingPattern = /bucket .* not found|the resource was not found|not found/i;
const profilePolicyPattern = /row-level security|permission denied|new row violates row-level security/i;

const getMissingColumn = (message: string): string | null => {
  const schemaCacheMatch = message.match(/could not find the '([^']+)' column of 'profiles'/i);
  if (schemaCacheMatch?.[1]) return schemaCacheMatch[1];

  const postgresMatch = message.match(/column \"([^\"]+)\" of relation \"profiles\" does not exist/i);
  if (postgresMatch?.[1]) return postgresMatch[1];

  return null;
};

const buildProfileRead = async (db: SupabaseClient, userId: string, email: string) => {
  const { data, error } = await db.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) {
    return {
      profile: null,
      error,
    };
  }

  return {
    profile: normalizeProfileRecord((data as Record<string, unknown> | null) || null, { id: userId, email }),
    error: null,
  };
};

export const isProfileSaveRequest = (payload: unknown): payload is SaveProfileRequest => {
  if (!payload || typeof payload !== "object") return false;
  const record = payload as Record<string, unknown>;
  const values = record.values;

  if (!values || typeof values !== "object") return false;
  const typedValues = values as Record<string, unknown>;

  return (
    typeof typedValues.fullName === "string" &&
    typeof typedValues.location === "string" &&
    (typedValues.latitude === null || typedValues.latitude === undefined || typeof typedValues.latitude === "number") &&
    (typedValues.longitude === null || typedValues.longitude === undefined || typeof typedValues.longitude === "number") &&
    (typedValues.role === "provider" || typedValues.role === "seeker") &&
    typeof typedValues.bio === "string" &&
    Array.isArray(typedValues.interests) &&
    typeof typedValues.email === "string" &&
    typeof typedValues.phone === "string" &&
    typeof typedValues.website === "string" &&
    typeof typedValues.avatarUrl === "string" &&
    typeof typedValues.backgroundImageUrl === "string" &&
    (typedValues.availability === "available" || typedValues.availability === "busy" || typedValues.availability === "offline")
  );
};

export const saveProfileRow = async (params: {
  db: SupabaseClient;
  userId: string;
  email: string;
  values: ProfileFormValues;
}): Promise<ProfileWriteResult> => {
  const existingRead = await buildProfileRead(params.db, params.userId, params.email);
  const existingProfile = existingRead.profile || null;

  const workingPayload: Record<string, unknown> = {
    ...createProfileSavePayload({
      user: {
        id: params.userId,
        email: params.email,
      },
      values: params.values,
      existingProfile,
    }),
  };

  const strippedColumns: string[] = [];

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { error } = await params.db.from("profiles").upsert(workingPayload, { onConflict: "id" });

    if (!error) {
      const latestRead = await buildProfileRead(params.db, params.userId, params.email);
      return {
        ok: true,
        profile:
          latestRead.profile ||
          normalizeProfileRecord(workingPayload, {
            id: params.userId,
            email: params.email,
          }),
        compatibilityMode: strippedColumns.length > 0,
        strippedColumns,
      };
    }

    const message = error.message || "Profile save failed.";
    const details = error.details || null;

    if (missingTablePattern.test(message)) {
      return {
        ok: false,
        compatibilityMode: false,
        strippedColumns,
        message: "Profiles table is missing in Supabase. Apply the canonical migrations first.",
        code: error.code,
        details,
      };
    }

    const missingColumn = getMissingColumn(message);
    if (missingColumn && Object.prototype.hasOwnProperty.call(workingPayload, missingColumn)) {
      delete workingPayload[missingColumn];
      strippedColumns.push(missingColumn);
      continue;
    }

    if (profilePolicyPattern.test(message)) {
      return {
        ok: false,
        compatibilityMode: strippedColumns.length > 0,
        strippedColumns,
        message:
          "Profile save is blocked by Supabase permissions. Add SUPABASE_SERVICE_ROLE_KEY on the server or apply the canonical profiles RLS migration.",
        code: error.code,
        details,
      };
    }

    return {
      ok: false,
      compatibilityMode: strippedColumns.length > 0,
      strippedColumns,
      message,
      code: error.code,
      details,
    };
  }

  return {
    ok: false,
    compatibilityMode: strippedColumns.length > 0,
    strippedColumns,
    message: "Profile save retries were exhausted.",
    code: "RETRY_EXHAUSTED",
    details: null,
  };
};

export const uploadProfileAvatarFile = async (params: {
  db: SupabaseClient;
  userId: string;
  file: File;
  usingAdminClient: boolean;
}): Promise<{ ok: true; publicUrl: string; compatibilityMode: boolean } | { ok: false; message: string; code?: string | null; details?: string | null }> => {
  const extension = params.file.name.split(".").pop() || "bin";
  const fileName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const objectPath = `avatars/${params.userId}/${fileName}`;
  const buffer = Buffer.from(await params.file.arrayBuffer());

  const { error } = await params.db.storage.from(PROFILE_AVATAR_BUCKET).upload(objectPath, buffer, {
    contentType: params.file.type || "application/octet-stream",
    upsert: false,
  });

  if (error) {
    const message = error.message || "Avatar upload failed.";
    if (bucketMissingPattern.test(message)) {
      return {
        ok: false,
        message: `Bucket "${PROFILE_AVATAR_BUCKET}" is missing in Supabase Storage.`,
        code: error.name || "NOT_FOUND",
        details: null,
      };
    }

    if (!params.usingAdminClient && profilePolicyPattern.test(message)) {
      return {
        ok: false,
        message:
          `Avatar upload requires either SUPABASE_SERVICE_ROLE_KEY on the server or insert/update policies on storage.objects for bucket "${PROFILE_AVATAR_BUCKET}".`,
        code: error.name || "FORBIDDEN",
        details: null,
      };
    }

    return {
      ok: false,
      message,
      code: error.name || "UNKNOWN",
      details: null,
    };
  }

  const { data } = params.db.storage.from(PROFILE_AVATAR_BUCKET).getPublicUrl(objectPath);
  return {
    ok: true,
    publicUrl: data.publicUrl,
    compatibilityMode: !params.usingAdminClient,
  };
};
