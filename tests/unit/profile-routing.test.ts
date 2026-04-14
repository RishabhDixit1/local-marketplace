import { describe, expect, it } from "vitest";
import {
  FIRST_TIME_POST_LOGIN_REDIRECT_ROUTE,
  POST_LOGIN_REDIRECT_ROUTE,
} from "../../lib/profile/types";
import { resolveAuthenticatedProfilePath } from "../../lib/profile/utils";

describe("resolveAuthenticatedProfilePath", () => {
  it("sends first-time users to Explore when no explicit next path is set", () => {
    expect(FIRST_TIME_POST_LOGIN_REDIRECT_ROUTE).toBe("/dashboard");
    expect(resolveAuthenticatedProfilePath({ onboarding_completed: false })).toBe("/dashboard");
    expect(resolveAuthenticatedProfilePath(null)).toBe("/dashboard");
  });

  it("keeps completed profiles on the returning-user landing route", () => {
    expect(POST_LOGIN_REDIRECT_ROUTE).toBe("/dashboard/welcome");
    expect(resolveAuthenticatedProfilePath({ onboarding_completed: true })).toBe("/dashboard/welcome");
  });

  it("preserves an explicit next path", () => {
    expect(resolveAuthenticatedProfilePath({ onboarding_completed: false }, "/dashboard/tasks")).toBe("/dashboard/tasks");
  });
});
