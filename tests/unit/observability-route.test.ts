import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

describe("POST /api/observability", () => {
  const originalForwardUrl = process.env.OBSERVABILITY_FORWARD_URL;
  const originalForwardToken = process.env.OBSERVABILITY_FORWARD_TOKEN;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.OBSERVABILITY_FORWARD_URL;
    delete process.env.OBSERVABILITY_FORWARD_TOKEN;
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.OBSERVABILITY_FORWARD_URL = originalForwardUrl;
    process.env.OBSERVABILITY_FORWARD_TOKEN = originalForwardToken;
    vi.restoreAllMocks();
  });

  it("accepts ui_action events for newly tracked launch routes", async () => {
    const { POST } = await import("../../app/api/observability/route");
    const response = await POST(
      new NextRequest("http://localhost:3000/api/observability", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "vitest",
          "x-forwarded-for": "127.0.0.1",
        },
        body: JSON.stringify({
          event_type: "ui_action",
          route: "launchpad",
          pathname: "/dashboard/launchpad",
          metric: "map_open",
          context: {
            layer: "people",
          },
        }),
      })
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(console.info).toHaveBeenCalledWith("[observability:event]", expect.stringContaining("\"route\":\"launchpad\""));
    expect(console.info).toHaveBeenCalledWith("[observability:event]", expect.stringContaining("\"metric\":\"map_open\""));
  });

  it("rejects invalid routes and event types", async () => {
    const { POST } = await import("../../app/api/observability/route");
    const response = await POST(
      new NextRequest("http://localhost:3000/api/observability", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event_type: "tap",
          route: "billing",
          metric: "deep_link_open",
        }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_payload" });
  });
});
