import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";

function formatPaise(paise: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);
}

export async function GET(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const invoiceId = searchParams.get("invoiceId");
  const orderId = searchParams.get("orderId");

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Server configuration error." }, { status: 500 });
  }

  let query = admin
    .from("invoices")
    .select("*, orders(service_label, created_at)");

  if (invoiceId) {
    query = query.eq("id", invoiceId);
  } else if (orderId) {
    query = query.eq("order_id", orderId);
  } else {
    query = query.or(`provider_id.eq.${auth.auth.userId},consumer_id.eq.${auth.auth.userId}`);
  }

  const { data, error } = await query.order("created_at", { ascending: false }).maybeSingle();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: "Invoice not found." }, { status: 404 });
  }

  if (data.provider_id !== auth.auth.userId && data.consumer_id !== auth.auth.userId) {
    return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
  }

  return NextResponse.json({
    ok: true,
    invoice: {
      ...data,
      subtotal: formatPaise(data.subtotal_paise),
      commission: formatPaise(data.commission_paise),
      tax: formatPaise(data.tax_paise),
      total: formatPaise(data.total_paise),
      gstCgst: formatPaise(data.gst_cgst_paise),
      gstSgst: formatPaise(data.gst_sgst_paise),
      gstIgst: formatPaise(data.gst_igst_paise),
    },
  });
}
