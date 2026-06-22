import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { isAdminEmail, requireRequestAuth } from "@/lib/server/requestAuth";
import { getConfiguredSiteUrl } from "@/lib/siteUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let diagnosticsCache: { data: DiagnosticsPayload; ts: number } | null = null;
const CACHE_TTL = 15_000; // 15s

type DiagnosticsPayload = {
  ok: boolean;
  issues: string[];
  checks: Record<string, boolean>;
};

const baseFixInstructions = [
  "Apply canonical migrations from supabase/migrations in sorted order.",
  "Recommended command: npm run supabase:migrate",
  "If direct database access is unavailable, run npm run supabase:sql-editor and paste the generated SQL bundle into Supabase SQL Editor.",
  "Ensure SUPABASE_SERVICE_ROLE_KEY is configured in local/server env when relying on server-side avatar uploads.",
  "Apply storage policies for bucket profile-avatars if you want browser-direct avatar uploads without a service-role key.",
  "Confirm required auth URLs in Supabase Authentication URL configuration.",
  "Set NEXT_PUBLIC_SITE_URL/SITE_URL to your canonical auth origin so magic-link callbacks always resolve correctly.",
  "Configure a custom SMTP provider in Supabase for production auth emails to improve deliverability and bounce handling.",
  "Optional auth hardening: set AUTH_MAGIC_LINK_ALLOWED_RECIPIENTS or AUTH_MAGIC_LINK_BLOCKED_DOMAINS / AUTH_MAGIC_LINK_BLOCKED_RECIPIENTS on the app server.",
];

const siteUrlLooksLocal = (value: string) => /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(value);

const TABLE_NAMES = [
  "posts", "help_requests", "orders", "connection_requests",
  "conversations", "messages", "notifications", "provider_presence",
  "live_talk_requests", "feed_card_saves", "feed_card_shares",
  "profiles", "subscriber_plans", "disputes", "invoices",
] as const;

const BUCKET_NAMES = ["post-media", "profile-avatars", "review-photos", "post-photos", "chat-attachments"] as const;

const CHECK_KEYS = [
  ...TABLE_NAMES.map((t) => `${t}_table` as const),
  ...BUCKET_NAMES.map((b) => `${b.replace(/-/g, "_")}_bucket` as const),
  "auth_site_url",
] as const;

const fallbackDiagnostics = async () => {
  const checks = Object.fromEntries(CHECK_KEYS.map((k) => [k, true])) as Record<string, boolean>;
  const issues: string[] = [];
  const configuredSiteUrl = getConfiguredSiteUrl();
  const productionLike = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, checks, issues: ["SUPABASE_SERVICE_ROLE_KEY is missing on server."] };
  }

  // Single query to check all tables, buckets, and schema info
  const { data: schemaCheck, error } = await admin.rpc("get_schema_diagnostics");
  if (!error && schemaCheck) {
    const d = schemaCheck as {
      tables: string[];
      buckets: string[];
    };
    for (const table of TABLE_NAMES) {
      if (!d.tables.includes(table)) {
        checks[`${table}_table`] = false;
        issues.push(`Missing table: public.${table}`);
      }
    }
    for (const bucket of BUCKET_NAMES) {
      if (!d.buckets.includes(bucket)) {
        checks[`${bucket.replace(/-/g, "_")}_bucket`] = false;
        issues.push(`Missing storage bucket: ${bucket}`);
      }
    }
  } else {
    // Fallback: check if information_schema is accessible directly
    const { data: tableData } = await admin.rpc("get_table_list", { schema_name: "public" });
    const tableList = (tableData as string[] | null) ?? [];
    for (const table of TABLE_NAMES) {
      if (!tableList.includes(table)) {
        checks[`${table}_table`] = false;
        issues.push(`Missing table: public.${table}`);
      }
    }
    const { data: bucketData } = await admin.rpc("get_bucket_list");
    const bucketList = (bucketData as string[] | null) ?? [];
    for (const bucket of BUCKET_NAMES) {
      if (!bucketList.includes(bucket)) {
        checks[`${bucket.replace(/-/g, "_")}_bucket`] = false;
        issues.push(`Missing storage bucket: ${bucket}`);
      }
    }
  }

  if (productionLike && siteUrlLooksLocal(configuredSiteUrl)) {
    checks.auth_site_url = false;
    issues.push(`Auth site URL resolves to a local origin (${configuredSiteUrl}). Set NEXT_PUBLIC_SITE_URL/SITE_URL to your public app domain.`);
  }

  return { ok: issues.length === 0, checks, issues };
}

export async function GET(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, admin: false, issues: [authResult.message] }, { status: authResult.status });
  }

  const adminUser = isAdminEmail(authResult.auth.email);
  if (!adminUser) {
    return NextResponse.json({ ok: true, admin: false, issues: [], checks: {} });
  }

  // Serve from cache if fresh
  if (diagnosticsCache && Date.now() - diagnosticsCache.ts < CACHE_TTL) {
    return NextResponse.json({ ...diagnosticsCache.data, admin: true, fixInstructions: baseFixInstructions, source: "cache" });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    const empty: Record<string, boolean> = {};
    return NextResponse.json(
      { ok: false, admin: true, issues: ["SUPABASE_SERVICE_ROLE_KEY is missing on server."], checks: empty, fixInstructions: baseFixInstructions },
      { status: 500 }
    );
  }

  const { data, error } = await admin.rpc("get_platform_startup_diagnostics");

  if (error) {
    const fallback = await fallbackDiagnostics();
    diagnosticsCache = { data: fallback, ts: Date.now() };
    return NextResponse.json({
      ...fallback,
      admin: true,
      fixInstructions: baseFixInstructions,
      source: "fallback",
    });
  }

  const diagnostics = (data as DiagnosticsPayload | null) || { ok: true, issues: [], checks: {} };

  const configuredSiteUrl = getConfiguredSiteUrl();
  const productionLike = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  const issues = [...(diagnostics.issues || [])];
  const checks = {
    ...(diagnostics.checks || {}),
    auth_site_url: !(productionLike && siteUrlLooksLocal(configuredSiteUrl)),
  };

  if (productionLike && siteUrlLooksLocal(configuredSiteUrl)) {
    issues.push(`Auth site URL resolves to a local origin (${configuredSiteUrl}). Set NEXT_PUBLIC_SITE_URL/SITE_URL to your public app domain.`);
  }

  const result: DiagnosticsPayload & { admin?: boolean; fixInstructions?: string[]; source?: string } = {
    ok: diagnostics.ok && issues.length === 0,
    issues,
    checks,
  };
  diagnosticsCache = { data: result, ts: Date.now() };

  return NextResponse.json({
    ...result,
    admin: true,
    fixInstructions: baseFixInstructions,
    source: "rpc",
  });
}
