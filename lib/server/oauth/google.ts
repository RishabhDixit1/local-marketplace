import { OAuth2Client } from "google-auth-library";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const CALLBACK_URL = process.env.GOOGLE_OAUTH_CALLBACK_URL || "https://www.serviq.in/api/auth/google/callback";
const SCOPES = [
  "https://www.googleapis.com/auth/business.manage",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

function getClient(): OAuth2Client {
  return new OAuth2Client({
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    redirectUri: CALLBACK_URL,
  });
}

export function getGoogleAuthUrl(state: string): string {
  const client = getClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

export async function exchangeGoogleCode(code: string): Promise<{
  ok: true; tokens: { accessToken: string; refreshToken: string; expiryDate: number };
} | { ok: false; error: string }> {
  try {
    const client = getClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
      return { ok: false, error: "Missing required tokens from Google" };
    }
    return {
      ok: true,
      tokens: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: tokens.expiry_date,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Token exchange failed";
    return { ok: false, error: message };
  }
}

export async function refreshGoogleToken(refreshToken: string): Promise<{
  ok: true; accessToken: string; expiryDate: number;
} | { ok: false; error: string }> {
  try {
    const client = getClient();
    client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await client.refreshAccessToken();
    if (!credentials.access_token || !credentials.expiry_date) {
      return { ok: false, error: "Token refresh returned incomplete credentials" };
    }
    return {
      ok: true,
      accessToken: credentials.access_token,
      expiryDate: credentials.expiry_date,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Token refresh failed";
    return { ok: false, error: message };
  }
}

export async function syncGoogleBusinessProfile(providerId: string): Promise<{
  ok: true; synced: Record<string, unknown>;
} | { ok: false; error: string }> {
  const db = createSupabaseAdminClient();
  if (!db) return { ok: false, error: "No DB client" };

  const { data: tokenRow, error: tokenError } = await db
    .from("google_business_tokens")
    .select("*")
    .eq("provider_id", providerId)
    .eq("is_active", true)
    .maybeSingle();

  if (tokenError || !tokenRow) {
    return { ok: false, error: tokenError?.message || "No Google Business token found. Connect your Google account first." };
  }

  let accessToken = tokenRow.access_token;
  const now = Date.now();
  const expiresAt = new Date(tokenRow.token_expires_at).getTime();

  if (now >= expiresAt - 300_000) {
    const refreshed = await refreshGoogleToken(tokenRow.refresh_token);
    if (!refreshed.ok) return refreshed;
    accessToken = refreshed.accessToken;
    await db.from("google_business_tokens").update({
      access_token: refreshed.accessToken,
      token_expires_at: new Date(refreshed.expiryDate).toISOString(),
    }).eq("id", tokenRow.id);
  }

  try {
    const accountsRes = await fetch(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!accountsRes.ok) {
      const body = await accountsRes.text();
      return { ok: false, error: `Google My Business API (accounts): ${body}` };
    }
    const accountsData: { accounts?: Array<{ name: string; accountName: string }> } = await accountsRes.json();
    const account = accountsData.accounts?.[0];
    if (!account) {
      return { ok: false, error: "No Google Business Profile account found" };
    }

    const locationsRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=title,storefrontAddress,phoneNumbers,websiteUri,regularHours,metadata,categories`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!locationsRes.ok) {
      const body = await locationsRes.text();
      return { ok: false, error: `Google My Business API (locations): ${body}` };
    }
    const locationsData: { locations?: Array<Record<string, unknown>> } = await locationsRes.json();
    const location = locationsData.locations?.[0];
    if (!location) {
      return { ok: false, error: "No Google Business Profile location found under this account" };
    }

    const categories: Array<Record<string, unknown>> = (location.categories as Array<Record<string, unknown>>) || [];
    const primaryCategory = categories[0] as { displayName?: string } | undefined;

    const syncData: Record<string, unknown> = {
      google_account_id: account.name,
      google_account_name: account.accountName,
      google_location_name: location.name,
      google_business_title: location.title,
      google_primary_category: primaryCategory?.displayName || null,
      google_address: location.storefrontAddress,
      google_phone: (location.phoneNumbers as Record<string, unknown> | null)?.primaryPhone,
      google_website: location.websiteUri,
      google_metadata: location.metadata,
      synced_at: new Date().toISOString(),
    };

    const { data: profile } = await db.from("profiles").select("metadata").eq("id", providerId).maybeSingle();
    const currentMetadata = (profile?.metadata as Record<string, unknown>) || {};
    const mergedMetadata = { ...currentMetadata, ...syncData };

    const { error: updateError } = await db.from("profiles").update({
      metadata: mergedMetadata,
      website: (syncData.google_website as string) || currentMetadata.website,
    }).eq("id", providerId);

    if (updateError) return { ok: false, error: updateError.message };

    return { ok: true, synced: syncData };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync request failed";
    return { ok: false, error: message };
  }
}
