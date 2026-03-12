import { describe, expect, it } from "vitest";
import {
  createConnectionBuckets,
  deriveConnectionState,
  getConnectionActionDescriptors,
  type ConnectionRequestRow,
} from "../../lib/connectionState";

const row = (overrides: Partial<ConnectionRequestRow>): ConnectionRequestRow => ({
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

describe("connection state helpers", () => {
  it("derives none, pending, and accepted states from the latest row", () => {
    expect(deriveConnectionState("viewer-1", "peer-1", []).kind).toBe("none");

    expect(
      deriveConnectionState("viewer-1", "peer-1", [
        row({
          id: "pending-outgoing",
          status: "pending",
        }),
      ]).kind
    ).toBe("outgoing_pending");

    expect(
      deriveConnectionState("viewer-1", "peer-1", [
        row({
          id: "incoming",
          requester_id: "peer-1",
          recipient_id: "viewer-1",
          status: "pending",
        }),
      ]).kind
    ).toBe("incoming_pending");

    const acceptedState = deriveConnectionState("viewer-1", "peer-1", [
      row({
        id: "older-pending",
        status: "pending",
        updated_at: "2026-03-12T09:00:00.000Z",
      }),
      row({
        id: "newer-accepted",
        status: "accepted",
        updated_at: "2026-03-12T11:00:00.000Z",
      }),
    ]);

    expect(acceptedState.kind).toBe("accepted");
    expect(acceptedState.requestId).toBe("newer-accepted");
  });

  it("returns button descriptors for every visible connection state", () => {
    expect(
      getConnectionActionDescriptors(
        deriveConnectionState("viewer-1", "peer-1", [row({ status: "pending" })])
      ).map((action) => action.key)
    ).toEqual(["sent", "cancel"]);

    expect(
      getConnectionActionDescriptors(
        deriveConnectionState("viewer-1", "peer-1", [
          row({
            requester_id: "peer-1",
            recipient_id: "viewer-1",
            status: "pending",
          }),
        ])
      ).map((action) => action.key)
    ).toEqual(["accept", "reject"]);

    expect(
      getConnectionActionDescriptors(
        deriveConnectionState("viewer-1", "peer-1", [row({ status: "accepted" })])
      ).map((action) => action.key)
    ).toEqual(["connected"]);

    expect(
      getConnectionActionDescriptors(
        deriveConnectionState("viewer-1", "peer-1", [row({ status: "rejected" })])
      )[0]?.label
    ).toBe("Connect again");
  });

  it("groups latest incoming, outgoing, and accepted requests into buckets", () => {
    const buckets = createConnectionBuckets("viewer-1", [
      row({
        id: "incoming-1",
        requester_id: "peer-2",
        recipient_id: "viewer-1",
        status: "pending",
        updated_at: "2026-03-12T10:30:00.000Z",
      }),
      row({
        id: "outgoing-1",
        requester_id: "viewer-1",
        recipient_id: "peer-3",
        status: "pending",
        updated_at: "2026-03-12T10:20:00.000Z",
      }),
      row({
        id: "accepted-1",
        requester_id: "viewer-1",
        recipient_id: "peer-4",
        status: "accepted",
        updated_at: "2026-03-12T10:40:00.000Z",
      }),
    ]);

    expect(buckets.incoming.map((entry) => entry.userId)).toEqual(["peer-2"]);
    expect(buckets.outgoing.map((entry) => entry.userId)).toEqual(["peer-3"]);
    expect(buckets.accepted.map((entry) => entry.userId)).toEqual(["peer-4"]);
  });
});
