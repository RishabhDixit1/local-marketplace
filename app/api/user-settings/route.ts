import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

type UserSettingsRow = {
  id: string;
  user_id: string;
  order_notifications: boolean;
  promo_notifications: boolean;
  message_notifications: boolean;
};

const defaults = {
  order_notifications: true,
  promo_notifications: true,
  message_notifications: true,
};

const getDbClient = (accessToken: string) => {
  const admin = createSupabaseAdminClient();
  return admin || createSupabaseUserServerClient(accessToken);
};

export async function GET(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, message: authResult.message }, { status: authResult.status });
  }

  const db = getDbClient(authResult.auth.accessToken);
  if (!db) {
    return NextResponse.json({ ok: false, message: "Server configuration error." }, { status: 500 });
  }

  const { data, error } = await db
    .from("user_settings")
    .select("id,user_id,order_notifications,promo_notifications,message_notifications")
    .eq("user_id", authResult.auth.userId)
    .maybeSingle<UserSettingsRow>();

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  if (!data) {
    const { data: inserted, error: insertError } = await db
      .from("user_settings")
      .insert({ user_id: authResult.auth.userId, ...defaults })
      .select("id,user_id,order_notifications,promo_notifications,message_notifications")
      .single<UserSettingsRow>();

    if (insertError || !inserted) {
      return NextResponse.json({ ok: false, message: insertError?.message || "Unable to initialize settings." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, settings: inserted });
  }

  return NextResponse.json({ ok: true, settings: data });
}

export async function PATCH(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, message: authResult.message }, { status: authResult.status });
  }

  const db = getDbClient(authResult.auth.accessToken);
  if (!db) {
    return NextResponse.json({ ok: false, message: "Server configuration error." }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as
    | Partial<Pick<UserSettingsRow, "order_notifications" | "promo_notifications" | "message_notifications">>
    | null;

  if (!body) {
    return NextResponse.json({ ok: false, message: "Invalid JSON body." }, { status: 400 });
  }

  const patch = {
    order_notifications:
      typeof body.order_notifications === "boolean" ? body.order_notifications : undefined,
    promo_notifications:
      typeof body.promo_notifications === "boolean" ? body.promo_notifications : undefined,
    message_notifications:
      typeof body.message_notifications === "boolean" ? body.message_notifications : undefined,
  };

  if (
    patch.order_notifications === undefined &&
    patch.promo_notifications === undefined &&
    patch.message_notifications === undefined
  ) {
    return NextResponse.json({ ok: false, message: "No valid settings fields provided." }, { status: 400 });
  }

  const { data, error } = await db
    .from("user_settings")
    .upsert(
      {
        user_id: authResult.auth.userId,
        ...patch,
      },
      { onConflict: "user_id" }
    )
    .select("id,user_id,order_notifications,promo_notifications,message_notifications")
    .single<UserSettingsRow>();

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, settings: data });
}
