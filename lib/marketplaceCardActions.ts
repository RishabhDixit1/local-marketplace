import type { MarketplaceFeedItem } from "@/lib/marketplaceFeed";
import { isClosedMarketplaceStatus } from "@/lib/marketplaceFeed";

export type MarketplacePrimaryActionKind = "accept" | "decline" | "send_quote" | "view_profile";
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
  const acceptedByOther = !!item.acceptedProviderId && item.acceptedProviderId !== viewerId;
  const acceptedByMe = !!viewerId && item.acceptedProviderId === viewerId;

  const acceptButton = (() => {
    if (!helpRequestItem) return null;
    if (isOwnListing) return buildButton("accept", "Accept", "status", true);
    if (isClosed) return buildButton("accept", "Accept", "status", true);
    if (acceptedByMe) return buildButton("accept", "Accept", "status", true);
    if (acceptedByOther) return buildButton("accept", "Accept", "status", true);
    return buildButton("accept", "Accept", "success", false);
  })();

  const quoteButton = (() => {
    if (isOwnListing) return buildButton("send_quote", "Show Interest", "status", true);
    if (isClosed) return buildButton("send_quote", "Show Interest", "status", true);
    if (helpRequestItem && acceptedByOther) return buildButton("send_quote", "Show Interest", "primary", false);
    if (helpRequestItem && acceptedByMe) return buildButton("send_quote", "Show Interest", "primary", false);
    return buildButton("send_quote", "Show Interest", "primary", false);
  })();

  const buttons: MarketplaceCardActionModel["buttons"] = [];
  if (acceptButton) buttons.push(acceptButton);
  if (quoteButton) buttons.push(quoteButton);
  buttons.push(buildButton("view_profile", "View Profile", "secondary", false));

  return {
    buttons,
    icons: [buildButton("save", "Save", "secondary"), buildButton("share", "Share", "secondary")],
  };
};
