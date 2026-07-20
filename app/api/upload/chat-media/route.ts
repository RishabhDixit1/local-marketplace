import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { LISTING_IMAGE_MAX_BYTES, formatUploadLimit, STORAGE_CACHE_SECONDS } from "@/lib/mediaLimits";
import { withErrorHandling } from "@/lib/server/errorHandler";
import { applyRateLimit, WRITE_ROUTE_CONFIG } from "@/lib/server/rateLimit";
import { validateFileMagicBytes } from "@/lib/server/fileValidation";

export const runtime = "nodejs";

const BUCKET = "chat-attachments";
const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const CHAT_IMAGE_MAX_BYTES = LISTING_IMAGE_MAX_BYTES;

async function postHandler(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, message: authResult.message }, { status: authResult.status });
  }

  const rateLimit = await applyRateLimit(authResult.auth.userId, "upload:chat-media", WRITE_ROUTE_CONFIG);
  if (rateLimit.limited) return rateLimit.response;

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ ok: false, message: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: "No file provided." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ ok: false, message: "Only JPEG, PNG, or WebP images are allowed." }, { status: 400 });
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  if (!validateFileMagicBytes(buffer, file.type)) {
    return NextResponse.json({ ok: false, message: "File content does not match its declared type." }, { status: 400 });
  }

  if (file.size > CHAT_IMAGE_MAX_BYTES) {
    return NextResponse.json({ ok: false, message: `File too large. Max ${formatUploadLimit(CHAT_IMAGE_MAX_BYTES)}.` }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${authResult.auth.userId}/${Date.now()}.${ext}`;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, message: "Server config error." }, { status: 500 });
  }

  const uploadBuf = Buffer.from(buffer);

  const { error } = await admin.storage.from(BUCKET).upload(path, uploadBuf, {
    contentType: file.type,
    cacheControl: STORAGE_CACHE_SECONDS,
    upsert: false,
  });

  if (error) {
    console.error("[api/upload/chat-media] upload error:", error.message);
    return NextResponse.json({ ok: false, message: "Upload failed: " + error.message }, { status: 500 });
  }

  const relativeUrl = `/storage/v1/object/public/${BUCKET}/${path}`;

  return NextResponse.json({ ok: true, path, url: relativeUrl });
}

export const POST = withErrorHandling(postHandler, "upload:chat-media");
