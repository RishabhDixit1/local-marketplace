"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { fetchAuthedJson } from "@/lib/clientApi";

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
        const body = await fetchAuthedJson<{ ok: boolean; invoices?: Invoice[] }>(supabase, "/api/invoices/list");
        if (body.invoices) setInvoices(body.invoices);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--ink-500)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[var(--ink-950)]">Invoices</h1>
        <p className="mt-1 text-sm text-[var(--ink-500)]">Tax invoices for completed orders.</p>
      </div>

      {invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] py-16">
          <FileText className="h-8 w-8 text-[var(--ink-500)]" />
          <p className="mt-4 text-sm text-[var(--ink-500)]">No invoices yet. Invoices are generated when orders are completed.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => (
            <Link
              key={inv.id}
              href={`/dashboard/invoices/${inv.id}`}
              className="flex items-center justify-between rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-4 transition hover:border-[var(--border-strong)]"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-[var(--surface-soft)] p-2">
                  <FileText className="h-5 w-5 text-[var(--ink-700)]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--ink-950)]">{inv.invoice_number}</p>
                  <p className="text-xs text-[var(--ink-500)]">
                    {inv.orders?.service_label ?? "Service"} &middot;{" "}
                    {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(inv.total_paise / 100)}
                  </p>
                </div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                inv.status === "paid" ? "bg-emerald-100 text-emerald-700" :
                inv.status === "issued" ? "bg-amber-100 text-amber-700" :
                "bg-[var(--surface-soft)] text-[var(--ink-700)]"
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
