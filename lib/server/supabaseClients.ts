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

// ── Timeout-aware fetch wrapper ──────────────────────────────────────────────
// Aborts the underlying HTTP request after `timeoutMs` to prevent
// hung connections from leaking memory or blocking the event loop.

export function createTimeoutFetch(timeoutMs: number) {
  return async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  };
}

// ── Timeout-aware anon client (for auth checks only) ─────────────────────────
// Every request through this client is aborted after `timeoutMs`.
// Use specifically for GoTrue calls (getUser, getSession) where a
// fast failure is critical to avoid event-loop blocking.

export const createSupabaseAnonServerClientWithAuthTimeout = (
  timeoutMs = 5_000,
): SupabaseClient | null => {
  const url = getSupabaseUrl();
  const anonKey = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!url || !anonKey) return null;

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: createTimeoutFetch(timeoutMs),
    },
  });
};

// ── Timeout-aware admin client (for GoTrue admin calls) ──────────────────────
// Same as the cached admin client but with a timeout on every request.
// Use for auth.admin.* calls (createUser, generateLink, etc.) where a
// fast failure is needed when GoTrue is unreachable.

export const createSupabaseAdminClientWithAuthTimeout = (
  timeoutMs = 5_000,
): SupabaseClient | null => {
  const env = getSupabaseServerEnv();
  if (!env) return null;

  return createClient(env.url, env.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: createTimeoutFetch(timeoutMs),
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
