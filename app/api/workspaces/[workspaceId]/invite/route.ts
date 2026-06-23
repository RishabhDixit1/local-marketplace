import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
import { FROM_EMAIL } from "@/lib/emailConfig";

export const runtime = "nodejs";
const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://serviqapp.com";

const toError = (status: number, code: string, message: string) =>
  NextResponse.json({ ok: false, code, message }, { status });

export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return toError(401, "UNAUTHORIZED", auth.message);
  const { workspaceId } = await params;

  const db = createSupabaseAdminClient() || createSupabaseUserServerClient(auth.auth.accessToken);
  if (!db) return toError(500, "CONFIG", "No DB client");

  let body: { email: string; role?: string };
  try { body = await request.json(); } catch { return toError(400, "INVALID_PAYLOAD", "Invalid JSON."); }
  if (!body.email?.trim()) return toError(400, "INVALID_PAYLOAD", "Email required.");

  // Verify workspace exists and check seat limit
  const { data: workspace } = await db
    .from("workspaces")
    .select("name, max_members")
    .eq("id", workspaceId)
    .single<{ name: string; max_members: number }>();
  if (!workspace) return toError(404, "NOT_FOUND", "Workspace not found.");

  const { count } = await db
    .from("workspace_members")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("is_active", true);
  if (count != null && count >= workspace.max_members) {
    return toError(403, "SEAT_LIMIT", `Workspace seat limit (${workspace.max_members}) reached.`);
  }

  // Find if user exists with this email
  const { data: existingUser } = await db
    .from("profiles")
    .select("id, full_name")
    .eq("email", body.email.trim().toLowerCase())
    .maybeSingle<{ id: string; full_name: string | null }>();

  if (existingUser) {
    // User exists — check if already a member
    const { data: existingMember } = await db
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", existingUser.id)
      .maybeSingle();

    if (existingMember) {
      return toError(409, "ALREADY_MEMBER", "This user is already a member of the workspace.");
    }

    // Add directly
    const { data: member, error } = await db.from("workspace_members").insert({
      workspace_id: workspaceId,
      user_id: existingUser.id,
      role: body.role || "member",
    }).select("*, profiles!inner(id, full_name, avatar_url)").single();

    if (error) return toError(400, "DB", error.message);

    await db.from("workspace_activity_log").insert({
      workspace_id: workspaceId,
      member_id: member.id,
      action: "member_added",
      entity_type: "workspace_member",
      entity_id: member.id,
      description: `${existingUser.full_name || body.email} joined via invite`,
    });

    // Send notification
    await fetch(`${APP_URL}/api/send-notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: existingUser.id,
        title: `You've been added to ${workspace.name}`,
        body: `You are now a member of the ${workspace.name} workspace.`,
      }),
    }).catch(() => {});

    return NextResponse.json({ ok: true, member, newUser: false });
  }

  // User doesn't exist — send invite email
  if (!RESEND_API_KEY) {
    return toError(503, "CONFIG", "Email service not configured. Invite the user by sharing your workspace link.");
  }

  const inviterName = auth.auth.email || "A workspace owner";
  const inviteLink = `${APP_URL}/signup?ref=workspace&workspace=${workspaceId}`;

  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: body.email.trim(),
      subject: `${inviterName} invited you to join ${workspace.name} on ServiQ`,
      html: [
        `<div style="font-family:Inter,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0f172a">`,
        `<h2 style="font-size:18px;font-weight:700;margin:0 0 12px">You're invited to join ${workspace.name} 👋</h2>`,
        `<p style="color:#475569">${inviterName} has invited you to join their workspace on ServiQ. Accept the invitation to start collaborating.</p>`,
        `<a href="${inviteLink}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#2563eb;color:#fff;font-size:14px;font-weight:600;border-radius:12px;text-decoration:none">Accept Invitation</a>`,
        `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8">This invitation was sent by ${inviterName} via ServiQ.</div>`,
        `</div>`,
      ].join(""),
    }),
  });

  if (!emailRes.ok) {
    const errText = await emailRes.text().catch(() => "unknown");
    return toError(502, "EMAIL_FAILED", `Failed to send invite: ${errText}`);
  }

  // Log activity
  await db.from("workspace_activity_log").insert({
    workspace_id: workspaceId,
    action: "invite_sent",
    entity_type: "workspace",
    entity_id: workspaceId,
    description: `Invitation sent to ${body.email}`,
  });

  return NextResponse.json({ ok: true, invited: true, email: body.email });
}
