import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { FEATURE_FLAGS_TABLE, FEATURE_FLAG_OVERRIDES_TABLE } from "./types";

export async function isFeatureEnabled(
  flagKey: string,
  userId?: string | null
): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  if (!admin) return false;

  if (userId) {
    const { data: override } = await admin
      .from(FEATURE_FLAG_OVERRIDES_TABLE)
      .select("enabled")
      .eq("user_id", userId)
      .eq("flag_key", flagKey)
      .maybeSingle<{ enabled: boolean }>();
    if (override !== null) return override.enabled;
  }

  const { data: flag } = await admin
    .from(FEATURE_FLAGS_TABLE)
    .select("enabled")
    .eq("key", flagKey)
    .maybeSingle<{ enabled: boolean }>();
  return flag?.enabled ?? false;
}

export async function getAllFeatureFlags(): Promise<
  { key: string; enabled: boolean; description: string }[]
> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const { data } = await admin
    .from(FEATURE_FLAGS_TABLE)
    .select("key, enabled, description")
    .order("key");
  return (data ?? []) as { key: string; enabled: boolean; description: string }[];
}

export async function setFeatureFlag(
  flagKey: string,
  enabled: boolean,
  description?: string
): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin.from(FEATURE_FLAGS_TABLE).upsert(
    {
      key: flagKey,
      enabled,
      description: description ?? "",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
}

export async function setUserOverride(
  userId: string,
  flagKey: string,
  enabled: boolean
): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin.from(FEATURE_FLAG_OVERRIDES_TABLE).upsert(
    { user_id: userId, flag_key: flagKey, enabled },
    { onConflict: "user_id, flag_key" }
  );
}
