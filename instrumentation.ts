/**
 * Next.js instrumentation — runs once when the server starts.
 * Registers process-level error handlers to prevent crashes from
 * uncaught network errors (ECONNRESET, ENETUNREACH, ETIMEDOUT)
 * that originate from hung GoTrue/EC2 connections.
 *
 * process.on / process.exit are Node-only APIs — they must NOT
 * run in the Edge runtime.  NEXT_RUNTIME is set by Next.js:
 *   'nodejs' on the Node.js server, 'edge' on the Edge server.
 *
 * The actual handlers live in lib/instrumentation-node-handlers.ts
 * and are dynamically imported so that Sentry's valueInjectionLoader
 * does not flag them when it compiles this file for Edge.
 */

export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  import("@/lib/instrumentation-node-handlers").then(({ registerNodeHandlers }) => {
    registerNodeHandlers();
  });
}
