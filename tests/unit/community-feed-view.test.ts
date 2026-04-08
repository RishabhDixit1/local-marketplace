import { describe, expect, it } from "vitest";
import { buildCommunityFeedView } from "../../lib/server/communityFeedView";

describe("buildCommunityFeedView", () => {
  it("normalizes feed items, derives stats, and pushes accepted tasks behind open work", () => {
    const view = buildCommunityFeedView({
      currentUserId: "viewer-1",
      acceptedConnectionIds: ["provider-1"],
      currentUserProfile: {
        id: "viewer-1",
        name: "Viewer",
        latitude: 12.9716,
        longitude: 77.5946,
        role: "seeker",
      },
      services: [
        {
          id: "service-1",
          title: "Emergency plumbing visit",
          description: "Leak detection and repair",
          price: 1800,
          category: "Plumbing",
          provider_id: "provider-1",
          created_at: "2026-03-24T08:00:00.000Z",
        },
      ],
      products: [],
      posts: [
        {
          id: "post-1",
          user_id: "provider-1",
          title: "Need local wiring help",
          description: "Urgent rewiring support needed",
          type: "need",
          post_type: "need",
          category: "Electrical",
          status: "open",
          created_at: "2026-03-24T09:00:00.000Z",
        },
      ],
      helpRequests: [
        {
          id: "help-open",
          requester_id: "viewer-2",
          title: "Need AC repair",
          details: "Cooling stopped working today",
          category: "Appliance Repair",
          urgency: "urgent",
          budget_max: 2200,
          location_label: "Indiranagar",
          status: "open",
          created_at: "2026-03-24T10:00:00.000Z",
        },
        {
          id: "help-taken",
          requester_id: "viewer-3",
          title: "Need carpentry support",
          details: "Shelf install",
          category: "Carpentry",
          urgency: "today",
          budget_max: 1200,
          location_label: "Koramangala",
          accepted_provider_id: "provider-9",
          status: "accepted",
          created_at: "2026-03-24T11:00:00.000Z",
        },
      ],
      viewerMatchStatusByHelpRequestId: {
        "help-open": "interested",
      },
      profiles: [
        {
          id: "provider-1",
          name: "Asha Repairs",
          role: "business",
          verification_level: "email",
          location: "Indiranagar",
          latitude: 12.978,
          longitude: 77.64,
          profile_completion_percent: 84,
        },
        {
          id: "viewer-2",
          name: "Rohit",
          role: "seeker",
          location: "Indiranagar",
        },
        {
          id: "viewer-3",
          name: "Meera",
          role: "seeker",
          location: "Koramangala",
        },
      ],
      reviews: [
        { provider_id: "provider-1", rating: 5 },
        { provider_id: "provider-1", rating: 4 },
        { provider_id: "provider-1", rating: 5 },
      ],
      presence: [
        {
          provider_id: "provider-1",
          is_online: true,
          availability: "available",
          response_sla_minutes: 15,
          rolling_response_minutes: 9,
          last_seen: "2026-03-24T11:00:00.000Z",
        },
      ],
      orderStats: [{ provider_id: "provider-1", completed_jobs: 14, open_leads: 2 }],
    });

    expect(view.mapCenter).toEqual({ lat: 12.9716, lng: 77.5946 });
    expect(view.feedItems.map((item) => item.id)).toEqual(["help-open", "post-1", "service-1", "help-taken"]);
    expect(view.feedStats).toEqual({
      total: 4,
      urgent: 3,
      demand: 3,
      service: 1,
      product: 0,
    });

    expect(view.feedItems[0]).toMatchObject({
      id: "help-open",
      source: "help_request",
      type: "demand",
      category: "Appliance Repair",
      price: 2200,
      viewerMatchStatus: "interested",
      viewerHasExpressedInterest: true,
    });

    expect(view.feedItems[2]).toMatchObject({
      id: "service-1",
      source: "service_listing",
      creatorName: "Asha Repairs",
      verificationStatus: "verified",
      averageRating: 4.7,
      completedJobs: 14,
      responseMinutes: 9,
    });

    expect(view.feedItems[3]).toMatchObject({
      id: "help-taken",
      status: "accepted",
      acceptedProviderId: "provider-9",
    });
  });

  it("collapses mirrored need records into a single community card", () => {
    const mirroredMetadata = {
      source: "serviq_compose",
      postType: "need",
      publishGroupKey: "serviq:demand:dryclean-123",
      title: "Dryclean",
      details: "Need a same-day dryclean service",
      category: "Laundry",
      budget: 1200,
      locationLabel: "Indiranagar",
      radiusKm: 8,
      mode: "urgent",
      neededWithin: "today",
      scheduleDate: "",
      scheduleTime: "",
      flexibleTiming: true,
      attachmentCount: 0,
      media: [],
    };

    const view = buildCommunityFeedView({
      currentUserId: "viewer-1",
      acceptedConnectionIds: ["provider-1"],
      currentUserProfile: {
        id: "viewer-1",
        name: "Viewer",
        latitude: 12.9716,
        longitude: 77.5946,
        role: "seeker",
      },
      services: [],
      products: [],
      posts: [
        {
          id: "post-need",
          user_id: "provider-1",
          title: "Dryclean",
          description: "Need a pickup and wash",
          type: "need",
          post_type: "need",
          category: "Laundry",
          metadata: mirroredMetadata,
          status: "open",
          created_at: "2026-03-24T15:00:00.000Z",
        },
      ],
      helpRequests: [
        {
          id: "help-need",
          requester_id: "provider-1",
          title: "Dryclean pickup",
          details: "Need a same-day dryclean service",
          category: "Laundry",
          budget_max: 1200,
          location_label: "Indiranagar",
          metadata: {
            ...mirroredMetadata,
            source: "api_needs_publish",
          },
          status: "open",
          created_at: "2026-03-24T09:00:30.000Z",
        },
      ],
      profiles: [
        {
          id: "provider-1",
          name: "Asha Repairs",
          role: "business",
          location: "Indiranagar",
          latitude: 12.978,
          longitude: 77.64,
          profile_completion_percent: 84,
        },
      ],
      reviews: [],
      presence: [],
      orderStats: [],
    });

    expect(view.feedItems).toHaveLength(1);
    expect(view.feedItems[0]).toMatchObject({
      id: "help-need",
      source: "help_request",
      type: "demand",
      title: "Dryclean pickup",
    });
  });

  it("preserves composer media for synced listings and falls back to listing image fields", () => {
    const view = buildCommunityFeedView({
      currentUserId: "viewer-1",
      acceptedConnectionIds: ["provider-1", "provider-2"],
      currentUserProfile: {
        id: "viewer-1",
        name: "Viewer",
        latitude: 12.9716,
        longitude: 77.5946,
        role: "seeker",
      },
      services: [
        {
          id: "service-media",
          title: "AC servicing",
          description: "Metadata-backed listing",
          provider_id: "provider-1",
          category: "Repair",
          metadata: {
            source: "composer_listing_sync",
            postType: "service",
            title: "AC servicing",
            details: "Full servicing with filter cleanup.",
            category: "Repair",
            budget: 999,
            locationLabel: "Indiranagar",
            radiusKm: 8,
            mode: "urgent",
            neededWithin: "today",
            scheduleDate: "",
            scheduleTime: "",
            flexibleTiming: true,
            attachmentCount: 1,
            media: [
              {
                name: "ac.jpg",
                url: "https://cdn.example.com/service/ac.jpg",
                type: "image/jpeg",
              },
            ],
          },
          created_at: "2026-03-24T08:00:00.000Z",
        },
      ],
      products: [
        {
          id: "product-image",
          title: "Office chair",
          description: "Image-url fallback listing",
          provider_id: "provider-2",
          category: "Furniture",
          image_url: "https://cdn.example.com/product/chair.jpg",
          created_at: "2026-03-24T07:00:00.000Z",
        },
      ],
      posts: [],
      helpRequests: [],
      profiles: [
        {
          id: "provider-1",
          name: "Asha Repairs",
          role: "business",
          latitude: 12.978,
          longitude: 77.64,
        },
        {
          id: "provider-2",
          name: "Ritu Local Goods",
          role: "business",
          latitude: 12.976,
          longitude: 77.631,
        },
      ],
      reviews: [],
      presence: [],
      orderStats: [],
    });

    expect(view.feedItems.find((item) => item.id === "service-media")?.media).toEqual([
      {
        mimeType: "image/jpeg",
        url: "https://cdn.example.com/service/ac.jpg",
      },
    ]);
    expect(view.feedItems.find((item) => item.id === "product-image")?.media).toEqual([
      {
        mimeType: "image/*",
        url: "https://cdn.example.com/product/chair.jpg",
      },
    ]);
  });

  it("does not invent ratings for providers who only have completed jobs", () => {
    const view = buildCommunityFeedView({
      currentUserId: "viewer-1",
      acceptedConnectionIds: ["provider-1"],
      currentUserProfile: {
        id: "viewer-1",
        name: "Viewer",
        latitude: 12.9716,
        longitude: 77.5946,
        role: "seeker",
      },
      services: [
        {
          id: "service-no-reviews",
          title: "Laptop diagnostics",
          description: "Hardware and software checks",
          price: 900,
          category: "Repair",
          provider_id: "provider-1",
          created_at: "2026-03-24T08:00:00.000Z",
        },
      ],
      products: [],
      posts: [],
      helpRequests: [],
      profiles: [
        {
          id: "provider-1",
          name: "Asha Repairs",
          role: "business",
          location: "Indiranagar",
          latitude: 12.978,
          longitude: 77.64,
          profile_completion_percent: 84,
        },
      ],
      reviews: [],
      presence: [],
      orderStats: [{ provider_id: "provider-1", completed_jobs: 9, open_leads: 0 }],
    });

    expect(view.feedItems[0]).toMatchObject({
      id: "service-no-reviews",
      averageRating: null,
      reviewCount: 0,
      completedJobs: 9,
      verificationStatus: "pending",
    });
  });
});
