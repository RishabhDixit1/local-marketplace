export type ChatApiError = {
  ok: false;
  code: "UNAUTHORIZED" | "FORBIDDEN" | "CONFIG" | "DB" | "INVALID_PAYLOAD" | "NOT_FOUND";
  message: string;
};

export type DirectConversationResponse =
  | {
      ok: true;
      conversationId: string;
      recipientId: string;
    }
  | ChatApiError;

export type ChatMessageRecord = {
  id: string;
  conversation_id: string;
  content: string;
  sender_id: string;
  created_at: string;
};

export type SendChatMessageResponse =
  | {
      ok: true;
      message: ChatMessageRecord;
    }
  | ChatApiError;

export type LiveTalkStatus = "pending" | "accepted" | "declined" | "ended" | "cancelled";

export type LiveTalkRequestRecord = {
  id: string;
  conversation_id: string;
  caller_id: string;
  recipient_id: string;
  status: LiveTalkStatus;
  mode: "audio_video";
  created_at: string;
  updated_at: string;
  responded_at: string | null;
  metadata: Record<string, unknown> | null;
};

export type CreateLiveTalkRequest =
  | {
      ok: true;
      request: LiveTalkRequestRecord;
    }
  | ChatApiError;
