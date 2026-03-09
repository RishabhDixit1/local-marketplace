import type { SupabaseClient } from "@supabase/supabase-js";

type ConversationParticipantRow = {
  conversation_id: string | null;
};

type ConversationInsertRow = {
  id: string;
};

const isMissingRpcError = (message: string) =>
  /function .* does not exist|could not find the function .* in the schema cache|get_or_create_direct_conversation/i.test(
    message
  );

const normalizeConversationIds = (rows: ConversationParticipantRow[] | null | undefined) =>
  (rows || [])
    .map((row) => row.conversation_id)
    .filter((conversationId): conversationId is string => typeof conversationId === "string" && conversationId.length > 0);

export const findDirectConversationId = async (
  supabase: SupabaseClient,
  viewerId: string,
  recipientId: string
): Promise<string | null> => {
  if (!viewerId || !recipientId || viewerId === recipientId) {
    return null;
  }

  const { data: viewerParticipantRows, error: viewerParticipantError } = await supabase
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

  const { data: directConversationRow, error: directConversationError } = await supabase
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

export const getOrCreateDirectConversationId = async (
  supabase: SupabaseClient,
  viewerId: string,
  recipientId: string
): Promise<string> => {
  if (!viewerId || !recipientId) {
    throw new Error("Both viewerId and recipientId are required.");
  }

  if (viewerId === recipientId) {
    throw new Error("Cannot create a direct conversation with yourself.");
  }

  const rpcResult = await supabase.rpc("get_or_create_direct_conversation", {
    target_user_id: recipientId,
  });

  if (!rpcResult.error) {
    if (typeof rpcResult.data === "string" && rpcResult.data) {
      return rpcResult.data;
    }
  } else if (!isMissingRpcError(rpcResult.error.message || "")) {
    throw new Error(rpcResult.error.message);
  }

  const existingConversationId = await findDirectConversationId(supabase, viewerId, recipientId);
  if (existingConversationId) {
    return existingConversationId;
  }

  const { data: createdConversation, error: createdConversationError } = await supabase
    .from("conversations")
    .insert({ created_by: viewerId })
    .select("id")
    .single();

  if (createdConversationError || !(createdConversation as ConversationInsertRow | null)?.id) {
    throw new Error(createdConversationError?.message || "Unable to create conversation.");
  }

  const conversationId = (createdConversation as ConversationInsertRow).id;

  const { error: participantError } = await supabase.from("conversation_participants").upsert(
    [
      { conversation_id: conversationId, user_id: viewerId },
      { conversation_id: conversationId, user_id: recipientId },
    ],
    {
      onConflict: "conversation_id,user_id",
      ignoreDuplicates: true,
    }
  );

  if (participantError) {
    throw new Error(participantError.message);
  }

  return conversationId;
};

export const insertConversationMessage = async (supabase: SupabaseClient, params: {
  conversationId: string;
  senderId: string;
  content: string;
}) => {
  const { conversationId, senderId, content } = params;

  if (!conversationId || !senderId || !content.trim()) {
    throw new Error("conversationId, senderId, and content are required.");
  }

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: senderId,
    content: content.trim(),
  });

  if (error) {
    throw new Error(error.message);
  }
};

export const sendDirectMessage = async (supabase: SupabaseClient, params: {
  viewerId: string;
  recipientId: string;
  content: string;
}) => {
  const { viewerId, recipientId, content } = params;
  const conversationId = await getOrCreateDirectConversationId(supabase, viewerId, recipientId);
  await insertConversationMessage(supabase, {
    conversationId,
    senderId: viewerId,
    content,
  });

  return { conversationId };
};
