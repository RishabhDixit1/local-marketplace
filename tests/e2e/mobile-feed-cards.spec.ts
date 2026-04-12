import { expect, test, type Page } from "@playwright/test";
import { hasE2EAuthConfig, resolveMagicLinkUrl } from "./helpers/auth";

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
});

const appUrl = (
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "http://127.0.0.1:3000"
).replace(/\/+$/u, "");

const toDataUrl = (svg: string) =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

const inlineAvatar = toDataUrl(`
  <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
    <rect width="160" height="160" rx="80" fill="#0f766e" />
    <text x="80" y="96" text-anchor="middle" font-family="Arial, sans-serif" font-size="54" font-weight="700" fill="#ffffff">RS</text>
  </svg>
`);

const inlineCardImage = toDataUrl(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700" viewBox="0 0 1200 700">
    <rect width="1200" height="700" fill="#f8fafc" />
    <rect x="80" y="80" width="1040" height="540" rx="40" fill="#dbeafe" />
    <circle cx="980" cy="170" r="120" fill="#93c5fd" opacity="0.8" />
    <text x="140" y="215" font-family="Arial, sans-serif" font-size="62" font-weight="700" fill="#0f172a">
      Need suit for 3 hours on rent
    </text>
    <text x="140" y="300" font-family="Arial, sans-serif" font-size="34" fill="#475569">
      Long mobile card regression fixture
    </text>
  </svg>
`);

const longDescription =
  "Hey everyone! I'm looking to rent a stylish suit for an upcoming engagement function. Prefer something elegant and well-fitted, 3-piece or blazer set works. Size M. Location crossing republik, Ghaziabad. Please share options and quick availability if you have anything nearby today.";

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

const installFeedStub = async (page: Page) => {
  const explorePayload = {
    ok: true,
    currentUserId: "viewer-1",
    acceptedConnectionIds: ["requester-1"],
    currentUserProfile: {
      id: "viewer-1",
      name: "ServiQ E2E User",
      location: "Ghaziabad",
      latitude: 28.646,
      longitude: 77.36,
      role: "seeker",
    },
    feedItems: [
      {
        id: "feed-item-1",
        source: "help_request",
        helpRequestId: "help-1",
        linkedPostId: "post-1",
        linkedHelpRequestId: "help-1",
        providerId: "requester-1",
        type: "demand",
        title: "Need suit for 3 hours on rent",
        description: longDescription,
        category: "Other",
        price: 500,
        avatarUrl: inlineAvatar,
        creatorName: "Rishabh Shukla",
        creatorUsername: "rishabh-shukla",
        locationLabel: "Supertech Livingston crossing republik Ghaziabad",
        distanceKm: 1,
        lat: 28.646,
        lng: 77.36,
        coordinateAccuracy: "approximate",
        media: [{ mimeType: "image/jpeg", url: inlineCardImage }],
        createdAt: "2026-04-11T18:10:00.000Z",
        urgent: true,
        rankScore: 81,
        profileCompletion: 100,
        responseMinutes: 45,
        verificationStatus: "verified",
        publicProfilePath: "/profile/rishabh-shukla-requester-1",
        status: "open",
        acceptedProviderId: null,
        viewerMatchStatus: "interested",
        viewerHasExpressedInterest: true,
        reviewCount: 5,
        averageRating: 5,
        completedJobs: 7,
      },
    ],
    feedStats: {
      total: 1,
      urgent: 1,
      demand: 1,
      service: 0,
      product: 0,
    },
    mapCenter: { lat: 28.646, lng: 77.36 },
    services: [],
    products: [],
    posts: [],
    helpRequests: [],
    profiles: [],
    reviews: [],
    presence: [],
    orderStats: [],
  };

  const welcomePayload = {
    ...explorePayload,
    helpRequests: [
      {
        id: "help-1",
        requester_id: "requester-1",
        accepted_provider_id: null,
        title: "Need suit for 3 hours on rent",
        details: longDescription,
        category: "Other",
        urgency: "today",
        budget_min: 500,
        budget_max: 500,
        location_label: "Supertech Livingston crossing republik Ghaziabad",
        latitude: 28.646,
        longitude: 77.36,
        status: "open",
        metadata: {
          source: "serviq_compose",
          postType: "need",
          title: "Need suit for 3 hours on rent",
          details: longDescription,
          category: "Other",
          budget: 500,
          locationLabel: "Supertech Livingston crossing republik Ghaziabad",
          radiusKm: 8,
          mode: "urgent",
          neededWithin: "today",
          scheduleDate: "",
          scheduleTime: "",
          flexibleTiming: true,
          attachmentCount: 1,
          media: [{ name: "fixture", url: inlineCardImage, type: "image/jpeg" }],
        },
        created_at: "2026-04-11T18:10:00.000Z",
      },
    ],
    profiles: [
      {
        id: "requester-1",
        name: "Rishabh Shukla",
        location: "Supertech Livingston crossing republik Ghaziabad",
        latitude: 28.646,
        longitude: 77.36,
      },
    ],
  };

  await page.route("**/api/community/feed**", async (route) => {
    const url = new URL(route.request().url());
    const payload = url.searchParams.get("scope") === "connected" ? welcomePayload : explorePayload;

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    });
  });
};

const readCardMetrics = async (page: Page) =>
  page.evaluate(() => {
    const card = document.querySelector<HTMLElement>('[data-testid="feed-card"]');
    if (!card) {
      return null;
    }

    const rect = card.getBoundingClientRect();
    return {
      cardHeight: rect.height,
      cardWidth: rect.width,
      bodyScrollWidth: document.body.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  });

const expectCompactMobileCard = async (page: Page) => {
  const firstCard = page.locator('[data-testid="feed-card"]').first();
  await expect(firstCard).toBeVisible({ timeout: 15_000 });

  const metrics = await readCardMetrics(page);
  expect(metrics).not.toBeNull();

  expect(metrics?.bodyScrollWidth ?? 0).toBeLessThanOrEqual(metrics?.clientWidth ?? 0);
  expect(metrics?.cardWidth ?? 0).toBeLessThanOrEqual((metrics?.clientWidth ?? 0) - 12);
  expect(metrics?.cardHeight ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(580);
};

test("welcome and explore feed cards stay compact on small mobile screens", async ({ page }) => {
  test.skip(
    !hasE2EAuthConfig,
    "Provide E2E_MAGIC_LINK_URL or (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + E2E_LOGIN_EMAIL).",
  );

  await authenticateWithMagicLink(page);
  await installFeedStub(page);

  await test.step("explore card stays within the mobile width and height budget", async () => {
    await page.goto(`${appUrl}/dashboard?mobile-feed-regression=1`, { waitUntil: "networkidle" });
    await expectCompactMobileCard(page);
  });

  await test.step("welcome card stays within the mobile width and height budget", async () => {
    await page.goto(`${appUrl}/dashboard/welcome?mobile-feed-regression=1`, { waitUntil: "networkidle" });
    await expectCompactMobileCard(page);
  });
});
