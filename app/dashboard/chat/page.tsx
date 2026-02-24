"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Search, Send, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

type Conversation = {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  lastMessageAt: string | null;
  otherUserId: string | null;
};

type Message = {
  id: string;
  conversation_id: string;
  content: string;
  sender_id: string;
  created_at: string;
};

export default function ChatPage() {
  const router = useRouter();
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
  const [requestedChatId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(
      window.location.search
    );
    return params.get("open");
  });
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedChat) || null,
    [conversations, selectedChat]
  );

  /* ---------------- GET USER ---------------- */

  useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        setChatError(`Auth error: ${error.message}`);
        setLoadingConversations(false);
        return;
      }
      if (data.user) {
        setUserId(data.user.id);
      } else {
        setChatError("You are not logged in.");
        setLoadingConversations(false);
      }
    };
    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || "");
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  /* ---------------- LOAD CONVERSATIONS ---------------- */

  const loadConversations = useCallback(async () => {
    if (!userId) return;
    setLoadingConversations(true);
    setChatError(null);

    /* 1️⃣ Get conversations where user participates */
    const {
      data: participants,
      error: participantsError,
    } = await supabase
      .from("conversation_participants")
      .select("conversation_id, user_id")
      .eq("user_id", userId);

    if (participantsError) {
      setChatError(
        `Failed to load conversation participants: ${participantsError.message}`
      );
      setConversations([]);
      setLoadingConversations(false);
      return;
    }

    if (!participants?.length) {
      setConversations([]);
      setChatError(null);
      setLoadingConversations(false);
      return;
    }

    const convoIds = participants.map((p) => p.conversation_id);

    /* 2️⃣ Get all participants in those convos */
    const {
      data: allParticipants,
      error: allParticipantsError,
    } = await supabase
      .from("conversation_participants")
      .select("conversation_id, user_id")
      .in("conversation_id", convoIds);

    if (allParticipantsError) {
      setChatError(
        `Failed to load participants for conversations: ${allParticipantsError.message}`
      );
      setConversations([]);
      setLoadingConversations(false);
      return;
    }

    /* 3️⃣ Get profiles */
    const uniqueUserIds = [...new Set(allParticipants?.map((p) => p.user_id) || [])];

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, name, avatar_url")
      .in("id", uniqueUserIds);

    if (profilesError) {
      setChatError(`Failed to load user profiles: ${profilesError.message}`);
      setConversations([]);
      setLoadingConversations(false);
      return;
    }

    /* 4️⃣ Get last messages */
    const {
      data: lastMessages,
      error: lastMessagesError,
    } = await supabase
      .from("messages")
      .select("*")
      .in("conversation_id", convoIds)
      .order("created_at", { ascending: false });

    if (lastMessagesError) {
      setChatError(`Failed to load messages: ${lastMessagesError.message}`);
      setConversations([]);
      setLoadingConversations(false);
      return;
    }

    /* 5️⃣ Format for UI */
    const profilesById = new Map((profiles || []).map((profile) => [profile.id, profile]));
    const formatted: Conversation[] = convoIds.map((conversationId) => {
      const users = allParticipants?.filter((p) => p.conversation_id === conversationId) || [];
      const otherUser = users.find((u) => u.user_id !== userId) || null;
      const profile = otherUser ? profilesById.get(otherUser.user_id) : null;
      const last = lastMessages?.find((m) => m.conversation_id === conversationId);

      return {
        id: conversationId,
        name: profile?.name || "User",
        avatar: profile?.avatar_url || "https://i.pravatar.cc/150",
        lastMessage: last?.content || "Start chat",
        lastMessageAt: last?.created_at || null,
        otherUserId: otherUser?.user_id || null,
      };
    });

    formatted.sort((a, b) => {
      if (!a.lastMessageAt) return 1;
      if (!b.lastMessageAt) return -1;
      return b.lastMessageAt.localeCompare(a.lastMessageAt);
    });

    setConversations(formatted);
    setSelectedChat((previousChat) => {
      if (previousChat && formatted.some((conversation) => conversation.id === previousChat)) {
        return previousChat;
      }
      if (requestedChatId && formatted.some((conversation) => conversation.id === requestedChatId)) {
        return requestedChatId;
      }
      return formatted[0]?.id || null;
    });
    setLoadingConversations(false);
  }, [requestedChatId, userId]);

  useEffect(() => {
    if (!userId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadConversations();
  }, [loadConversations, userId]);

  /* ---------------- LOAD MESSAGES ---------------- */

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true);
    setChatError(null);

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      setChatError(`Failed to load chat messages: ${error.message}`);
      setMessages([]);
      setLoadingMessages(false);
      return;
    }

    setMessages(data || []);
    setLoadingMessages(false);
  }, []);

  useEffect(() => {
    if (!selectedChat) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMessages(selectedChat);
  }, [loadMessages, selectedChat]);

  /* ---------------- SEND MESSAGE ---------------- */

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || !selectedChat || sending) return;
    setSending(true);

    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setChatError("You must be logged in to send messages.");
      setSending(false);
      return;
    }

    const { error } = await supabase.from("messages").insert({
      conversation_id: selectedChat,
      sender_id: data.user.id,
      content: trimmed,
    });

    if (error) {
      setChatError(`Failed to send message: ${error.message}`);
      setSending(false);
      return;
    }

    setInput("");
    loadConversations();
    setSending(false);
  };

  /* ---------------- REALTIME ---------------- */

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
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

          setConversations((previousConversations) => {
            const exists = previousConversations.some(
              (conversation) => conversation.id === newMessage.conversation_id
            );
            if (!exists) return previousConversations;

            const updatedConversations = previousConversations.map((conversation) =>
              conversation.id === newMessage.conversation_id
                ? {
                    ...conversation,
                    lastMessage: newMessage.content,
                    lastMessageAt: newMessage.created_at,
                  }
                : conversation
            );

            updatedConversations.sort((a, b) => {
              if (!a.lastMessageAt) return 1;
              if (!b.lastMessageAt) return -1;
              return b.lastMessageAt.localeCompare(a.lastMessageAt);
            });

            return updatedConversations;
          });

          if (newMessage.conversation_id === selectedChat) {
            setMessages((previousMessages) => {
              if (previousMessages.some((message) => message.id === newMessage.id)) {
                return previousMessages;
              }
              return [...previousMessages, newMessage];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedChat, userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ---------------- UI ---------------- */
  const filteredConversations = conversations.filter((chat) =>
    chat.name.toLowerCase().includes(search.toLowerCase())
  );

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="h-[calc(100vh-7.5rem)] rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 text-slate-900 shadow-sm overflow-hidden">
      <div className="flex h-full">
        <div className={`w-full md:w-96 border-r border-slate-200 flex flex-col bg-slate-50 ${selectedChat ? "hidden md:flex" : "flex"}`}>
          <div className="p-5 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold tracking-wide text-slate-800">
                Messages
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-300">
                <Sparkles size={12} />
                LIVE
              </span>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-300 bg-white p-2">
              <Search size={16} className="text-slate-500" />
              <input
                placeholder="Search chats..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingConversations && (
              <p className="p-4 text-sm text-slate-500">Loading chats...</p>
            )}

            {!loadingConversations && filteredConversations.length === 0 && (
              <div className="p-4 text-sm text-slate-600 space-y-3">
                <p>No chats yet.</p>
                <p className="text-xs text-slate-500">
                  Start from Posts or People to open your first conversation.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => router.push("/dashboard")}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-500"
                  >
                    Go to Posts
                  </button>
                  <button
                    onClick={() => router.push("/dashboard/people")}
                    className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-300"
                  >
                    Find People
                  </button>
                </div>
              </div>
            )}

            {filteredConversations.map((chat) => (
              <button
                type="button"
                key={chat.id}
                onClick={() => setSelectedChat(chat.id)}
                className={`w-full border-b border-slate-200 px-4 py-3 text-left transition ${
                  selectedChat === chat.id
                    ? "bg-indigo-100/70"
                    : "hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Image
                    src={chat.avatar}
                    alt={`${chat.name} avatar`}
                    width={42}
                    height={42}
                    className="h-11 w-11 rounded-full border border-slate-700 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-slate-800">{chat.name}</p>
                      <p className="shrink-0 text-[11px] text-slate-400">
                        {chat.lastMessageAt ? formatTime(chat.lastMessageAt) : ""}
                      </p>
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
            <div className="flex h-full items-center justify-center px-6 text-slate-400">
              Select a conversation to start chatting.
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
                      className="h-10 w-10 rounded-full border border-slate-700 object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{selectedConversation.name}</p>
                      <p className="text-xs text-emerald-600">Connected in realtime</p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-5 bg-slate-50/60">
                {loadingMessages ? (
                  <p className="text-sm text-slate-500">Loading conversation...</p>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => {
                      const mine = msg.sender_id === userId;
                      return (
                        <div
                          key={msg.id}
                          className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm shadow-md ${
                            mine
                              ? "ml-auto rounded-br-md bg-gradient-to-r from-blue-500 to-indigo-500 text-white"
                              : "rounded-bl-md border border-slate-300 bg-white text-slate-800"
                          }`}
                        >
                          <p className="break-words">{msg.content}</p>
                          <p className={`mt-1 text-[10px] ${mine ? "text-blue-100" : "text-slate-400"}`}>
                            {formatTime(msg.created_at)}
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
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Type a message..."
                    className="flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-slate-400"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={sending || !input.trim()}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send size={16} />
                  </button>
                </div>
                {chatError && <p className="mt-2 text-xs text-rose-600">{chatError}</p>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
