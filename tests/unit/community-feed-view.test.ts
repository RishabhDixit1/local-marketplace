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
    });

    expect(view.feedItems[2]).toMatchObject({
      id: "service-1",
      source: "service_listing",
      creatorName: "Asha Repairs",
      verificationStatus: "pending",
      responseMinutes: 9,
    });
  });
});
