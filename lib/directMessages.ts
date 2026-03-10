import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatApiError, DirectConversationResponse, SendChatMessageResponse } from "@/lib/api/chat";
import { fetchAuthedJson } from "@/lib/clientApi";

type ConversationParticipantRow = {
  conversation_id: string | null;
};

const getChatApiErrorMessage = (payload: ChatApiError | null | undefined, fallback: string) => payload?.message || fallback;

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

  const payload = await fetchAuthedJson<DirectConversationResponse>(supabase, "/api/chat/direct", {
    method: "POST",
    body: JSON.stringify({
      recipientId,
    }),
  });

  if (!payload.ok) {
    throw new Error(getChatApiErrorMessage(payload, "Unable to create conversation."));
  }

  return payload.conversationId;
};

export const insertConversationMessage = async (
  supabase: SupabaseClient,
  params: {
    conversationId: string;
    senderId: string;
    content: string;
  }
) => {
  const { conversationId, senderId, content } = params;

  if (!conversationId || !senderId || !content.trim()) {
    throw new Error("conversationId, senderId, and content are required.");
  }

  const payload = await fetchAuthedJson<SendChatMessageResponse>(supabase, "/api/chat/messages", {
    method: "POST",
    body: JSON.stringify({
      conversationId,
      content: content.trim(),
    }),
  });

  if (!payload.ok) {
    throw new Error(getChatApiErrorMessage(payload, "Unable to send message."));
  }
};

export const sendDirectMessage = async (
  supabase: SupabaseClient,
  params: {
    viewerId: string;
    recipientId: string;
    content: string;
  }
) => {
  const { viewerId, recipientId, content } = params;
  const conversationId = await getOrCreateDirectConversationId(supabase, viewerId, recipientId);
  await insertConversationMessage(supabase, {
    conversationId,
    senderId: viewerId,
    content,
  });

  return { conversationId };
};
