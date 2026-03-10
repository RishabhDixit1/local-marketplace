import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LiveTalkRequestRecord } from "@/lib/api/chat";

type FlexibleRow = Record<string, unknown>;

const trim = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const isFlexibleRow = (value: unknown): value is FlexibleRow =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const toFlexibleRows = (value: unknown): FlexibleRow[] =>
  Array.isArray(value) ? value.filter((item): item is FlexibleRow => isFlexibleRow(item)) : [];
const isMissingRelationError = (message: string) =>
  /relation .* does not exist|table .* does not exist|could not find the table '.*' in the schema cache/i.test(message);

const pairFilter = (userA: string, userB: string) =>
  `and(requester_id.eq.${userA},recipient_id.eq.${userB}),and(requester_id.eq.${userB},recipient_id.eq.${userA})`;

const isAcceptedStatus = (value: unknown) => trim(value).toLowerCase() === "accepted";

export const areUsersConnected = async (db: SupabaseClient, userA: string, userB: string) => {
  if (!userA || !userB || userA === userB) return false;

  const { data, error } = await db
    .from("connection_requests")
    .select("id,status")
    .or(pairFilter(userA, userB))
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error.message || "")) {
      throw new Error("Connection system is not configured. Apply the latest Supabase migrations.");
    }
    throw new Error(error.message);
  }

  return isAcceptedStatus((isFlexibleRow(data) ? data : null)?.status);
};

export const listAcceptedConnectionPeerIds = async (db: SupabaseClient, viewerId: string) => {
  if (!viewerId) return new Set<string>();

  const { data, error } = await db
    .from("connection_requests")
    .select("requester_id,recipient_id,status")
    .or(`requester_id.eq.${viewerId},recipient_id.eq.${viewerId}`)
    .eq("status", "accepted");

  if (error) {
    if (isMissingRelationError(error.message || "")) {
      return new Set<string>();
    }
    throw new Error(error.message);
  }

  const peers = new Set<string>();

  toFlexibleRows(data).forEach((row) => {
    const requesterId = trim(row.requester_id);
    const recipientId = trim(row.recipient_id);
    if (requesterId === viewerId && recipientId) peers.add(recipientId);
    if (recipientId === viewerId && requesterId) peers.add(requesterId);
  });

  return peers;
};

export const getConversationContext = async (db: SupabaseClient, conversationId: string, viewerId: string) => {
  if (!conversationId || !viewerId) {
    throw new Error("conversationId and viewerId are required.");
  }

  const [{ data: conversationRow, error: conversationError }, { data: participantRows, error: participantError }] =
    await Promise.all([
      db.from("conversations").select("id,kind").eq("id", conversationId).maybeSingle(),
      db.from("conversation_participants").select("user_id").eq("conversation_id", conversationId),
    ]);

  if (conversationError) {
    throw new Error(conversationError.message);
  }

  if (participantError) {
    throw new Error(participantError.message);
  }

  const participantIds = (((participantRows as Array<{ user_id?: string }> | null) || []).map((row) => trim(row.user_id))).filter(
    Boolean
  );

  if (!participantIds.includes(viewerId)) {
    throw new Error("You do not have access to this conversation.");
  }

  const otherUserId = participantIds.find((participantId) => participantId !== viewerId) || null;
  const kind = trim((conversationRow as FlexibleRow | null)?.kind || "direct").toLowerCase() || "direct";

  return {
    kind,
    participantIds,
    otherUserId,
  };
};

export const mapLiveTalkRequestRow = (row: FlexibleRow | null): LiveTalkRequestRecord | null => {
  if (!row) return null;

  const id = trim(row.id);
  const conversationId = trim(row.conversation_id);
  const callerId = trim(row.caller_id);
  const recipientId = trim(row.recipient_id);
  const status = trim(row.status).toLowerCase() || "pending";
  const mode = trim(row.mode).toLowerCase() === "audio_video" ? "audio_video" : "audio_video";

  if (!id || !conversationId || !callerId || !recipientId) return null;

  return {
    id,
    conversation_id: conversationId,
    caller_id: callerId,
    recipient_id: recipientId,
    status:
      status === "accepted" || status === "declined" || status === "ended" || status === "cancelled"
        ? status
        : "pending",
    mode,
    created_at: trim(row.created_at),
    updated_at: trim(row.updated_at),
    responded_at: trim(row.responded_at) || null,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null,
  };
};
