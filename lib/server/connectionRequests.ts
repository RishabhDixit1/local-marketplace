import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CONNECTION_SCHEMA_UNAVAILABLE_MESSAGE,
  isMissingConnectionSchemaError,
} from "@/lib/connectionErrors";
import {
  deriveConnectionState,
  normalizeConnectionRow,
  type ConnectionDecision,
  type ConnectionRequestRow,
} from "@/lib/connectionState";

const pairFilter = (viewerId: string, otherUserId: string) =>
  `and(requester_id.eq.${viewerId},recipient_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},recipient_id.eq.${viewerId})`;

export const hasConnectionRequestSchema = async (db: SupabaseClient) => {
  const { error } = await db.from("connection_requests").select("id").limit(1);

  if (error) {
    if (isMissingConnectionSchemaError(error.message || "")) return false;
    throw new Error(error.message);
  }

  return true;
};

const fetchPairRows = async (db: SupabaseClient, viewerId: string, otherUserId: string) => {
  const { data, error } = await db
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

export const listViewerConnectionRows = async (db: SupabaseClient, viewerId: string) => {
  if (!viewerId) return [];

  const { data, error } = await db
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

const tryRpcSendConnectionRequest = async (db: SupabaseClient, targetUserId: string) => {
  const { data, error } = await db.rpc("send_connection_request", {
    target_user_id: targetUserId,
  });

  if (error) {
    if (isMissingConnectionSchemaError(error.message || "")) return null;
    throw new Error(error.message);
  }

  return typeof data === "string" ? data : null;
};

const tryRpcRespondToConnectionRequest = async (
  db: SupabaseClient,
  requestId: string,
  decision: ConnectionDecision
) => {
  const { data, error } = await db.rpc("respond_to_connection_request", {
    target_request_id: requestId,
    decision,
  });

  if (error) {
    if (isMissingConnectionSchemaError(error.message || "")) return null;
    throw new Error(error.message);
  }

  return typeof data === "string" ? data : null;
};

export const sendViewerConnectionRequest = async (db: SupabaseClient, viewerId: string, targetUserId: string) => {
  if (!viewerId) {
    throw new Error("Authentication required.");
  }

  if (!targetUserId || viewerId === targetUserId) {
    throw new Error("You cannot connect with yourself.");
  }

  const rpcRequestId = await tryRpcSendConnectionRequest(db, targetUserId);
  if (rpcRequestId) {
    return {
      requestId: rpcRequestId,
      rows: await listViewerConnectionRows(db, viewerId),
    };
  }

  const pairRows = await fetchPairRows(db, viewerId, targetUserId);
  const currentState = deriveConnectionState(viewerId, targetUserId, pairRows);

  if (currentState.kind === "accepted" || currentState.kind === "outgoing_pending") {
    return {
      requestId: currentState.requestId,
      rows: await listViewerConnectionRows(db, viewerId),
    };
  }

  if (currentState.kind === "incoming_pending" && currentState.requestId) {
    const { error } = await db
      .from("connection_requests")
      .update({
        status: "accepted",
        responded_at: new Date().toISOString(),
      })
      .eq("id", currentState.requestId);

    if (error) throw new Error(error.message);

    return {
      requestId: currentState.requestId,
      rows: await listViewerConnectionRows(db, viewerId),
    };
  }

  const { data, error } = await db
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
      const latestRows = await fetchPairRows(db, viewerId, targetUserId);
      return {
        requestId: deriveConnectionState(viewerId, targetUserId, latestRows).requestId,
        rows: await listViewerConnectionRows(db, viewerId),
      };
    }
    if (isMissingConnectionSchemaError(error.message || "")) {
      throw new Error(CONNECTION_SCHEMA_UNAVAILABLE_MESSAGE);
    }

    throw new Error(error.message);
  }

  return {
    requestId: typeof data?.id === "string" ? data.id : null,
    rows: await listViewerConnectionRows(db, viewerId),
  };
};

export const respondViewerConnectionRequest = async (
  db: SupabaseClient,
  viewerId: string,
  requestId: string,
  decision: ConnectionDecision
) => {
  if (!viewerId) {
    throw new Error("Authentication required.");
  }

  const rpcRequestId = await tryRpcRespondToConnectionRequest(db, requestId, decision);
  if (rpcRequestId) {
    return {
      requestId: rpcRequestId,
      rows: await listViewerConnectionRows(db, viewerId),
    };
  }

  const { data, error } = await db
    .from("connection_requests")
    .select("id,requester_id,recipient_id,status,metadata,responded_at,created_at,updated_at")
    .eq("id", requestId)
    .maybeSingle();

  if (error) {
    if (isMissingConnectionSchemaError(error.message || "")) {
      throw new Error(CONNECTION_SCHEMA_UNAVAILABLE_MESSAGE);
    }
    throw new Error(error.message);
  }

  const row = normalizeConnectionRow(data as Record<string, unknown> | null);
  if (!row) {
    throw new Error("Connection request not found.");
  }

  if (decision === "cancelled" && row.requester_id !== viewerId) {
    throw new Error("Only the requester can cancel this connection request.");
  }

  if (decision !== "cancelled" && row.recipient_id !== viewerId) {
    throw new Error("Only the recipient can accept or reject this connection request.");
  }

  const { error: updateError } = await db
    .from("connection_requests")
    .update({
      status: decision,
      responded_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (updateError) {
    if (isMissingConnectionSchemaError(updateError.message || "")) {
      throw new Error(CONNECTION_SCHEMA_UNAVAILABLE_MESSAGE);
    }
    throw new Error(updateError.message);
  }

  return {
    requestId,
    rows: await listViewerConnectionRows(db, viewerId),
  };
};
