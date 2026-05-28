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
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f8fafc", color: "#0f172a" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "24px", textAlign: "center" }}>
          <div style={{ marginBottom: "32px" }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#94a3b8" }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, margin: 0, color: "#0f172a" }}>Something went wrong</h1>
          <p style={{ fontSize: "14px", color: "#64748b", marginTop: "8px", lineHeight: 1.5, maxWidth: "400px" }}>
            We encountered an unexpected issue. Our team has been notified. Try reloading the page to continue.
          </p>
          <div style={{ marginTop: "24px", display: "flex", gap: "12px" }}>
            <button
              onClick={reset}
              style={{
                padding: "12px 28px",
                borderRadius: "12px",
                border: "none",
                background: "#0f172a",
                color: "#fff",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try Again
            </button>
            <button
              onClick={() => { window.location.href = "/"; }}
              style={{
                padding: "12px 28px",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                background: "#fff",
                color: "#0f172a",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Go Home
            </button>
          </div>
          {process.env.NODE_ENV === "development" && (
            <pre style={{ marginTop: "32px", padding: "16px", background: "#1e293b", color: "#e2e8f0", borderRadius: "12px", fontSize: "12px", maxWidth: "100%", overflow: "auto", textAlign: "left" }}>
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
