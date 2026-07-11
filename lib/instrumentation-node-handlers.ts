/**
 * Node.js-only process-level error handlers.
 * Separated from instrumentation.ts so Sentry's valueInjectionLoader
 * does not flag process.on / process.exit when it transforms the file
 * for the Edge Runtime bundle.
 */

export function registerNodeHandlers() {
  process.on("unhandledRejection", (reason: unknown) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    console.error("[instrumentation] unhandledRejection:", message);

    if (process.env.NODE_ENV === "production") {
      import("@sentry/nextjs")
        .then((Sentry) => {
          Sentry.captureException(
            reason instanceof Error ? reason : new Error(String(reason)),
            { level: "warning" },
          );
        })
        .catch(() => {});
    }
  });

  process.on("uncaughtException", (error: Error) => {
    const code = (error as NodeJS.ErrnoException).code;
    const isNetworkError =
      code === "ECONNRESET" ||
      code === "ENETUNREACH" ||
      code === "ETIMEDOUT" ||
      code === "ECONNREFUSED" ||
      error.message?.includes("aborted");

    if (isNetworkError) {
      console.warn(
        "[instrumentation] uncaughtException (network, suppressed):",
        code,
        error.message,
      );
      return;
    }

    console.error("[instrumentation] uncaughtException (fatal):", error);
    if (process.env.NODE_ENV === "production") {
      import("@sentry/nextjs")
        .then((Sentry) => {
          Sentry.captureException(error, { level: "fatal" });
        })
        .catch(() => {});
    }
    process.exit(1);
  });
}
