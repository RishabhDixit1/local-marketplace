import type { ConnectionDecision, ConnectionRequestRow } from "@/lib/connectionState";

export type ConnectionsApiErrorCode = "UNAUTHORIZED" | "INVALID_PAYLOAD" | "DB" | "NOT_FOUND";

export type ConnectionsApiError = {
  ok: false;
  code: ConnectionsApiErrorCode;
  message: string;
};

export type ConnectionsListResponse =
  | {
      ok: true;
      viewerId: string;
      rows: ConnectionRequestRow[];
      schemaReady: boolean;
      schemaMessage: string | null;
    }
  | ConnectionsApiError;

export type SendConnectionRequestPayload = {
  targetUserId: string;
};

export type RespondToConnectionRequestPayload = {
  decision: ConnectionDecision;
};

export type ConnectionMutationResponse =
  | {
      ok: true;
      viewerId: string;
      requestId: string | null;
      rows: ConnectionRequestRow[];
    }
  | ConnectionsApiError;
