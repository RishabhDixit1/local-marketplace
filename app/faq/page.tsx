import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ",
};

const faqs = [
  {
    q: "How do I create an account?",
    a: "Enter your email on the sign-in page and we'll send you a magic link. Click it to sign in instantly — no password needed. If email delivery fails, you'll get an OTP code to use instead.",
  },
  {
    q: "How do I find a service provider?",
    a: "Use the search bar to find providers by name, service, or location. You can filter by category, rating, and availability. Browse provider profiles to see services, reviews, and pricing before booking.",
  },
  {
    q: "How do I book a service?",
    a: "Once you've found a provider, send them a message or create a help request. The provider will respond with a quote or availability. You can then confirm the booking and make payment.",
  },
  {
    q: "What payment methods are accepted?",
    a: "We accept UPI, credit/debit cards, and net banking through Razorpay. Cash on delivery is also available for eligible services.",
  },
  {
    q: "How do I cancel a booking?",
    a: "Go to your orders page and select the booking you want to cancel. If the provider hasn't started the service, you can cancel and receive a full refund. Cancellation policies vary by provider.",
  },
  {
    q: "How do I get a refund?",
    a: "If a provider fails to deliver the service as agreed, file a dispute through your order page. Our team will review and resolve it within 5-7 business days.",
  },
  {
    q: "How do I become a provider?",
    a: "Sign in and navigate to your dashboard. Complete the 4-step provider onboarding wizard: set your location and service area, configure availability, fill in your business profile, and publish.",
  },
  {
    q: "How do I get paid?",
    a: "Add your bank account details in the Payouts section of your dashboard. Payments are processed after service completion and are typically settled within 3-5 business days.",
  },
  {
    q: "How do I delete my account?",
    a: "Go to Settings in your dashboard, scroll to the Account section, and click 'Delete account'. Type DELETE to confirm. All your data will be permanently removed within 30 days.",
  },
  {
    q: "How do I report a problem with a provider?",
    a: "Use the 'File a Dispute' option on your order page. Select the reason and provide a description. Our admin team will review and take appropriate action.",
  },
  {
    q: "Is my data secure?",
    a: "Yes. We use encryption in transit (TLS) and at rest. Payment data is handled by Razorpay, a PCI-DSS compliant processor. We never store full payment card details on our servers.",
  },
  {
    q: "Can I use ServiQ outside India?",
    a: "ServiQ is currently available only in India. We verify provider locations to connect you with nearby professionals in your area.",
  },
  {
    q: "How are disputes resolved?",
    a: "If you have an issue with a service, file a dispute from your order page. Our admin team reviews evidence from both sides and makes a determination within 5-7 business days.",
  },
  {
    q: "How do I update my profile?",
    a: "Go to your profile page and click 'Edit Profile'. You can update your name, photo, contact details, location, and preferences. Changes are saved immediately.",
  },
];

export default function FaqPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">
        Frequently Asked Questions
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Everything you need to know about using ServiQ.
      </p>

      <div className="mt-8 space-y-4">
        {faqs.map((faq, i) => (
          <details key={i} className="group rounded-2xl border border-slate-200 bg-white">
            <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-semibold text-slate-900">
              {faq.q}
              <svg
                className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <p className="border-t border-slate-100 px-5 py-4 text-sm leading-6 text-slate-600">
              {faq.a}
            </p>
          </details>
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-slate-500">
        Still need help?{" "}
        <a
          href="mailto:support@serviqapp.com"
          className="font-semibold text-slate-900 underline"
        >
          Contact our support team
        </a>
      </p>
    </main>
  );
}
