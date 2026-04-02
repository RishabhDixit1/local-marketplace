export type ObservedRoute =
  | "dashboard"
  | "chat"
  | "tasks"
  | "welcome"
  | "people"
  | "launchpad"
  | "checkout"
  | "profile"
  | "settings";

export type ObservabilityEventType = "route_view" | "route_perf" | "web_vital" | "client_error" | "ui_action";

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

export const captureUiActionObservability = async (params: {
  route: ObservedRoute;
  action: string;
  pathname?: string;
  context?: Record<string, unknown>;
}) =>
  captureClientObservability({
    event_type: "ui_action",
    route: params.route,
    pathname: params.pathname,
    metric: params.action,
    context: params.context,
  });

export const resolveObservedRouteFromPathname = (pathname: string): ObservedRoute => {
  if (pathname.startsWith("/dashboard/chat")) return "chat";
  if (pathname.startsWith("/dashboard/tasks")) return "tasks";
  if (pathname.startsWith("/dashboard/welcome")) return "welcome";
  if (pathname.startsWith("/dashboard/people")) return "people";
  if (pathname.startsWith("/dashboard/launchpad")) return "launchpad";
  if (pathname.startsWith("/dashboard/profile")) return "profile";
  if (pathname.startsWith("/dashboard/settings")) return "settings";
  if (pathname.startsWith("/checkout")) return "checkout";
  return "dashboard";
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
