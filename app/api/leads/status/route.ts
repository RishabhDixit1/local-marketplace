import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";

export const runtime = "nodejs";

type LeadStatusRequest = {
  leadId: string;
  action: "dismiss" | "convert";
};

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, message: authResult.message }, { status: authResult.status });
  }

  let body: LeadStatusRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.leadId || !["dismiss", "convert"].includes(body.action)) {
    return NextResponse.json({ ok: false, message: "leadId and action (dismiss|convert) are required." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const userClient = createSupabaseUserServerClient(authResult.auth.accessToken);
  const db = admin || userClient;
  if (!db) {
    return NextResponse.json({ ok: false, message: "Supabase server credentials are missing." }, { status: 500 });
  }

  const newStatus = body.action === "dismiss" ? "lost" : "converted";

  const { error } = await db
    .from("lead_assignments")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", body.leadId)
    .eq("provider_id", authResult.auth.userId);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
