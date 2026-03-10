import type { SupabaseClient } from "@supabase/supabase-js";

const getErrorMessage = async (response: Response) => {
  const payload = (await response.json().catch(() => null)) as { message?: string } | null;
  return payload?.message || `${response.status} ${response.statusText}`.trim();
};

const isMessagePayload = (value: unknown): value is { message?: string } =>
  typeof value === "object" && value !== null && "message" in value;

export const getAccessToken = async (supabase: SupabaseClient) => {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.access_token) {
    throw new Error(error?.message || "Login required.");
  }

  return session.access_token;
};

export const fetchAuthedJson = async <T>(
  supabase: SupabaseClient,
  input: string,
  init: RequestInit = {}
): Promise<T> => {
  const accessToken = await getAccessToken(supabase);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(input, {
    ...init,
    headers,
    cache: init.cache ?? "no-store",
  });

  const payload = (await response.json().catch(() => null)) as T | { message?: string } | null;
  if (!response.ok || !payload) {
    throw new Error(isMessagePayload(payload) ? payload.message || "Request failed." : await getErrorMessage(response));
  }

  return payload as T;
};
