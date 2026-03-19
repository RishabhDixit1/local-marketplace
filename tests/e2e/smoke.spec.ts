import { expect, test, type Page } from "@playwright/test";
import { hasE2EAuthConfig, resolveMagicLinkUrl } from "./helpers/auth";

const loginEmail = process.env.E2E_LOGIN_EMAIL;
const enableLoginRequestSmoke = process.env.E2E_ENABLE_LOGIN_REQUEST_SMOKE === "1";

const transitionLabelRegex =
  /Send Quote|Mark Accepted|Reject|Start Work|Mark Completed|Accept Quote|Confirm Completion|Cancel Request/i;

const authenticateWithMagicLink = async ({ page }: { page: Page }) => {
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

test("login request smoke", async ({ page }) => {
  test.skip(
    !enableLoginRequestSmoke || !loginEmail,
    "Set E2E_ENABLE_LOGIN_REQUEST_SMOKE=1 and E2E_LOGIN_EMAIL to run login-request smoke."
  );

  await page.goto("/");
  await page.getByPlaceholder("you@example.com").fill(loginEmail || "");
  await page.getByRole("button", { name: /Send Login Link/i }).click();

  await expect(page.getByText(/Check Your Email/i)).toBeVisible({ timeout: 15000 });
});

test("authenticated marketplace smoke", async ({ page }) => {
  test.skip(
    !hasE2EAuthConfig,
    "Provide E2E_MAGIC_LINK_URL or (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + E2E_LOGIN_EMAIL)."
  );

  page.on("dialog", (dialog) => {
    void dialog.accept();
  });

  await authenticateWithMagicLink({ page });

  await test.step("provider discovery", async () => {
    await page.goto("/dashboard/people", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /People Network/i })).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("heading", { name: /Discover nearby professionals and businesses/i })
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("article").first()).toBeVisible({ timeout: 15_000 });
  });

  await test.step("open connected chat + send message", async () => {
    const mobileConnectionsToggle = page.getByRole("button", { name: /^Connections$/i });
    if ((await mobileConnectionsToggle.count()) > 0 && (await mobileConnectionsToggle.first().isVisible())) {
      await mobileConnectionsToggle.first().click();
    }

    const connectionsPanel = page.locator("section").filter({ has: page.getByRole("heading", { name: /^Connections$/i }) }).first();
    await expect(connectionsPanel).toBeVisible({ timeout: 15_000 });

    await connectionsPanel.getByRole("button", { name: /Connected/i }).click();

    const acceptedConnectionChat = connectionsPanel.getByRole("button", { name: /^Chat$/i }).first();
    if ((await acceptedConnectionChat.count()) > 0) {
      await expect(acceptedConnectionChat).toBeVisible({ timeout: 15_000 });
      await acceptedConnectionChat.click();
    } else {
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      const dashboardConnectedCard = page
        .locator("article")
        .filter({ has: page.getByRole("button", { name: /^Connected$/i }) })
        .first();
      await expect(dashboardConnectedCard).toBeVisible({ timeout: 20_000 });
      await dashboardConnectedCard.getByRole("button", { name: /^Chat$/i }).click();
    }

    await page.waitForURL(/\/dashboard\/chat\?open=/, { timeout: 30_000 });
    const composer = page.getByPlaceholder("Write a message...");
    await expect(composer).toBeVisible({ timeout: 20_000 });

    const message = `e2e smoke ${Date.now()}`;
    await composer.fill(message);
    await composer.press("Enter");

    await expect(page.getByText(message).last()).toBeVisible({ timeout: 15_000 });
  });

  await test.step("create order from marketplace", async () => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const acceptButton = page.getByRole("button", { name: /^Accept$/i }).first();
    await expect(acceptButton).toBeVisible({ timeout: 20_000 });
    await acceptButton.click();

    const confirmButton = page.getByRole("button", { name: /Yes,\s*Accept/i });
    await expect(confirmButton).toBeVisible({ timeout: 15_000 });
    await confirmButton.click();

    await expect(confirmButton).toBeHidden({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /^Accepted$/i }).first()).toBeVisible({ timeout: 20_000 });
  });

  await test.step("task status transition", async () => {
    await page.goto("/dashboard/tasks", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Tasks Workspace|My Tasks|Task Operations/i })).toBeVisible();

    const transitionButton = page
      .locator("button")
      .filter({ hasText: transitionLabelRegex })
      .first();

    if ((await transitionButton.count()) > 0) {
      await transitionButton.click();
    }
  });
});
