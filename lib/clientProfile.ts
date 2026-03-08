"use client";

import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const bootstrappedUserIds = new Set<string>();

const getMetadataString = (user: User, keys: string[]) => {
  const metadata = (user.user_metadata || {}) as Record<string, unknown>;

  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
};

const inferName = (user: User) => {
  const metadataName = getMetadataString(user, ["full_name", "name", "display_name", "user_name", "preferred_name"]);
  if (metadataName) return metadataName;

  const emailPrefix = (user.email || "").split("@")[0]?.trim();
  if (emailPrefix) return emailPrefix;

  return "Local Member";
};

const buildProfilePayload = (user: User, existingProfile?: Record<string, unknown> | null) => {
  const inferredName = inferName(user);
  const inferredAvatar = getMetadataString(user, ["avatar_url", "picture", "photo_url"]);
  const inferredLocation = getMetadataString(user, ["location", "city"]);
  const inferredRole = getMetadataString(user, ["role", "account_type"]) || "seeker";
  const inferredAvailability = getMetadataString(user, ["availability"]) || "available";
  const inferredEmail = (user.email || "").trim();

  const payload: Record<string, unknown> = { id: user.id };
  const existing = existingProfile || {};

  if (!existing.name && inferredName) payload.name = inferredName;
  if (!existing.avatar_url && inferredAvatar) payload.avatar_url = inferredAvatar;
  if (!existing.email && inferredEmail) payload.email = inferredEmail;
  if (!existing.location && inferredLocation) payload.location = inferredLocation;
  if (!existing.role && inferredRole) payload.role = inferredRole;
  if (!existing.availability && inferredAvailability) payload.availability = inferredAvailability;

  return payload;
};

export const ensureClientProfile = async (user: User | null | undefined): Promise<boolean> => {
  if (!user?.id) return false;
  if (bootstrappedUserIds.has(user.id)) return true;

  const { data: existingProfile, error: existingProfileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfileError) {
    console.warn("Unable to read profile during bootstrap:", existingProfileError.message);
    return false;
  }

  const nextPayload = buildProfilePayload(user, (existingProfile as Record<string, unknown> | null) || null);
  if (Object.keys(nextPayload).length === 1) {
    bootstrappedUserIds.add(user.id);
    return true;
  }

  const payloadVariants: Record<string, unknown>[] = [
    nextPayload,
    Object.fromEntries(
      Object.entries(nextPayload).filter(([key]) => ["id", "name", "email", "avatar_url", "role", "availability"].includes(key))
    ),
    Object.fromEntries(
      Object.entries(nextPayload).filter(([key]) => ["id", "name", "email", "avatar_url"].includes(key))
    ),
    Object.fromEntries(
      Object.entries(nextPayload).filter(([key]) => ["id", "name", "email"].includes(key))
    ),
    { id: user.id },
  ];

  for (const payload of payloadVariants) {
    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
    if (!error) {
      bootstrappedUserIds.add(user.id);
      return true;
    }
  }

  return false;
};
