import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { isAdminEmail, requireRequestAuth } from "@/lib/server/requestAuth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }
  if (!isAdminEmail(auth.auth.email)) {
    return NextResponse.json({ ok: false, code: "FORBIDDEN", message: "Admin access required." }, { status: 403 });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, code: "CONFIG", message: "No DB client." }, { status: 500 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "pending";
  const limit = Math.min(Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)), 200);
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10));

  const { data, error } = await db
    .from("verification_documents")
    .select("id,user_id,document_type,file_url,file_path,status,admin_notes,created_at,updated_at")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ ok: false, code: "DB", message: error.message }, { status: 500 });
  }

  const docs = (data || []) as Array<{
    id: string; user_id: string; document_type: string;
    file_url: string | null; file_path: string | null;
    status: string; admin_notes: string | null;
    created_at: string | null; updated_at: string | null;
  }>;

  const userIds = [...new Set(docs.map((d) => d.user_id))];
  const { data: profiles } = await db
    .from("profiles")
    .select("id,full_name,name,email,phone,verification_status")
    .in("id", userIds);

  const profileMap = new Map(
    (profiles as Array<{
      id: string; full_name: string | null; name: string | null;
      email: string | null; phone: string | null; verification_status: string | null;
    }> | null)?.map((p) => [p.id, p]) ?? []
  );

  const result = docs.map((doc) => {
    const profile = profileMap.get(doc.user_id);
    return {
      ...doc,
      applicantName: profile?.full_name || profile?.name || "Unknown",
      applicantEmail: profile?.email,
      applicantPhone: profile?.phone,
      applicantVerificationStatus: profile?.verification_status,
    };
  });

  return NextResponse.json({ ok: true, verifications: result });
}

export async function PATCH(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }
  if (!isAdminEmail(auth.auth.email)) {
    return NextResponse.json({ ok: false, code: "FORBIDDEN", message: "Admin access required." }, { status: 403 });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, code: "CONFIG", message: "No DB client." }, { status: 500 });
  }

  let body: { id: string; action: "approve" | "reject"; adminNotes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "Invalid JSON." }, { status: 400 });
  }

  if (!body.id || !body.action) {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "id and action are required." }, { status: 400 });
  }

  const { data: doc } = await db
    .from("verification_documents")
    .select("id,user_id,status")
    .eq("id", body.id)
    .maybeSingle();

  if (!doc) {
    return NextResponse.json({ ok: false, code: "NOT_FOUND", message: "Document not found." }, { status: 404 });
  }

  const newStatus = body.action === "approve" ? "approved" : "rejected";
  const { error: docError } = await db.from("verification_documents").update({
    status: newStatus,
    admin_notes: body.adminNotes || null,
    reviewed_at: new Date().toISOString(),
  }).eq("id", body.id);

  if (docError) {
    return NextResponse.json({ ok: false, code: "DB", message: docError.message }, { status: 500 });
  }

  if (body.action === "approve") {
    await db.from("profiles").update({ verification_status: "verified" }).eq("id", doc.user_id);
    await db.from("notifications").insert({
      user_id: doc.user_id,
      kind: "system",
      title: "Verification approved",
      message: "Your identity documents have been verified. You now have a verified badge on your profile.",
      entity_type: "verification",
      entity_id: doc.id,
    });
  } else {
    await db.from("profiles").update({ verification_status: "rejected" }).eq("id", doc.user_id);
    await db.from("notifications").insert({
      user_id: doc.user_id,
      kind: "system",
      title: "Verification rejected",
      message: `Your verification was not approved.${body.adminNotes ? ` Reason: ${body.adminNotes}` : ""}`,
      entity_type: "verification",
      entity_id: doc.id,
    });
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
