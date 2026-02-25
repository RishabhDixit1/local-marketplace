import { expect, test, type Page } from "@playwright/test";

const magicLinkUrl = process.env.E2E_MAGIC_LINK_URL;
const loginEmail = process.env.E2E_LOGIN_EMAIL;

const transitionLabelRegex =
  /Send Quote|Mark Accepted|Reject|Start Work|Mark Completed|Accept Quote|Confirm Completion|Cancel Request/i;

const authenticateWithMagicLink = async ({ page }: { page: Page }) => {
  if (!magicLinkUrl) return;
  await page.goto(magicLinkUrl);
  await page.waitForURL(/\/dashboard/, { timeout: 45000 });
};

test("login request smoke", async ({ page }) => {
  test.skip(!loginEmail, "Set E2E_LOGIN_EMAIL to enable login request smoke test.");

  await page.goto("/");
  await page.getByPlaceholder("you@example.com").fill(loginEmail || "");
  await page.getByRole("button", { name: /Send Login Link/i }).click();

  await expect(page.getByText(/Check Your Email/i)).toBeVisible({ timeout: 15000 });
});

test("authenticated marketplace smoke", async ({ page }) => {
  test.skip(!magicLinkUrl, "Set E2E_MAGIC_LINK_URL to run authenticated smoke flow.");

  page.on("dialog", (dialog) => {
    void dialog.accept();
  });

  await authenticateWithMagicLink({ page });

  await test.step("provider discovery", async () => {
    await page.goto("/dashboard/people");
    await expect(page.getByRole("heading", { name: /People Near You/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Chat/i }).first()).toBeVisible();
  });

  await test.step("start chat + send message", async () => {
    await page.getByRole("button", { name: /Chat/i }).first().click();
    await page.waitForURL(/\/dashboard\/chat/, { timeout: 30000 });

    const composer = page.getByPlaceholder("Type a message...");
    await expect(composer).toBeVisible();

    const message = `e2e smoke ${Date.now()}`;
    await composer.fill(message);
    await composer.press("Enter");

    await expect(page.getByText(message).last()).toBeVisible({ timeout: 15000 });
  });

  await test.step("create order from marketplace", async () => {
    await page.goto("/dashboard");
    const bookButton = page.getByRole("button", { name: /Book Now|Accept Job/i }).first();
    await expect(bookButton).toBeVisible();
    await bookButton.click();
  });

  await test.step("task status transition", async () => {
    await page.goto("/dashboard/tasks");
    await expect(page.getByRole("heading", { name: /My Tasks/i })).toBeVisible();

    const transitionButton = page
      .locator("button")
      .filter({ hasText: transitionLabelRegex })
      .first();

    if ((await transitionButton.count()) > 0) {
      await transitionButton.click();
    }
  });
});
