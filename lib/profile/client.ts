"use client";

import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { PROFILE_AVATAR_BUCKET, type ProfileFormValues, type ProfileRecord } from "@/lib/profile/types";
import {
  buildBootstrapProfilePatch,
  createProfileSavePayload,
  normalizeProfileRecord,
  resolveAuthenticatedProfilePath,
} from "@/lib/profile/utils";

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
  existingProfile: ProfileRecord | null;
}) => {
  const payload = createProfileSavePayload(params);
  const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
  if (error) throw error;
  bootstrappedUserIds.add(params.user.id);
  return fetchProfileByUserId(params.user.id, params.user);
};

export const uploadProfileAvatar = async (params: { userId: string; file: File }) => {
  const extension = params.file.name.split(".").pop() || "bin";
  const fileName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const path = `avatars/${params.userId}/${fileName}`;

  const { error } = await supabase.storage.from(PROFILE_AVATAR_BUCKET).upload(path, params.file, {
    contentType: params.file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) {
    throw new Error(
      `Failed to upload avatar. Ensure bucket "${PROFILE_AVATAR_BUCKET}" exists and avatar policies are applied.`
    );
  }

  const { data } = supabase.storage.from(PROFILE_AVATAR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
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
