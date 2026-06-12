import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy",
};

export default function RefundPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold text-slate-900">Refund & Cancellation Policy</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: June 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-600">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">1. Scope</h2>
          <p>
            This policy applies to all services and products booked through ServiQ. It
            governs cancellations made by consumers, providers, and the platform.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">2. Consumer Cancellations</h2>
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-semibold text-slate-900">Before Provider Accepts</h3>
              <p className="mt-1 text-slate-600">
                You may cancel any order before the provider accepts it. No charges apply.
                Any payments made are fully refunded within 5-7 business days.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-semibold text-slate-900">After Provider Accepts (Before Work Starts)</h3>
              <p className="mt-1 text-slate-600">
                You may cancel within 24 hours of acceptance for a full refund. After 24
                hours, a 10% cancellation fee (capped at ₹500) applies to cover the
                provider&apos;s time and scheduling.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-semibold text-slate-900">During Active Work</h3>
              <p className="mt-1 text-slate-600">
                If the provider has started work, cancellations are handled on a case-by-case
                basis. You will be refunded for any uncompleted portions. File a dispute if
                you and the provider cannot agree on a fair amount.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-semibold text-slate-900">After Work Is Completed</h3>
              <p className="mt-1 text-slate-600">
                You have 3 days after completion to report any issues. Refunds for
                unsatisfactory work are handled through our dispute resolution process.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">3. Provider Cancellations</h2>
          <p>
            If a provider cancels after accepting an order, the consumer receives a full
            refund. Repeated cancellations may result in account suspension.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">4. Service Guarantee</h2>
          <p>
            If a verified provider fails to deliver the agreed service, ServiQ will
            mediate and, where applicable, refund up to 100% of the order value through
            our dispute resolution process.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">5. Dispute Resolution</h2>
          <p>
            If you are unsatisfied with a service, file a dispute within 3 days of
            completion. Our team reviews each case and aims to resolve within 5 business
            days. Decisions may include full refund, partial refund, or service redo.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">6. Refund Timeline</h2>
          <p>
            Approved refunds are processed within 5-7 business days. Refunds are credited
            to the original payment method. Razorpay payments typically reflect within
            3-5 business days after processing.
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-semibold text-slate-900">7. Contact</h2>
          <p>
            For refund inquiries, contact{" "}
            <a href="mailto:support@serviq.app" className="font-medium text-[var(--brand-700)] underline underline-offset-2">
              support@serviq.app
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
