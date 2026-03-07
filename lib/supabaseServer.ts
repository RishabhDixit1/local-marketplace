import { createClient } from "@supabase/supabase-js";

const clean = (value: string | undefined): string => value?.trim() ?? "";

export const getServerSupabase = () => {
  const supabaseUrl = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const serviceRoleKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!supabaseUrl || (!supabaseAnonKey && !serviceRoleKey)) {
    return null;
  }

  const serverKey = serviceRoleKey || supabaseAnonKey;

  return createClient(supabaseUrl, serverKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};
