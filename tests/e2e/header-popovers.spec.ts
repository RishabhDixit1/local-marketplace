import { expect, test, type Page } from "@playwright/test";
import { hasE2EAuthConfig, resolveMagicLinkUrl } from "./helpers/auth";

test.use({
  viewport: { width: 1440, height: 960 },
});

const authenticateWithMagicLink = async (page: Page) => {
  const magicLinkUrl = await resolveMagicLinkUrl();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(magicLinkUrl, { waitUntil: "domcontentloaded" });
      await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
      return;
    } catch (error) {
      if (attempt === 2) throw error;
      await page.waitForTimeout(1500 * (attempt + 1));
    }
  }
};

test("desktop header popovers stay visible and mutually exclusive", async ({
  page,
}) => {
  test.skip(
    !hasE2EAuthConfig,
    "Provide E2E_MAGIC_LINK_URL or (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + E2E_LOGIN_EMAIL)."
  );

  await authenticateWithMagicLink(page);
  await page.goto("/dashboard/welcome", { waitUntil: "domcontentloaded" });

  const accountMenuButton = page.getByRole("button", {
    name: /Open account menu/i,
  });
  const notificationsButton = page.getByRole("button", {
    name: /Open notifications/i,
  });

  await expect(accountMenuButton).toBeVisible({ timeout: 20_000 });
  await expect(notificationsButton).toBeVisible({ timeout: 20_000 });

  await accountMenuButton.click();

  await expect(page.getByText(/ServiQ account/i)).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByRole("button", { name: /^Saved$/i })).toBeVisible({
    timeout: 10_000,
  });
  await expect(
    page.getByRole("button", {
      name: /^(View Public Profile|Complete Profile)$/i,
    }),
  ).toBeVisible({
    timeout: 10_000,
  });

  await notificationsButton.click();

  await expect(
    page.getByRole("dialog", { name: /Notifications panel/i }),
  ).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/ServiQ account/i)).toBeHidden({
    timeout: 10_000,
  });
});
