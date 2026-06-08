import { NextResponse } from "next/server";

export type ApiErrorContext = {
  route: string;
  userId?: string | null;
  action?: string;
  metadata?: Record<string, unknown>;
  status?: number;
};

const reportToSentry = (error: unknown, context: ApiErrorContext) => {
  import("@sentry/nextjs").then((Sentry) => {
    Sentry.captureException(error instanceof Error ? error : new Error(String(error)), {
      tags: {
        route: context.route,
        ...(context.action ? { action: context.action } : {}),
      },
      ...(context.userId ? { user: { id: context.userId } } : {}),
      ...(context.metadata ? { extra: context.metadata } : {}),
    });
  }).catch(() => {
    // Sentry not available — skip.
  });
};

export const captureApiError = (error: unknown, context: ApiErrorContext) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  const status = context.status ?? 502;

  console.error(`[${context.route}]${context.action ? ` ${context.action}` : ""}`, message);

  if (process.env.NODE_ENV === "production") {
    reportToSentry(error, context);
  }

  return NextResponse.json({ ok: false, message }, { status });
};

// Next.js route handler signatures vary (static vs dynamic params),
// so we use a loose type rather than enumerating every permutation.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RouteHandler = (...args: any[]) => Promise<NextResponse>;

export const withErrorHandling = (handler: RouteHandler, route: string): RouteHandler => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (...args: any[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      return captureApiError(error, { route });
    }
  };
};
