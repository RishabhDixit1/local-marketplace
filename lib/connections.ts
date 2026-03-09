"use client";

import { supabase } from "@/lib/supabase";

export type ConnectionStatus = "pending" | "accepted" | "rejected" | "cancelled";
export type ConnectionDecision = Exclude<ConnectionStatus, "pending">;
export type ConnectionStateKind =
  | "self"
  | "none"
  | "outgoing_pending"
  | "incoming_pending"
  | "accepted"
  | "rejected"
  | "cancelled";

export type ConnectionRequestRow = {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: ConnectionStatus;
  metadata: Record<string, unknown>;
  responded_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ConnectionState = {
  kind: ConnectionStateKind;
  requestId: string | null;
  updatedAt: string | null;
  row: ConnectionRequestRow | null;
};

export type ConnectionBucketEntry = {
  requestId: string;
  userId: string;
  kind: Exclude<ConnectionStateKind, "self" | "none">;
  updatedAt: string | null;
  row: ConnectionRequestRow;
};

const missingRelationPattern =
  /relation .* does not exist|table .* does not exist|could not find the table '.*' in the schema cache/i;
const missingFunctionPattern =
  /function .* does not exist|could not find the function .* in the schema cache|send_connection_request|get_or_create_direct_conversation|respond_to_connection_request/i;

const trim = (value: string | null | undefined) => value?.trim() ?? "";

export const isMissingConnectionSchemaError = (message: string) =>
  missingRelationPattern.test(message) || missingFunctionPattern.test(message);

export const normalizeConnectionStatus = (value: string | null | undefined): ConnectionStatus => {
  const normalized = trim(value).toLowerCase();
  if (normalized === "accepted") return "accepted";
  if (normalized === "rejected") return "rejected";
  if (normalized === "cancelled") return "cancelled";
  return "pending";
};

const toIsoTimestamp = (value: unknown) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
};

export const normalizeConnectionRow = (row: Record<string, unknown> | null | undefined): ConnectionRequestRow | null => {
  const id = trim(typeof row?.id === "string" ? row.id : "");
  const requesterId = trim(typeof row?.requester_id === "string" ? row.requester_id : "");
  const recipientId = trim(typeof row?.recipient_id === "string" ? row.recipient_id : "");

  if (!id || !requesterId || !recipientId) return null;

  return {
    id,
    requester_id: requesterId,
    recipient_id: recipientId,
    status: normalizeConnectionStatus(typeof row?.status === "string" ? row.status : null),
    metadata:
      row?.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    responded_at: toIsoTimestamp(row?.responded_at),
    created_at: toIsoTimestamp(row?.created_at),
    updated_at: toIsoTimestamp(row?.updated_at),
  };
};

const getSortTimestamp = (row: ConnectionRequestRow) => row.updated_at || row.responded_at || row.created_at || "";

const sortRowsByFreshness = (rows: ConnectionRequestRow[]) =>
  [...rows].sort((a, b) => getSortTimestamp(b).localeCompare(getSortTimestamp(a)));

const pairFilter = (viewerId: string, otherUserId: string) =>
  `and(requester_id.eq.${viewerId},recipient_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},recipient_id.eq.${viewerId})`;

const getCurrentViewerId = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.id) {
    throw new Error(error?.message || "Login required.");
  }

  return user.id;
};

const fetchPairRows = async (viewerId: string, otherUserId: string) => {
  const { data, error } = await supabase
    .from("connection_requests")
    .select("id,requester_id,recipient_id,status,metadata,responded_at,created_at,updated_at")
    .or(pairFilter(viewerId, otherUserId))
    .order("updated_at", { ascending: false });

  if (error) {
    if (isMissingConnectionSchemaError(error.message || "")) return [];
    throw new Error(error.message);
  }

  return ((data as Record<string, unknown>[] | null) || [])
    .map((row) => normalizeConnectionRow(row))
    .filter((row): row is ConnectionRequestRow => !!row);
};

export const listCurrentUserConnectionRows = async (viewerId: string) => {
  if (!viewerId) return [];

  const { data, error } = await supabase
    .from("connection_requests")
    .select("id,requester_id,recipient_id,status,metadata,responded_at,created_at,updated_at")
    .or(`requester_id.eq.${viewerId},recipient_id.eq.${viewerId}`)
    .order("updated_at", { ascending: false });

  if (error) {
    if (isMissingConnectionSchemaError(error.message || "")) return [];
    throw new Error(error.message);
  }

  return ((data as Record<string, unknown>[] | null) || [])
    .map((row) => normalizeConnectionRow(row))
    .filter((row): row is ConnectionRequestRow => !!row);
};

export const getConnectionPeerId = (viewerId: string, row: ConnectionRequestRow) =>
  row.requester_id === viewerId ? row.recipient_id : row.requester_id;

export const deriveConnectionState = (
  viewerId: string | null | undefined,
  targetUserId: string,
  rows: ConnectionRequestRow[]
): ConnectionState => {
  const normalizedViewerId = trim(viewerId);
  if (!normalizedViewerId || !targetUserId) {
    return {
      kind: "none",
      requestId: null,
      updatedAt: null,
      row: null,
    };
  }

  if (normalizedViewerId === targetUserId) {
    return {
      kind: "self",
      requestId: null,
      updatedAt: null,
      row: null,
    };
  }

  const latestRow =
    sortRowsByFreshness(
      rows.filter(
        (row) =>
          (row.requester_id === normalizedViewerId && row.recipient_id === targetUserId) ||
          (row.requester_id === targetUserId && row.recipient_id === normalizedViewerId)
      )
    )[0] || null;

  if (!latestRow) {
    return {
      kind: "none",
      requestId: null,
      updatedAt: null,
      row: null,
    };
  }

  if (latestRow.status === "accepted") {
    return {
      kind: "accepted",
      requestId: latestRow.id,
      updatedAt: latestRow.updated_at,
      row: latestRow,
    };
  }

  if (latestRow.status === "rejected") {
    return {
      kind: "rejected",
      requestId: latestRow.id,
      updatedAt: latestRow.updated_at,
      row: latestRow,
    };
  }

  if (latestRow.status === "cancelled") {
    return {
      kind: "cancelled",
      requestId: latestRow.id,
      updatedAt: latestRow.updated_at,
      row: latestRow,
    };
  }

  return {
    kind: latestRow.requester_id === normalizedViewerId ? "outgoing_pending" : "incoming_pending",
    requestId: latestRow.id,
    updatedAt: latestRow.updated_at,
    row: latestRow,
  };
};

