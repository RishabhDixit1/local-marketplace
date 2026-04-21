import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { getPostMediaLimitBytes, formatUploadLimit, STORAGE_CACHE_SECONDS } from "@/lib/mediaLimits";

export const runtime = "nodejs";

const BUCKET = "post-media";
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/ogg",
];

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

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ ok: false, message: "Only image, video, or audio uploads are allowed." }, { status: 400 });
  }

  const limitBytes = getPostMediaLimitBytes(file.type);
  if (file.size > limitBytes) {
    return NextResponse.json({ ok: false, message: `File too large. Max ${formatUploadLimit(limitBytes)}.` }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, message: "Server config error." }, { status: 500 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const safeType = file.type.split("/")[0] || "file";
  const path = `posts/${authResult.auth.userId}/${safeType}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await admin.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type,
    cacheControl: STORAGE_CACHE_SECONDS,
    upsert: false,
  });

  if (error) {
    return NextResponse.json({ ok: false, message: `Upload failed: ${error.message}` }, { status: 500 });
  }

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);

  return NextResponse.json({
    ok: true,
    path,
    url: data.publicUrl,
    media: {
      name: file.name,
      url: data.publicUrl,
      type: file.type,
    },
  });
}
