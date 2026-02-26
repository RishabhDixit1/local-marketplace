"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Star,
  Truck,
  X,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isAbortLikeError, isFailedFetchError } from "@/lib/runtimeErrors";
import {
  getNotificationKind,
  getDemoNotifications,
  resolveNotificationAction,
  type NotificationKind,
  type NotificationRow,
} from "@/lib/notifications";

type NotificationRowRaw = Omit<NotificationRow, "kind" | "metadata"> & {
  kind: string | null;
  metadata: Record<string, unknown> | null;
};

type DecoratedNotification = NotificationRow & {
  unread: boolean;
  timeLabel: string;
};

const CLOCK_REFRESH_MS = 30000;

const kindStyles: Record<
  NotificationKind,
  { icon: LucideIcon; iconClassName: string; badgeClassName: string }
> = {
  order: {
    icon: Truck,
    iconClassName: "text-blue-600",
    badgeClassName: "bg-blue-100 text-blue-700",
  },
  message: {
    icon: MessageCircle,
    iconClassName: "text-violet-600",
    badgeClassName: "bg-violet-100 text-violet-700",
  },
  review: {
    icon: Star,
    iconClassName: "text-amber-600",
    badgeClassName: "bg-amber-100 text-amber-700",
  },
  system: {
    icon: ShieldCheck,
    iconClassName: "text-emerald-600",
    badgeClassName: "bg-emerald-100 text-emerald-700",
  },
};

