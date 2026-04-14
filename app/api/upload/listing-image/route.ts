import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { LISTING_IMAGE_MAX_BYTES, formatUploadLimit, STORAGE_CACHE_SECONDS } from "@/lib/mediaLimits";

export const runtime = "nodejs";

const BUCKET = "listing-images";
const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, message: authResult.message }, { status: authResult.status });
  }

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

  if (file.size > LISTING_IMAGE_MAX_BYTES) {
    return NextResponse.json({ ok: false, message: `File too large. Max ${formatUploadLimit(LISTING_IMAGE_MAX_BYTES)}.` }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  // Path: {userId}/{timestamp}.{ext}
  const path = `${authResult.auth.userId}/${Date.now()}.${ext}`;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, message: "Server config error." }, { status: 500 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await admin.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type,
    cacheControl: STORAGE_CACHE_SECONDS,
    upsert: false,
  });

  if (error) {
    console.error("[api/upload/listing-image] upload error:", error.message);
    return NextResponse.json({ ok: false, message: "Upload failed: " + error.message }, { status: 500 });
  }

  const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = urlData.publicUrl;

  return NextResponse.json({ ok: true, path, url: publicUrl });
}
