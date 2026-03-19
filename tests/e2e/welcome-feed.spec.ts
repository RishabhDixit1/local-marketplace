import { expect, test, type Page } from "@playwright/test";
import { hasE2EAuthConfig, resolveMagicLinkUrl } from "./helpers/auth";

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

const gotoWelcomeFeed = async (page: Page) => {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.goto("/dashboard/welcome", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("welcome-live-feed")).toBeVisible({ timeout: 20_000 });

    try {
      await expect(page.getByTestId("welcome-feed-card").first()).toBeVisible({ timeout: 20_000 });
      return;
    } catch (error) {
      if (attempt === 1) throw error;
      await page.waitForTimeout(1500);
    }
  }
};

const getWelcomeFeedCard = (page: Page, cardId: string) =>
  page.locator(`[data-testid="welcome-feed-card"][data-card-id="${cardId}"]`).first();

const clickWelcomeFeedAction = async (page: Page, cardId: string, actionTestId: string) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const action = getWelcomeFeedCard(page, cardId).getByTestId(actionTestId);
    await expect(action).toBeVisible({ timeout: 15_000 });

    try {
      await action.click();
      return;
    } catch (error) {
      if (attempt === 2) throw error;
      await page.waitForTimeout(1_000);
    }
  }
};

test.describe("welcome feed cards", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !hasE2EAuthConfig,
      "Provide E2E_MAGIC_LINK_URL or (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + E2E_LOGIN_EMAIL)."
    );
    await authenticateWithMagicLink(page);
  });

  test("renders visual cards with media and actions", async ({ page }) => {
    await gotoWelcomeFeed(page);

    const firstCard = page.getByTestId("welcome-feed-card").first();
    await expect(firstCard.getByRole("heading", { level: 3 })).toBeVisible();
    await expect(firstCard.getByTestId("feed-card-main-image")).toBeVisible();
    await expect(firstCard.getByTestId("feed-action-primary")).toBeVisible();
    await expect(firstCard.getByTestId("feed-action-message")).toBeVisible();
    await expect(firstCard.getByTestId("feed-action-network")).toBeVisible();
    await expect(firstCard.getByTestId("feed-action-share")).toBeVisible();
    await expect(firstCard.getByTestId("feed-action-save")).toBeVisible();
  });

  test("falls back to clipboard sharing and shows feedback", async ({ page }) => {
    await page.addInitScript(() => {
      (window as Window & { __feedClipboardWrites?: string[] }).__feedClipboardWrites = [];

      Object.defineProperty(navigator, "share", {
        configurable: true,
        writable: true,
        value: undefined,
      });

      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value: string) => {
            const target = window as Window & { __feedClipboardWrites?: string[] };
            target.__feedClipboardWrites = target.__feedClipboardWrites || [];
            target.__feedClipboardWrites.push(value);
            return Promise.resolve();
          },
        },
      });
    });

    await gotoWelcomeFeed(page);

    const firstCard = page.getByTestId("welcome-feed-card").first();
    await firstCard.getByTestId("feed-action-share").click();

    await expect(page.getByText("Share link copied.")).toBeVisible();

    const writes = await page.evaluate(() => {
      const target = window as Window & { __feedClipboardWrites?: string[] };
      return target.__feedClipboardWrites || [];
    });

    expect(writes.length).toBeGreaterThan(0);
    expect(writes[0]).toContain("source=welcome_feed");
  });

  test("keeps contextual params when opening primary, chat, and network actions", async ({ page }) => {
    await gotoWelcomeFeed(page);

    const feedCard = page.getByTestId("welcome-feed-card").first();
    const cardId = await feedCard.getAttribute("data-card-id");
    expect(cardId).toBeTruthy();

    await clickWelcomeFeedAction(page, cardId!, "feed-action-primary");
    await page.waitForURL((url) => url.pathname === "/dashboard" && url.searchParams.get("source") === "welcome_feed");
    await expect(page).toHaveURL(new RegExp(`context_card=${cardId}`));
    await expect(page).toHaveURL(/source=welcome_feed/);

    await gotoWelcomeFeed(page);

    const messageCard = page.getByTestId("welcome-feed-card").first();
    const messageCardId = await messageCard.getAttribute("data-card-id");
    expect(messageCardId).toBeTruthy();
    await clickWelcomeFeedAction(page, messageCardId!, "feed-action-message");
    await page.waitForURL(/\/dashboard\/chat/);
    await expect(page).toHaveURL(/source=welcome_feed/);

    await gotoWelcomeFeed(page);

    const networkCard = page.getByTestId("welcome-feed-card").first();
    const networkCardId = await networkCard.getAttribute("data-card-id");
    expect(networkCardId).toBeTruthy();
    await clickWelcomeFeedAction(page, networkCardId!, "feed-action-network");
    await page.waitForURL(
      (url) => url.pathname === "/dashboard/people" && url.searchParams.get("source") === "welcome_feed"
    );
    await expect(page).toHaveURL(/source=welcome_feed/);
  });

  test("saved cards are available in saved feed with contextual open action", async ({ page }) => {
    await gotoWelcomeFeed(page);

    const firstCard = page.getByTestId("welcome-feed-card").first();
    const cardId = await firstCard.getAttribute("data-card-id");
    expect(cardId).toBeTruthy();

    const saveButton = firstCard.getByTestId("feed-action-save");
    const saveLabel = (await saveButton.innerText()).toLowerCase();

    if (!saveLabel.includes("saved")) {
      await saveButton.click();
      await expect(firstCard.getByTestId("feed-action-save")).toContainText(/Saved|Saving.../);
    }

    await page.goto("/dashboard/saved");
    await expect(page.getByTestId("saved-feed-list")).toBeVisible();

    const savedCard = page.locator(`[data-testid=\"saved-feed-card\"][data-card-id=\"${cardId}\"]`).first();
    await expect(savedCard).toBeVisible({ timeout: 15_000 });

    await savedCard.getByTestId("saved-feed-open").click();
    await page.waitForURL((url) => url.searchParams.get("source") === "saved_feed");
    await expect(page).toHaveURL(/source=saved_feed/);
    await expect(page).toHaveURL(new RegExp(`context_card=${cardId}`));

    await page.goto("/dashboard/saved");
    await expect(savedCard).toBeVisible({ timeout: 15_000 });
    await savedCard.getByTestId("saved-feed-remove").click();
  });
});
