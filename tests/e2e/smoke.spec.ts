import { expect, test, type Page } from "@playwright/test";
import { hasE2EAuthConfig, resolveMagicLinkUrl } from "./helpers/auth";

const loginEmail = process.env.E2E_LOGIN_EMAIL;
const enableLoginRequestSmoke = process.env.E2E_ENABLE_LOGIN_REQUEST_SMOKE === "1";

const transitionLabelRegex =
  /Send Quote|Mark Accepted|Reject|Start Work|Mark Completed|Accept Quote|Confirm Completion|Cancel Request/i;

const authenticateWithMagicLink = async ({ page }: { page: Page }) => {
  const magicLinkUrl = await resolveMagicLinkUrl();
  await page.goto(magicLinkUrl);
  await page.waitForURL(/\/dashboard/, { timeout: 60000 });
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
    await page.goto("/dashboard/people");
    await expect(page.getByText(/People Network/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("heading", { name: /Discover trusted local providers and act on live availability\./i })
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("article").first()).toBeVisible({ timeout: 15_000 });
  });

  await test.step("start inline chat + send message + open thread", async () => {
    const connectedCard = page.locator("article").filter({ has: page.getByRole("button", { name: /^Chat$/i }) }).first();
    if ((await connectedCard.count()) === 0) {
      const gatedCard = page.locator("article").filter({ has: page.getByRole("button", { name: /Chat after connect/i }) }).first();
      await expect(gatedCard).toBeVisible({ timeout: 15_000 });
      return;
    }

    const firstCard = connectedCard;
    await firstCard.getByRole("button", { name: /^Chat$/i }).click();

    const composer = firstCard.getByPlaceholder(/Write a message to/i);
    await expect(composer).toBeVisible();

    const message = `e2e smoke ${Date.now()}`;
    await composer.fill(message);
    await firstCard.getByRole("button", { name: /Send Message/i }).click();

    await expect(firstCard.getByText(/Message sent\. It is saved in Chat tab\./i)).toBeVisible({ timeout: 15000 });

    const openThreadButton =
      (await firstCard.getByRole("button", { name: /Open Thread/i }).count()) > 0
        ? firstCard.getByRole("button", { name: /Open Thread/i }).first()
        : firstCard.getByRole("button", { name: /Open Chat Tab/i }).first();
    await expect(openThreadButton).toBeVisible({ timeout: 15000 });
    await openThreadButton.click();

    await page.waitForURL(/\/dashboard\/chat/, { timeout: 30000 });
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
    await expect(page.getByRole("heading", { name: /My Tasks|Task Operations/i })).toBeVisible();

    const transitionButton = page
      .locator("button")
      .filter({ hasText: transitionLabelRegex })
      .first();

    if ((await transitionButton.count()) > 0) {
      await transitionButton.click();
    }
  });
});
