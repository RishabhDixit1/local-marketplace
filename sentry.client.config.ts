import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
  replaysSessionSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
  replaysOnErrorSampleRate: 1,
  environment: process.env.NODE_ENV || "development",
  enabled: process.env.NODE_ENV === "production",
  integrations: process.env.NODE_ENV === "production" ? [Sentry.replayIntegration()] : [],
});
