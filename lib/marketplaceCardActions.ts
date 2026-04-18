import type { MarketplaceFeedItem } from "@/lib/marketplaceFeed";
import { isClosedMarketplaceStatus, normalizeMarketplaceNeedMatchStatus } from "@/lib/marketplaceFeed";

export type MarketplacePrimaryActionKind =
  | "accept"
  | "withdraw"
  | "decline"
  | "send_quote"
  | "view_profile"
  | "discard";
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
  const viewerMatchStatus =
    normalizeMarketplaceNeedMatchStatus(item.viewerMatchStatus) ||
    (item.viewerHasExpressedInterest ? "interested" : null);

  const acceptButton = (() => {
    if (!helpRequestItem) return null;
    if (normalizedStatus === "accepted") {
      if (item.acceptedProviderId === viewerId || isOwnListing) {
        return buildButton(
          "decline",
          isOwnListing ? "Reopen" : "Leave Task",
          "destructive",
          false
        );
      }
      return buildButton("accept", "Taken", "status", true);
    }
    if (isOwnListing) return buildButton("accept", "Your Post", "status", true);
    if (isClosed) return buildButton("accept", "Closed", "status", true);
    if (item.acceptedProviderId && item.acceptedProviderId !== viewerId) {
      return buildButton("accept", "Taken", "status", true);
    }
    if (viewerMatchStatus === "interested") return buildButton("withdraw", "Withdraw", "destructive", false);
    if (viewerMatchStatus === "rejected") return buildButton("accept", "Not selected", "status", true);
    return buildButton("accept", "Send Interest", "success", false);
  })();

  const quoteButton = (() => {
    if (isOwnListing) return null;
    if (isClosed) return buildButton("send_quote", "Closed", "status", true);
    if (helpRequestItem && item.acceptedProviderId === viewerId) {
      return buildButton("send_quote", "Draft Quote", "primary", false);
    }
    return buildButton("send_quote", "Chat", "primary", false);
  })();

  const discardButton = helpRequestItem && isOwnListing ? buildButton("discard", "Discard", "destructive", false) : null;

  const buttons: MarketplaceCardActionModel["buttons"] = [];
  if (acceptButton) buttons.push(acceptButton);
  if (quoteButton) buttons.push(quoteButton);
  buttons.push(buildButton("view_profile", "Open", "secondary", false));
  if (discardButton) buttons.push(discardButton);

  return {
    buttons,
    icons: [buildButton("save", "Save", "secondary"), buildButton("share", "Share", "secondary")],
  };
};
