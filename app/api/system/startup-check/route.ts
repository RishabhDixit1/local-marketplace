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
  "Recommended command: npm run supabase:migrate",
  "If direct database access is unavailable, run npm run supabase:sql-editor and paste the generated SQL bundle into Supabase SQL Editor.",
  "Ensure SUPABASE_SERVICE_ROLE_KEY is configured in local/server env when relying on server-side avatar uploads.",
  "Apply storage policies for bucket profile-avatars if you want browser-direct avatar uploads without a service-role key.",
  "Confirm required auth URLs in Supabase Authentication URL configuration.",
];

const missingTablePattern = /relation .* does not exist|could not find the table '.*' in the schema cache/i;

const fallbackDiagnostics = async () => {
  const checks: Record<string, boolean> = {
    posts_table: true,
    help_requests_table: true,
    orders_table: true,
    connection_requests_table: true,
    conversations_table: true,
    messages_table: true,
    notifications_table: true,
    provider_presence_table: true,
    live_talk_requests_table: true,
    feed_card_saves_table: true,
    feed_card_shares_table: true,
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

  const ordersProbe = await admin.from("orders").select("id").limit(1);
  if (ordersProbe.error && missingTablePattern.test(ordersProbe.error.message || "")) {
    checks.orders_table = false;
    issues.push("Missing table: public.orders");
  }

  const connectionRequestsProbe = await admin.from("connection_requests").select("id").limit(1);
  if (connectionRequestsProbe.error && missingTablePattern.test(connectionRequestsProbe.error.message || "")) {
    checks.connection_requests_table = false;
    issues.push("Missing table: public.connection_requests");
  }

  const conversationsProbe = await admin.from("conversations").select("id").limit(1);
  if (conversationsProbe.error && missingTablePattern.test(conversationsProbe.error.message || "")) {
    checks.conversations_table = false;
    issues.push("Missing table: public.conversations");
  }

  const messagesProbe = await admin.from("messages").select("id").limit(1);
  if (messagesProbe.error && missingTablePattern.test(messagesProbe.error.message || "")) {
    checks.messages_table = false;
    issues.push("Missing table: public.messages");
  }

  const notificationsProbe = await admin.from("notifications").select("id").limit(1);
  if (notificationsProbe.error && missingTablePattern.test(notificationsProbe.error.message || "")) {
    checks.notifications_table = false;
    issues.push("Missing table: public.notifications");
  }

  const providerPresenceProbe = await admin.from("provider_presence").select("provider_id").limit(1);
  if (providerPresenceProbe.error && missingTablePattern.test(providerPresenceProbe.error.message || "")) {
    checks.provider_presence_table = false;
    issues.push("Missing table: public.provider_presence");
  }

  const liveTalkProbe = await admin.from("live_talk_requests").select("id").limit(1);
  if (liveTalkProbe.error && missingTablePattern.test(liveTalkProbe.error.message || "")) {
    checks.live_talk_requests_table = false;
    issues.push("Missing table: public.live_talk_requests");
  }

  const feedCardSavesProbe = await admin.from("feed_card_saves").select("id").limit(1);
  if (feedCardSavesProbe.error && missingTablePattern.test(feedCardSavesProbe.error.message || "")) {
    checks.feed_card_saves_table = false;
    issues.push("Missing table: public.feed_card_saves");
  }

  const feedCardSharesProbe = await admin.from("feed_card_shares").select("id").limit(1);
  if (feedCardSharesProbe.error && missingTablePattern.test(feedCardSharesProbe.error.message || "")) {
    checks.feed_card_shares_table = false;
    issues.push("Missing table: public.feed_card_shares");
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
