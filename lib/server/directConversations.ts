import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

type ConversationParticipantRow = {
  conversation_id: string | null;
};

const isMissingDirectConversationRpcError = (message: string) =>
  /function .* does not exist|could not find the function .* in the schema cache|get_or_create_direct_conversation/i.test(
    message
  );

const isMissingColumnError = (message: string) =>
  /column .* does not exist|could not find the '.*' column/i.test(message);

const normalizeConversationIds = (rows: ConversationParticipantRow[] | null | undefined) =>
  (rows || [])
    .map((row) => row.conversation_id)
    .filter((conversationId): conversationId is string => typeof conversationId === "string" && conversationId.length > 0);

const buildDirectConversationKey = (userA: string, userB: string) => [userA, userB].sort().join(":");

const findExistingDirectConversationId = async (
  db: SupabaseClient,
  viewerId: string,
  recipientId: string
): Promise<string | null> => {
  const { data: viewerParticipantRows, error: viewerParticipantError } = await db
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", viewerId);

  if (viewerParticipantError) {
    throw new Error(viewerParticipantError.message);
  }

  const viewerConversationIds = normalizeConversationIds(
    (viewerParticipantRows as ConversationParticipantRow[] | null) || []
  );
  if (!viewerConversationIds.length) {
    return null;
  }

  const { data: directConversationRow, error: directConversationError } = await db
    .from("conversation_participants")
    .select("conversation_id")
    .in("conversation_id", viewerConversationIds)
    .eq("user_id", recipientId)
    .limit(1)
    .maybeSingle();

  if (directConversationError) {
    throw new Error(directConversationError.message);
  }

  return ((directConversationRow as ConversationParticipantRow | null)?.conversation_id || null) as string | null;
};

const createFallbackConversationRow = async (
  db: SupabaseClient,
  viewerId: string,
  recipientId: string
): Promise<string> => {
  const directKey = buildDirectConversationKey(viewerId, recipientId);
  const insertPayload = {
    kind: "direct",
    created_by: viewerId,
    direct_key: directKey,
    metadata: { participant_count: 2 },
  };

  const insertResult = await db.from("conversations").insert(insertPayload).select("id").single();

  if (!insertResult.error && insertResult.data?.id) {
    return insertResult.data.id;
  }

  if (insertResult.error?.code === "23505") {
    const existingConversationId = await findExistingDirectConversationId(db, viewerId, recipientId);
    if (existingConversationId) {
      return existingConversationId;
    }
  }

  if (insertResult.error && isMissingColumnError(insertResult.error.message || "")) {
    const fallbackInsertResult = await db
      .from("conversations")
      .insert({
        kind: "direct",
        created_by: viewerId,
        metadata: { participant_count: 2 },
      })
      .select("id")
      .single();

    if (fallbackInsertResult.error || !fallbackInsertResult.data?.id) {
      throw new Error(fallbackInsertResult.error?.message || "Unable to open a direct conversation.");
    }

    return fallbackInsertResult.data.id;
  }

  throw new Error(insertResult.error?.message || "Unable to open a direct conversation.");
};

const ensureConversationParticipants = async (
  db: SupabaseClient,
  conversationId: string,
  viewerId: string,
  recipientId: string
) => {
  const { error } = await db.from("conversation_participants").upsert(
    [
      {
        conversation_id: conversationId,
        user_id: viewerId,
      },
      {
        conversation_id: conversationId,
        user_id: recipientId,
      },
    ],
    {
      onConflict: "conversation_id,user_id",
    }
  );

  if (error) {
    throw new Error(error.message);
  }
};

export const getOrCreateDirectConversationIdForUsers = async (
  db: SupabaseClient,
  viewerId: string,
  recipientId: string
) => {
  if (!viewerId || !recipientId) {
    throw new Error("Both viewerId and recipientId are required.");
  }

  if (viewerId === recipientId) {
    throw new Error("Cannot create a direct conversation with yourself.");
  }

  const rpcResult = await db.rpc("get_or_create_direct_conversation", {
    target_user_id: recipientId,
  });

  if (!rpcResult.error && typeof rpcResult.data === "string" && rpcResult.data) {
    return rpcResult.data;
  }

  if (rpcResult.error && !isMissingDirectConversationRpcError(rpcResult.error.message || "")) {
    throw new Error(rpcResult.error.message);
  }

  const existingConversationId = await findExistingDirectConversationId(db, viewerId, recipientId);
  if (existingConversationId) {
    await ensureConversationParticipants(db, existingConversationId, viewerId, recipientId);
    return existingConversationId;
  }

  const createdConversationId = await createFallbackConversationRow(db, viewerId, recipientId);
  await ensureConversationParticipants(db, createdConversationId, viewerId, recipientId);
  return createdConversationId;
};

export const __testUtils = {
  buildDirectConversationKey,
  isMissingDirectConversationRpcError,
};
