"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from "web-vitals";
import {
  captureClientObservability,
  toErrorStack,
  toErrorString,
  type ObservedRoute,
} from "@/lib/observability";
import { isAbortLikeError } from "@/lib/runtimeErrors";

type RouteObservabilityProps = {
  route: ObservedRoute;
};

const roundMetric = (value: number) => Number(value.toFixed(2));

export default function RouteObservability({ route }: RouteObservabilityProps) {
  const pathname = usePathname();

  useEffect(() => {
    const startedAt = performance.now();

    void captureClientObservability({
      event_type: "route_view",
      route,
      pathname,
      context: {
        href: window.location.href,
      },
    });

    const frameId = window.requestAnimationFrame(() => {
      void captureClientObservability({
        event_type: "route_perf",
        route,
        pathname,
        metric: "first_frame_ms",
        value: roundMetric(performance.now() - startedAt),
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [pathname, route]);

  useEffect(() => {
    const reportMetric = (metric: Metric) => {
      void captureClientObservability({
        event_type: "web_vital",
        route,
        pathname,
        metric: metric.name,
        value: roundMetric(metric.value),
        context: {
          id: metric.id,
          delta: roundMetric(metric.delta),
          rating: metric.rating,
          navigationType: metric.navigationType,
        },
      });
    };

    const subscriptions: Array<() => void> = [];
    const addSubscription = (unsubscribe: void | (() => void)) => {
      if (typeof unsubscribe === "function") {
        subscriptions.push(unsubscribe);
      }
    };

    addSubscription(onCLS(reportMetric, { reportAllChanges: true }));
    addSubscription(onINP(reportMetric, { reportAllChanges: true }));
    addSubscription(onLCP(reportMetric, { reportAllChanges: true }));
    addSubscription(onFCP(reportMetric, { reportAllChanges: true }));
    addSubscription(onTTFB(reportMetric, { reportAllChanges: true }));

    return () => {
      subscriptions.forEach((unsubscribe) => unsubscribe());
    };
  }, [pathname, route]);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const error = event.error;
      if (isAbortLikeError(error || event.message)) {
        return;
      }
      void captureClientObservability({
        event_type: "client_error",
        route,
        pathname,
        message: error ? toErrorString(error) : event.message || "Unhandled error event",
        stack: error ? toErrorStack(error) || undefined : undefined,
        context: {
          source: event.filename || null,
          line: event.lineno || null,
          column: event.colno || null,
        },
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      if (isAbortLikeError(event.reason)) {
        return;
      }
      void captureClientObservability({
        event_type: "client_error",
        route,
        pathname,
        message: toErrorString(event.reason),
        stack: toErrorStack(event.reason) || undefined,
        context: {
          source: "unhandledrejection",
        },
      });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, [pathname, route]);

  return null;
}
