import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const clean = (value: string | undefined): string => value?.trim() ?? "";

const getSupabaseUrl = (): string => {
  const internalUrl = clean(process.env.SUPABASE_URL);
  if (internalUrl) return internalUrl;
  return clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
};

export type SupabaseServerEnv = {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
};

export const getSupabaseServerEnv = (): SupabaseServerEnv | null => {
  const url = getSupabaseUrl();
  const anonKey = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const serviceRoleKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!url || !anonKey || !serviceRoleKey) return null;

  return {
    url,
    anonKey,
    serviceRoleKey,
  };
};

export const createSupabaseAnonServerClient = (): SupabaseClient | null => {
  const url = getSupabaseUrl();
  const anonKey = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!url || !anonKey) return null;

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

export const createSupabaseUserServerClient = (accessToken: string): SupabaseClient | null => {
  const url = getSupabaseUrl();
  const anonKey = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const token = clean(accessToken);

  if (!url || !anonKey || !token) return null;

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
};

let cachedAdminClient: SupabaseClient | null = null;

export const createSupabaseAdminClient = (): SupabaseClient | null => {
  if (cachedAdminClient) return cachedAdminClient;

  const env = getSupabaseServerEnv();
  if (!env) return null;

  cachedAdminClient = createClient(env.url, env.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedAdminClient;
};
