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

export type ConnectionActionKey = "connect" | "accept" | "reject" | "cancel" | "connected" | "sent";

export type ConnectionActionDescriptor = {
  key: ConnectionActionKey;
  label: string;
  pendingLabel: string;
  disabled?: boolean;
  tone: "primary" | "success" | "danger" | "neutral" | "status";
};

const trim = (value: string | null | undefined) => value?.trim() ?? "";

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

export const getConnectionSortTimestamp = (row: ConnectionRequestRow) =>
  row.updated_at || row.responded_at || row.created_at || "";

export const sortConnectionRowsByFreshness = (rows: ConnectionRequestRow[]) =>
  [...rows].sort((a, b) => getConnectionSortTimestamp(b).localeCompare(getConnectionSortTimestamp(a)));

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
    sortConnectionRowsByFreshness(
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

  sortConnectionRowsByFreshness(rows).forEach((row) => {
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

export const getConnectionActionDescriptors = (
  state: ConnectionState,
  options: {
    busy?: boolean;
    allowReconnect?: boolean;
  } = {}
): ConnectionActionDescriptor[] => {
  const { busy = false, allowReconnect = true } = options;

  if (state.kind === "self") return [];

  if (state.kind === "incoming_pending") {
    return [
      {
        key: "accept",
        label: "Accept",
        pendingLabel: "Accepting...",
        disabled: busy,
        tone: "success",
      },
      {
        key: "reject",
        label: "Decline",
        pendingLabel: "Declining...",
        disabled: busy,
        tone: "danger",
      },
    ];
  }

  if (state.kind === "outgoing_pending") {
    return [
      {
        key: "sent",
        label: "Pending",
        pendingLabel: "Pending",
        disabled: true,
        tone: "status",
      },
    ];
  }

  if (state.kind === "accepted") {
    return [
      {
        key: "connected",
        label: "Connected",
        pendingLabel: "Connected",
        disabled: true,
        tone: "success",
      },
    ];
  }

  return [
    {
      key: "connect",
      label: allowReconnect && (state.kind === "rejected" || state.kind === "cancelled") ? "Connect again" : "Connect",
      pendingLabel: "Connecting...",
      disabled: busy,
      tone: "primary",
    },
  ];
};
