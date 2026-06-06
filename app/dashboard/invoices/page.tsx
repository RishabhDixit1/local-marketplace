"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import Link from "next/link";

type Invoice = {
  id: string;
  invoice_number: string;
  total_paise: number;
  status: string;
  invoice_date: string;
  orders: { service_label: string } | null;
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/invoices/list");
        if (res.ok) {
          const body = (await res.json()) as { invoices: Invoice[] };
          setInvoices(body.invoices);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Invoices</h1>
        <p className="mt-1 text-sm text-slate-500">Tax invoices for completed orders.</p>
      </div>

      {invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-16">
          <FileText className="h-8 w-8 text-slate-300" />
          <p className="mt-4 text-sm text-slate-500">No invoices yet. Invoices are generated when orders are completed.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => (
            <Link
              key={inv.id}
              href={`/dashboard/invoices/${inv.id}`}
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-slate-100 p-2">
                  <FileText className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{inv.invoice_number}</p>
                  <p className="text-xs text-slate-500">
                    {inv.orders?.service_label ?? "Service"} &middot;{" "}
                    {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(inv.total_paise / 100)}
                  </p>
                </div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                inv.status === "paid" ? "bg-emerald-100 text-emerald-700" :
                inv.status === "issued" ? "bg-amber-100 text-amber-700" :
                "bg-slate-100 text-slate-600"
              }`}>
                {inv.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
