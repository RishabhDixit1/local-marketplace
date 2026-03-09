import { fetchProfileByUserId } from "@/lib/profile/client";
import { supabase } from "./supabase";

export async function getUserProfile() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  try {
    return await fetchProfileByUserId(user.id, user);
  } catch (error) {
    console.error("Profile fetch error:", error);
    return null;
  }
}
