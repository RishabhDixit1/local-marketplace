import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Privacy Policy",
  description: "ServiQ's privacy policy — how we collect, use, and protect your personal information when you use our local marketplace platform.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: June 6, 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-7 text-slate-700">
        <section>
          <h2 className="text-lg font-semibold text-slate-900">1. Information We Collect</h2>
          <p className="mt-2">
            When you use ServiQ, we collect information you provide directly: your name, email address,
            phone number, and any content you submit (profile information, service listings, messages,
            reviews). We also collect usage data such as pages visited, search queries, and interactions
            with providers.
          </p>
          <p className="mt-2">
            If you enable location services, we collect your approximate location to connect you with
            nearby providers. You can disable location access at any time in your device settings.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">2. How We Use Your Information</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>To provide, maintain, and improve our platform</li>
            <li>To connect you with service providers or customers</li>
            <li>To process transactions and send order updates</li>
            <li>To send service-related communications (order confirmations, reminders)</li>
            <li>To detect and prevent fraud or abuse</li>
            <li>To comply with legal obligations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">3. Data Sharing</h2>
          <p className="mt-2">
            We share your information only as necessary to provide our services:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><strong>With providers/customers</strong> — to facilitate service bookings</li>
            <li><strong>Payment processors</strong> — Razorpay for payment handling</li>
            <li><strong>Service providers</strong> — Resend (email), Twilio (SMS), Firebase (push notifications)</li>
            <li><strong>Legal requirements</strong> — when required by law or to protect rights</li>
          </ul>
          <p className="mt-2">
            We do not sell your personal information to third parties.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">4. Data Retention</h2>
          <p className="mt-2">
            We retain your information for as long as your account is active. If you delete your account,
            we delete or anonymize your data within 30 days, except where retention is required by law
            (such as transaction records for tax compliance).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">5. Your Rights</h2>
          <p className="mt-2">
            You have the right to:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data (via account settings or by contacting us)</li>
            <li>Withdraw consent for data processing</li>
            <li>Export your data in a portable format</li>
          </ul>
          <p className="mt-2">
            To exercise these rights, contact us at privacy@serviqapp.com.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">6. Security</h2>
          <p className="mt-2">
            We implement appropriate technical and organizational measures to protect your data,
            including encryption in transit (TLS), encrypted storage, and regular security audits.
            However, no method of electronic storage is 100% secure.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">7. Third-Party Services</h2>
          <p className="mt-2">
            Our platform integrates with third-party services for essential functionality. Each
            service provider processes data according to their own privacy policies. We recommend
            reviewing the privacy policies of Razorpay, Google Maps, Firebase, and Twilio.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">8. Changes to This Policy</h2>
          <p className="mt-2">
            We may update this privacy policy from time to time. Material changes will be notified
            via email or through the platform. Continued use after changes constitutes acceptance
            of the updated policy.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">9. Contact</h2>
          <p className="mt-2">
            For privacy-related inquiries, contact us at privacy@serviqapp.com or write to:
            ServiQ, Crossing Republik, Ghaziabad, Uttar Pradesh, India.
          </p>
        </section>
      </div>
    </main>
  );
}
