import { describe, expect, it } from "vitest";
import { resolveMarketplaceCardActionModel } from "../../lib/marketplaceCardActions";
import type { MarketplaceFeedItem } from "../../lib/marketplaceFeed";

const baseItem: MarketplaceFeedItem = {
  id: "feed-1",
  source: "post",
  helpRequestId: null,
  providerId: "provider-1",
  type: "service",
  title: "Electrical repair visit",
  description: "Nearby support for switchboard and wiring issues",
  category: "Electrical",
  price: 1600,
  avatarUrl: "",
  creatorName: "Asha Repairs",
  creatorUsername: "asha-repairs",
  locationLabel: "Indiranagar",
  distanceKm: 2.1,
  lat: 12.97,
  lng: 77.64,
  coordinateAccuracy: "precise",
  media: [],
  createdAt: "2026-03-24T10:00:00.000Z",
  urgent: false,
  rankScore: 88,
  profileCompletion: 86,
  responseMinutes: 9,
  verificationStatus: "verified",
  publicProfilePath: "/profile/asha-repairs-provider-1",
  status: "open",
  acceptedProviderId: null,
};

describe("resolveMarketplaceCardActionModel", () => {
  it("returns pricing discussion for standard listings", () => {
    const actions = resolveMarketplaceCardActionModel({
      item: baseItem,
      viewerId: "viewer-1",
    });

    expect(actions.buttons).toEqual([
      expect.objectContaining({ kind: "accept", label: "No Task", disabled: true }),
      expect.objectContaining({ kind: "send_quote", label: "Send Quote", disabled: false }),
      expect.objectContaining({ kind: "view_profile", label: "View Profile", disabled: false }),
    ]);
    expect(actions.icons.map((action) => action.kind)).toEqual(["save", "share"]);
  });

  it("keeps open help request cards actionable for accept and quote outreach", () => {
    const actions = resolveMarketplaceCardActionModel({
      item: {
        ...baseItem,
        id: "help-1",
        source: "help_request",
        helpRequestId: "help-1",
        type: "demand",
      },
      viewerId: "viewer-9",
    });

    expect(actions.buttons[0]).toMatchObject({ kind: "accept", disabled: false, tone: "success" });
    expect(actions.buttons[1]).toMatchObject({ kind: "send_quote", label: "Send Quote", disabled: false, tone: "primary" });
  });

  it("switches accept to decline for the accepted provider", () => {
    const actions = resolveMarketplaceCardActionModel({
      item: {
        ...baseItem,
        id: "help-accepted",
        source: "help_request",
        helpRequestId: "help-accepted",
        type: "demand",
        acceptedProviderId: "viewer-9",
        status: "accepted",
      },
      viewerId: "viewer-9",
    });

    expect(actions.buttons[0]).toMatchObject({ kind: "decline", disabled: false, tone: "destructive" });
    expect(actions.buttons[1]).toMatchObject({ kind: "send_quote", disabled: false, tone: "primary" });
  });

  it("switches accept to decline for the requester after someone accepts", () => {
    const actions = resolveMarketplaceCardActionModel({
      item: {
        ...baseItem,
        id: "help-creator",
        source: "help_request",
        helpRequestId: "help-creator",
        type: "demand",
        acceptedProviderId: "provider-22",
        status: "accepted",
      },
      viewerId: "provider-1",
    });

    expect(actions.buttons[0]).toMatchObject({ kind: "decline", disabled: false, tone: "destructive" });
    expect(actions.buttons[1]).toMatchObject({ kind: "send_quote", label: "Your Listing", disabled: true });
  });

  it("marks already taken help requests as unavailable", () => {
    const actions = resolveMarketplaceCardActionModel({
      item: {
        ...baseItem,
        id: "help-2",
        source: "help_request",
        helpRequestId: "help-2",
        type: "demand",
        acceptedProviderId: "provider-22",
      },
      viewerId: "viewer-9",
    });

    expect(actions.buttons[0]).toMatchObject({ kind: "accept", disabled: true, tone: "status" });
    expect(actions.buttons[1]).toMatchObject({ kind: "send_quote", label: "Send Quote", disabled: false });
  });

  it("disables accept and quote on your own listing", () => {
    const actions = resolveMarketplaceCardActionModel({
      item: baseItem,
      viewerId: "provider-1",
    });

    expect(actions.buttons[0]).toMatchObject({ kind: "accept", disabled: true });
    expect(actions.buttons[1]).toMatchObject({ kind: "send_quote", label: "Your Listing", disabled: true });
    expect(actions.buttons[2]).toMatchObject({ kind: "view_profile", disabled: false });
  });
});
