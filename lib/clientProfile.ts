"use client";

import type { User } from "@supabase/supabase-js";
import { ensureClientProfile as ensureProfileForClient } from "@/lib/profile/client";

export const ensureClientProfile = async (user: User | null | undefined): Promise<boolean> => {
  if (!user?.id) return false;

  try {
    const profile = await ensureProfileForClient(user);
    return Boolean(profile?.id);
  } catch (error) {
    console.warn("Unable to read profile during bootstrap:", error);
    return false;
  }
};
