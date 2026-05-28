import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const getSupabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const getSupabaseAnonKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

let cachedClient: SupabaseClient | null = null;

const createMissingEnvClient = (): SupabaseClient =>
  new Proxy(
    {} as SupabaseClient,
    {
      get(_target, prop) {
        const missingEnvMessage =
          "Supabase client is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.";
        if (prop === "then") return undefined; // avoid being treated as a thenable
        throw new Error(missingEnvMessage);
      },
    }
  );

export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  if (url && anonKey) {
    cachedClient = createClient(url, anonKey);
    return cachedClient;
  }

  return createMissingEnvClient();
}

export const supabase: SupabaseClient = new Proxy(
  {} as SupabaseClient,
  {
    get(_target, prop) {
      const client = getSupabaseClient();
      const value = Reflect.get(client, prop);
      return typeof value === "function" ? value.bind(client) : value;
    },
  }
);
