"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Loader2, MessageCircle, Search, Send, Sparkles, Users } from "lucide-react";
import { useRouter } from "next/navigation";
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

const fallbackAvatar = "https://i.pravatar.cc/150";

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

export default function ChatPage() {
  const router = useRouter();
  const [requestedChatId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return params.get("open");
  });

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState<string>("");
  const [chatError, setChatError] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [typingUserId, setTypingUserId] = useState<string | null>(null);

  const selectedChatRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const localTypingRef = useRef(false);
  const stopTypingTimerRef = useRef<number | null>(null);
  const remoteTypingTimerRef = useRef<number | null>(null);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedChat) || null,
    [conversations, selectedChat]
  );

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

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

      const { data: myParticipantRows, error: participantsError } = await supabase
        .from("conversation_participants")
        .select("conversation_id,user_id,last_read_at")
        .eq("user_id", userId);

      if (participantsError) {
        setChatError(`Failed to load conversation participants: ${participantsError.message}`);
        setConversations([]);
        setLoadingConversations(false);
        return;
      }

      if (!myParticipantRows?.length) {
        setConversations([]);
        setLoadingConversations(false);
        setChatError(null);
        return;
      }

      const conversationIds = myParticipantRows.map((row) => row.conversation_id);

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
            .limit(2000),
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
        const unreadCount = conversationMessages.reduce((count, message) => {
          if (message.sender_id === userId) return count;
          if (!lastReadAt) return count + 1;
          return message.created_at > lastReadAt ? count + 1 : count;
        }, 0);

        return {
          id: conversationId,
          name: profile?.name || "User",
          avatar: profile?.avatar_url || fallbackAvatar,
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
        if (previousChat && nextConversations.some((conversation) => conversation.id === previousChat)) {
          return previousChat;
        }

        if (requestedChatId && nextConversations.some((conversation) => conversation.id === requestedChatId)) {
          return requestedChatId;
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
      .order("created_at", { ascending: true });

    if (error) {
      setChatError(`Failed to load chat messages: ${error.message}`);
      setMessages([]);
      setLoadingMessages(false);
      return;
    }

    setMessages((data as Message[] | null) || []);
    setLoadingMessages(false);
  }, []);

  const markConversationAsRead = useCallback(
    async (conversationId: string, readAt?: string) => {
      if (!userId || !conversationId) return;
      const timestamp = readAt || new Date().toISOString();

      const { error } = await supabase
        .from("conversation_participants")
        .update({ last_read_at: timestamp })
        .eq("conversation_id", conversationId)
        .eq("user_id", userId);

      if (error) {
        console.warn("Failed to persist read state:", error.message);
      }

      setConversations((previous) =>
        previous.map((conversation) =>
          conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation
        )
      );
    },
    [userId]
  );

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadConversations();
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
    };
  }, [userId]);

  useEffect(() => {
    if (!selectedChat) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMessages(selectedChat);
    void markConversationAsRead(selectedChat);
  }, [loadMessages, markConversationAsRead, selectedChat]);

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
                newMessage.sender_id !== userId && !isCurrentConversation
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
          void loadConversations(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(realtimeChannel);
    };
  }, [loadConversations, markConversationAsRead, userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

    const { data: insertedMessage, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: selectedChat,
        sender_id: userId,
        content: trimmed,
      })
      .select("id,conversation_id,content,sender_id,created_at")
      .single();

    if (error) {
      setMessages((previous) => previous.filter((message) => message.id !== optimisticId));
      setInput(trimmed);
      setChatError(`Failed to send message: ${error.message}`);
      setSending(false);
      return;
    }

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
              lastMessageAt: (insertedMessage as Message).created_at,
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

  const filteredConversations = conversations.filter((conversation) =>
    conversation.name.toLowerCase().includes(search.toLowerCase())
  );
  const selectedUserOnline =
    selectedConversation?.otherUserId ? onlineUserIds.has(selectedConversation.otherUserId) : false;
  const selectedUserTyping =
    Boolean(typingUserId) && Boolean(selectedConversation?.otherUserId) && typingUserId === selectedConversation?.otherUserId;

  return (
    <div className="h-[calc(100vh-7.5rem)] rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 text-slate-900 shadow-sm overflow-hidden">
      <div className="flex h-full">
        <div className={`w-full md:w-96 border-r border-slate-200 flex flex-col bg-slate-50 ${selectedChat ? "hidden md:flex" : "flex"}`}>
          <div className="p-5 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold tracking-wide text-slate-800">Messages</h2>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                <Sparkles size={12} />
                LIVE
              </span>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-300 bg-white p-2">
              <Search size={16} className="text-slate-500" />
              <input
                placeholder="Search chats..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingConversations && (
              <div className="p-4 text-sm text-slate-500 inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading chats...
              </div>
            )}

            {!loadingConversations && filteredConversations.length === 0 && (
              <div className="p-4 text-sm text-slate-600 space-y-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="font-medium text-slate-800">No active conversations yet</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Start from Posts or People, then messages will sync here in realtime.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => router.push("/dashboard")}
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-xs text-white hover:bg-indigo-500"
                  >
                    Go to Posts
                  </button>
                  <button
                    onClick={() => router.push("/dashboard/people")}
                    className="rounded-lg bg-slate-200 px-3 py-2 text-xs text-slate-700 hover:bg-slate-300"
                  >
                    Find People
                  </button>
                </div>

                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-700 inline-flex items-center gap-2">
                  <Users className="h-3.5 w-3.5" />
                  Demo-ready state: create one conversation to unlock full live chat view.
                </div>
              </div>
            )}

            {filteredConversations.map((chat) => (
              <button
                type="button"
                key={chat.id}
                onClick={() => setSelectedChat(chat.id)}
                className={`w-full border-b border-slate-200 px-4 py-3 text-left transition ${
                  selectedChat === chat.id ? "bg-indigo-100/70" : "hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Image
                    src={chat.avatar}
                    alt={`${chat.name} avatar`}
                    width={42}
                    height={42}
                    className="h-11 w-11 rounded-full border border-slate-200 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {chat.name}
                        {chat.otherUserId && onlineUserIds.has(chat.otherUserId) && (
                          <span className="ml-2 text-[10px] font-semibold text-emerald-600">● online</span>
                        )}
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="shrink-0 text-[11px] text-slate-400">{formatTimeAgo(chat.lastMessageAt)}</p>
                        {chat.unreadCount > 0 && (
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-semibold text-white">
                            {chat.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">{chat.lastMessage}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className={`flex-1 flex-col ${selectedChat ? "flex" : "hidden md:flex"}`}>
          {!selectedChat ? (
            <div className="flex h-full items-center justify-center px-6 text-slate-400 text-center">
              <div>
                <p className="font-medium text-slate-600">Select a conversation to start chatting.</p>
                <p className="text-xs text-slate-500 mt-2">Realtime updates, unread indicators, and message sync are active.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-5 py-4">
                <button
                  type="button"
                  onClick={() => setSelectedChat(null)}
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 md:hidden"
                >
                  <ArrowLeft size={18} />
                </button>
                {selectedConversation && (
                  <>
                    <Image
                      src={selectedConversation.avatar}
                      alt={`${selectedConversation.name} avatar`}
                      width={38}
                      height={38}
                      className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{selectedConversation.name}</p>
                      <p className={`text-xs ${selectedUserTyping ? "text-indigo-600" : selectedUserOnline ? "text-emerald-600" : "text-slate-500"}`}>
                        {selectedUserTyping
                          ? "Typing..."
                          : selectedUserOnline
                          ? "Online now"
                          : "Offline"}
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-5 bg-slate-50/60">
                {loadingMessages ? (
                  <p className="text-sm text-slate-500 inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading conversation...
                  </p>
                ) : messages.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                    No messages yet. Send the first message to start this conversation.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((message) => {
                      const mine = message.sender_id === userId;
                      return (
                        <div
                          key={message.id}
                          className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm shadow-md ${
                            mine
                              ? "ml-auto rounded-br-md bg-gradient-to-r from-blue-500 to-indigo-500 text-white"
                              : "rounded-bl-md border border-slate-300 bg-white text-slate-800"
                          }`}
                        >
                          <p className="break-words">{message.content}</p>
                          <p className={`mt-1 text-[10px] ${mine ? "text-blue-100" : "text-slate-400"}`}>
                            {formatTime(message.created_at)}
                          </p>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 rounded-2xl border border-slate-300 bg-slate-50 p-2">
                  <input
                    value={input}
                    onChange={(event) => handleInputChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void sendMessage();
                      }
                    }}
                    placeholder="Type a message..."
                    className="flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-slate-400"
                  />
                  <button
                    onClick={() => void sendMessage()}
                    disabled={sending || !input.trim()}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
                {chatError && <p className="mt-2 text-xs text-rose-600">{chatError}</p>}
                {!chatError && (
                  <p className="mt-2 text-[11px] text-slate-500 inline-flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5" />
                    Messages, presence, and typing sync in realtime.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
