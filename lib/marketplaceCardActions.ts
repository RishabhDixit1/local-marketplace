import type { MarketplaceFeedItem } from "@/lib/marketplaceFeed";
import { isClosedMarketplaceStatus } from "@/lib/marketplaceFeed";

export type MarketplacePrimaryActionKind = "accept" | "send_quote" | "view_profile";
export type MarketplaceSecondaryActionKind = "save" | "share";

export type MarketplaceActionTone = "primary" | "secondary" | "success" | "status";

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
  const acceptedByOther = !!item.acceptedProviderId && item.acceptedProviderId !== viewerId;
  const acceptedByMe = !!viewerId && item.acceptedProviderId === viewerId;

  const acceptButton = (() => {
    if (!helpRequestItem) return buildButton("accept", "No Task", "status", true);
    if (isOwnListing) return buildButton("accept", "Your Request", "status", true);
    if (isClosed) return buildButton("accept", "Closed", "status", true);
    if (acceptedByMe) return buildButton("accept", "Accepted", "status", true);
    if (acceptedByOther) return buildButton("accept", "Taken", "status", true);
    return buildButton("accept", "Accept", "success", false);
  })();

  const quoteButton = (() => {
    if (isOwnListing) return buildButton("send_quote", "Your Listing", "status", true);
    if (isClosed) return buildButton("send_quote", "Closed", "status", true);
    if (helpRequestItem && acceptedByOther) return buildButton("send_quote", "Send Quote", "primary", false);
    if (helpRequestItem && acceptedByMe) return buildButton("send_quote", "Send Quote", "primary", false);
    return buildButton("send_quote", "Send Quote", "primary", false);
  })();

  return {
    buttons: [acceptButton, quoteButton, buildButton("view_profile", "View Profile", "secondary", false)],
    icons: [buildButton("save", "Save", "secondary"), buildButton("share", "Share", "secondary")],
  };
};
