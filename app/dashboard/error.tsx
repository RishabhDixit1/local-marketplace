"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { captureClientObservability } from "@/lib/observability";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void captureClientObservability({
      event_type: "client_error",
      route: "dashboard",
      pathname: typeof window !== "undefined" ? window.location.pathname : "/dashboard",
      message: error.message,
      stack: error.stack,
      digest: error.digest,
      context: {
        source: "error_boundary",
      },
    });
  }, [error]);

  return (
    <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
      <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-rose-100">
        <AlertTriangle className="h-5 w-5 text-rose-600" />
      </div>
      <h2 className="text-lg font-semibold text-slate-900">Something went wrong on this dashboard view.</h2>
      <p className="mt-2 text-sm text-slate-600">
        The incident was captured for investigation. Retry now or refresh the page.
      </p>
      <button
        onClick={reset}
        className="mt-4 inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
      >
        Retry
      </button>
    </div>
  );
}
