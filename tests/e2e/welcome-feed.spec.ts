import { expect, test, type Page } from "@playwright/test";

const magicLinkUrl = process.env.E2E_MAGIC_LINK_URL;

const authenticateWithMagicLink = async (page: Page) => {
  if (!magicLinkUrl) return;
  await page.goto(magicLinkUrl);
  await page.waitForURL(/\/dashboard/, { timeout: 45_000 });
};

const gotoWelcomeFeed = async (page: Page) => {
  await page.goto("/dashboard/welcome");
  await expect(page.getByTestId("welcome-live-feed")).toBeVisible();
  await expect(page.getByTestId("welcome-feed-card").first()).toBeVisible();
};

test.describe("welcome feed cards", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!magicLinkUrl, "Set E2E_MAGIC_LINK_URL to run welcome feed regression tests.");
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

    await feedCard.getByTestId("feed-action-primary").click();
    await page.waitForURL(/\/dashboard/);
    await expect(page).toHaveURL(new RegExp(`context_card=${cardId}`));
    await expect(page).toHaveURL(/source=welcome_feed/);

    await gotoWelcomeFeed(page);

    const messageCard = page.getByTestId("welcome-feed-card").first();
    await messageCard.getByTestId("feed-action-message").click();
    await page.waitForURL(/\/dashboard\/chat/);
    await expect(page).toHaveURL(/source=welcome_feed/);

    await gotoWelcomeFeed(page);

    const networkCard = page.getByTestId("welcome-feed-card").first();
    await networkCard.getByTestId("feed-action-network").click();
    await page.waitForURL(/\/dashboard/);
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
    await page.waitForURL(/\/dashboard/);
    await expect(page).toHaveURL(/source=saved_feed/);
    await expect(page).toHaveURL(new RegExp(`context_card=${cardId}`));

    await page.goto("/dashboard/saved");
    await expect(savedCard).toBeVisible({ timeout: 15_000 });
    await savedCard.getByTestId("saved-feed-remove").click();
  });
});
