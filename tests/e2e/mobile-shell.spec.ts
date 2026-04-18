import { expect, test, type Page } from "@playwright/test";
import { hasE2EAuthConfig, resolveMagicLinkUrl } from "./helpers/auth";

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
});

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

test("mobile shell navigation, overlays, and quick actions", async ({ page, context }) => {
  test.skip(
    !hasE2EAuthConfig,
    "Provide E2E_MAGIC_LINK_URL or (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + E2E_LOGIN_EMAIL)."
  );

  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 12.9341, longitude: 77.6113 });

  await page.route("**/api/community/feed**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        currentUserId: "viewer-1",
        acceptedConnectionIds: [],
        currentUserProfile: {
          id: "viewer-1",
          name: "ServiQ E2E User",
          location: "Bengaluru",
          latitude: 12.9341,
          longitude: 77.6113,
        },
        feedItems: [
          {
            id: "mobile-map-request",
            source: "post",
            helpRequestId: null,
            linkedPostId: "mobile-map-request",
            providerId: "requester-1",
            type: "demand",
            title: "Mobile map request",
            description: "Need quick electrical help",
            category: "Electrical",
            price: 750,
            avatarUrl: "https://cdn.example.com/requester.png",
            creatorName: "Ria Sharma",
            creatorUsername: "ria-sharma",
            locationLabel: "Koramangala, Bengaluru",
            distanceKm: 1.8,
            lat: 12.9352,
            lng: 77.6245,
            coordinateAccuracy: "approximate",
            media: [],
            createdAt: "2026-04-03T09:10:00.000Z",
            urgent: true,
            rankScore: 81,
            profileCompletion: 84,
            responseMinutes: 18,
            verificationStatus: "verified",
            publicProfilePath: "/profile/ria-sharma-requester-1",
            status: "open",
            acceptedProviderId: null,
          },
        ],
        feedStats: {
          total: 1,
          urgent: 1,
          demand: 1,
          service: 0,
          product: 0,
        },
        mapCenter: {
          lat: 12.9341,
          lng: 77.6113,
        },
        services: [],
        products: [],
        posts: [],
        helpRequests: [],
        profiles: [],
        reviews: [],
        presence: [],
      }),
    });
  });

  await page.route("**/api/community/people**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        currentUserId: "viewer-1",
        profiles: [
          {
            id: "provider-alice-mobile",
            name: "Alice Electric",
            role: "Electrician",
            location: "Indiranagar",
            latitude: 12.9784,
            longitude: 77.6408,
            availability: "available",
          },
        ],
        services: [
          {
            provider_id: "provider-alice-mobile",
            category: "Electrical",
            price: 699,
          },
        ],
        products: [],
        posts: [],
        helpRequests: [],
        reviews: [],
        presence: [
          {
            provider_id: "provider-alice-mobile",
            is_online: true,
            availability: "available",
            response_sla_minutes: 15,
            rolling_response_minutes: 12,
            last_seen: "2026-04-03T09:10:00.000Z",
          },
        ],
        orderStats: [],
      }),
    });
  });

  await authenticateWithMagicLink({ page });
  await page.goto("/dashboard/welcome", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("navigation", { name: /Main navigation/i })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: /Open notifications/i })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: /Open account menu/i })).toBeVisible({ timeout: 20_000 });

  await test.step("account menu opens with mobile actions", async () => {
    await page.getByRole("button", { name: /Open account menu/i }).click();
    await expect(page.getByText(/ServiQ account/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /^Saved$/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /^(View Public Profile|Complete Profile)$/i })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("button", { name: /^Edit Profile$/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /^Settings$/i }).last()).toBeVisible({ timeout: 10_000 });
    await page.mouse.click(16, 220);
  });

  await test.step("quick actions sheet and explore map open cleanly", async () => {
    const quickActionsButton = page.getByRole("button", { name: /Open quick actions/i });
    await expect(quickActionsButton).toBeVisible({ timeout: 10_000 });
    await quickActionsButton.click();
    await expect(page.getByText(/Quick actions/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /^Business AI$/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /^Open Map$/i })).toBeVisible({ timeout: 10_000 });

    await page.getByRole("link", { name: /^Explore$/i }).click();
    await page.waitForURL(/\/dashboard(?:\?.*)?$/, { timeout: 20_000 });
    await expect(page.getByRole("link", { name: /^Explore$/i })).toHaveAttribute("aria-current", "page");

    await page.getByRole("button", { name: /^Open Map$/i }).click();
    const mapDialog = page.getByRole("dialog", { name: /Map view/i });
    await expect(mapDialog).toBeVisible({ timeout: 15_000 });
    await expect(mapDialog.getByRole("button", { name: /^Explore$/i })).toBeVisible({ timeout: 10_000 });
    await expect(mapDialog.getByRole("button", { name: /^People$/i })).toBeVisible({ timeout: 10_000 });
    await mapDialog.getByRole("button", { name: /Close map/i }).click();
    await expect(mapDialog).toBeHidden({ timeout: 10_000 });
  });

  await test.step("bottom navigation and logo return to welcome", async () => {
    await page.getByRole("link", { name: /Open chat inbox/i }).click();
    await page.waitForURL(/\/dashboard\/chat/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /^Messages$/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: /Open chat inbox/i })).toHaveAttribute("aria-current", "page");

    await page.getByRole("link", { name: /^Tasks$/i }).click();
    await page.waitForURL(/\/dashboard\/tasks/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /Tasks Workspace/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: /^Tasks$/i })).toHaveAttribute("aria-current", "page");

    await page.getByLabel("Open Welcome dashboard").click();
    await page.waitForURL(/\/dashboard\/welcome/, { timeout: 20_000 });
    await expect(page.getByRole("link", { name: /^Welcome$/i })).toHaveAttribute("aria-current", "page");
  });
});
