"use client";

import { BadgeCheck, CreditCard, Landmark } from "lucide-react";
import { formatPaymentRailLabel } from "@/lib/paymentFlow";
import type { MarketplacePaymentMethodRecord } from "@/lib/profile/marketplace";

export default function PaymentMethodsSection({ paymentMethods }: { paymentMethods: MarketplacePaymentMethodRecord[] }) {
  return (
    <section className="rounded-[28px] border border-[var(--surface-border)]/80 bg-[var(--surface-elevated)] p-5 shadow-lg shadow-[var(--shadow-rgb)]/10 sm:p-6">
      <div className="mb-5">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--ink-500)]">Payments</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--ink-950)]">Payment Methods</h2>
      </div>

      {paymentMethods.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {paymentMethods.map((method) => (
            <article key={method.id} className="rounded-[24px] border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--surface-elevated)] text-[var(--ink-700)] shadow-sm">
                    {method.method_type === "card" ? <CreditCard className="h-4 w-4" /> : <Landmark className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="text-base font-semibold text-[var(--ink-950)]">
                      {method.account_label || formatPaymentRailLabel(method.method_type)}
                    </p>
                    <p className="text-sm text-[var(--ink-700)]">
                      {method.provider_name ? formatPaymentRailLabel(method.provider_name) : "Payment rail"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {method.is_default ? (
                    <span className="rounded-full bg-[var(--ink-950)] px-2.5 py-1 text-[11px] font-semibold text-white">Default</span>
                  ) : null}
                  {method.is_verified ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-elevated)] px-2.5 py-1 text-[11px] font-semibold text-emerald-700 shadow-sm">
                      <BadgeCheck className="h-3 w-3" />
                      Verified
                    </span>
                  ) : null}
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-[var(--ink-700)]">
                {method.account_handle || method.account_last4 ? (
                  <span className="font-medium text-[var(--ink-950)]">{method.account_handle || `•••• ${method.account_last4}`}</span>
                ) : (
                  "Payment details are ready to be configured."
                )}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-[24px] border border-dashed border-[var(--surface-border)] bg-[var(--surface-soft)] p-6 text-sm text-[var(--ink-700)]">
          No payment methods listed yet.
        </div>
      )}
    </section>
  );
}
