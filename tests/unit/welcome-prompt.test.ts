import { describe, expect, it } from "vitest";
import { resolveWelcomeCommand } from "../../lib/welcomePrompt";

describe("resolveWelcomeCommand", () => {
  it("routes refresh requests back into a feed refresh action", () => {
    expect(
      resolveWelcomeCommand("refresh my feed", {
        defaultHref: "/dashboard/people",
        isProvider: false,
      })
    ).toEqual({ kind: "refresh" });
  });

  it("routes saved and chat requests to the right dashboard surfaces", () => {
    expect(
      resolveWelcomeCommand("show my saved posts", {
        defaultHref: "/dashboard/people",
        isProvider: false,
      })
    ).toEqual({ kind: "route", href: "/dashboard/saved" });

    expect(
      resolveWelcomeCommand("open chat", {
        defaultHref: "/dashboard/people",
        isProvider: false,
      })
    ).toEqual({ kind: "route", href: "/dashboard/chat" });
  });

  it("routes provider selling intents into listing creation", () => {
    expect(
      resolveWelcomeCommand("add a new service listing", {
        defaultHref: "/dashboard/people",
        providerDefaultHref: "/dashboard/provider/add-service",
        isProvider: true,
      })
    ).toEqual({ kind: "route", href: "/dashboard/provider/add-service" });
  });

  it("falls back to the recommended next action when the request is broad", () => {
    expect(
      resolveWelcomeCommand("what should i do next", {
        defaultHref: "/dashboard?compose=1",
        isProvider: false,
      })
    ).toEqual({ kind: "route", href: "/dashboard?compose=1" });
  });
});