const formatTimeAgo = (nowMs: number, timestamp: string) => {
  const time = new Date(timestamp).getTime();
  if (Number.isNaN(time)) return "Recently";
  const diffMs = Math.max(0, nowMs - time);
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const normalizeNotificationRows = (rows: NotificationRowRaw[] | null | undefined): NotificationRow[] => {
  return (rows || []).map((row) => ({
    ...row,
    kind: getNotificationKind(row.kind),
    metadata: row.metadata || null,
  }));
};

const isMissingNotificationsTable = (message: string) =>
  /relation .*notifications.* does not exist|could not find the 'notifications' table/i.test(message);

export default function NotificationCenter() {
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [useMobileSheet, setUseMobileSheet] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [userId, setUserId] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState("");
  const [demoMode, setDemoMode] = useState(false);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const loadNotifications = useCallback(
    async (soft = false) => {
      if (!userId) {
        setNotifications([]);
        setLoading(false);
        setErrorMessage("");
        setDemoMode(false);
        return;
      }

      if (!soft) setLoading(true);

      try {
        const { data, error } = await supabase
          .from("notifications")
          .select("id,user_id,kind,title,message,entity_type,entity_id,metadata,read_at,cleared_at,created_at")
          .eq("user_id", userId)
          .is("cleared_at", null)
          .order("created_at", { ascending: false })
          .limit(60);

        if (error) {
          if (isMissingNotificationsTable(error.message)) {
            setNotifications(getDemoNotifications(userId));
            setErrorMessage(
              "Live notifications are in demo mode. Run supabase/secure_realtime_rls.sql to enable realtime DB events."
            );
            setDemoMode(true);
            setLoading(false);
            return;
          }

          setNotifications([]);
          setLoading(false);
          setErrorMessage("Unable to load notifications. Please refresh and try again.");
          setDemoMode(false);
          return;
        }

        setNotifications(normalizeNotificationRows((data as NotificationRowRaw[] | null) || []));
        setErrorMessage("");
        setDemoMode(false);
        setLoading(false);
      } catch (error) {
        if (isAbortLikeError(error)) {
          setLoading(false);
          return;
        }

        setNotifications([]);
        setLoading(false);
        setDemoMode(false);
        setErrorMessage(
          isFailedFetchError(error)
            ? "Connection issue while loading notifications. Retry once your network is stable."
            : "Unable to load notifications. Please refresh and try again."
        );
      }
    },
    [userId]
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, CLOCK_REFRESH_MS);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        let user = sessionData.session?.user || null;

        if (!user) {
          const {
            data: authData,
          } = await supabase.auth.getUser();
          user = authData.user;
        }

        if (!user) {
          setNotifications([]);
          setLoading(false);
          setErrorMessage("");
          setDemoMode(false);
        }
        setUserId(user?.id || "");
      } catch (error) {
        console.warn("Unable to initialize notifications auth:", error);
        setNotifications([]);
        setLoading(false);
        setErrorMessage("");
        setDemoMode(false);
        setUserId("");
      }
    };

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setNotifications([]);
        setLoading(false);
        setErrorMessage("");
        setDemoMode(false);
      }
      setUserId(session?.user?.id || "");
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId || demoMode) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadNotifications();
  }, [demoMode, loadNotifications, userId]);

  useEffect(() => {
    if (!userId || demoMode) return;

    const channel = supabase
      .channel(`notifications-live-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void loadNotifications(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [demoMode, loadNotifications, userId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
    const mobileWidthQuery = window.matchMedia("(max-width: 640px)");
    const touchCapable = navigator.maxTouchPoints > 0 || "ontouchstart" in window;

    const updateMode = () => {
      setUseMobileSheet(touchCapable || coarsePointerQuery.matches || mobileWidthQuery.matches);
    };

    updateMode();

    const add = (query: MediaQueryList, handler: () => void) => {
      if (typeof query.addEventListener === "function") {
        query.addEventListener("change", handler);
        return () => query.removeEventListener("change", handler);
      }

      query.addListener(handler);
      return () => query.removeListener(handler);
    };

    const removeCoarse = add(coarsePointerQuery, updateMode);
    const removeWidth = add(mobileWidthQuery, updateMode);
    window.addEventListener("resize", updateMode);

    return () => {
      removeCoarse();
      removeWidth();
      window.removeEventListener("resize", updateMode);
    };
  }, []);

  useEffect(() => {
    if (!isOpen || !useMobileSheet) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, useMobileSheet]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const decoratedNotifications = useMemo<DecoratedNotification[]>(() => {
    return notifications.map((item) => ({
      ...item,
      unread: !item.read_at,
      timeLabel: formatTimeAgo(nowMs, item.created_at),
    }));
  }, [notifications, nowMs]);

  const unreadCount = useMemo(
    () => decoratedNotifications.filter((item) => item.unread).length,
    [decoratedNotifications]
  );

  const markAsRead = useCallback(
    async (id: string) => {
      if (!userId) return;

      const timestamp = new Date().toISOString();
      setNotifications((current) =>
        current.map((item) =>
          item.id === id && !item.read_at ? { ...item, read_at: timestamp } : item
        )
      );

      if (demoMode) return;

      const { error } = await supabase
        .from("notifications")
        .update({ read_at: timestamp })
        .eq("id", id)
        .eq("user_id", userId)
        .is("read_at", null);

      if (error) {
        void loadNotifications(true);
      }
    },
    [demoMode, loadNotifications, userId]
  );

  const markAllAsRead = useCallback(async () => {
    if (!userId || unreadCount === 0) return;

    const timestamp = new Date().toISOString();
    setNotifications((current) =>
      current.map((item) => (item.read_at ? item : { ...item, read_at: timestamp }))
    );

    if (demoMode) return;

    const { error: rpcError } = await supabase.rpc("mark_all_notifications_read");
    if (!rpcError) return;

    const { error: fallbackError } = await supabase
      .from("notifications")
      .update({ read_at: timestamp })
      .eq("user_id", userId)
      .is("read_at", null)
      .is("cleared_at", null);

    if (fallbackError) {
      void loadNotifications(true);
    }
  }, [demoMode, loadNotifications, unreadCount, userId]);

  const clearNotification = useCallback(
    async (id: string) => {
      if (!userId) return;

      const timestamp = new Date().toISOString();
      setNotifications((current) => current.filter((item) => item.id !== id));

      if (demoMode) return;

      const { error } = await supabase
        .from("notifications")
        .update({ cleared_at: timestamp })
        .eq("id", id)
        .eq("user_id", userId)
        .is("cleared_at", null);

      if (error) {
        void loadNotifications(true);
      }
    },
    [demoMode, loadNotifications, userId]
  );

  const clearAll = useCallback(async () => {
    if (!userId || notifications.length === 0) return;

    setNotifications([]);

    if (demoMode) return;

    const { error: rpcError } = await supabase.rpc("clear_all_notifications");
    if (!rpcError) return;

    const timestamp = new Date().toISOString();
    const { error: fallbackError } = await supabase
      .from("notifications")
      .update({ cleared_at: timestamp })
      .eq("user_id", userId)
      .is("cleared_at", null);

    if (fallbackError) {
      void loadNotifications(true);
    }
  }, [demoMode, loadNotifications, notifications.length, userId]);

  const openNotification = async (item: DecoratedNotification) => {
    const action = resolveNotificationAction(item);
    await markAsRead(item.id);
    setIsOpen(false);
    router.push(action.href);
  };

  const panelContent = (
    <>
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-900">Notifications</h3>
            <p className="text-xs text-slate-500 mt-1">
              {unreadCount} unread ·{" "}
              {demoMode
                ? "Demo feed (switches to live after SQL setup)"
                : "Live from orders, messages, reviews, and help matches"}
            </p>
          </div>
          <div
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold ${
              demoMode
                ? "border border-amber-200 bg-amber-50 text-amber-700"
                : "border border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${demoMode ? "bg-amber-500" : "bg-emerald-500 animate-pulse"}`}
            />
            {demoMode ? "Demo" : "Live"}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-4 text-sm text-slate-500 inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading notifications...
        </div>
      ) : (
        <ul className="flex-1 min-h-0 overflow-y-auto">
          {decoratedNotifications.map((item) => {
            const style = kindStyles[item.kind];
            const Icon = style.icon;
            const action = resolveNotificationAction(item);

            return (
              <li key={item.id} className="border-b border-slate-100 last:border-b-0">
                <div className={`flex items-start gap-2 px-2 py-2 ${item.unread ? "bg-sky-50/70" : ""}`}>
                  <button
                    type="button"
                    onClick={() => void openNotification(item)}
                    className="flex min-w-0 flex-1 items-start gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                      <Icon className={`h-4 w-4 ${style.iconClassName}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900 leading-5">{item.title}</p>
                        <span className="shrink-0 text-[11px] text-slate-500">{item.timeLabel}</span>
                      </div>
                      <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-5">{item.message}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.badgeClassName}`}>
                          {action.ctaLabel}
                        </span>
                        {item.unread && <span className="text-[11px] font-semibold text-sky-700">New</span>}
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => void clearNotification(item.id)}
                    className="mt-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                    aria-label="Clear notification"
                    title="Clear"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            );
          })}

          {!decoratedNotifications.length && (
            <li className="p-4 text-sm text-slate-500">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="font-medium text-slate-800">No notifications yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  New alerts appear automatically when chats, orders, reviews, and help matches update.
                </p>
              </div>
            </li>
          )}
        </ul>
      )}

      {!!errorMessage && (
        <div
          className={`border-t px-4 py-2 text-[11px] ${
            demoMode
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {errorMessage}
        </div>
      )}

      <div
        className={`grid grid-cols-1 gap-2 p-3 border-t border-slate-200 bg-slate-50 ${
          demoMode ? "sm:grid-cols-3" : "sm:grid-cols-2"
        }`}
      >
        <button
          type="button"
          onClick={() => void markAllAsRead()}
          disabled={unreadCount === 0 || loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCheck className="h-4 w-4" />
          Mark all read
        </button>
        <button
          type="button"
          onClick={() => void clearAll()}
          disabled={notifications.length === 0 || loading}
          className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Clear all
        </button>
        {demoMode && (
          <button
            type="button"
            onClick={() => void loadNotifications()}
            disabled={loading}
            className="rounded-xl bg-amber-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Retry live
          </button>
        )}
      </div>
    </>
  );

  const canUseDOM = typeof document !== "undefined";
  const mobilePanel =
    canUseDOM && isOpen && useMobileSheet
      ? createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-[1390] bg-slate-900/25"
              onClick={() => setIsOpen(false)}
              aria-label="Close notifications"
            />
            <div
              ref={panelRef}
              className="fixed inset-x-3 top-[4.25rem] bottom-3 z-[1400] flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:inset-x-4 sm:top-[4.5rem] sm:bottom-4"
              role="dialog"
              aria-label="Notifications panel"
            >
              {panelContent}
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <div className="relative z-[1400]">
      <button
        ref={triggerRef}
        onClick={() => setIsOpen((open) => !open)}
        className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors"
        aria-label="Open notifications"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <Bell className="w-5 h-5 text-slate-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-red-500 rounded-full flex items-center justify-center text-white text-[11px] font-bold leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && !useMobileSheet && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full z-[1400] mt-2 flex w-[24rem] max-h-[36rem] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          role="dialog"
          aria-label="Notifications panel"
        >
          {panelContent}
        </div>
      )}

      {mobilePanel}
    </div>
  );
}
