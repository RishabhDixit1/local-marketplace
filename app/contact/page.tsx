import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Contact Us",
  description: "Get in touch with the ServiQ team. Email us at support@serviqapp.com for help, feedback, or partnership inquiries.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-[var(--ink-950)]">Contact Us</h1>
      <p className="mt-2 text-sm text-[var(--ink-500)]">We&apos;d love to hear from you. Here&apos;s how to reach us.</p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-6">
          <h2 className="text-base font-semibold text-[var(--ink-950)]">General Inquiries</h2>
          <p className="mt-2 text-sm text-[var(--ink-700)]">
            For general questions, feedback, or partnership inquiries.
          </p>
          <a
            href="mailto:info@serviqapp.com"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink-950)] underline"
          >
            info@serviqapp.com
          </a>
        </div>

        <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-6">
          <h2 className="text-base font-semibold text-[var(--ink-950)]">Customer Support</h2>
          <p className="mt-2 text-sm text-[var(--ink-700)]">
            For help with orders, accounts, or technical issues.
          </p>
          <a
            href="mailto:support@serviqapp.com"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink-950)] underline"
          >
            support@serviqapp.com
          </a>
        </div>

        <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-6">
          <h2 className="text-base font-semibold text-[var(--ink-950)]">Privacy</h2>
          <p className="mt-2 text-sm text-[var(--ink-700)]">
            For privacy-related inquiries and data requests.
          </p>
          <a
            href="mailto:privacy@serviqapp.com"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink-950)] underline"
          >
            privacy@serviqapp.com
          </a>
        </div>

        <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-6">
          <h2 className="text-base font-semibold text-[var(--ink-950)]">Legal</h2>
          <p className="mt-2 text-sm text-[var(--ink-700)]">
            For legal notices or terms-related questions.
          </p>
          <a
            href="mailto:legal@serviqapp.com"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink-950)] underline"
          >
            legal@serviqapp.com
          </a>
        </div>

        <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-6">
          <h2 className="text-base font-semibold text-[var(--ink-950)]">Press & Partnerships</h2>
          <p className="mt-2 text-sm text-[var(--ink-700)]">
            For media inquiries and partnership opportunities.
          </p>
          <a
            href="mailto:press@serviqapp.com"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink-950)] underline"
          >
            press@serviqapp.com
          </a>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-6">
        <h2 className="text-base font-semibold text-[var(--ink-950)]">Office Address</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--ink-700)]">
          ServiQ Technologies Pvt. Ltd.
          <br />
          Crossing Republik
          <br />
          Ghaziabad, Uttar Pradesh 201009
          <br />
          India
        </p>
      </div>
    </main>
  );
}
