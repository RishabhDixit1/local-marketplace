"use client";

import { useEffect } from "react";

export default function PageError({
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
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-12 text-center">
      <svg
        width="56"
        height="56"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mb-6 text-[var(--ink-400)]"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <h1 className="text-xl font-bold text-[var(--ink-950)]">Something went wrong</h1>
      <p className="mt-2 max-w-[400px] text-sm leading-relaxed text-[var(--ink-500)]">
        We hit an unexpected error. Try again or go back to the homepage.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={reset}
          className="rounded-[10px] border-none bg-[var(--ink-950)] px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
        >
          Try Again
        </button>
        <button
          onClick={() => { window.location.href = "/"; }}
          className="rounded-[10px] border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-6 py-2.5 text-sm font-semibold text-[var(--ink-950)] transition hover:brightness-95"
        >
          Go Home
        </button>
      </div>
      {process.env.NODE_ENV === "development" && (
        <pre className="mt-6 max-w-full overflow-auto rounded-[10px] bg-[var(--ink-950)] p-4 text-left text-xs text-[var(--ink-200)]">
          {error.message}
          {"\n\n"}
          {error.digest ? `Digest: ${error.digest}\n\n` : ""}
          {error.stack}
        </pre>
      )}
    </div>
  );
}
