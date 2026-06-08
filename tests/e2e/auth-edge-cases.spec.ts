import { expect, test } from "@playwright/test";
import { hasE2EAuthConfig, resolveMagicLinkUrl } from "./helpers/auth";

const siteUrl = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";

test.describe("auth edge cases", () => {
  test("unauthenticated access redirects to login", async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/$|login|auth\/login/, { timeout: 15_000 });
    expect(page.url()).not.toContain("/dashboard");

    await context.close();
  });

  test("unauthenticated API route returns 401", async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    const response = await page.request.get("/api/orders");
    expect(response.status()).toBe(401);

    await context.close();
  });

  test.describe("authenticated", () => {
    test.use({ storageState: ".auth/user.json" });

    test("onboarding redirects to dashboard when profile is complete", async ({ page }) => {
      test.skip(
        !hasE2EAuthConfig,
        "Provide E2E_MAGIC_LINK_URL or (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + E2E_LOGIN_EMAIL)."
      );

      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("button", { name: /Post a need|Post Need/i })).toBeVisible({
        timeout: 20_000,
      });

      await page.goto("/onboarding/seeker", { waitUntil: "domcontentloaded" });
      await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
    });

    test("public profile page loads with correct content", async ({ page }) => {
      test.skip(
        !hasE2EAuthConfig,
        "Provide E2E_MAGIC_LINK_URL or (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + E2E_LOGIN_EMAIL)."
      );

      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await expect(page.locator('[data-provider-card="true"]').first()).toBeVisible({
        timeout: 20_000,
      });

      const firstCard = page.locator('[data-provider-card="true"]').first();
      const link = firstCard.locator("a").first();
      const href = await link.getAttribute("href");

      expect(href).toMatch(/\/profile\/|business\//);

      await page.goto(href!, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 15_000 });
      const bodyText = await page.locator("body").innerText();
      expect(bodyText.length).toBeGreaterThan(50);
    });
  });
});
