import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { isAdminEmail, requireRequestAuth } from "@/lib/server/requestAuth";

export const runtime = "nodejs";

type DiagnosticsPayload = {
  ok: boolean;
  issues: string[];
  checks: Record<string, boolean>;
};

const baseFixInstructions = [
  "Apply canonical migrations from supabase/migrations in sorted order.",
  "Recommended command: npm run supabase:setup -- --with-verify",
  "Ensure SUPABASE_SERVICE_ROLE_KEY is configured in local/server env when relying on server-side avatar uploads.",
  "Apply storage policies for bucket profile-avatars if you want browser-direct avatar uploads without a service-role key.",
  "Confirm required auth URLs in Supabase Authentication URL configuration.",
];

const missingTablePattern = /relation .* does not exist|could not find the table '.*' in the schema cache/i;

const fallbackDiagnostics = async () => {
  const checks: Record<string, boolean> = {
    posts_table: true,
    help_requests_table: true,
    post_media_bucket: true,
    profile_avatar_bucket: true,
  };
  const issues: string[] = [];

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      ok: false,
      checks,
      issues: ["SUPABASE_SERVICE_ROLE_KEY is missing on server."],
    };
  }

  const postsProbe = await admin.from("posts").select("id").limit(1);
  if (postsProbe.error && missingTablePattern.test(postsProbe.error.message || "")) {
    checks.posts_table = false;
    issues.push("Missing table: public.posts");
  }

  const helpRequestsProbe = await admin.from("help_requests").select("id").limit(1);
  if (helpRequestsProbe.error && missingTablePattern.test(helpRequestsProbe.error.message || "")) {
    checks.help_requests_table = false;
    issues.push("Missing table: public.help_requests");
  }

  const bucketProbe = await admin.schema("storage").from("buckets").select("id").eq("id", "post-media").maybeSingle();
  if (bucketProbe.error || !(bucketProbe.data as { id?: string } | null)?.id) {
    checks.post_media_bucket = false;
    issues.push("Missing storage bucket: post-media");
  }

  const profileAvatarBucketProbe = await admin
    .schema("storage")
    .from("buckets")
    .select("id")
    .eq("id", "profile-avatars")
    .maybeSingle();
  if (profileAvatarBucketProbe.error || !(profileAvatarBucketProbe.data as { id?: string } | null)?.id) {
    checks.profile_avatar_bucket = false;
    issues.push("Missing storage bucket: profile-avatars");
  }

  return {
    ok: issues.length === 0,
    checks,
    issues,
  };
};

export async function GET(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, admin: false, issues: [authResult.message] }, { status: authResult.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      {
        ok: false,
        admin: isAdminEmail(authResult.auth.email),
        issues: ["SUPABASE_SERVICE_ROLE_KEY is missing on server."],
        checks: {},
        fixInstructions: baseFixInstructions,
      },
      { status: 500 }
    );
  }

  const adminUser = isAdminEmail(authResult.auth.email);
  if (!adminUser) {
    return NextResponse.json({ ok: true, admin: false, issues: [], checks: {} });
  }

  const { data, error } = await admin.rpc("get_platform_startup_diagnostics");

  if (error) {
    const fallback = await fallbackDiagnostics();
    return NextResponse.json({
      ok: fallback.ok,
      admin: true,
      issues: fallback.issues,
      checks: fallback.checks,
      fixInstructions: baseFixInstructions,
      source: "fallback",
    });
  }

  const diagnostics = (data as DiagnosticsPayload | null) || {
    ok: true,
    issues: [],
    checks: {},
  };

  return NextResponse.json({
    ok: diagnostics.ok,
    admin: true,
    issues: diagnostics.issues || [],
    checks: diagnostics.checks || {},
    fixInstructions: baseFixInstructions,
    source: "rpc",
  });
}
