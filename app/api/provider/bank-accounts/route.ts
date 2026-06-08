import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { withErrorHandling } from "@/lib/server/errorHandler";

export const runtime = "nodejs";

async function getHandler(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });
  }

  const { data: accounts } = await db
    .from("provider_bank_accounts")
    .select("*")
    .eq("provider_id", auth.auth.userId)
    .order("is_default", { ascending: false });

  return NextResponse.json({ ok: true, accounts: accounts ?? [] });
}

type AddAccountBody = {
  account_type: "bank" | "upi";
  account_holder_name?: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  upi_handle?: string;
  is_default?: boolean;
};

async function postHandler(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  let body: AddAccountBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }

  if (!["bank", "upi"].includes(body.account_type)) {
    return NextResponse.json({ ok: false, message: "Invalid account type" }, { status: 400 });
  }

  if (body.account_type === "bank" && (!body.account_number || !body.ifsc_code)) {
    return NextResponse.json({ ok: false, message: "Account number and IFSC required for bank accounts" }, { status: 400 });
  }

  if (body.account_type === "upi" && !body.upi_handle) {
    return NextResponse.json({ ok: false, message: "UPI handle required" }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });
  }

  const userId = auth.auth.userId;

  // If this is set as default, unset other defaults
  if (body.is_default) {
    await db
      .from("provider_bank_accounts")
      .update({ is_default: false })
      .eq("provider_id", userId)
      .eq("is_default", true);
  }

  const { data: account, error } = await db
    .from("provider_bank_accounts")
    .insert({
      provider_id: userId,
      account_type: body.account_type,
      account_holder_name: body.account_holder_name?.trim() ?? null,
      bank_name: body.bank_name?.trim() ?? null,
      account_number: body.account_number?.trim() ?? null,
      ifsc_code: body.ifsc_code?.trim() ?? null,
      upi_handle: body.upi_handle?.trim() ?? null,
      is_default: body.is_default ?? false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, account });
}

export const GET = withErrorHandling(getHandler, "provider:bank-accounts");
export const POST = withErrorHandling(postHandler, "provider:bank-accounts-create");
