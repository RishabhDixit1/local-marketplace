import { expect, test, type Page } from "@playwright/test";
import { hasE2EAuthConfig, resolveMagicLinkUrl } from "./helpers/auth";

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

test("global map deep links and approximate labels", async ({ page, context }) => {
  test.skip(
    !hasE2EAuthConfig,
    "Provide E2E_MAGIC_LINK_URL or (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + E2E_LOGIN_EMAIL)."
  );

  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 12.9341, longitude: 77.6113 });

  const requestedCoordinates: Array<{ lat: string | null; lng: string | null }> = [];

  await page.route("**/api/community/feed**", async (route) => {
    const url = new URL(route.request().url());
    requestedCoordinates.push({
      lat: url.searchParams.get("lat"),
      lng: url.searchParams.get("lng"),
    });

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
            id: "map-request-approx",
            source: "post",
            helpRequestId: null,
            linkedPostId: "map-request-approx",
            providerId: "requester-1",
            type: "demand",
            title: "Approx plumbing request",
            description: "Kitchen sink repair today",
            category: "Plumbing",
            price: 1200,
            avatarUrl: "https://cdn.example.com/requester.png",
            creatorName: "Ria Sharma",
            creatorUsername: "ria-sharma",
            locationLabel: "Koramangala, Bengaluru",
            distanceKm: 2.1,
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
            id: "provider-alice-map",
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
            provider_id: "provider-alice-map",
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
            provider_id: "provider-alice-map",
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
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

  const openMapButton = page.getByRole("button", { name: /Open map view/i }).first();
  await expect(openMapButton).toBeVisible({ timeout: 20_000 });

  await test.step("people layer routes to exact profile", async () => {
    await openMapButton.click();

    const mapDialog = page.getByRole("dialog", { name: /Map view/i });
    await expect(mapDialog).toBeVisible({ timeout: 15_000 });

    await mapDialog.getByRole("button", { name: /^People$/i }).click();
    await expect(page.getByLabel("Focus Alice Electric")).toBeVisible({ timeout: 20_000 });
    await page.getByLabel("Focus Alice Electric").click();

    await expect(page.getByText(/Precise pin/i)).toBeVisible({ timeout: 10_000 });
    await mapDialog.getByRole("button", { name: /^Open profile$/i }).click();
    await page.waitForURL(/\/profile\/alice-electric-provider-alice-map$/, { timeout: 20_000 });
  });

  await test.step("explore layer shows approximate badge and focus deep link", async () => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await openMapButton.click();

    const mapDialog = page.getByRole("dialog", { name: /Map view/i });
    await expect(mapDialog).toBeVisible({ timeout: 15_000 });

    await mapDialog.getByRole("button", { name: /^Explore$/i }).click();
    await expect(page.getByLabel("Focus Approx plumbing request")).toBeVisible({ timeout: 20_000 });
    await page.getByLabel("Focus Approx plumbing request").click();

    await expect(page.getByText(/Approx area/i)).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(/This pin represents a shared area or city, not an exact street-level address\./i)
    ).toBeVisible({ timeout: 10_000 });
    await mapDialog.getByRole("button", { name: /^Open request$/i }).click();
    await page.waitForURL(/\/dashboard\?source=posts_feed&focus=map-request-approx$/, { timeout: 20_000 });
  });

  expect(
    requestedCoordinates.some((request) => request.lat === "12.9341" && request.lng === "77.6113")
  ).toBe(true);
});
