export type ObservedRoute = "dashboard" | "chat" | "tasks";

export type ObservabilityEventType = "route_view" | "route_perf" | "web_vital" | "client_error";

export type ObservabilityEventPayload = {
  event_type: ObservabilityEventType;
  route: ObservedRoute;
  pathname?: string;
  metric?: string;
  value?: number;
  message?: string;
  stack?: string;
  digest?: string;
  context?: Record<string, unknown>;
};

const DEFAULT_OBSERVABILITY_ENDPOINT = "/api/observability";

const shouldCaptureClientObservability = () => {
  const explicitDisable = process.env.NEXT_PUBLIC_OBSERVABILITY_ENABLED === "0";
  if (explicitDisable) return false;
  if (process.env.NODE_ENV === "production") return true;
  return process.env.NEXT_PUBLIC_OBSERVABILITY_DEBUG === "1";
};

export const captureClientObservability = async (payload: ObservabilityEventPayload) => {
  if (typeof window === "undefined") return;
  if (!shouldCaptureClientObservability()) return;

  try {
    await fetch(DEFAULT_OBSERVABILITY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...payload,
        pathname: payload.pathname || window.location.pathname,
      }),
      keepalive: true,
    });
  } catch {
    // Observability should never block user flow.
  }
};

export const toErrorString = (value: unknown) => {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  return "Unknown client error";
};

export const toErrorStack = (value: unknown) => {
  if (value instanceof Error) return value.stack || null;
  return null;
};
