import { describe, expect, it } from "vitest";
import {
  FIRST_TIME_POST_LOGIN_REDIRECT_ROUTE,
  POST_LOGIN_REDIRECT_ROUTE,
} from "../../lib/profile/types";
import { resolveAuthenticatedProfilePath } from "../../lib/profile/utils";

describe("resolveAuthenticatedProfilePath", () => {
  it("sends first-time users to Explore when no explicit next path is set", () => {
    expect(FIRST_TIME_POST_LOGIN_REDIRECT_ROUTE).toBe("/dashboard");
    expect(resolveAuthenticatedProfilePath({ onboarding_completed: false, role: "business" })).toBe("/dashboard");
    expect(resolveAuthenticatedProfilePath(null)).toBe("/dashboard");
  });

  it("keeps completed profiles on the returning-user landing route", () => {
    expect(POST_LOGIN_REDIRECT_ROUTE).toBe("/dashboard");
    expect(resolveAuthenticatedProfilePath({ onboarding_completed: true, role: "business" })).toBe("/dashboard");
  });

  it("sends incomplete seeker profiles to the onboarding wizard", () => {
    expect(resolveAuthenticatedProfilePath({ onboarding_completed: false })).toBe("/onboarding/seeker");
    expect(resolveAuthenticatedProfilePath({ onboarding_completed: true })).toBe("/onboarding/seeker");
  });

  it("sends complete seeker profiles to the returning-user route", () => {
    expect(resolveAuthenticatedProfilePath({ onboarding_completed: true, seeker_onboarding_completed: true })).toBe("/dashboard");
  });

  it("preserves an explicit next path", () => {
    expect(resolveAuthenticatedProfilePath({ onboarding_completed: false }, "/dashboard/tasks")).toBe("/dashboard/tasks");
  });
});
