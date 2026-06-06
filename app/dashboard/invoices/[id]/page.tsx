"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, FileText, Loader2, Printer } from "lucide-react";
import Link from "next/link";

type InvoiceData = {
  id: string;
  invoice_number: string;
  subtotal: string;
  commission: string;
  tax: string;
  total: string;
  gstCgst: string;
  gstSgst: string;
  gstIgst: string;
  gst_rate: number;
  status: string;
  invoice_date: string;
  subtotal_paise: number;
  provider_id: string;
  consumer_id: string;
  orders: { service_label: string; created_at: string } | null;
};

export default function InvoiceDetailPage() {
  const params = useParams();
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/invoices?invoiceId=${params.id}`);
        if (res.ok) {
          const body = (await res.json()) as { invoice: InvoiceData };
          setInvoice(body.invoice);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <p className="text-slate-500">Invoice not found.</p>
        <Link href="/dashboard/invoices" className="mt-4 inline-flex text-sm font-semibold text-slate-900 underline">
          Back to invoices
        </Link>
      </div>
    );
  }

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between py-2 text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <Link
        href="/dashboard/invoices"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to invoices
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8" id="invoice-print">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{invoice.invoice_number}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {new Date(invoice.invoice_date).toLocaleDateString("en-IN", {
                day: "numeric", month: "long", year: "numeric",
              })}
            </p>
          </div>
          <div className="rounded-xl bg-slate-100 p-3">
            <FileText className="h-6 w-6 text-slate-600" />
          </div>
        </div>

        <div className="mt-6 border-t border-slate-100 pt-4">
          <p className="text-sm font-medium text-slate-900">{invoice.orders?.service_label ?? "Service"}</p>
        </div>

        <div className="mt-6 space-y-1 border-t border-slate-100 pt-4">
          <Row label="Subtotal" value={invoice.subtotal} />
          <Row label="Commission (12.5%)" value={`-${invoice.commission}`} />
          <Row label={`GST @ ${invoice.gst_rate}%`} value={invoice.tax} />
          <Row label="CGST" value={invoice.gstCgst} />
          <Row label="SGST" value={invoice.gstSgst} />
          <div className="border-t border-slate-200 pt-2 mt-1">
            <Row label="Total" value={invoice.total} />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
            invoice.status === "paid" ? "bg-emerald-100 text-emerald-700" :
            invoice.status === "issued" ? "bg-amber-100 text-amber-700" :
            "bg-slate-100 text-slate-600"
          }`}>
            {invoice.status.toUpperCase()}
          </span>
          <span className="text-xs text-slate-400">
            Tax Invoice &middot; Valid under GST
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => window.print()}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        <Printer className="h-4 w-4" />
        Print / Download PDF
      </button>
    </div>
  );
}
