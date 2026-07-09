import { expect, test, type Page } from "@playwright/test";
import { hasE2EAuthConfig, resolveMagicLinkUrl } from "./helpers/auth";

const checkoutAddress = "221B Baker Street, Bengaluru";

const signInAsNewUser = async ({ page }: { page: Page }) => {
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

const addStoreItemToCart = async ({ page }: { page: Page }) => {
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

  throw new Error("Could not find a provider with a checkoutable store item.");
};

test.describe("critical flow: sign-up → browse → purchase → cancel", () => {
  test.setTimeout(240_000);

  test.skip(
    !hasE2EAuthConfig,
    "Provide E2E_MAGIC_LINK_URL or (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + E2E_LOGIN_EMAIL)."
  );

  test("full purchase and cancellation flow", async ({ page }) => {
    page.on("dialog", (dialog) => {
      void dialog.accept();
    });

    await test.step("sign in as new user", async () => {
      await signInAsNewUser({ page });
      await expect(page.getByRole("button", { name: /Post a need|Post Need/i })).toBeVisible({
        timeout: 15_000,
      });
    });

    await test.step("browse marketplace providers", async () => {
      await page.goto("/dashboard/people", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /People Network/i })).toBeVisible({ timeout: 20_000 });
      await expect(page.locator("article").first()).toBeVisible({ timeout: 15_000 });
    });

    let orderUrl = "";

    await test.step("purchase from store", async () => {
      await addStoreItemToCart({ page });

      const cartDialog = page.getByRole("dialog", { name: /Shopping cart/i });
      await expect(cartDialog).toBeVisible({ timeout: 15_000 });
      await cartDialog.getByRole("button", { name: /Checkout/i }).click();

      await page.waitForURL(/\/checkout/, { timeout: 20_000 });
      await expect(page.getByRole("heading", { name: /^Checkout$/i })).toBeVisible({ timeout: 15_000 });

      await page.getByLabel(/Delivery or service address|Delivery address/i).fill(checkoutAddress);
      await page.getByRole("radio", { name: /^Pay on Delivery$/i }).click();
      await page.getByRole("button", { name: /Place order/i }).click();

      await page.waitForURL(/\/orders\/[^/]+$/, { timeout: 30_000 });
      orderUrl = page.url();
      await expect(page.getByText(checkoutAddress)).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(/Order ID:/i)).toBeVisible({ timeout: 20_000 });
    });

    await test.step("cancel order from order detail page", async () => {
      await page.goto(orderUrl, { waitUntil: "domcontentloaded" });
      const cancelButton = page.getByRole("button", { name: /Cancel Order/i });
      await expect(cancelButton).toBeVisible({ timeout: 15_000 });
      await cancelButton.click();

      await expect(page.getByText(/cancelled|canceled/i)).toBeVisible({ timeout: 15_000 });
    });

    await test.step("verify cancelled status persists on reload", async () => {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByText(/cancelled|canceled/i)).toBeVisible({ timeout: 15_000 });
    });
  });
});
