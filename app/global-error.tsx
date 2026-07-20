"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try {
      import("@sentry/nextjs").then(({ captureException }) => captureException(error));
    } catch {
      // Sentry not available — skip.
    }
  }, [error]);

  return (
    <html>
      <body className="m-0 min-h-screen bg-[var(--surface-app,#f8fafc)] font-sans text-[var(--ink-950,#0f172a)]">
        <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <div className="mb-8">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--ink-400,#94a3b8)]">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[var(--ink-950,#0f172a)]">Something went wrong</h1>
          <p className="mt-2 max-w-[400px] text-sm leading-relaxed text-[var(--ink-500,#64748b)]">
            We encountered an unexpected issue. Our team has been notified. Try reloading the page to continue.
          </p>
          <div className="mt-6 flex gap-3">
            <button
              onClick={reset}
              className="rounded-xl border-none bg-[var(--ink-950,#0f172a)] px-7 py-3 text-sm font-semibold text-white transition hover:brightness-110"
            >
              Try Again
            </button>
            <button
              onClick={() => { window.location.href = "/"; }}
              className="rounded-xl border border-[var(--surface-border,#e2e8f0)] bg-[var(--surface-elevated,#fff)] px-7 py-3 text-sm font-semibold text-[var(--ink-950,#0f172a)] transition hover:brightness-95"
            >
              Go Home
            </button>
          </div>
          {process.env.NODE_ENV === "development" && (
            <pre className="mt-8 max-w-full overflow-auto rounded-xl bg-[var(--ink-950,#1e293b)] p-4 text-left text-xs text-[var(--ink-200,#e2e8f0)]">
              {error.message}
              {"\n\n"}
              {error.digest ? `Digest: ${error.digest}\n\n` : ""}
              {error.stack}
            </pre>
          )}
        </div>
      </body>
    </html>
  );
}
