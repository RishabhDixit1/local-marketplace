import type { MarketplaceFeedItem } from "@/lib/marketplaceFeed";
import { isClosedMarketplaceStatus } from "@/lib/marketplaceFeed";

export type MarketplacePrimaryActionKind = "accept" | "decline" | "send_quote" | "view_profile" | "discard";
export type MarketplaceSecondaryActionKind = "save" | "share";

export type MarketplaceActionTone = "primary" | "secondary" | "success" | "status" | "destructive";

export type MarketplaceCardActionButton<K extends string> = {
  kind: K;
  label: string;
  disabled?: boolean;
  tone: MarketplaceActionTone;
};

export type MarketplaceCardActionModel = {
  buttons: MarketplaceCardActionButton<MarketplacePrimaryActionKind>[];
  icons: MarketplaceCardActionButton<MarketplaceSecondaryActionKind>[];
};

type ResolveMarketplaceCardActionModelParams = {
  item: MarketplaceFeedItem;
  viewerId: string | null;
};

const buildButton = <K extends MarketplacePrimaryActionKind | MarketplaceSecondaryActionKind>(
  kind: K,
  label: string,
  tone: MarketplaceActionTone,
  disabled = false
) => ({
  kind,
  label,
  tone,
  disabled,
});

export const resolveMarketplaceCardActionModel = (
  params: ResolveMarketplaceCardActionModelParams
): MarketplaceCardActionModel => {
  const { item, viewerId } = params;
  const isOwnListing = !!viewerId && item.providerId === viewerId;
  const isClosed = isClosedMarketplaceStatus(item.status);
  const helpRequestItem = !!item.helpRequestId;
  const normalizedStatus = (item.status || "").trim().toLowerCase();

  const acceptButton = (() => {
    if (!helpRequestItem) return buildButton("accept", "No Task", "status", true);
    if (normalizedStatus === "accepted") return buildButton("decline", "Decline", "destructive", false);
    if (isOwnListing) return buildButton("accept", "No Task", "status", true);
    if (isClosed) return buildButton("accept", "Closed", "status", true);
    if (item.acceptedProviderId && item.acceptedProviderId !== viewerId) return buildButton("accept", "Taken", "status", true);
    return buildButton("accept", "Accept", "success", false);
  })();

  const quoteButton = (() => {
    if (isOwnListing) return buildButton("send_quote", "Your Listing", "status", true);
    if (isClosed) return buildButton("send_quote", "Send Quote", "status", true);
    return buildButton("send_quote", "Send Quote", "primary", false);
  })();

  const discardButton = helpRequestItem && isOwnListing ? buildButton("discard", "Discard", "destructive", false) : null;

  const buttons: MarketplaceCardActionModel["buttons"] = [];
  if (acceptButton) buttons.push(acceptButton);
  if (quoteButton) buttons.push(quoteButton);
  buttons.push(buildButton("view_profile", "View Profile", "secondary", false));
  if (discardButton) buttons.push(discardButton);

  return {
    buttons,
    icons: [buildButton("save", "Save", "secondary"), buildButton("share", "Share", "secondary")],
  };
};
