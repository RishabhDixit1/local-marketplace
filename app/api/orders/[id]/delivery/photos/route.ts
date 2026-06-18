import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { STORAGE_CACHE_SECONDS } from "@/lib/mediaLimits";
import { withErrorHandling } from "@/lib/server/errorHandler";
import { applyRateLimit, WRITE_ROUTE_CONFIG } from "@/lib/server/rateLimit";

export const runtime = "nodejs";

const BUCKET = "delivery-photos";
const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

async function postHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, message: authResult.message }, { status: authResult.status });
  }

  const { id } = await params;

  const rateLimit = await applyRateLimit(authResult.auth.userId, "upload:delivery-photo", WRITE_ROUTE_CONFIG);
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

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, message: "File too large. Max 10 MB." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, message: "Server config error." }, { status: 500 });
  }

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("consumer_id,provider_id,metadata")
    .eq("id", id)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  }

  if (order.provider_id !== authResult.auth.userId) {
    return NextResponse.json({ ok: false, message: "Only the provider can upload delivery photos." }, { status: 403 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `orders/${id}/${Date.now()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type,
    cacheControl: STORAGE_CACHE_SECONDS,
    upsert: false,
  });

  if (uploadError) {
    console.error("[api/delivery/photos] upload error:", uploadError.message);
    // Try creating the bucket if it doesn't exist
    if (/bucket .* not found/i.test(uploadError.message)) {
      const { error: bucketError } = await admin.storage.createBucket(BUCKET, { public: true });
      if (bucketError) {
        return NextResponse.json({ ok: false, message: "Storage bucket unavailable." }, { status: 500 });
      }
      const { error: retryError } = await admin.storage.from(BUCKET).upload(path, buffer, {
        contentType: file.type,
        cacheControl: STORAGE_CACHE_SECONDS,
        upsert: false,
      });
      if (retryError) {
        return NextResponse.json({ ok: false, message: "Upload failed after bucket creation." }, { status: 500 });
      }
    } else {
      return NextResponse.json({ ok: false, message: "Upload failed: " + uploadError.message }, { status: 500 });
    }
  }

  const relativeUrl = `/storage/v1/object/public/${BUCKET}/${path}`;

  const currentDelivery = (order.metadata?.delivery as Record<string, unknown>) ?? null;
  const existingPhotos: string[] = currentDelivery?.photoUrls
    ? (currentDelivery.photoUrls as string[])
    : [];
  const updatedPhotos = [...existingPhotos, relativeUrl];

  const { error: updateError } = await admin
    .from("orders")
    .update({
      metadata: {
        ...order.metadata,
        delivery: {
          ...(currentDelivery || {}),
          photoUrls: updatedPhotos,
        },
      },
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ ok: false, message: `Metadata update failed: ${updateError.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url: relativeUrl, photoUrls: updatedPhotos });
}

export const POST = withErrorHandling(postHandler, "delivery:photos");
