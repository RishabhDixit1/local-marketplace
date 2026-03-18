"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type ParticipantRow = {
  conversation_id: string;
  last_read_at?: string | null;
};

type MessageRow = {
  conversation_id: string;
  sender_id: string;
  created_at: string;
};

const CONVERSATION_MESSAGE_SCAN_MIN = 200;
const CONVERSATION_MESSAGE_SCAN_MAX = 1000;
const CONVERSATION_MESSAGE_SCAN_PER_CHAT = 40;

const isMissingColumnError = (message: string) =>
  /column .* does not exist|could not find the '.*' column/i.test(message);

export default function useUnreadChatCount(enabled = true) {
  const [userId, setUserId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const conversationIdsRef = useRef<Set<string>>(new Set());

  const loadUnreadCount = useCallback(async () => {
    if (!enabled || !userId) {
      conversationIdsRef.current = new Set();
      setUnreadCount(0);
      return;
    }

    const participantsWithReadState = await supabase
      .from("conversation_participants")
      .select("conversation_id,last_read_at")
      .eq("user_id", userId);

    if (participantsWithReadState.error) {
      if (isMissingColumnError(participantsWithReadState.error.message)) {
        conversationIdsRef.current = new Set();
        setUnreadCount(0);
        return;
      }

      console.warn("Unable to load unread chat count:", participantsWithReadState.error.message);
      return;
    }

    const participantRows = ((participantsWithReadState.data as ParticipantRow[] | null) || []).filter(
      (row) => typeof row.conversation_id === "string" && row.conversation_id.length > 0
    );

    if (!participantRows.length) {
      conversationIdsRef.current = new Set();
      setUnreadCount(0);
      return;
    }

    const conversationIds = participantRows.map((row) => row.conversation_id);
    conversationIdsRef.current = new Set(conversationIds);

    const messageScanLimit = Math.min(
      CONVERSATION_MESSAGE_SCAN_MAX,
      Math.max(CONVERSATION_MESSAGE_SCAN_MIN, conversationIds.length * CONVERSATION_MESSAGE_SCAN_PER_CHAT)
    );

    const { data: messageRows, error: messagesError } = await supabase
      .from("messages")
      .select("conversation_id,sender_id,created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false })
      .limit(messageScanLimit);

    if (messagesError) {
      console.warn("Unable to load unread chat messages:", messagesError.message);
      return;
    }

    const lastReadAtByConversation = new Map<string, string | null>(
      participantRows.map((row) => [row.conversation_id, row.last_read_at || null])
    );

    const nextUnreadCount = ((messageRows as MessageRow[] | null) || []).reduce((count, message) => {
      if (message.sender_id === userId) return count;

      const lastReadAt = lastReadAtByConversation.get(message.conversation_id) || null;
      if (!lastReadAt) return count + 1;
      return message.created_at > lastReadAt ? count + 1 : count;
    }, 0);

    setUnreadCount(nextUnreadCount);
  }, [enabled, userId]);

  useEffect(() => {
    if (!enabled) return;

    let active = true;

    void supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        console.warn("Unable to resolve unread chat auth:", error.message);
        return;
      }
      setUserId(data.user?.id ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUserId(session?.user?.id ?? null);
      if (!session?.user) {
        setUnreadCount(0);
        conversationIdsRef.current = new Set();
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !userId) {
      conversationIdsRef.current = new Set();
      return;
    }

    const initialLoadTimer = window.setTimeout(() => {
      void loadUnreadCount();
    }, 0);

    const participantsChannel = supabase
      .channel(`dashboard-chat-unread-participants-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_participants",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void loadUnreadCount();
        }
      )
      .subscribe();

    const messagesChannel = supabase
      .channel(`dashboard-chat-unread-messages-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const conversationId =
            payload.new && typeof payload.new === "object" && "conversation_id" in payload.new
              ? String(payload.new.conversation_id || "")
              : "";

          if (!conversationId || !conversationIdsRef.current.has(conversationId)) return;
          void loadUnreadCount();
        }
      )
      .subscribe();

    return () => {
      window.clearTimeout(initialLoadTimer);
      void supabase.removeChannel(participantsChannel);
      void supabase.removeChannel(messagesChannel);
    };
  }, [enabled, loadUnreadCount, userId]);

  return unreadCount;
}
