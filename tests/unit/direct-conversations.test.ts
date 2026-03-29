import { describe, expect, it, vi } from "vitest";
import { getOrCreateDirectConversationIdForUsers } from "../../lib/server/directConversations";

type QueryResponse = {
  data: unknown;
  error: { message: string; code?: string } | null;
};

const missingRpcResponse = {
  data: null,
  error: { message: "function get_or_create_direct_conversation does not exist" },
} satisfies QueryResponse;

const connectionGatedRpcResponse = {
  data: null,
  error: { message: "Connect before starting a direct chat" },
} satisfies QueryResponse;

const createDb = (options: {
  rpcResponse?: QueryResponse;
  viewerParticipantResponse?: QueryResponse;
  recipientParticipantResponse?: QueryResponse;
  insertConversationResponse?: QueryResponse;
  upsertResponse?: QueryResponse;
}) => {
  const upsertMock = vi.fn(async () => options.upsertResponse || { data: null, error: null });
  const insertConversationMock = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(async () => options.insertConversationResponse || { data: { id: "conv-new" }, error: null }),
    })),
  }));

  const conversationParticipantsTable = {
    select: vi.fn(() => ({
      eq: vi.fn(async () => options.viewerParticipantResponse || { data: [], error: null }),
      in: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            maybeSingle: vi.fn(async () => options.recipientParticipantResponse || { data: null, error: null }),
          })),
        })),
      })),
    })),
    upsert: upsertMock,
  };

  const db = {
    rpc: vi.fn(async () => options.rpcResponse || { data: "conv-rpc", error: null }),
    from: vi.fn((table: string) => {
      if (table === "conversation_participants") {
        return conversationParticipantsTable;
      }

      if (table === "conversations") {
        return {
          insert: insertConversationMock,
        };
      }

      throw new Error(`Unexpected table access in test: ${table}`);
    }),
  };

  return {
    db: db as never,
    upsertMock,
    insertConversationMock,
  };
};

describe("direct conversation service", () => {
  it("returns the RPC conversation id when the schema is current", async () => {
    const { db, insertConversationMock, upsertMock } = createDb({
      rpcResponse: { data: "conv-rpc-1", error: null },
    });

    const conversationId = await getOrCreateDirectConversationIdForUsers(db as never, "viewer-1", "peer-1");

    expect(conversationId).toBe("conv-rpc-1");
    expect(insertConversationMock).not.toHaveBeenCalled();
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("uses the user-scoped client for the RPC even when an admin client is provided", async () => {
    const { db, insertConversationMock, upsertMock } = createDb({
      rpcResponse: { data: "conv-rpc-user", error: null },
    });
    const adminDb = {
      rpc: vi.fn(async () => {
        throw new Error("Authentication required");
      }),
      from: vi.fn(),
    };

    const conversationId = await getOrCreateDirectConversationIdForUsers(db as never, "viewer-1", "peer-1", adminDb as never);

    expect(conversationId).toBe("conv-rpc-user");
    expect((db as { rpc: ReturnType<typeof vi.fn> }).rpc).toHaveBeenCalledWith("get_or_create_direct_conversation", {
      target_user_id: "peer-1",
    });
    expect(adminDb.rpc).not.toHaveBeenCalled();
    expect(insertConversationMock).not.toHaveBeenCalled();
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("reuses an existing conversation when the RPC is missing", async () => {
    const { db, insertConversationMock, upsertMock } = createDb({
      rpcResponse: missingRpcResponse,
      viewerParticipantResponse: { data: [{ conversation_id: "conv-existing" }], error: null },
      recipientParticipantResponse: { data: { conversation_id: "conv-existing" }, error: null },
    });

    const conversationId = await getOrCreateDirectConversationIdForUsers(db as never, "viewer-1", "peer-1");

    expect(conversationId).toBe("conv-existing");
    expect(insertConversationMock).not.toHaveBeenCalled();
    expect(upsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ conversation_id: "conv-existing", user_id: "viewer-1" }),
        expect.objectContaining({ conversation_id: "conv-existing", user_id: "peer-1" }),
      ]),
      expect.objectContaining({ onConflict: "conversation_id,user_id" })
    );
  });

  it("creates a conversation fallback when the RPC is missing and no thread exists", async () => {
    const { db, insertConversationMock, upsertMock } = createDb({
      rpcResponse: missingRpcResponse,
      viewerParticipantResponse: { data: [], error: null },
      recipientParticipantResponse: { data: null, error: null },
      insertConversationResponse: { data: { id: "conv-fallback" }, error: null },
    });

    const conversationId = await getOrCreateDirectConversationIdForUsers(db as never, "viewer-1", "peer-1");

    expect(conversationId).toBe("conv-fallback");
    expect(insertConversationMock).toHaveBeenCalled();
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });

  it("creates a conversation fallback when an older RPC still enforces connections", async () => {
    const { db, insertConversationMock, upsertMock } = createDb({
      rpcResponse: connectionGatedRpcResponse,
      viewerParticipantResponse: { data: [], error: null },
      recipientParticipantResponse: { data: null, error: null },
      insertConversationResponse: { data: { id: "conv-open-chat" }, error: null },
    });

    const conversationId = await getOrCreateDirectConversationIdForUsers(db as never, "viewer-1", "peer-1");

    expect(conversationId).toBe("conv-open-chat");
    expect(insertConversationMock).toHaveBeenCalled();
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });
});
