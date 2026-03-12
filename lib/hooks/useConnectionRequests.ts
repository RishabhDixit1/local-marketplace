"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { ConnectionMutationResponse, ConnectionsListResponse } from "@/lib/api/connections";
import { fetchAuthedJson } from "@/lib/clientApi";
import { CONNECTION_SCHEMA_UNAVAILABLE_MESSAGE } from "@/lib/connectionErrors";
import {
  createConnectionBuckets,
  createConnectionStateMap,
  deriveConnectionState,
  type ConnectionActionKey,
  type ConnectionDecision,
  type ConnectionRequestRow,
} from "@/lib/connectionState";
import { supabase } from "@/lib/supabase";

type RealtimeConnectionRow = {
  requester_id?: string | null;
  recipient_id?: string | null;
};

export const useConnectionRequests = ({ enabled = true }: { enabled?: boolean } = {}) => {
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [rows, setRows] = useState<ConnectionRequestRow[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");
  const [schemaReady, setSchemaReady] = useState(true);
  const [schemaMessage, setSchemaMessage] = useState("");
  const [busyTargetId, setBusyTargetId] = useState<string | null>(null);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [busyActionKey, setBusyActionKey] = useState<ConnectionActionKey | null>(null);
  const reloadTimerRef = useRef<number | null>(null);

  const loadConnections = useCallback(
    async (options: { soft?: boolean; forceViewerId?: string | null } = {}) => {
      const { soft = false, forceViewerId = viewerId } = options;

      if (!enabled) {
        setLoading(false);
        setRows([]);
        setError("");
        setSchemaReady(true);
        setSchemaMessage("");
        return [];
      }

      if (!forceViewerId) {
        setLoading(false);
        setRows([]);
        setError("");
        setSchemaReady(true);
        setSchemaMessage("");
        return [];
      }

      if (!soft) {
        setLoading(true);
      }
      setError("");

      try {
        const payload = await fetchAuthedJson<ConnectionsListResponse>(supabase, "/api/connections");
        if (!payload.ok) {
          throw new Error(payload.message);
        }

        setViewerId(payload.viewerId);
        setRows(payload.rows);
        setSchemaReady(payload.schemaReady);
        setSchemaMessage(payload.schemaMessage || "");
        setError(payload.schemaReady ? "" : payload.schemaMessage || "");
        return payload.rows;
      } catch (nextError) {
        const message = nextError instanceof Error ? nextError.message : "Unable to load connections.";
        setError(message);
        return [];
      } finally {
        if (!soft) {
          setLoading(false);
        }
      }
    },
    [enabled, viewerId]
  );

  useEffect(() => {
    let active = true;

    void (async () => {
      if (!enabled) {
        setLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;

      setViewerId(user?.id || null);

      if (!user?.id) {
        setRows([]);
        setLoading(false);
        return;
      }

      await loadConnections({ forceViewerId: user.id });
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextViewerId = session?.user?.id || null;
      setViewerId(nextViewerId);

      if (!nextViewerId) {
        setRows([]);
        setError("");
        setSchemaReady(true);
        setSchemaMessage("");
        setLoading(false);
        return;
      }

      void loadConnections({ forceViewerId: nextViewerId });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [enabled, loadConnections]);

  useEffect(() => {
    if (!enabled || !viewerId || !schemaReady) return;

    const scheduleReload = (payload: RealtimePostgresChangesPayload<RealtimeConnectionRow>) => {
      const nextRow = (payload.new as RealtimeConnectionRow | null) || null;
      const previousRow = (payload.old as RealtimeConnectionRow | null) || null;
      const requesterId = nextRow?.requester_id || previousRow?.requester_id || null;
      const recipientId = nextRow?.recipient_id || previousRow?.recipient_id || null;

      if (requesterId !== viewerId && recipientId !== viewerId) {
        return;
      }

      if (reloadTimerRef.current) {
        window.clearTimeout(reloadTimerRef.current);
      }

      reloadTimerRef.current = window.setTimeout(() => {
        void loadConnections({ soft: true, forceViewerId: viewerId });
      }, 320);
    };

    const channel = supabase
      .channel(`connection-requests-${viewerId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "connection_requests" }, scheduleReload)
      .subscribe();

    return () => {
      if (reloadTimerRef.current) {
        window.clearTimeout(reloadTimerRef.current);
      }
      void supabase.removeChannel(channel);
    };
  }, [enabled, loadConnections, schemaReady, viewerId]);

  const sendRequest = useCallback(async (targetUserId: string) => {
    if (!schemaReady) {
      throw new Error(schemaMessage || CONNECTION_SCHEMA_UNAVAILABLE_MESSAGE);
    }

    setBusyTargetId(targetUserId);
    setBusyActionKey("connect");
    setError("");

    try {
      const payload = await fetchAuthedJson<ConnectionMutationResponse>(supabase, "/api/connections", {
        method: "POST",
        body: JSON.stringify({ targetUserId }),
      });

      if (!payload.ok) {
        throw new Error(payload.message);
      }

      setViewerId(payload.viewerId);
      setRows(payload.rows);
      setSchemaReady(true);
      setSchemaMessage("");
      return payload;
    } finally {
      setBusyTargetId(null);
      setBusyActionKey(null);
    }
  }, [schemaMessage, schemaReady]);

  const respond = useCallback(async (requestId: string, decision: ConnectionDecision) => {
    if (!schemaReady) {
      throw new Error(schemaMessage || CONNECTION_SCHEMA_UNAVAILABLE_MESSAGE);
    }

    setBusyRequestId(requestId);
    setBusyActionKey(decision === "accepted" ? "accept" : decision === "rejected" ? "reject" : "cancel");
    setError("");

    try {
      const payload = await fetchAuthedJson<ConnectionMutationResponse>(supabase, `/api/connections/${requestId}`, {
        method: "PATCH",
        body: JSON.stringify({ decision }),
      });

      if (!payload.ok) {
        throw new Error(payload.message);
      }

      setViewerId(payload.viewerId);
      setRows(payload.rows);
      setSchemaReady(true);
      setSchemaMessage("");
      return payload;
    } finally {
      setBusyRequestId(null);
      setBusyActionKey(null);
    }
  }, [schemaMessage, schemaReady]);

  const connectionStateMap = useMemo(() => createConnectionStateMap(viewerId, rows), [rows, viewerId]);
  const connectionBuckets = useMemo(() => createConnectionBuckets(viewerId, rows), [rows, viewerId]);
  const getConnectionState = useCallback(
    (targetUserId: string) =>
      connectionStateMap.get(targetUserId) ||
      deriveConnectionState(viewerId, targetUserId, rows),
    [connectionStateMap, rows, viewerId]
  );

  return {
    viewerId,
    rows,
    loading,
    error,
    schemaReady,
    schemaMessage,
    busyTargetId,
    busyRequestId,
    busyActionKey,
    connectionStateMap,
    connectionBuckets,
    loadConnections,
    getConnectionState,
    sendRequest,
    respond,
  };
};
