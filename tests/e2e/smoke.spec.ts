import { expect, test, type Page } from "@playwright/test";
import { hasE2EAuthConfig, resolveMagicLinkUrl } from "./helpers/auth";

const loginEmail = process.env.E2E_LOGIN_EMAIL;
const enableLoginRequestSmoke = process.env.E2E_ENABLE_LOGIN_REQUEST_SMOKE === "1";

const transitionLabelRegex =
  /Send Quote|Mark Accepted|Reject|Start Work|Mark Completed|Accept Quote|Confirm Completion|Cancel Request/i;
const checkoutAddress = "221B Baker Street, Bengaluru";

const authenticateWithMagicLink = async ({ page }: { page: Page }) => {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  const dashboardAction = page.getByRole("button", { name: /Post a need|Post Need/i });
  try {
    await expect(dashboardAction).toBeVisible({ timeout: 10_000 });
    return;
  } catch {
    // Fall back to a fresh magic link when storageState is unavailable or stale.
  }

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
  const providerCards = page.locator('article[data-provider-card="true"]');
  await expect(providerCards.first()).toBeVisible({ timeout: 15_000 });

  const clickCommerceAction = async (timeout = 8_000) => {
    const commerceButton = page.getByRole("button", { name: /Add to Cart|Hire Now|Buy Now/i }).first();
    try {
      await expect(commerceButton).toBeVisible({ timeout });
      await commerceButton.click();
      return true;
    } catch {
      return false;
    }
  };

  const storeReadyCards = page.locator('article[data-provider-card="true"][data-has-store="true"]');
  const cards = (await storeReadyCards.count()) > 0 ? storeReadyCards : providerCards;
  const cardCount = await cards.count();
  const maxAttempts = Math.min(cardCount, 8);

  for (let index = 0; index < maxAttempts; index += 1) {
    await page.goto("/dashboard/people", { waitUntil: "domcontentloaded" });

    const card = cards.nth(index);
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.click();

    await page.waitForURL(/\/(profile|business)\//, { timeout: 20_000 }).catch(() => {});

    if (await clickCommerceAction()) {
      return;
    }

    const storeTab = page.getByRole("button", { name: /^Store$/i }).first();
    if ((await storeTab.count()) > 0) {
      await expect(storeTab).toBeVisible({ timeout: 20_000 });
      await storeTab.click();

      if (await clickCommerceAction(10_000)) {
        return;
      }
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
  test.setTimeout(180_000);

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
    const connectedCard = page.locator("article").filter({ hasText: /Connected/i }).first();
    const connectedMessageButton = connectedCard.getByRole("button", { name: /^Message$/i }).first();
    if ((await connectedMessageButton.count()) > 0) {
      await expect(connectedMessageButton).toBeVisible({ timeout: 15_000 });
      await connectedMessageButton.click();
    } else {
      const firstMessageButton = page.getByRole("button", { name: /^Message$/i }).first();
      await expect(firstMessageButton).toBeVisible({ timeout: 15_000 });
      await firstMessageButton.click();
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
    const interestButton = page.getByRole("button", { name: /^(Send Interest|Accept|Withdraw)$/i }).first();
    await expect(interestButton).toBeVisible({ timeout: 20_000 });

    const currentLabel = (await interestButton.innerText()).trim();
    if (!/withdraw/i.test(currentLabel)) {
      await interestButton.click();

      const confirmHeading = page.getByText("Send interest in this task");
      await expect(confirmHeading).toBeVisible({ timeout: 15_000 });
      const confirmButton = page.getByRole("button", { name: /^(Send Interest|Yes,\s*Accept)$/i }).last();
      await confirmButton.click();

      await expect(confirmHeading).toBeHidden({ timeout: 20_000 });
    }

    await expect(page.getByRole("button", { name: /^Withdraw$/i }).first()).toBeVisible({ timeout: 20_000 });
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

    await page.getByLabel(/Delivery or service address|Delivery address/i).fill(checkoutAddress);
    await page.getByRole("radio", { name: /^Pay on Delivery$/i }).click();
    await page.getByRole("button", { name: /Place order/i }).click();

    await page.waitForURL(/\/orders\/[^/]+$/, { timeout: 30_000 });
    await expect(page.getByText(checkoutAddress)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Order ID:/i)).toBeVisible({ timeout: 20_000 });
  });
});
