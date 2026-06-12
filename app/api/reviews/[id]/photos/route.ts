import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { withErrorHandling } from "@/lib/server/errorHandler";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const { id: reviewId } = await params;

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });
  }

  // Verify user owns this review
  const { data: review } = await db
    .from("reviews")
    .select("reviewer_id, metadata")
    .eq("id", reviewId)
    .single<{ reviewer_id: string; metadata: Record<string, unknown> }>();

  if (!review) {
    return NextResponse.json({ ok: false, message: "Review not found" }, { status: 404 });
  }

  if (review.reviewer_id !== auth.auth.userId) {
    return NextResponse.json({ ok: false, message: "Only the reviewer can add photos" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ ok: false, message: "No file provided" }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ ok: false, message: "File must be under 5MB" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const fileName = `${reviewId}/${crypto.randomUUID()}.${ext}`;

  const { data: uploadData, error: uploadError } = await db.storage
    .from("review-photos")
    .upload(fileName, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    // Bucket might not exist — fall back to storing as base64 in metadata
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    const meta = (review.metadata ?? {}) as Record<string, unknown>;
    const photos = Array.isArray(meta.photos) ? [...meta.photos] : [];
    photos.push(dataUrl);

    await db.from("reviews").update({
      metadata: { ...meta, photos },
    }).eq("id", reviewId);

    return NextResponse.json({ ok: true, photo: dataUrl, note: "stored inline (storage bucket unavailable)" });
  }

  const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/review-photos/${fileName}`;
  const meta = (review.metadata ?? {}) as Record<string, unknown>;
  const photos = Array.isArray(meta.photos) ? [...meta.photos] : [];
  photos.push(publicUrl);

  await db.from("reviews").update({
    metadata: { ...meta, photos },
  }).eq("id", reviewId);

  return NextResponse.json({ ok: true, photo: publicUrl });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const { id: reviewId } = await params;

  const url = new URL(request.url);
  const photoUrl = url.searchParams.get("url");
  if (!photoUrl) {
    return NextResponse.json({ ok: false, message: "url query param required" }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });
  }

  const { data: review } = await db
    .from("reviews")
    .select("reviewer_id, metadata")
    .eq("id", reviewId)
    .single<{ reviewer_id: string; metadata: Record<string, unknown> }>();

  if (!review || review.reviewer_id !== auth.auth.userId) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 403 });
  }

  const meta = (review.metadata ?? {}) as Record<string, unknown>;
  const photos = Array.isArray(meta.photos) ? (meta.photos as string[]).filter((p) => p !== photoUrl) : [];

  await db.from("reviews").update({
    metadata: { ...meta, photos },
  }).eq("id", reviewId);

  return NextResponse.json({ ok: true });
}
