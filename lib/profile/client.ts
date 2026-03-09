"use client";

import type { User } from "@supabase/supabase-js";
import type { SaveProfileResponse, UploadProfileAvatarResponse } from "@/lib/api/profile";
import { supabase } from "@/lib/supabase";
import { type ProfileFormValues, type ProfileRecord } from "@/lib/profile/types";
import {
  buildBootstrapProfilePatch,
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
}) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token || "";

  if (!accessToken) {
    throw new Error("You need to be signed in to save your profile.");
  }

  const response = await fetch("/api/profile/save", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      values: params.values,
    }),
  });

  const payload = (await response.json().catch(() => null)) as SaveProfileResponse | null;
  if (!response.ok || !payload || payload.ok === false) {
    throw new Error(payload && payload.ok === false ? payload.message : "Unable to save profile.");
  }

  bootstrappedUserIds.add(params.user.id);
  return payload.profile;
};

export const uploadProfileAvatar = async (params: { userId: string; file: File }) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token || "";

  if (!accessToken) {
    throw new Error("You need to be signed in to upload an avatar.");
  }

  const body = new FormData();
  body.set("file", params.file);

  const response = await fetch("/api/profile/avatar", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body,
  });

  const payload = (await response.json().catch(() => null)) as UploadProfileAvatarResponse | null;
  if (!response.ok || !payload || payload.ok === false) {
    throw new Error(payload && payload.ok === false ? payload.message : "Avatar upload failed.");
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
