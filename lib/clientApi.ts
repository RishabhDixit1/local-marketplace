import type { Session, SupabaseClient } from "@supabase/supabase-js";

const isMessagePayload = (value: unknown): value is { message?: string } =>
  typeof value === "object" && value !== null && "message" in value;

const isFormDataBody = (body: RequestInit["body"]) =>
  typeof FormData !== "undefined" && body instanceof FormData;

const parseJsonSafely = async <T>(response: Response) =>
  (await response.json().catch(() => null)) as T | null;

const getLocalAccessToken = (): string | null => {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem("serviq-local-auth");
    if (!raw) return null;
    const data = JSON.parse(raw) as { accessToken?: string };
    return data?.accessToken || null;
  } catch {
    return null;
  }
};

const shouldRefreshSession = (session: Session | null) => {
  if (!session?.access_token) return true;
  if (typeof session.expires_at !== "number") return false;
  return session.expires_at * 1000 - Date.now() < 60_000;
};

const refreshAccessToken = async (supabase: SupabaseClient) => {
  const {
    data: { session },
    error,
  } = await supabase.auth.refreshSession();

  if (error || !session?.access_token) {
    const localToken = getLocalAccessToken();
    if (localToken) return localToken;
    throw new Error(error?.message || "Session expired. Please sign in again.");
  }

  return session.access_token;
};

export const getAccessToken = async (supabase: SupabaseClient) => {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (!error && session?.access_token && !shouldRefreshSession(session)) {
    return session.access_token;
  }

  // GoTrue may be unreachable — try locally-stored session
  const localToken = getLocalAccessToken();
  if (localToken) return localToken;

  if (error) {
    throw new Error(error?.message || "Login required.");
  }

  if (session?.refresh_token) {
    return refreshAccessToken(supabase);
  }

  throw new Error("Login required.");
};

export const fetchAuthed = async (
  supabase: SupabaseClient,
  input: string,
  init: RequestInit = {},
  options: { retryOnUnauthorized?: boolean } = {}
) => {
  const makeRequest = async (mode: "session" | "refresh") => {
    const accessToken =
      mode === "refresh"
        ? await refreshAccessToken(supabase)
        : await getAccessToken(supabase);
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);

    if (init.body && !headers.has("Content-Type") && !isFormDataBody(init.body)) {
      headers.set("Content-Type", "application/json");
    }

    return fetch(input, {
      ...init,
      headers,
      cache: init.cache ?? "no-store",
    });
  };

  let response = await makeRequest("session");
  if (response.status === 401 && options.retryOnUnauthorized !== false) {
    response = await makeRequest("refresh");
  }

  return response;
};

export const fetchAuthedJson = async <T>(
  supabase: SupabaseClient,
  input: string,
  init: RequestInit = {},
  options: { retryOnUnauthorized?: boolean } = {}
): Promise<T> => {
  const response = await fetchAuthed(supabase, input, init, options);
  const payload = await parseJsonSafely<T | { message?: string }>(response);

  if (!response.ok || !payload) {
    const fallbackMessage = `${response.status} ${response.statusText}`.trim() || "Request failed.";
    throw new Error(
      isMessagePayload(payload) ? payload.message || fallbackMessage : fallbackMessage
    );
  }

  return payload as T;
};
