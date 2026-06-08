import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { withErrorHandling } from "@/lib/server/errorHandler";

export const runtime = "nodejs";

async function postHandler(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const documentType = formData.get("document_type") as string | null;

  if (!file || !documentType) {
    return NextResponse.json({ ok: false, message: "File and document_type are required." }, { status: 400 });
  }

  const validTypes = ["id_proof", "address_proof", "business_license", "professional_certificate", "insurance", "guarantee"];
  if (!validTypes.includes(documentType)) {
    return NextResponse.json({ ok: false, message: "Invalid document type." }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ ok: false, message: "File must be under 10MB." }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, message: "DB config error" }, { status: 500 });

  const ext = file.name.split(".").pop() || "png";
  const fileName = `${auth.auth.userId}/${documentType}_${Date.now()}.${ext}`;

  const { error: uploadError } = await db.storage
    .from("verification-docs")
    .upload(fileName, file, { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ ok: false, message: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = db.storage.from("verification-docs").getPublicUrl(fileName);
  const fileUrl = urlData?.publicUrl || fileName;

  const { error: insertError } = await db.from("verification_documents").insert({
    profile_id: auth.auth.userId,
    document_type: documentType,
    file_url: fileUrl,
    status: "pending",
  });

  if (insertError) {
    return NextResponse.json({ ok: false, message: insertError.message }, { status: 500 });
  }

  await db.from("profiles").update({ verification_status: "pending" }).eq("id", auth.auth.userId);

  return NextResponse.json({ ok: true, fileUrl });
}

async function getHandler(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: 401 });

  const db = createSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, message: "DB config error" }, { status: 500 });

  const { data, error } = await db
    .from("verification_documents")
    .select("*")
    .eq("profile_id", auth.auth.userId)
    .order("submitted_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, documents: data || [] });
}

export const POST = withErrorHandling(postHandler, "verification:documents-upload");
export const GET = withErrorHandling(getHandler, "verification:documents-list");
