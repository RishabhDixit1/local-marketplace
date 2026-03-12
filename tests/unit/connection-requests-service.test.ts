import { describe, expect, it, vi } from "vitest";
import {
  respondViewerConnectionRequest,
  sendViewerConnectionRequest,
} from "../../lib/server/connectionRequests";
import type { ConnectionRequestRow } from "../../lib/connectionState";

type QueryResponse = {
  data: unknown;
  error: { message: string; code?: string } | null;
};

const connectionRow = (overrides: Partial<ConnectionRequestRow>): ConnectionRequestRow => ({
  id: "req-1",
  requester_id: "viewer-1",
  recipient_id: "peer-1",
  status: "pending",
  metadata: {},
  responded_at: null,
  created_at: "2026-03-12T10:00:00.000Z",
  updated_at: "2026-03-12T10:00:00.000Z",
  ...overrides,
});

const createDb = (options: {
  rpcResponse?: QueryResponse;
  orderResponses?: QueryResponse[];
  maybeSingleResponses?: QueryResponse[];
  singleResponses?: QueryResponse[];
  updateResponses?: QueryResponse[];
}) => {
  const insertMock = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(async () => options.singleResponses?.shift() || { data: { id: "new-request" }, error: null }),
    })),
  }));

  const updateMock = vi.fn((payload: unknown) => ({
    eq: vi.fn(async () => {
      void payload;
      return options.updateResponses?.shift() || { data: null, error: null };
    }),
  }));

  const db = {
    rpc: vi.fn(async () => options.rpcResponse || { data: null, error: null }),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        or: vi.fn(() => ({
          order: vi.fn(async () => options.orderResponses?.shift() || { data: [], error: null }),
        })),
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => options.maybeSingleResponses?.shift() || { data: null, error: null }),
        })),
      })),
      insert: insertMock,
      update: updateMock,
    })),
  };

  return {
    db: db as never,
    insertMock,
    updateMock,
  };
};

const missingRpcMessage = { data: null, error: { message: "function send_connection_request does not exist" } };
const missingRespondRpcMessage = { data: null, error: { message: "function respond_to_connection_request does not exist" } };

describe("connection request service", () => {
  it("prevents invalid self-connections before hitting the database", async () => {
    const { db, insertMock } = createDb({});

    await expect(sendViewerConnectionRequest(db as never, "viewer-1", "viewer-1")).rejects.toThrow(
      "You cannot connect with yourself."
    );
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("prevents duplicate outgoing requests and reuses the existing request id", async () => {
    const existingRows = [
      connectionRow({
        id: "existing-request",
        requester_id: "viewer-1",
        recipient_id: "peer-1",
        status: "pending",
      }),
    ];
    const { db, insertMock } = createDb({
      rpcResponse: missingRpcMessage,
      orderResponses: [
        { data: existingRows, error: null },
        { data: existingRows, error: null },
      ],
    });

    const result = await sendViewerConnectionRequest(db as never, "viewer-1", "peer-1");

    expect(result.requestId).toBe("existing-request");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("accepts and rejects requests only through valid viewer actions", async () => {
    const acceptedRow = connectionRow({
      id: "incoming-request",
      requester_id: "peer-1",
      recipient_id: "viewer-1",
      status: "pending",
    });
    const acceptedDb = createDb({
      rpcResponse: missingRespondRpcMessage,
      maybeSingleResponses: [{ data: acceptedRow, error: null }],
      updateResponses: [{ data: null, error: null }],
      orderResponses: [
        {
          data: [connectionRow({ ...acceptedRow, status: "accepted" })],
          error: null,
        },
      ],
    });

    const acceptedResult = await respondViewerConnectionRequest(
      acceptedDb.db as never,
      "viewer-1",
      "incoming-request",
      "accepted"
    );

    expect(acceptedResult.requestId).toBe("incoming-request");
    expect(acceptedDb.updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "accepted",
      })
    );

    const rejectedDb = createDb({
      rpcResponse: missingRespondRpcMessage,
      maybeSingleResponses: [{ data: acceptedRow, error: null }],
      updateResponses: [{ data: null, error: null }],
      orderResponses: [
        {
          data: [connectionRow({ ...acceptedRow, status: "rejected" })],
          error: null,
        },
      ],
    });

    await respondViewerConnectionRequest(rejectedDb.db as never, "viewer-1", "incoming-request", "rejected");
    expect(rejectedDb.updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "rejected",
      })
    );
  });

  it("allows the requester to cancel a pending request", async () => {
    const pendingRow = connectionRow({
      id: "outgoing-request",
      requester_id: "viewer-1",
      recipient_id: "peer-1",
      status: "pending",
    });
    const { db, updateMock } = createDb({
      rpcResponse: missingRespondRpcMessage,
      maybeSingleResponses: [{ data: pendingRow, error: null }],
      updateResponses: [{ data: null, error: null }],
      orderResponses: [
        {
          data: [connectionRow({ ...pendingRow, status: "cancelled" })],
          error: null,
        },
      ],
    });

    const result = await respondViewerConnectionRequest(db as never, "viewer-1", "outgoing-request", "cancelled");

    expect(result.requestId).toBe("outgoing-request");
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "cancelled",
      })
    );
  });
});
