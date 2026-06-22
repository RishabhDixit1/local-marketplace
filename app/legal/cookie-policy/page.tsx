import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Cookie Policy",
  description: "ServiQ's cookie policy — how we use cookies and similar technologies to improve your experience on our platform.",
  path: "/legal/cookie-policy",
});

const cookieCategories = [
  {
    title: "Essential Cookies",
    description:
      "Required for the platform to function. These enable authentication, session management, and security features.",
    examples: ["Supabase auth session token", "CSRF protection token"],
    duration: "Session / 1 year",
  },
  {
    title: "Preference Cookies",
    description:
      "Remember your settings and choices to personalize your experience.",
    examples: ["Theme preference (light/dark mode)"],
    duration: "1 year",
  },
  {
    title: "Analytics Cookies",
    description:
      "Help us understand how users interact with the platform so we can improve it.",
    examples: ["Vercel Analytics (anonymous page views)"],
    duration: "Session",
  },
];

export default function CookiePolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold text-slate-900">Cookie Policy</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: June 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-600">
        <p>
          ServiQ uses cookies and similar technologies to provide, secure, and
          improve our platform. This policy explains what we use and how you can
          control them.
        </p>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">
            What Are Cookies?
          </h2>
          <p>
            Cookies are small text files stored on your device by your browser.
            They allow us to recognize your browser, remember preferences, and
            understand how you use our service.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">
            Cookies We Use
          </h2>
          <div className="space-y-4">
            {cookieCategories.map((cat) => (
              <div
                key={cat.title}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <h3 className="font-semibold text-slate-900">{cat.title}</h3>
                <p className="mt-1 text-slate-600">{cat.description}</p>
                <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                  <div>
                    <span className="font-medium text-slate-500">
                      Examples:
                    </span>
                    <ul className="mt-1 list-inside list-disc text-slate-500">
                      {cat.examples.map((ex) => (
                        <li key={ex}>{ex}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="font-medium text-slate-500">
                      Duration:
                    </span>
                    <p className="mt-1 text-slate-500">{cat.duration}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">
            Your Choices
          </h2>
          <p>
            When you first visit ServiQ, you can choose to accept all cookies or
            reject non-essential ones. Essential cookies cannot be disabled as
            they are necessary for the platform to function.
          </p>
          <p className="mt-2">
            You can also manage cookies through your browser settings. Note that
            blocking essential cookies may prevent parts of the platform from
            working correctly.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">
            Third-Party Services
          </h2>
          <p>
            We use Vercel Analytics for anonymous usage tracking and Sentry for
            error monitoring. These services operate under their own privacy
            policies and do not receive personally identifiable information.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">
            Contact
          </h2>
          <p>
            For questions about this cookie policy, contact us at{" "}
            <a
              href="mailto:privacy@serviq.app"
              className="font-medium text-[var(--brand-700)] underline underline-offset-2"
            >
              privacy@serviq.app
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
