"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { CreateLiveTalkRequest, LiveTalkRequestRecord, SendChatMessageResponse } from "@/lib/api/chat";
import { fetchAuthedJson } from "@/lib/clientApi";
import type { DashboardPromptConfig } from "@/app/components/prompt/DashboardPromptContext";
import { useDashboardPrompt } from "@/app/components/prompt/DashboardPromptContext";
import QuoteDraftEditor from "@/app/components/quotes/QuoteDraftEditor";
import RouteObservability from "@/app/components/RouteObservability";
import {
  Activity,
  ArrowLeft,
  CheckCheck,
  Loader2,
  MessageCircle,
  Receipt,
  Search,
  Send,
  Sparkles,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { resolveProfileAvatarUrl } from "@/lib/mediaUrl";
import {
  extractPresenceUserIds,
  getConversationRealtimeChannel,
  GLOBAL_PRESENCE_CHANNEL,
  type TypingEventPayload,
} from "@/lib/realtime";

type Conversation = {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  lastMessageAt: string | null;
  otherUserId: string | null;
  unreadCount: number;
  lastSenderId: string | null;
};

type Message = {
  id: string;
  conversation_id: string;
  content: string;
  sender_id: string;
  created_at: string;
};

type ParticipantRow = {
  conversation_id: string;
  user_id: string;
  last_read_at?: string | null;
};

type ProfileRow = {
  id: string;
  name: string | null;
  avatar_url: string | null;
};

type InboxFilter = "all" | "unread";
type ChannelHealth = "connecting" | "connected" | "reconnecting" | "error" | "offline";

type GroupedMessages = {
  key: string;
  label: string;
  items: Message[];
};

type FeedMessageContext = {
  cardId: string;
  focusId: string;
  itemType: "demand" | "service" | "product";
  title: string;
  audience: string;
};

type RequestedQuoteContext = {
  orderId: string | null;
  helpRequestId: string | null;
  conversationId: string | null;
};

const fallbackAvatar = "https://i.pravatar.cc/150";
const CONVERSATION_MESSAGE_SCAN_MIN = 200;
const CONVERSATION_MESSAGE_SCAN_MAX = 1000;
const CONVERSATION_MESSAGE_SCAN_PER_CHAT = 40;
const MESSAGE_HISTORY_LIMIT = 300;

const isMissingColumnError = (message: string) =>
  /column .* does not exist|could not find the '.*' column/i.test(message);

const CHANNEL_HEALTH_STYLES: Record<
  ChannelHealth,
  {
    label: string;
    badgeClassName: string;
    dotClassName: string;
  }
> = {
  connected: {
    label: "Connected",
    badgeClassName: "border-emerald-300/70 bg-emerald-50 text-emerald-700",
    dotClassName: "bg-emerald-500",
  },
  connecting: {
    label: "Connecting",
    badgeClassName: "border-amber-300/80 bg-amber-50 text-amber-700",
    dotClassName: "bg-amber-500",
  },
  reconnecting: {
    label: "Reconnecting",
    badgeClassName: "border-orange-300/80 bg-orange-50 text-orange-700",
    dotClassName: "bg-orange-500",
  },
  error: {
    label: "Error",
    badgeClassName: "border-rose-300/80 bg-rose-50 text-rose-700",
    dotClassName: "bg-rose-500",
  },
  offline: {
    label: "Idle",
    badgeClassName: "border-slate-300 bg-slate-100 text-slate-600",
    dotClassName: "bg-slate-400",
  },
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

const formatTimeAgo = (iso: string | null) => {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";

  const diffMs = Date.now() - parsed.getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

const formatDayLabel = (iso: string) => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMessageDay = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfMessageDay.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";

  return parsed.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: parsed.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
};

const mapChannelHealth = (status: string): ChannelHealth => {
  if (status === "SUBSCRIBED") return "connected";
  if (status === "TIMED_OUT") return "reconnecting";
  if (status === "CHANNEL_ERROR") return "error";
  if (status === "CLOSED") return "offline";
  return "connecting";
};

const mapLiveTalkRow = (row: Record<string, unknown> | null | undefined): LiveTalkRequestRecord | null => {
  const id = typeof row?.id === "string" ? row.id.trim() : "";
  const conversationId = typeof row?.conversation_id === "string" ? row.conversation_id.trim() : "";
  const callerId = typeof row?.caller_id === "string" ? row.caller_id.trim() : "";
  const recipientId = typeof row?.recipient_id === "string" ? row.recipient_id.trim() : "";
  const status = typeof row?.status === "string" ? row.status.trim().toLowerCase() : "pending";

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
    mode: "audio_video",
    created_at: typeof row?.created_at === "string" ? row.created_at : new Date().toISOString(),
    updated_at: typeof row?.updated_at === "string" ? row.updated_at : new Date().toISOString(),
    responded_at: typeof row?.responded_at === "string" ? row.responded_at : null,
    metadata:
      row?.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null,
  };
};

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedChatId = searchParams.get("open");
  const requestedLiveTalk = searchParams.get("liveTalk") === "1";
  const [quoteTarget, setQuoteTarget] = useState<RequestedQuoteContext | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    if (params.get("quote") !== "1") return null;

    const orderId = params.get("order");
    const helpRequestId = params.get("helpRequest");
    if (!orderId && !helpRequestId) return null;

    return {
      orderId,
      helpRequestId,
      conversationId: params.get("open"),
    };
  });
  const [feedContext] = useState<FeedMessageContext | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    if (params.get("source") !== "welcome_feed") return null;

    const cardId = params.get("context_card");
    const focusId = params.get("context_focus") || params.get("focus");
    const itemType = params.get("context_type") || params.get("type");
    const title = params.get("context_title");

    if (!cardId || !focusId || !itemType || !title) return null;
    if (!["demand", "service", "product"].includes(itemType)) return null;

    return {
      cardId,
      focusId,
      itemType: itemType as "demand" | "service" | "product",
      title,
      audience: params.get("context_audience") || "Your local network",
    };
  });
  const [feedContextDismissed, setFeedContextDismissed] = useState(false);
  const [quotePanelDismissed, setQuotePanelDismissed] = useState(false);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [input, setInput] = useState<string>(() =>
    feedContext ? `Hi, I am interested in "${feedContext.title}". Is it still available?` : ""
  );
  const [search, setSearch] = useState("");
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>("all");
  const [userId, setUserId] = useState<string>("");
  const [chatError, setChatError] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [typingUserId, setTypingUserId] = useState<string | null>(null);
  const [presenceConnection, setPresenceConnection] = useState<ChannelHealth>("connecting");
  const [typingConnection, setTypingConnection] = useState<ChannelHealth>("offline");
  const [streamConnection, setStreamConnection] = useState<ChannelHealth>("connecting");
  const [lastRealtimeEventAt, setLastRealtimeEventAt] = useState<string | null>(null);
  const [supportsReadReceipts, setSupportsReadReceipts] = useState(true);
  const [liveTalkRequest, setLiveTalkRequest] = useState<LiveTalkRequestRecord | null>(null);
  const [liveTalkBusy, setLiveTalkBusy] = useState(false);

  const selectedChatRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const localTypingRef = useRef(false);
  const stopTypingTimerRef = useRef<number | null>(null);
  const remoteTypingTimerRef = useRef<number | null>(null);
  const autoRequestedLiveTalkRef = useRef(false);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedChat) || null,
    [conversations, selectedChat]
  );

  const activeFeedContext = feedContextDismissed ? null : feedContext;
  const activeQuoteTarget =
    quoteTarget && (!quoteTarget.conversationId || quoteTarget.conversationId === selectedChat) ? quoteTarget : null;
  const showQuotePanel = Boolean(activeQuoteTarget) && !quotePanelDismissed;

  const feedContextPath = useMemo(() => {
    if (!activeFeedContext) return null;
    const params = new URLSearchParams({
      source: "welcome_feed",
      context_card: activeFeedContext.cardId,
      focus: activeFeedContext.focusId,
      type: activeFeedContext.itemType,
    });
    return `/dashboard?${params.toString()}`;
  }, [activeFeedContext]);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (quoteTarget) {
      params.set("quote", "1");
      if (quoteTarget.orderId) params.set("order", quoteTarget.orderId);
      else params.delete("order");
      if (quoteTarget.helpRequestId) params.set("helpRequest", quoteTarget.helpRequestId);
      else params.delete("helpRequest");
      if (quoteTarget.conversationId) params.set("open", quoteTarget.conversationId);
    } else {
      params.delete("quote");
      params.delete("order");
      params.delete("helpRequest");
    }

    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [quoteTarget]);

  const sendTypingEvent = useCallback(
    (isTyping: boolean) => {
      const conversationId = selectedChatRef.current;
      if (!conversationId || !userId || !typingChannelRef.current) return;

      void typingChannelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: {
          conversation_id: conversationId,
          user_id: userId,
          is_typing: isTyping,
          sent_at: new Date().toISOString(),
        } satisfies TypingEventPayload,
      });
    },
    [userId]
  );

  const loadConversations = useCallback(
    async (soft = false) => {
      if (!userId) return;
      if (!soft) setLoadingConversations(true);

      let hasReadReceiptColumn = true;
      let myParticipantRows: ParticipantRow[] = [];

      const participantsWithReadState = await supabase
        .from("conversation_participants")
        .select("conversation_id,user_id,last_read_at")
        .eq("user_id", userId);

      if (participantsWithReadState.error) {
        if (isMissingColumnError(participantsWithReadState.error.message)) {
          hasReadReceiptColumn = false;
          const participantsFallback = await supabase
            .from("conversation_participants")
            .select("conversation_id,user_id")
            .eq("user_id", userId);

          if (participantsFallback.error) {
            setChatError(`Failed to load conversation participants: ${participantsFallback.error.message}`);
            setConversations([]);
            setLoadingConversations(false);
            return;
          }

          myParticipantRows = (((participantsFallback.data as ParticipantRow[] | null) || []).map((row) => ({
            ...row,
            last_read_at: null,
          })));
        } else {
          setChatError(`Failed to load conversation participants: ${participantsWithReadState.error.message}`);
          setConversations([]);
          setLoadingConversations(false);
          return;
        }
      } else {
        myParticipantRows = (participantsWithReadState.data as ParticipantRow[] | null) || [];
      }

      setSupportsReadReceipts(hasReadReceiptColumn);

      if (!myParticipantRows?.length) {
        setConversations([]);
        setLoadingConversations(false);
        setChatError(null);
        return;
      }

      const conversationIds = myParticipantRows.map((row) => row.conversation_id);
      const messageScanLimit = Math.min(
        CONVERSATION_MESSAGE_SCAN_MAX,
        Math.max(CONVERSATION_MESSAGE_SCAN_MIN, conversationIds.length * CONVERSATION_MESSAGE_SCAN_PER_CHAT)
      );

      const [{ data: allParticipantRows, error: allParticipantsError }, { data: messageRows, error: messagesError }] =
        await Promise.all([
          supabase
            .from("conversation_participants")
            .select("conversation_id,user_id")
            .in("conversation_id", conversationIds),
          supabase
            .from("messages")
            .select("id,conversation_id,content,created_at,sender_id")
            .in("conversation_id", conversationIds)
            .order("created_at", { ascending: false })
            .limit(messageScanLimit),
        ]);

      if (allParticipantsError) {
        setChatError(`Failed to load participants for conversations: ${allParticipantsError.message}`);
        setConversations([]);
        setLoadingConversations(false);
        return;
      }

      if (messagesError) {
        setChatError(`Failed to load messages: ${messagesError.message}`);
        setConversations([]);
        setLoadingConversations(false);
        return;
      }

      const participantRows = (allParticipantRows as ParticipantRow[] | null) || [];
      const myRows = (myParticipantRows as ParticipantRow[] | null) || [];
      const lastReadAtByConversation = new Map<string, string | null>(
        myRows.map((row) => [row.conversation_id, row.last_read_at || null])
      );
      const uniqueUserIds = Array.from(new Set(participantRows.map((row) => row.user_id)));

      const { data: profileRows, error: profilesError } = await supabase
        .from("profiles")
        .select("id,name,avatar_url")
        .in("id", uniqueUserIds);

      if (profilesError) {
        setChatError(`Failed to load user profiles: ${profilesError.message}`);
        setConversations([]);
        setLoadingConversations(false);
        return;
      }

      const profilesById = new Map(((profileRows as ProfileRow[] | null) || []).map((profile) => [profile.id, profile]));

      const normalizedMessages = (messageRows as Message[] | null) || [];
      const messagesByConversation = new Map<string, Message[]>();
      const lastMessageByConversation = new Map<string, Message>();

      normalizedMessages.forEach((message) => {
        if (!messagesByConversation.has(message.conversation_id)) {
          messagesByConversation.set(message.conversation_id, []);
        }
        messagesByConversation.get(message.conversation_id)?.push(message);
        if (!lastMessageByConversation.has(message.conversation_id)) {
          lastMessageByConversation.set(message.conversation_id, message);
        }
      });

      const nextConversations: Conversation[] = conversationIds.map((conversationId) => {
        const users = participantRows.filter((row) => row.conversation_id === conversationId);
        const otherUser = users.find((row) => row.user_id !== userId) || null;
        const profile = otherUser ? profilesById.get(otherUser.user_id) : null;
        const lastMessage = lastMessageByConversation.get(conversationId);
        const lastReadAt = lastReadAtByConversation.get(conversationId) || null;
        const conversationMessages = messagesByConversation.get(conversationId) || [];
        const unreadCount = hasReadReceiptColumn
          ? conversationMessages.reduce((count, message) => {
              if (message.sender_id === userId) return count;
              if (!lastReadAt) return count + 1;
              return message.created_at > lastReadAt ? count + 1 : count;
            }, 0)
          : 0;

        return {
          id: conversationId,
          name: profile?.name || "User",
          avatar: resolveProfileAvatarUrl(profile?.avatar_url) || fallbackAvatar,
          lastMessage: lastMessage?.content || "Start chat",
          lastMessageAt: lastMessage?.created_at || null,
          otherUserId: otherUser?.user_id || null,
          unreadCount: selectedChatRef.current === conversationId ? 0 : unreadCount,
          lastSenderId: lastMessage?.sender_id || null,
        };
      });

      nextConversations.sort((a, b) => {
        if (!a.lastMessageAt) return 1;
        if (!b.lastMessageAt) return -1;
        return b.lastMessageAt.localeCompare(a.lastMessageAt);
      });

      setConversations(nextConversations);
      setSelectedChat((previousChat) => {
        // Query-driven chat targets should win when a route change asks for a specific conversation.
        if (requestedChatId && nextConversations.some((conversation) => conversation.id === requestedChatId)) {
          return requestedChatId;
        }

        if (previousChat && nextConversations.some((conversation) => conversation.id === previousChat)) {
          return previousChat;
        }

        return nextConversations[0]?.id || null;
      });

      setLoadingConversations(false);
      setChatError(null);
    },
    [requestedChatId, userId]
  );

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true);

    const { data, error } = await supabase
      .from("messages")
      .select("id,conversation_id,content,sender_id,created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(MESSAGE_HISTORY_LIMIT);

    if (error) {
      setChatError(`Failed to load chat messages: ${error.message}`);
      setMessages([]);
      setLoadingMessages(false);
      return;
    }

    const normalized = ((data as Message[] | null) || []).slice().reverse();
    setMessages(normalized);
    setLoadingMessages(false);
  }, []);

  const markConversationAsRead = useCallback(
    async (conversationId: string, readAt?: string) => {
      if (!userId || !conversationId) return;
      if (!supportsReadReceipts) {
        setConversations((previous) =>
          previous.map((conversation) =>
            conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation
          )
        );
        return;
      }
      const timestamp = readAt || new Date().toISOString();

      const { error } = await supabase
        .from("conversation_participants")
        .update({ last_read_at: timestamp })
        .eq("conversation_id", conversationId)
        .eq("user_id", userId);

      if (error) {
        if (isMissingColumnError(error.message)) {
          setSupportsReadReceipts(false);
        } else {
          console.warn("Failed to persist read state:", error.message);
        }
      }

      setConversations((previous) =>
        previous.map((conversation) =>
          conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation
        )
      );
    },
    [supportsReadReceipts, userId]
  );

  const loadLiveTalkRequest = useCallback(async (conversationId: string) => {
    if (!conversationId) {
      setLiveTalkRequest(null);
      return;
    }

    const { data, error } = await supabase
      .from("live_talk_requests")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (!isMissingColumnError(error.message)) {
        console.warn("Failed to load live talk state:", error.message);
      }
      setLiveTalkRequest(null);
      return;
    }

    setLiveTalkRequest(mapLiveTalkRow((data as Record<string, unknown> | null) || null));
  }, []);

  const startLiveTalk = useCallback(
    async (conversationIdOverride?: string) => {
      const conversationId = conversationIdOverride || selectedChat;
      if (!conversationId) return;

      setLiveTalkBusy(true);
      setChatError(null);

      try {
        const payload = await fetchAuthedJson<CreateLiveTalkRequest>(supabase, "/api/live-talk", {
          method: "POST",
          body: JSON.stringify({
            conversationId,
          }),
        });

        if (!payload.ok) {
          throw new Error(payload.message || "Unable to start Live Talk.");
        }

        setLiveTalkRequest(payload.request);
      } catch (error) {
        setChatError(error instanceof Error ? error.message : "Unable to start Live Talk.");
      } finally {
        setLiveTalkBusy(false);
      }
    },
    [selectedChat]
  );

  const updateLiveTalk = useCallback(async (requestId: string, status: "accepted" | "declined" | "ended" | "cancelled") => {
    setLiveTalkBusy(true);
    setChatError(null);

    try {
      const payload = await fetchAuthedJson<CreateLiveTalkRequest>(supabase, "/api/live-talk", {
        method: "PATCH",
        body: JSON.stringify({
          requestId,
          status,
        }),
      });

      if (!payload.ok) {
        throw new Error(payload.message || "Unable to update Live Talk.");
      }

      setLiveTalkRequest(payload.request);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Unable to update Live Talk.");
    } finally {
      setLiveTalkBusy(false);
    }
  }, []);

  useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        setChatError(`Auth error: ${error.message}`);
        setLoadingConversations(false);
        return;
      }
      if (!data.user) {
        setChatError("You are not logged in.");
        setLoadingConversations(false);
        return;
      }
      setUserId(data.user.id);
    };

    void getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || "");
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) return;

    let isCancelled = false;
    void loadConversations().catch(() => {
      if (!isCancelled) {
        setLoadingConversations(false);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [loadConversations, userId]);

  useEffect(() => {
    if (!userId) return;

    const presenceChannel = supabase.channel(GLOBAL_PRESENCE_CHANNEL, {
      config: {
        presence: {
          key: userId,
        },
      },
    });
    presenceChannelRef.current = presenceChannel;

    const syncOnlineUsers = () => {
      setOnlineUserIds(extractPresenceUserIds(presenceChannel.presenceState()));
    };

    presenceChannel
      .on("presence", { event: "sync" }, syncOnlineUsers)
      .on("presence", { event: "join" }, syncOnlineUsers)
      .on("presence", { event: "leave" }, syncOnlineUsers)
      .subscribe(async (status) => {
        setPresenceConnection(mapChannelHealth(status));
        if (status !== "SUBSCRIBED") return;
        await presenceChannel.track({
          user_id: userId,
          last_seen_at: new Date().toISOString(),
          page: "chat",
        });
      });

    const heartbeatTimer = window.setInterval(() => {
      void presenceChannel.track({
        user_id: userId,
        last_seen_at: new Date().toISOString(),
        page: "chat",
      });
    }, 30000);

    return () => {
      window.clearInterval(heartbeatTimer);
      if (presenceChannelRef.current) {
        void presenceChannelRef.current.untrack();
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
      setOnlineUserIds(new Set());
      setPresenceConnection("offline");
    };
  }, [userId]);

  useEffect(() => {
    if (!selectedChat) return;

    void loadMessages(selectedChat);
    void markConversationAsRead(selectedChat);
    void loadLiveTalkRequest(selectedChat);
  }, [loadLiveTalkRequest, loadMessages, markConversationAsRead, selectedChat]);

  useEffect(() => {
    if (!selectedChat) {
      setLiveTalkRequest(null);
      return;
    }

    const liveTalkChannel = supabase
      .channel(`live-talk-${selectedChat}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_talk_requests",
          filter: `conversation_id=eq.${selectedChat}`,
        },
        (payload) => {
          setLastRealtimeEventAt(new Date().toISOString());
          const nextRow = mapLiveTalkRow((payload.new as Record<string, unknown> | undefined) || null);
          if (payload.eventType === "DELETE") {
            setLiveTalkRequest(null);
            return;
          }
          setLiveTalkRequest(nextRow);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(liveTalkChannel);
    };
  }, [selectedChat]);

  useEffect(() => {
    if (!requestedLiveTalk || !selectedChat || autoRequestedLiveTalkRef.current) return;
    autoRequestedLiveTalkRef.current = true;
    void startLiveTalk(selectedChat);
  }, [requestedLiveTalk, selectedChat, startLiveTalk]);

  useEffect(() => {
    if (!selectedChat || !userId) return;

    const typingChannel = supabase.channel(getConversationRealtimeChannel(selectedChat), {
      config: {
        presence: {
          key: userId,
        },
      },
    });
    typingChannelRef.current = typingChannel;

    typingChannel
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const eventPayload = payload as TypingEventPayload;
        if (eventPayload.conversation_id !== selectedChat) return;
        if (eventPayload.user_id === userId) return;

        setLastRealtimeEventAt(eventPayload.sent_at || new Date().toISOString());

        if (!eventPayload.is_typing) {
          setTypingUserId((current) => (current === eventPayload.user_id ? null : current));
          return;
        }

        setTypingUserId(eventPayload.user_id);
        if (remoteTypingTimerRef.current) {
          window.clearTimeout(remoteTypingTimerRef.current);
        }
        remoteTypingTimerRef.current = window.setTimeout(() => {
          setTypingUserId(null);
        }, 2200);
      })
      .subscribe(async (status) => {
        setTypingConnection(mapChannelHealth(status));
        if (status !== "SUBSCRIBED") return;
        await typingChannel.track({
          user_id: userId,
          conversation_id: selectedChat,
          last_seen_at: new Date().toISOString(),
        });
      });

    return () => {
      if (remoteTypingTimerRef.current) {
        window.clearTimeout(remoteTypingTimerRef.current);
        remoteTypingTimerRef.current = null;
      }
      if (stopTypingTimerRef.current) {
        window.clearTimeout(stopTypingTimerRef.current);
        stopTypingTimerRef.current = null;
      }
      localTypingRef.current = false;
      setTypingUserId(null);

      if (typingChannelRef.current) {
        void typingChannelRef.current.untrack();
        supabase.removeChannel(typingChannelRef.current);
        typingChannelRef.current = null;
      }
      setTypingConnection("offline");
    };
  }, [selectedChat, userId]);

  useEffect(() => {
    if (!userId) return;

    const realtimeChannel = supabase
      .channel(`chat-live-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const newMessage = payload.new as Message;
          const isCurrentConversation = selectedChatRef.current === newMessage.conversation_id;

          setLastRealtimeEventAt(newMessage.created_at || new Date().toISOString());

          setConversations((previousConversations) => {
            const conversationExists = previousConversations.some(
              (conversation) => conversation.id === newMessage.conversation_id
            );

            if (!conversationExists) {
              void loadConversations(true);
              return previousConversations;
            }

            const updated = previousConversations.map((conversation) => {
              if (conversation.id !== newMessage.conversation_id) return conversation;
              const unreadIncrement =
                supportsReadReceipts && newMessage.sender_id !== userId && !isCurrentConversation
                  ? conversation.unreadCount + 1
                  : 0;

              return {
                ...conversation,
                lastMessage: newMessage.content,
                lastMessageAt: newMessage.created_at,
                lastSenderId: newMessage.sender_id,
                unreadCount: unreadIncrement,
              };
            });

            updated.sort((a, b) => {
              if (!a.lastMessageAt) return 1;
              if (!b.lastMessageAt) return -1;
              return b.lastMessageAt.localeCompare(a.lastMessageAt);
            });

            return updated;
          });

          if (isCurrentConversation) {
            setMessages((previousMessages) => {
              if (previousMessages.some((message) => message.id === newMessage.id)) {
                return previousMessages;
              }
              return [...previousMessages, newMessage];
            });

            if (newMessage.sender_id !== userId) {
              void markConversationAsRead(newMessage.conversation_id, newMessage.created_at);
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_participants",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          setLastRealtimeEventAt(new Date().toISOString());
          void loadConversations(true);
        }
      )
      .subscribe((status) => {
        setStreamConnection(mapChannelHealth(status));
      });

    return () => {
      supabase.removeChannel(realtimeChannel);
      setStreamConnection("offline");
    };
  }, [loadConversations, markConversationAsRead, supportsReadReceipts, userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUserId]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || !selectedChat || sending || !userId) return;

    if (localTypingRef.current) {
      sendTypingEvent(false);
      localTypingRef.current = false;
    }
    if (stopTypingTimerRef.current) {
      window.clearTimeout(stopTypingTimerRef.current);
      stopTypingTimerRef.current = null;
    }

    setSending(true);
    setChatError(null);

    const optimisticId = `local-${Date.now()}`;
    const optimisticMessage: Message = {
      id: optimisticId,
      conversation_id: selectedChat,
      content: trimmed,
      sender_id: userId,
      created_at: new Date().toISOString(),
    };

    setMessages((previous) => [...previous, optimisticMessage]);
    setInput("");
    if (messageInputRef.current) {
      messageInputRef.current.style.height = "44px";
    }

    let insertedMessage: Message | null = null;

    try {
      const payload = await fetchAuthedJson<SendChatMessageResponse>(supabase, "/api/chat/messages", {
        method: "POST",
        body: JSON.stringify({
          conversationId: selectedChat,
          content: trimmed,
        }),
      });

      if (!payload.ok) {
        throw new Error(payload.message || "Unable to send message.");
      }

      insertedMessage = payload.message as Message;
    } catch (error) {
      setMessages((previous) => previous.filter((message) => message.id !== optimisticId));
      setInput(trimmed);
      setChatError(`Failed to send message: ${error instanceof Error ? error.message : "unknown error"}`);
      setSending(false);
      return;
    }

    setLastRealtimeEventAt(insertedMessage?.created_at || new Date().toISOString());

    setMessages((previous) => {
      const withoutOptimistic = previous.filter((message) => message.id !== optimisticId);
      const normalized = insertedMessage as Message;
      if (withoutOptimistic.some((message) => message.id === normalized.id)) {
        return withoutOptimistic;
      }
      return [...withoutOptimistic, normalized];
    });

    setConversations((previousConversations) => {
      const updated = previousConversations.map((conversation) =>
        conversation.id === selectedChat
          ? {
              ...conversation,
              lastMessage: trimmed,
              lastMessageAt: insertedMessage?.created_at,
              lastSenderId: userId,
              unreadCount: 0,
            }
          : conversation
      );

      updated.sort((a, b) => {
        if (!a.lastMessageAt) return 1;
        if (!b.lastMessageAt) return -1;
        return b.lastMessageAt.localeCompare(a.lastMessageAt);
      });

      return updated;
    });

    setSending(false);
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    if (!selectedChatRef.current || !userId) return;

    const hasContent = value.trim().length > 0;
    if (hasContent && !localTypingRef.current) {
      localTypingRef.current = true;
      sendTypingEvent(true);
    }

    if (!hasContent && localTypingRef.current) {
      localTypingRef.current = false;
      sendTypingEvent(false);
    }

    if (stopTypingTimerRef.current) {
      window.clearTimeout(stopTypingTimerRef.current);
    }

    stopTypingTimerRef.current = window.setTimeout(() => {
      if (!localTypingRef.current) return;
      localTypingRef.current = false;
      sendTypingEvent(false);
    }, 1400);
  };

  const filteredConversations = useMemo(() => {
    const normalizedSearch = search.toLowerCase();

    return conversations.filter((conversation) => {
      const matchesQuery =
        conversation.name.toLowerCase().includes(normalizedSearch) ||
        conversation.lastMessage.toLowerCase().includes(normalizedSearch);

      if (!matchesQuery) return false;
      if (inboxFilter === "unread") return conversation.unreadCount > 0;
      return true;
    });
  }, [conversations, inboxFilter, search]);

  const handleChatPromptSubmit = useCallback(() => {
    if (filteredConversations[0]) {
      setSelectedChat(filteredConversations[0].id);
      return;
    }

    if (search.trim()) {
      setInboxFilter("all");
    }
  }, [filteredConversations, search]);

  const chatPromptConfig = useMemo<DashboardPromptConfig>(
    () => ({
      placeholder: "Search chats by member name or message keyword",
      value: search,
      onValueChange: setSearch,
      onSubmit: handleChatPromptSubmit,
      actions: [
        {
          id: "refresh-chat",
          label: loadingConversations ? "Refreshing..." : "Refresh",
          icon: Loader2,
          onClick: () => {
            void loadConversations(true);
          },
          variant: "secondary",
          disabled: loadingConversations || !userId,
          busy: loadingConversations,
        },
      ],
    }),
    [handleChatPromptSubmit, loadConversations, loadingConversations, search, userId]
  );

  useDashboardPrompt(chatPromptConfig);

  const groupedMessages = useMemo<GroupedMessages[]>(() => {
    const groups: GroupedMessages[] = [];

    messages.forEach((message) => {
      const key = message.created_at.slice(0, 10);
      const latestGroup = groups[groups.length - 1];

      if (!latestGroup || latestGroup.key !== key) {
        groups.push({
          key,
          label: formatDayLabel(message.created_at),
          items: [message],
        });
        return;
      }

      latestGroup.items.push(message);
    });

    return groups;
  }, [messages]);

  const totalUnread = useMemo(
    () => conversations.reduce((total, conversation) => total + conversation.unreadCount, 0),
    [conversations]
  );

  const onlineContacts = useMemo(
    () => conversations.filter((conversation) => conversation.otherUserId && onlineUserIds.has(conversation.otherUserId)).length,
    [conversations, onlineUserIds]
  );

  const selectedUserOnline =
    selectedConversation?.otherUserId ? onlineUserIds.has(selectedConversation.otherUserId) : false;

  const selectedUserTyping =
    Boolean(typingUserId) &&
    Boolean(selectedConversation?.otherUserId) &&
    typingUserId === selectedConversation?.otherUserId;

  const connectedChannels = useMemo(() => {
    const channels = [presenceConnection, streamConnection, typingConnection];
    return channels.filter((status) => status === "connected").length;
  }, [presenceConnection, streamConnection, typingConnection]);

  const realtimeBadge = connectedChannels >= 2 ? "Realtime healthy" : "Realtime recovering";
  const lastRealtimeLabel = lastRealtimeEventAt
    ? `Last event ${formatTimeAgo(lastRealtimeEventAt)} ago`
    : "Awaiting first live event";
  const liveTalkRole =
    liveTalkRequest && userId
      ? liveTalkRequest.caller_id === userId
        ? "caller"
        : liveTalkRequest.recipient_id === userId
        ? "recipient"
        : null
      : null;
  const liveTalkStatusLabel =
    liveTalkRequest?.status === "accepted"
      ? "Live Talk accepted"
      : liveTalkRequest?.status === "declined"
      ? "Live Talk declined"
      : liveTalkRequest?.status === "ended"
      ? "Live Talk ended"
      : liveTalkRequest?.status === "cancelled"
      ? "Live Talk cancelled"
      : liveTalkRequest
      ? "Live Talk requested"
      : null;

  return (
    <div className="relative h-[calc(100dvh-7.5rem)] overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_20px_70px_-45px_rgba(15,23,42,0.65)]">
      <RouteObservability route="chat" />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-20 -top-16 h-56 w-56 rounded-full bg-indigo-200/35 blur-3xl" />
        <div className="absolute -left-16 bottom-0 h-72 w-72 rounded-full bg-sky-200/30 blur-3xl" />
      </div>

      <div className="relative flex h-full">
        <aside
          className={`w-full border-r border-slate-200/80 bg-white/90 backdrop-blur-xl md:w-[23rem] lg:w-[25rem] ${
            selectedChat ? "hidden md:flex" : "flex"
          } flex-col`}
        >
          <div className="border-b border-slate-200/80 px-5 pb-5 pt-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Local Inbox</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">Messages</h2>
                <p className="mt-1 text-xs text-slate-500">Hyperlocal chats with live sync, unread state, and presence.</p>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                  connectedChannels >= 2
                    ? "border-emerald-300/70 bg-emerald-50 text-emerald-700"
                    : "border-amber-300/80 bg-amber-50 text-amber-700"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {realtimeBadge}
              </span>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2.5">
              <Search size={16} className="text-slate-500" />
              <input
                placeholder="Search people or messages"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setInboxFilter("all")}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  inboxFilter === "all"
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                All Chats ({conversations.length})
              </button>
              <button
                type="button"
                onClick={() => setInboxFilter("unread")}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  inboxFilter === "unread"
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                Unread ({totalUnread})
              </button>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-slate-200 bg-white px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Chats</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{conversations.length}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Online</p>
                <p className="mt-1 text-sm font-semibold text-emerald-600">{onlineContacts}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Unread</p>
                <p className="mt-1 text-sm font-semibold text-indigo-600">{totalUnread}</p>
              </div>
            </div>
          </div>

          {chatError && (
            <div className="mx-4 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {chatError}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-3">
            {loadingConversations && (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
                    <div className="mt-2 h-3 w-full animate-pulse rounded bg-slate-100" />
                  </div>
                ))}
              </div>
            )}

            {!loadingConversations && filteredConversations.length === 0 && (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                  <Users className="h-3.5 w-3.5" />
                  Inbox is empty for now
                </div>
                <p className="text-sm text-slate-700">Start a conversation from posts or people and it will appear here instantly.</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => router.push("/dashboard")}
                    className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
                  >
                    Explore Posts
                  </button>
                  <button
                    onClick={() => router.push("/dashboard/people")}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Browse People
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              {filteredConversations.map((chat) => {
                const isSelected = selectedChat === chat.id;
                const isOnline = chat.otherUserId ? onlineUserIds.has(chat.otherUserId) : false;
                const isFromMe = chat.lastSenderId === userId;

                return (
                  <button
                    type="button"
                    key={chat.id}
                    onClick={() => setSelectedChat(chat.id)}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition-all duration-200 ${
                      isSelected
                        ? "border-indigo-300 bg-gradient-to-r from-indigo-50 via-sky-50 to-white shadow-sm"
                        : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative shrink-0">
                        <Image
                          src={chat.avatar}
                          alt={`${chat.name} avatar`}
                          width={44}
                          height={44}
                          unoptimized
                          className="h-11 w-11 rounded-full border border-slate-200 object-cover"
                        />
                        <span
                          className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white ${
                            isOnline ? "bg-emerald-500" : "bg-slate-300"
                          }`}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-slate-900">{chat.name}</p>
                          <p className="shrink-0 text-[11px] text-slate-500">{formatTimeAgo(chat.lastMessageAt)}</p>
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-600">
                          {isFromMe ? "You: " : ""}
                          {chat.lastMessage}
                        </p>
                      </div>

                      {chat.unreadCount > 0 && (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-semibold text-white">
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <section className={`flex-1 flex-col ${selectedChat ? "flex" : "hidden md:flex"}`}>
          {activeFeedContext && (
            <div className="border-b border-indigo-200/70 bg-indigo-50/70 px-4 py-3 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-700">From Live Feed</p>
                  <p className="truncate text-sm font-semibold text-slate-900">{activeFeedContext.title}</p>
                  <p className="truncate text-xs text-slate-600">{activeFeedContext.audience}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!feedContextPath) return;
                      router.push(feedContextPath);
                    }}
                    className="rounded-lg border border-indigo-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                  >
                    Open post
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedContextDismissed(true)}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                  >
                    Hide
                  </button>
                </div>
              </div>
            </div>
          )}

          {!selectedChat ? (
            <div className="relative flex h-full items-center justify-center overflow-y-auto p-6 md:p-10">
              <div className="w-full max-w-3xl rounded-3xl border border-slate-200/80 bg-white/85 p-6 shadow-sm backdrop-blur-xl md:p-8">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                    <Activity className="h-3.5 w-3.5" />
                    Live Messaging Hub
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    <MessageCircle className="h-3.5 w-3.5" />
                    {lastRealtimeLabel}
                  </span>
                </div>

                <h3 className="mt-4 text-2xl font-semibold text-slate-900">Select a conversation to launch the realtime workspace.</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Presence, unread counters, and typing indicators are already wired. Open a chat to start sending instantly.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Conversations</p>
                    <p className="mt-1 text-xl font-semibold text-slate-900">{conversations.length}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Unread</p>
                    <p className="mt-1 text-xl font-semibold text-indigo-600">{totalUnread}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Channels Up</p>
                    <p className="mt-1 text-xl font-semibold text-emerald-600">{connectedChannels}/3</p>
                  </div>
                </div>

                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  {conversations.slice(0, 4).map((conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => setSelectedChat(conversation.id)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40"
                    >
                      <p className="truncate text-sm font-semibold text-slate-900">{conversation.name}</p>
                      <p className="mt-1 truncate text-xs text-slate-600">{conversation.lastMessage}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              <header className="border-b border-slate-200/80 bg-white/90 px-4 py-4 backdrop-blur-xl sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedChat(null)}
                      className="rounded-xl border border-slate-300 bg-white p-2 text-slate-600 transition hover:bg-slate-50 md:hidden"
                    >
                      <ArrowLeft size={18} />
                    </button>

                    {selectedConversation && (
                      <>
                        <div className="relative">
                          <Image
                            src={selectedConversation.avatar}
                            alt={`${selectedConversation.name} avatar`}
                            width={42}
                            height={42}
                            unoptimized
                            className="h-11 w-11 rounded-full border border-slate-200 object-cover"
                          />
                          <span
                            className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white ${
                              selectedUserOnline ? "bg-emerald-500" : "bg-slate-300"
                            }`}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{selectedConversation.name}</p>
                          <p
                            className={`text-xs ${
                              selectedUserTyping
                                ? "text-indigo-600"
                                : selectedUserOnline
                                ? "text-emerald-600"
                                : "text-slate-500"
                            }`}
                          >
                            {selectedUserTyping ? "Typing now..." : selectedUserOnline ? "Online now" : "Offline"}
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                          if (activeQuoteTarget) {
                            setQuotePanelDismissed((current) => !current);
                          } else {
                            setQuoteTarget({ orderId: null, helpRequestId: null, conversationId: selectedChat });
                            setQuotePanelDismissed(false);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-sky-300 bg-sky-50 px-3 py-1.5 text-[11px] font-semibold text-sky-700 transition hover:bg-sky-100"
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        {showQuotePanel ? "Hide Quote" : "Send Quote"}
                      </button>
                    {selectedConversation?.otherUserId && (
                      <button
                        type="button"
                        onClick={() => void startLiveTalk()}
                        disabled={liveTalkBusy}
                        className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300 bg-cyan-50 px-3 py-1.5 text-[11px] font-semibold text-cyan-700 transition hover:bg-cyan-100 disabled:opacity-70"
                      >
                        {liveTalkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        {liveTalkRequest?.status === "pending" ? "Live Talk pending" : "Start Live Talk"}
                      </button>
                    )}
                    {[
                      { label: "Presence", state: presenceConnection },
                      { label: "Messages", state: streamConnection },
                      { label: "Typing", state: typingConnection },
                    ].map((channel) => {
                      const style = CHANNEL_HEALTH_STYLES[channel.state];
                      return (
                        <span
                          key={channel.label}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${style.badgeClassName}`}
                        >
                          <span className={`h-2 w-2 rounded-full ${style.dotClassName}`} />
                          {channel.label}: {style.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </header>

              <div className="relative flex-1 overflow-y-auto bg-slate-50/65 px-4 py-5 sm:px-6">
                {activeQuoteTarget && showQuotePanel && (
                  <div className="mb-4">
                    <QuoteDraftEditor
                      orderId={activeQuoteTarget.orderId}
                      helpRequestId={activeQuoteTarget.helpRequestId}
                      conversationId={selectedChat}
                      surface="chat"
                      onSaved={() => {
                        setChatError(null);
                      }}
                      onSent={(result) => {
                        setQuotePanelDismissed(false);
                        setQuoteTarget((current) =>
                          current
                            ? {
                                ...current,
                                orderId: result.orderId,
                                helpRequestId: null,
                                conversationId: result.conversationId || current.conversationId || selectedChat,
                              }
                            : current
                        );
                        if (selectedChat) {
                          void loadMessages(selectedChat);
                        }
                      }}
                    />
                  </div>
                )}

                {liveTalkRequest && (
                  <div className="mb-4 rounded-2xl border border-cyan-200 bg-cyan-50/90 p-4 text-sm text-slate-700 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">Live Talk</p>
                        <p className="mt-1 font-semibold text-slate-900">{liveTalkStatusLabel}</p>
                        <p className="mt-1 text-xs text-slate-600">
                          {liveTalkRequest.status === "pending"
                            ? liveTalkRole === "recipient"
                              ? "This member wants to launch the live audio/video workspace for this chat."
                              : "Your live audio/video request is pending. Keep using chat while the other member responds."
                            : liveTalkRequest.status === "accepted"
                            ? "Realtime chat is active now. This placeholder is ready for WebRTC media wiring in the next pass."
                            : liveTalkRequest.status === "declined"
                            ? "The request was declined. You can keep coordinating in chat and retry later."
                            : "This Live Talk session is no longer active."}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {liveTalkRequest.status === "pending" && liveTalkRole === "recipient" && (
                          <>
                            <button
                              type="button"
                              onClick={() => void updateLiveTalk(liveTalkRequest.id, "accepted")}
                              disabled={liveTalkBusy}
                              className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-70"
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              onClick={() => void updateLiveTalk(liveTalkRequest.id, "declined")}
                              disabled={liveTalkBusy}
                              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-70"
                            >
                              Decline
                            </button>
                          </>
                        )}
                        {liveTalkRequest.status === "pending" && liveTalkRole === "caller" && (
                          <button
                            type="button"
                            onClick={() => void updateLiveTalk(liveTalkRequest.id, "cancelled")}
                            disabled={liveTalkBusy}
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-70"
                          >
                            Cancel request
                          </button>
                        )}
                        {liveTalkRequest.status === "accepted" && (
                          <button
                            type="button"
                            onClick={() => void updateLiveTalk(liveTalkRequest.id, "ended")}
                            disabled={liveTalkBusy}
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-70"
                          >
                            End session
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {loadingMessages ? (
                  <p className="inline-flex items-center gap-2 text-sm text-slate-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading conversation...
                  </p>
                ) : messages.length === 0 ? (
                  <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
                    <p className="font-semibold text-slate-800">No messages yet</p>
                    <p className="mt-1">Send the first message to start this conversation.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {groupedMessages.map((group) => (
                      <div key={group.key} className="space-y-3">
                        <div className="flex justify-center">
                          <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">
                            {group.label}
                          </span>
                        </div>

                        {group.items.map((message) => {
                          const mine = message.sender_id === userId;
                          const optimistic = message.id.startsWith("local-");
                          return (
                            <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                              <div
                                className={`max-w-[84%] rounded-2xl px-4 py-2.5 text-sm shadow-sm sm:max-w-[75%] ${
                                  mine
                                    ? "rounded-br-md bg-gradient-to-r from-indigo-600 to-blue-500 text-white"
                                    : "rounded-bl-md border border-slate-200 bg-white text-slate-800"
                                }`}
                              >
                                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                                <p
                                  className={`mt-1 inline-flex items-center gap-1 text-[10px] ${
                                    mine ? "text-indigo-100" : "text-slate-400"
                                  }`}
                                >
                                  {formatTime(message.created_at)}
                                  {mine && optimistic && <Loader2 className="h-3 w-3 animate-spin" />}
                                  {mine && !optimistic && <CheckCheck className="h-3.5 w-3.5" />}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}

                    {selectedUserTyping && selectedConversation && (
                      <div className="flex justify-start">
                        <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
                          {selectedConversation.name} is typing...
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              <footer className="border-t border-slate-200/80 bg-white px-4 pb-[env(safe-area-inset-bottom,0px)] pt-4 sm:px-6">
                <div className="rounded-2xl border border-slate-300 bg-slate-50 p-2">
                  <div className="flex items-end gap-2">
                    <textarea
                      ref={messageInputRef}
                      value={input}
                      onChange={(event) => {
                        handleInputChange(event.target.value);
                        const element = event.currentTarget;
                        element.style.height = "44px";
                        element.style.height = `${Math.min(element.scrollHeight, 150)}px`;
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void sendMessage();
                        }
                      }}
                      placeholder="Write a message..."
                      rows={1}
                      maxLength={1200}
                      className="h-11 max-h-36 min-h-11 flex-1 resize-none bg-transparent px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                    />
                    <button
                      onClick={() => void sendMessage()}
                      disabled={sending || !input.trim()}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <p className="inline-flex items-center gap-1.5 text-slate-500">
                    {connectedChannels >= 2 ? (
                      <Wifi className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <WifiOff className="h-3.5 w-3.5 text-amber-600" />
                    )}
                    {lastRealtimeLabel}
                  </p>
                  <p className="text-slate-400">Press Enter to send, Shift + Enter for newline.</p>
                </div>
              </footer>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
