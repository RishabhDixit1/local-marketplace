import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Contact Us",
  description: "Get in touch with the ServiQ team. Email us at info@serviqapp.com for help, feedback, or partnership inquiries.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-[var(--ink-950)]">Contact Us</h1>
      <p className="mt-2 text-sm text-[var(--ink-500)]">We&apos;d love to hear from you. Here&apos;s how to reach us.</p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-6">
          <h2 className="text-base font-semibold text-[var(--ink-950)]">Email</h2>
          <p className="mt-2 text-sm text-[var(--ink-700)]">
            For general questions, support, feedback, or partnership inquiries.
          </p>
          <a
            href="mailto:info@serviqapp.com"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink-950)] underline"
          >
            info@serviqapp.com
          </a>
        </div>

        <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-6">
          <h2 className="text-base font-semibold text-[var(--ink-950)]">Phone</h2>
          <p className="mt-2 text-sm text-[var(--ink-700)]">
            For urgent inquiries or immediate assistance.
          </p>
          <a
            href="tel:+919696707492"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink-950)] underline"
          >
            +91 9696707492
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
