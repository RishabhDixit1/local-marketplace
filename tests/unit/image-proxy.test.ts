import { describe, expect, it } from "vitest";
import {
  buildNextImageProxyUrl,
  proxyCommunityFeedImages,
  proxyCommunityPeopleImages,
} from "@/lib/server/imageProxy";

describe("image proxy helpers", () => {
  it("builds a Next image URL for remote images", () => {
    const proxied = buildNextImageProxyUrl(
      "https://example.supabase.co/storage/v1/object/public/post-media/posts/u/image.webp",
      { origin: "https://serviq.example", width: 640, quality: 70 },
    );

    const url = new URL(proxied);
    expect(url.origin).toBe("https://serviq.example");
    expect(url.pathname).toBe("/_next/image");
    expect(url.searchParams.get("w")).toBe("640");
    expect(url.searchParams.get("q")).toBe("70");
    expect(url.searchParams.get("url")).toBe(
      "https://example.supabase.co/storage/v1/object/public/post-media/posts/u/image.webp",
    );
  });

  it("leaves inline images unchanged", () => {
    const inline = "data:image/svg+xml,%3Csvg%3E%3C/svg%3E";
    expect(
      buildNextImageProxyUrl(inline, {
        origin: "https://serviq.example",
        width: 96,
        quality: 60,
      }),
    ).toBe(inline);
  });

  it("leaves non-storage remote images unchanged", () => {
    const remote = "https://images.unsplash.com/photo-1?w=1200";
    expect(
      buildNextImageProxyUrl(remote, {
        origin: "https://serviq.example",
        width: 640,
        quality: 70,
      }),
    ).toBe(remote);
  });

  it("leaves Supabase videos unchanged", () => {
    const video = "https://example.supabase.co/storage/v1/object/public/post-media/posts/u/video.mp4";
    expect(
      buildNextImageProxyUrl(video, {
        origin: "https://serviq.example",
        width: 640,
        quality: 70,
      }),
    ).toBe(video);
  });

  it("proxies feed thumbnails and avatars for mobile API callers", () => {
    const snapshot = proxyCommunityFeedImages(
      {
        ok: true,
        currentUserId: "viewer-1",
        acceptedConnectionIds: [],
        currentUserProfile: null,
        savedCardIds: [],
        feedStats: { total: 1, urgent: 0, demand: 0, service: 1, product: 0 },
        mapCenter: { lat: 0, lng: 0 },
        services: [],
        products: [],
        posts: [],
        helpRequests: [],
        profiles: [],
        reviews: [],
        presence: [],
        orderStats: [],
        feedItems: [
          {
            id: "service-1",
            source: "service_listing",
            helpRequestId: null,
            providerId: "provider-1",
            type: "service",
            title: "Repair",
            description: "Fast local repair",
            category: "Repair",
            price: 1000,
            avatarUrl: "https://example.supabase.co/storage/v1/object/public/profile-avatars/avatar.webp",
            creatorName: "Asha",
            creatorUsername: "asha",
            locationLabel: "Nearby",
            distanceKm: 1,
            lat: 0,
            lng: 0,
            coordinateAccuracy: "approximate",
            media: [],
            thumbnailUrl: "https://example.supabase.co/storage/v1/object/public/listing-images/listing.webp",
            createdAt: "2026-04-23T00:00:00.000Z",
            urgent: false,
            rankScore: 0,
            profileCompletion: 100,
            responseMinutes: 15,
            verificationStatus: "verified",
            publicProfilePath: "/profile/asha",
            status: "open",
            acceptedProviderId: null,
          },
        ],
      },
      "https://serviq.example",
    );

    if (snapshot.ok !== true) throw new Error("Expected ok snapshot.");
    expect(snapshot.feedItems[0].avatarUrl).toContain("/_next/image?");
    expect(snapshot.feedItems[0].avatarUrl).toContain("w=96");
    expect(snapshot.feedItems[0].thumbnailUrl).toContain("/_next/image?");
    expect(snapshot.feedItems[0].thumbnailUrl).toContain("w=640");
  });

  it("proxies people preview images", () => {
    const snapshot = proxyCommunityPeopleImages(
      {
        ok: true,
        currentUserId: "viewer-1",
        acceptedConnectionIds: [],
        profiles: [
          {
            id: "provider-1",
            avatar_url: "https://example.supabase.co/storage/v1/object/public/profile-avatars/avatar.webp",
          },
        ],
        services: [],
        products: [],
        posts: [],
        helpRequests: [],
        reviews: [],
        presence: [],
        orderStats: [],
        profilePreviewById: {
          "provider-1": {
            imageUrl: "https://example.supabase.co/storage/v1/object/public/listing-images/listing.webp",
            mediaCount: 1,
            title: "Repair",
            source: "service",
          },
        },
      },
      "https://serviq.example",
    );

    if (snapshot.ok !== true) throw new Error("Expected ok snapshot.");
    expect(snapshot.profiles[0].avatar_url).toContain("/_next/image?");
    expect(snapshot.profilePreviewById?.["provider-1"].imageUrl).toContain("/_next/image?");
  });
});
