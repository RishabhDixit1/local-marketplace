import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { withErrorHandling } from "@/lib/server/errorHandler";

function generateInvoiceNumber(): string {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `INV-${y}${m}${d}-${rand}`;
}

async function postHandler(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  let body: { orderId: string };
  try {
    body = (await request.json()) as { orderId: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  if (!body.orderId) {
    return NextResponse.json({ ok: false, error: "Missing orderId." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Server configuration error." }, { status: 500 });
  }

  const { data: order } = await admin
    .from("orders")
    .select("id, consumer_id, provider_id, total_paise, status, created_at")
    .eq("id", body.orderId)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404 });
  }

  if (auth.auth.userId !== order.consumer_id && auth.auth.userId !== order.provider_id) {
    return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
  }

  const { data: existing } = await admin
    .from("invoices")
    .select("id, invoice_number")
    .eq("order_id", order.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, invoiceId: existing.id, invoiceNumber: existing.invoice_number });
  }

  const subtotalPaise = order.total_paise;
  const commissionPaise = Math.round(subtotalPaise * 0.125);
  const gstRate = 18.00;
  const taxablePaise = subtotalPaise;
  const gstTotalPaise = Math.round(taxablePaise * gstRate / 100);
  const gstCgstPaise = Math.round(gstTotalPaise / 2);
  const gstSgstPaise = Math.round(gstTotalPaise / 2);
  const gstIgstPaise = 0;
  const totalPaise = subtotalPaise + gstTotalPaise;

  const invoiceNumber = generateInvoiceNumber();

  const { data: invoice, error } = await admin
    .from("invoices")
    .insert({
      order_id: order.id,
      invoice_number: invoiceNumber,
      provider_id: order.provider_id,
      consumer_id: order.consumer_id,
      subtotal_paise: subtotalPaise,
      commission_paise: commissionPaise,
      tax_paise: gstTotalPaise,
      total_paise: totalPaise,
      gst_rate: gstRate,
      gst_cgst_paise: gstCgstPaise,
      gst_sgst_paise: gstSgstPaise,
      gst_igst_paise: gstIgstPaise,
    })
    .select("id, invoice_number")
    .maybeSingle();

  if (error || !invoice) {
    console.error("[invoices/generate] insert error:", error);
    return NextResponse.json({ ok: false, error: "Failed to generate invoice." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, invoiceId: invoice.id, invoiceNumber: invoice.invoice_number });
}

export const POST = withErrorHandling(postHandler, "invoices:generate");
