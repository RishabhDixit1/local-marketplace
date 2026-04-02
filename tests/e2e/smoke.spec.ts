import { expect, test, type Page } from "@playwright/test";
import { hasE2EAuthConfig, resolveMagicLinkUrl } from "./helpers/auth";

const loginEmail = process.env.E2E_LOGIN_EMAIL;
const enableLoginRequestSmoke = process.env.E2E_ENABLE_LOGIN_REQUEST_SMOKE === "1";

const transitionLabelRegex =
  /Send Quote|Mark Accepted|Reject|Start Work|Mark Completed|Accept Quote|Confirm Completion|Cancel Request/i;
const checkoutAddress = "221B Baker Street, Bengaluru";

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

const openProviderStoreAndAddItemToCart = async ({ page }: { page: Page }) => {
  await page.goto("/dashboard/people", { waitUntil: "domcontentloaded" });
  await expect(page.locator("article").first()).toBeVisible({ timeout: 15_000 });

  const cardCount = await page.locator("article").count();
  const maxAttempts = Math.min(cardCount, 8);

  for (let index = 0; index < maxAttempts; index += 1) {
    await page.goto("/dashboard/people", { waitUntil: "domcontentloaded" });

    const card = page.locator("article").nth(index);
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.click();

    const storeTab = page.getByRole("button", { name: /^Store$/i });
    await expect(storeTab).toBeVisible({ timeout: 20_000 });
    await storeTab.click();

    const addToCartButton = page.getByRole("button", { name: /Add to Cart/i }).first();
    if ((await addToCartButton.count()) > 0) {
      await expect(addToCartButton).toBeVisible({ timeout: 10_000 });
      await addToCartButton.click();
      return;
    }

    const buyNowButton = page.getByRole("button", { name: /Hire Now|Buy Now/i }).first();
    if ((await buyNowButton.count()) > 0) {
      await expect(buyNowButton).toBeVisible({ timeout: 10_000 });
      await buyNowButton.click();
      return;
    }
  }

  throw new Error("Could not find a provider with a checkoutable store item in the first 8 cards.");
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

  await test.step("public profile store checkout", async () => {
    await openProviderStoreAndAddItemToCart({ page });

    const cartDialog = page.getByRole("dialog", { name: /Shopping cart/i });
    await expect(cartDialog).toBeVisible({ timeout: 15_000 });
    await cartDialog.getByRole("button", { name: /Checkout/i }).click();

    await page.waitForURL(/\/checkout/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /^Checkout$/i })).toBeVisible({ timeout: 15_000 });

    await page.getByLabel("Delivery address").fill(checkoutAddress);
    await page.getByRole("button", { name: /^Pay on Delivery$/i }).click();
    await page.getByRole("button", { name: /Place Order/i }).click();

    await page.waitForURL(/\/orders\/[^/]+$/, { timeout: 30_000 });
    await expect(page.getByText(checkoutAddress)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Order ID:/i)).toBeVisible({ timeout: 20_000 });
  });
});