export const createConnectionStateMap = (viewerId: string | null | undefined, rows: ConnectionRequestRow[]) => {
  const normalizedViewerId = trim(viewerId);
  const states = new Map<string, ConnectionState>();

  if (!normalizedViewerId) return states;

  sortRowsByFreshness(rows).forEach((row) => {
    const peerId = getConnectionPeerId(normalizedViewerId, row);
    if (!peerId || states.has(peerId)) return;
    states.set(peerId, deriveConnectionState(normalizedViewerId, peerId, [row]));
  });

  return states;
};

export const createConnectionBuckets = (viewerId: string | null | undefined, rows: ConnectionRequestRow[]) => {
  const normalizedViewerId = trim(viewerId);
  const incoming: ConnectionBucketEntry[] = [];
  const outgoing: ConnectionBucketEntry[] = [];
  const accepted: ConnectionBucketEntry[] = [];

  if (!normalizedViewerId) {
    return { incoming, outgoing, accepted };
  }

  createConnectionStateMap(normalizedViewerId, rows).forEach((state, userId) => {
    if (!state.requestId || !state.row) return;

    const entry: ConnectionBucketEntry = {
      requestId: state.requestId,
      userId,
      kind: state.kind as ConnectionBucketEntry["kind"],
      updatedAt: state.updatedAt,
      row: state.row,
    };

    if (state.kind === "incoming_pending") incoming.push(entry);
    if (state.kind === "outgoing_pending") outgoing.push(entry);
    if (state.kind === "accepted") accepted.push(entry);
  });

  const sortEntries = (items: ConnectionBucketEntry[]) =>
    items.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

  return {
    incoming: sortEntries(incoming),
    outgoing: sortEntries(outgoing),
    accepted: sortEntries(accepted),
  };
};

const tryRpcSendConnectionRequest = async (targetUserId: string) => {
  const { data, error } = await supabase.rpc("send_connection_request", {
    target_user_id: targetUserId,
  });

  if (error) {
    if (isMissingConnectionSchemaError(error.message || "")) return null;
    throw new Error(error.message);
  }

  return typeof data === "string" ? data : null;
};

const tryRpcRespondToConnectionRequest = async (requestId: string, decision: ConnectionDecision) => {
  const { data, error } = await supabase.rpc("respond_to_connection_request", {
    target_request_id: requestId,
    decision,
  });

  if (error) {
    if (isMissingConnectionSchemaError(error.message || "")) return null;
    throw new Error(error.message);
  }

  return typeof data === "string" ? data : null;
};

export const sendConnectionRequest = async (targetUserId: string) => {
  const viewerId = await getCurrentViewerId();

  if (viewerId === targetUserId) {
    throw new Error("You cannot connect with yourself.");
  }

  const rpcRequestId = await tryRpcSendConnectionRequest(targetUserId);
  if (rpcRequestId) return rpcRequestId;

  const pairRows = await fetchPairRows(viewerId, targetUserId);
  const currentState = deriveConnectionState(viewerId, targetUserId, pairRows);

  if (currentState.kind === "accepted" || currentState.kind === "outgoing_pending") {
    return currentState.requestId;
  }

  if (currentState.kind === "incoming_pending" && currentState.requestId) {
    const { error } = await supabase
      .from("connection_requests")
      .update({
        status: "accepted",
        responded_at: new Date().toISOString(),
      })
      .eq("id", currentState.requestId);

    if (error) throw new Error(error.message);
    return currentState.requestId;
  }

  const { data, error } = await supabase
    .from("connection_requests")
    .insert({
      requester_id: viewerId,
      recipient_id: targetUserId,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      const latestRows = await fetchPairRows(viewerId, targetUserId);
      return deriveConnectionState(viewerId, targetUserId, latestRows).requestId;
    }
    throw new Error(error.message);
  }

  return typeof data?.id === "string" ? data.id : null;
};

export const respondToConnectionRequest = async (params: {
  requestId: string;
  decision: ConnectionDecision;
}) => {
  const viewerId = await getCurrentViewerId();
  const rpcRequestId = await tryRpcRespondToConnectionRequest(params.requestId, params.decision);
  if (rpcRequestId) return rpcRequestId;

  const { data, error } = await supabase
    .from("connection_requests")
    .select("id,requester_id,recipient_id,status")
    .eq("id", params.requestId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const row = normalizeConnectionRow(data as Record<string, unknown> | null);
  if (!row) throw new Error("Connection request not found.");

  if (params.decision === "cancelled" && row.requester_id !== viewerId) {
    throw new Error("Only the requester can cancel this connection request.");
  }

  if (params.decision !== "cancelled" && row.recipient_id !== viewerId) {
    throw new Error("Only the recipient can accept or reject this connection request.");
  }

  const { error: updateError } = await supabase
    .from("connection_requests")
    .update({
      status: params.decision,
      responded_at: new Date().toISOString(),
    })
    .eq("id", params.requestId);

  if (updateError) throw new Error(updateError.message);

  return params.requestId;
};
