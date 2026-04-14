import { describe, expect, it } from "vitest";
import {
  buildChatConversationPath,
  parseChatDraftTemplate,
  parseChatFeedContext,
  parseChatQuoteContext,
} from "../../lib/chatNavigation";

describe("chat navigation helpers", () => {
  it("round-trips chat feed, draft, and quote params through the route builder", () => {
    const href = buildChatConversationPath({
      conversationId: "conv-123",
      feedContext: {
        source: "posts_feed",
        cardId: "card-1",
        focusId: "focus-1",
        itemType: "demand",
        title: "Need an electrician tonight",
        audience: "Marketplace feed",
        returnPath: "/dashboard?source=posts_feed&focus=focus-1",
      },
      quoteContext: {
        helpRequestId: "help-123",
      },
      draftTemplate: {
        kind: "interest",
        title: "Need an electrician tonight",
      },
    });

    const params = new URL(href, "https://example.com").searchParams;

    expect(params.get("open")).toBe("conv-123");
    expect(parseChatFeedContext(params)).toEqual({
      source: "posts_feed",
      cardId: "card-1",
      focusId: "focus-1",
      itemType: "demand",
      title: "Need an electrician tonight",
      audience: "Marketplace feed",
      returnPath: "/dashboard?source=posts_feed&focus=focus-1",
    });
    expect(parseChatQuoteContext(params)).toEqual({
      helpRequestId: "help-123",
      orderId: null,
    });
    expect(parseChatDraftTemplate(params)).toEqual({
      kind: "interest",
      title: "Need an electrician tonight",
    });
  });

  it("ignores malformed quote params until a quote context is explicit", () => {
    const params = new URLSearchParams({
      helpRequest: "help-1",
      order: "order-1",
    });

    expect(parseChatQuoteContext(params)).toBeNull();
  });
});
