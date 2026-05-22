import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import type { QuoteAttachmentRecord, QuoteAttachmentType } from "@/lib/api/quotes";

export const runtime = "nodejs";

type AddAttachmentRequest = {
  quoteId: string;
  fileName: string;
  filePath: string;
  fileUrl: string;
  fileSizeBytes?: number;
  mimeType?: string;
  kind?: QuoteAttachmentType;
  title?: string;
  description?: string;
};

type RemoveAttachmentRequest = {
  attachmentId: string;
};

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, message: authResult.message }, { status: authResult.status });
  }

  const userId = authResult.auth.userId;
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, message: "Server config error." }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as AddAttachmentRequest | null;
  if (!body || !body.quoteId || !body.filePath || !body.fileUrl || !body.fileName) {
    return NextResponse.json({ ok: false, message: "Invalid payload: quoteId, fileName, filePath, fileUrl required." }, { status: 400 });
  }

  const {
    quoteId,
    fileName,
    filePath,
    fileUrl,
    fileSizeBytes,
    mimeType,
    kind = "attachment",
    title,
    description,
  } = body;

  const quoteRes = await admin
    .from("quote_drafts")
    .select("id, order_id, help_request_id, provider_id, consumer_id")
    .eq("id", quoteId)
    .limit(1);

  const quote = quoteRes.data?.[0];
  const quoteError = quoteRes.error;
  if (quoteError || !quote) {
    return NextResponse.json({ ok: false, message: quoteError?.message || "Quote not found." }, { status: 404 });
  }

  const isParty = quote.provider_id === userId || quote.consumer_id === userId;
  if (!isParty) {
    return NextResponse.json({ ok: false, message: "Forbidden: not a party to this quote." }, { status: 403 });
  }

  const insertRes = await admin
    .from("quote_attachments")
    .insert({
      quote_id: quoteId,
      order_id: quote.order_id,
      help_request_id: quote.help_request_id,
      uploaded_by: userId,
      kind,
      file_name: fileName,
      file_path: filePath,
      file_url: fileUrl,
      file_size_bytes: fileSizeBytes ?? null,
      mime_type: mimeType ?? null,
      title: title ?? null,
      description: description ?? null,
      metadata: {},
    })
    .select("id, quote_id, order_id, help_request_id, uploaded_by, kind, file_name, file_path, file_url, file_size_bytes, mime_type, title, description, metadata, created_at, updated_at")
    .limit(1);

  if (insertRes.error || !insertRes.data?.[0]) {
    return NextResponse.json({ ok: false, message: insertRes.error?.message || "Failed to save attachment." }, { status: 500 });
  }

  const row = insertRes.data[0];
  const attachment: QuoteAttachmentRecord = {
    id: row.id,
    quoteId: row.quote_id,
    orderId: row.order_id,
    helpRequestId: row.help_request_id,
    uploadedBy: row.uploaded_by,
    kind: row.kind as QuoteAttachmentType,
    fileName: row.file_name,
    filePath: row.file_path,
    fileUrl: row.file_url,
    fileSizeBytes: row.file_size_bytes,
    mimeType: row.mime_type,
    title: row.title,
    description: row.description,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  return NextResponse.json({ ok: true, attachment });
}

export async function DELETE(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, message: authResult.message }, { status: authResult.status });
  }

  const userId = authResult.auth.userId;
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, message: "Server config error." }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as RemoveAttachmentRequest | null;
  if (!body || !body.attachmentId) {
    return NextResponse.json({ ok: false, message: "Invalid payload: attachmentId required." }, { status: 400 });
  }

  const checkRes = await admin
    .from("quote_attachments")
    .select("id, uploaded_by")
    .eq("id", body.attachmentId)
    .limit(1);

  if (checkRes.error || !checkRes.data?.[0]) {
    return NextResponse.json({ ok: false, message: checkRes.error?.message || "Attachment not found." }, { status: 404 });
  }

  if (checkRes.data[0].uploaded_by !== userId) {
    return NextResponse.json({ ok: false, message: "Forbidden: not the uploader." }, { status: 403 });
  }

  const deleteRes = await admin.from("quote_attachments").delete().eq("id", body.attachmentId);
  if (deleteRes.error) {
    return NextResponse.json({ ok: false, message: deleteRes.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, attachmentId: body.attachmentId });
}
