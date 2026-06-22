import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Terms of Service",
  description: "ServiQ's terms of service — the rules and guidelines for using our local marketplace platform as a customer or service provider.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Terms of Service</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: June 6, 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-7 text-slate-700">
        <section>
          <h2 className="text-lg font-semibold text-slate-900">1. Acceptance of Terms</h2>
          <p className="mt-2">
            By accessing or using ServiQ (&quot;the Platform&quot;), you agree to be bound by these Terms of
            Service. If you do not agree, do not use the Platform.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">2. Description of Service</h2>
          <p className="mt-2">
            ServiQ is a marketplace platform connecting consumers with local service providers.
            We facilitate the discovery, booking, and payment for services. We are not a direct
            provider of the services listed and are not responsible for the quality or delivery
            of services performed by providers.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">3. User Accounts</h2>
          <p className="mt-2">
            You are responsible for maintaining the confidentiality of your account credentials.
            You must be at least 18 years old to use the Platform. You agree to provide accurate
            and complete information when creating an account.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">4. Provider Obligations</h2>
          <p className="mt-2">If you list services on the Platform, you agree to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Provide accurate descriptions and pricing for your services</li>
            <li>Deliver services as described and in a professional manner</li>
            <li>Honour confirmed bookings and provide timely communication</li>
            <li>Comply with all applicable laws and regulations</li>
            <li>Maintain appropriate insurance and licences as required</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">5. Payments and Fees</h2>
          <p className="mt-2">
            All payments are processed through Razorpay. ServiQ charges a commission on each
            transaction as disclosed at the time of booking. Providers are paid after service
            completion, subject to any applicable dispute resolution process.
          </p>
          <p className="mt-2">
            Prices displayed are inclusive of applicable taxes. You are responsible for any
            additional taxes or fees required by law.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">6. Cancellations and Refunds</h2>
          <p className="mt-2">
            Cancellation and refund policies are determined by individual providers and disclosed
            at the time of booking. If a provider fails to deliver the service as agreed, you may
            file a dispute through our dispute resolution process.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">7. Prohibited Conduct</h2>
          <p className="mt-2">You agree not to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Use the Platform for any illegal purpose</li>
            <li>Misrepresent your identity or qualifications</li>
            <li>Interfere with the operation of the Platform</li>
            <li>Harass, abuse, or harm other users</li>
            <li>Circumvent our commission or payment systems</li>
            <li>Collect user information without consent</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">8. Limitation of Liability</h2>
          <p className="mt-2">
            ServiQ provides the Platform on an &quot;as is&quot; basis. To the maximum extent permitted by
            law, we disclaim all warranties, express or implied. Our total liability for any claim
            arising from your use of the Platform is limited to the fees you paid to us in the
            12 months preceding the claim.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">9. Dispute Resolution</h2>
          <p className="mt-2">
            Disputes between users should first be resolved through the Platform&apos;s in-app dispute
            resolution system. If a dispute cannot be resolved, it shall be settled by arbitration
            in Ghaziabad, Uttar Pradesh, in accordance with the Arbitration and Conciliation Act,
            1996. The decision of the arbitrator shall be final and binding.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">10. Governing Law</h2>
          <p className="mt-2">
            These Terms are governed by the laws of India. Any legal action shall be brought
            exclusively in the courts of Ghaziabad, Uttar Pradesh.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">11. Termination</h2>
          <p className="mt-2">
            We may suspend or terminate your account for violation of these Terms. You may delete
            your account at any time through your settings. Upon termination, your right to use
            the Platform ceases immediately.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">12. Contact</h2>
          <p className="mt-2">
            For questions about these Terms, contact legal@serviqapp.com or write to:
            ServiQ, Crossing Republik, Ghaziabad, Uttar Pradesh, India.
          </p>
        </section>
      </div>
    </main>
  );
}
