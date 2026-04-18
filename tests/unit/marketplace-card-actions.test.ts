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
      expect.objectContaining({ kind: "send_quote", label: "Chat", disabled: false }),
      expect.objectContaining({ kind: "view_profile", label: "Open", disabled: false }),
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

    expect(actions.buttons[0]).toMatchObject({ kind: "accept", label: "Send Interest", disabled: false, tone: "success" });
    expect(actions.buttons[1]).toMatchObject({ kind: "send_quote", label: "Chat", disabled: false, tone: "primary" });
  });

  it("switches interested help requests to a withdraw action for the same provider", () => {
    const actions = resolveMarketplaceCardActionModel({
      item: {
        ...baseItem,
        id: "help-interested",
        source: "help_request",
        helpRequestId: "help-interested",
        type: "demand",
        viewerMatchStatus: "interested",
        viewerHasExpressedInterest: true,
      },
      viewerId: "viewer-9",
    });

    expect(actions.buttons[0]).toMatchObject({ kind: "withdraw", label: "Withdraw", disabled: false, tone: "destructive" });
    expect(actions.buttons[1]).toMatchObject({ kind: "send_quote", label: "Chat", disabled: false, tone: "primary" });
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

    expect(actions.buttons[0]).toMatchObject({ kind: "decline", label: "Leave Task", disabled: false, tone: "destructive" });
    expect(actions.buttons[1]).toMatchObject({ kind: "send_quote", label: "Draft Quote", disabled: false, tone: "primary" });
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

    expect(actions.buttons[0]).toMatchObject({ kind: "decline", label: "Reopen", disabled: false, tone: "destructive" });
    expect(actions.buttons[1]).toMatchObject({ kind: "view_profile", label: "Open", disabled: false });
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
    expect(actions.buttons[1]).toMatchObject({ kind: "send_quote", label: "Chat", disabled: false });
  });

  it("keeps your own listing focused on open rather than chat", () => {
    const actions = resolveMarketplaceCardActionModel({
      item: baseItem,
      viewerId: "provider-1",
    });

    expect(actions.buttons).toEqual([
      expect.objectContaining({ kind: "view_profile", label: "Open", disabled: false }),
    ]);
  });
});
