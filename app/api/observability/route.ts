import { NextRequest, NextResponse } from "next/server";
import type { ObservabilityEventPayload } from "@/lib/observability";

const EVENT_TYPES = new Set(["route_view", "route_perf", "web_vital", "client_error", "ui_action"]);
const ROUTES = new Set(["dashboard", "chat", "tasks", "welcome", "people", "launchpad", "checkout", "profile", "settings"]);

const truncate = (value: unknown, maxLength: number) => {
  if (typeof value !== "string") return null;
  return value.length > maxLength ? value.slice(0, maxLength) : value;
};

const toNumberOrNull = (value: unknown) => {
  if (typeof value !== "number") return null;
  return Number.isFinite(value) ? value : null;
};

const sanitizePayload = (payload: unknown) => {
  if (!payload || typeof payload !== "object") return null;
  const raw = payload as ObservabilityEventPayload;

  if (!EVENT_TYPES.has(raw.event_type)) return null;
  if (!ROUTES.has(raw.route)) return null;

  return {
    event_type: raw.event_type,
    route: raw.route,
    pathname: truncate(raw.pathname, 300),
    metric: truncate(raw.metric, 64),
    value: toNumberOrNull(raw.value),
    message: truncate(raw.message, 1000),
    stack: truncate(raw.stack, 5000),
    digest: truncate(raw.digest, 256),
    context: raw.context && typeof raw.context === "object" ? raw.context : null,
  };
};

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const payload = sanitizePayload(body);
  if (!payload) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const eventEnvelope = {
    ...payload,
    captured_at: new Date().toISOString(),
    user_agent: truncate(request.headers.get("user-agent"), 300),
    x_forwarded_for: truncate(request.headers.get("x-forwarded-for"), 120),
  };

  console.info("[observability:event]", JSON.stringify(eventEnvelope));

  const forwardUrl = process.env.OBSERVABILITY_FORWARD_URL;
  if (forwardUrl) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (process.env.OBSERVABILITY_FORWARD_TOKEN) {
      headers.Authorization = `Bearer ${process.env.OBSERVABILITY_FORWARD_TOKEN}`;
    }

    try {
      await fetch(forwardUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(eventEnvelope),
        cache: "no-store",
      });
    } catch (error) {
      console.error("[observability:forward_error]", error);
    }
  }

  return NextResponse.json({ ok: true }, { status: 202 });
}
