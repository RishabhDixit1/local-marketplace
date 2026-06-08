import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { withErrorHandling } from "@/lib/server/errorHandler";

async function getHandler(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Server configuration error." }, { status: 500 });
  }

  const { data } = await admin
    .from("invoices")
    .select("id, invoice_number, total_paise, status, invoice_date, orders(service_label)")
    .or(`provider_id.eq.${auth.auth.userId},consumer_id.eq.${auth.auth.userId}`)
    .order("created_at", { ascending: false });

  return NextResponse.json({ invoices: data ?? [] });
}

export const GET = withErrorHandling(getHandler, "invoices:list");
