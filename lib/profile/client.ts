"use client";

import type { User } from "@supabase/supabase-js";
import type { SaveProfileResponse, UploadProfileAvatarResponse } from "@/lib/api/profile";
import { fetchAuthedJson } from "@/lib/clientApi";
import { supabase } from "@/lib/supabase";
import { type ProfileFormValues, type ProfileRecord } from "@/lib/profile/types";
import {
  buildBootstrapProfilePatch,
  normalizeProfileRecord,
  resolveAuthenticatedProfilePath,
} from "@/lib/profile/utils";
import { compressImageFile } from "@/lib/clientImageCompression";
import { PROFILE_IMAGE_MAX_BYTES, formatUploadLimit } from "@/lib/mediaLimits";

const bootstrappedUserIds = new Set<string>();

const readProfileRow = async (userId: string) => {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data as Record<string, unknown> | null;
};

export const fetchProfileByUserId = async (userId: string, user?: Pick<User, "id" | "email"> | null) => {
  const row = await readProfileRow(userId);
  return normalizeProfileRecord(row, user || null);
};

const bootstrapUpsertVariants = (payload: Record<string, unknown>) => [
  payload,
  Object.fromEntries(
    Object.entries(payload).filter(([key]) =>
      ["id", "full_name", "name", "email", "avatar_url", "role", "location", "availability", "metadata"].includes(key)
    )
  ),
  Object.fromEntries(
    Object.entries(payload).filter(([key]) => ["id", "name", "email", "avatar_url", "role", "availability"].includes(key))
  ),
  Object.fromEntries(Object.entries(payload).filter(([key]) => ["id", "name", "email", "avatar_url"].includes(key))),
  { id: payload.id },
];

export const ensureProfileForUser = async (user: User) => {
  const existingProfile = await fetchProfileByUserId(user.id, user).catch(() => null);
  const patch = buildBootstrapProfilePatch(user, existingProfile);

  if (Object.keys(patch).length > 1 || !existingProfile) {
    for (const payload of bootstrapUpsertVariants(patch)) {
      const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
      if (!error) break;
    }
  }

  bootstrappedUserIds.add(user.id);
  return fetchProfileByUserId(user.id, user);
};

export const ensureClientProfile = async (user: User | null | undefined) => {
  if (!user?.id) return null;
  if (bootstrappedUserIds.has(user.id)) {
    return fetchProfileByUserId(user.id, user).catch(() => null);
  }

  return ensureProfileForUser(user);
};

export const saveCurrentUserProfile = async (params: {
  user: Pick<User, "id" | "email">;
  values: ProfileFormValues;
}) => {
  const payload = await fetchAuthedJson<SaveProfileResponse>(
    supabase,
    "/api/profile/save",
    {
      method: "POST",
      body: JSON.stringify({
        values: params.values,
      }),
    }
  );

  if (payload.ok === false) {
    throw new Error(payload.message || "Unable to save profile.");
  }

  bootstrappedUserIds.add(params.user.id);
  return payload.profile;
};

export const uploadProfileAvatar = async (params: { userId: string; file: File }) => {
  const prepared = (await compressImageFile(params.file, { maxBytes: PROFILE_IMAGE_MAX_BYTES })).file;
  if (prepared.size > PROFILE_IMAGE_MAX_BYTES) {
    throw new Error(`Profile image must be ${formatUploadLimit(PROFILE_IMAGE_MAX_BYTES)} or smaller after compression.`);
  }

  const body = new FormData();
  body.set("file", prepared);

  const payload = await fetchAuthedJson<UploadProfileAvatarResponse>(
    supabase,
    "/api/profile/avatar",
    {
      method: "POST",
      body,
    }
  );

  if (payload.ok === false) {
    throw new Error(payload.message || "Avatar upload failed.");
  }

  return payload.publicUrl;
};

export const subscribeToCurrentUserProfile = (userId: string, onChange: () => void) => {
  const channel = supabase
    .channel(`profile-live-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "profiles",
        filter: `id=eq.${userId}`,
      },
      onChange
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
};

export const resolveCurrentProfileDestination = (profile: ProfileRecord | null, nextPath?: string) =>
  resolveAuthenticatedProfilePath(profile, nextPath);
