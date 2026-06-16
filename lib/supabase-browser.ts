import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAuthCookieName } from "@/lib/supabaseAuthCookie";

const getSupabaseUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  if (typeof window !== "undefined" && envUrl) {
    return window.location.origin;
  }
  return envUrl;
};

const getSupabaseAnonKey = () =>
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

let cachedClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  if (url && anonKey) {
    cachedClient = createBrowserClient(url, anonKey, {
      cookieOptions: { name: getSupabaseAuthCookieName() },
    });
    return cachedClient;
  }

  const missingEnvMessage =
    "Supabase client is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.";
  throw new Error(missingEnvMessage);
}

export const supabase: SupabaseClient = new Proxy(
  {} as SupabaseClient,
  {
    get(_target, prop) {
      const client = getSupabaseBrowserClient();
      const value = Reflect.get(client, prop);
      return typeof value === "function" ? value.bind(client) : value;
    },
  }
);
