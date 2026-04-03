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
  UserCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { scheduleClientIdleTask } from "@/lib/clientIdle";
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
const NOTIFICATION_REFRESH_MS = 180000;
const NOTIFICATION_REFRESH_DEBOUNCE_MS = 350;

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
  connection: {
    icon: UserCheck,
    iconClassName: "text-rose-600",
    badgeClassName: "bg-rose-100 text-rose-700",
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
  /relation .*notifications.* does not exist|table .*notifications.* does not exist|could not find the table '.*notifications.*' in the schema cache/i.test(
    message
  );

type NotificationCenterContentProps = {
  enabled?: boolean;
  userId?: string | null;
};

export default function NotificationCenter({ enabled = true, userId = null }: NotificationCenterContentProps) {
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [useMobileSheet, setUseMobileSheet] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [errorMessage, setErrorMessage] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const [toast, setToast] = useState<{ title: string; kind: NotificationKind } | null>(null);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const isOpenRef = useRef(isOpen);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadInFlightRef = useRef(false);
  const queuedReloadRef = useRef(false);

  const loadNotifications = useCallback(
    async (soft = false) => {
      if (loadInFlightRef.current) {
        queuedReloadRef.current = true;
        return;
      }

      loadInFlightRef.current = true;

      if (!userId) {
        setNotifications([]);
        setLoading(false);
        setErrorMessage("");
        setDemoMode(false);
        loadInFlightRef.current = false;
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
              "Live notifications are in demo mode. Apply canonical Supabase migrations (npm run supabase:migrate or npm run supabase:sql-editor) to enable realtime DB events."
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
      } finally {
        loadInFlightRef.current = false;
        if (queuedReloadRef.current) {
          queuedReloadRef.current = false;
          window.setTimeout(() => {
            void loadNotifications(true);
          }, 0);
        }
      }
    },
    [userId]
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, CLOCK_REFRESH_MS);

    return () => {
      window.clearInterval(timer);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (enabled && userId) return;

    setNotifications([]);
    setLoading(false);
    setErrorMessage("");
    setDemoMode(false);
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, [enabled, userId]);

  useEffect(() => {
    if (!enabled || !userId || demoMode) return;

    return scheduleClientIdleTask(() => {
      void loadNotifications(true);
    }, 3200);
  }, [demoMode, enabled, loadNotifications, userId]);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const scheduleLoadNotifications = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      void loadNotifications(true);
    }, NOTIFICATION_REFRESH_DEBOUNCE_MS);
  }, [loadNotifications]);

  useEffect(() => {
    if (!enabled || !userId || demoMode) return;

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
        (payload) => {
          scheduleLoadNotifications();

          if (
            payload.eventType === "INSERT" &&
            !isOpenRef.current &&
            payload.new &&
            typeof payload.new === "object"
          ) {
            const row = payload.new as Record<string, unknown>;
            const title = typeof row.title === "string" ? row.title : "New notification";
            const kind = getNotificationKind(typeof row.kind === "string" ? row.kind : null);

            setToast({ title, kind });

            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
            toastTimerRef.current = setTimeout(() => setToast(null), 5000);
          }
        }
      )
      .subscribe();

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [demoMode, enabled, scheduleLoadNotifications, userId]);

  useEffect(() => {
    if (!enabled || !userId || demoMode) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      scheduleLoadNotifications();
    }, NOTIFICATION_REFRESH_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [demoMode, enabled, scheduleLoadNotifications, userId]);

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
    void markAsRead(item.id);
    setIsOpen(false);
    router.push(action.href);
  };

  const togglePanel = () => {
    if (!enabled) return;
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen && userId) {
      void loadNotifications(notifications.length > 0);
    }
  };

  const unreadItems = decoratedNotifications.filter((n) => n.unread);
  const readItems = decoratedNotifications.filter((n) => !n.unread);

  const renderItem = (item: DecoratedNotification) => {
    const style = kindStyles[item.kind];
    const Icon = style.icon;
    const action = resolveNotificationAction(item);
    // Derive matching bg color from the badge class, e.g. "bg-violet-100 …" → "bg-violet-100"
    const iconBg = style.badgeClassName.split(" ").find((c) => c.startsWith("bg-")) ?? "bg-slate-100";

    return (
      <li key={item.id} className="border-b border-slate-100 last:border-b-0">
        <div className="flex items-start gap-2 px-3 py-2.5 hover:bg-slate-50 transition-colors">
          <button
            type="button"
            onClick={() => void openNotification(item)}
            className="flex min-w-0 flex-1 items-start gap-3 text-left"
          >
            <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
              <Icon className={`h-4 w-4 ${style.iconClassName}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900 leading-5">{item.title}</p>
                <span className="shrink-0 text-[11px] text-slate-400">{item.timeLabel}</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 leading-4 line-clamp-2">{item.message}</p>
              <span className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.badgeClassName}`}>
                {action.ctaLabel}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => void clearNotification(item.id)}
            className="mt-1 rounded-lg p-1.5 text-slate-300 hover:bg-slate-200 hover:text-slate-600 transition-colors"
            aria-label="Clear notification"
            title="Clear"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </li>
    );
  };

  const panelContent = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-slate-600" />
          <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
          {unreadCount > 0 && (
            <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </div>
        <div
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            demoMode
              ? "bg-amber-100 text-amber-700"
              : "bg-emerald-100 text-emerald-700"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${demoMode ? "bg-amber-500" : "bg-emerald-500 animate-pulse"}`} />
          {demoMode ? "Demo" : "Live"}
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center gap-2 py-10 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : (
        <ul className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100">
          {/* Unread group */}
          {unreadItems.length > 0 && (
            <>
              <li className="sticky top-0 z-10 flex items-center gap-2 bg-sky-50 px-3 py-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wide text-sky-600">Unread</span>
              </li>
              {unreadItems.map(renderItem)}
            </>
          )}

          {/* Earlier group */}
          {readItems.length > 0 && (
            <>
              <li className="sticky top-0 z-10 flex items-center gap-2 bg-slate-50 px-3 py-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Earlier</span>
              </li>
              {readItems.map(renderItem)}
            </>
          )}

          {/* Empty state */}
          {decoratedNotifications.length === 0 && (
            <li className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                <Bell className="h-5 w-5 text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-700">You&apos;re all caught up</p>
              <p className="text-xs text-slate-400 max-w-[18rem]">
                New alerts appear here for chats, orders, reviews, connection requests, and Live Talk updates.
              </p>
            </li>
          )}
        </ul>
      )}

      {/* Error banner */}
      {!!errorMessage && (
        <div
          className={`px-3 py-2 text-[11px] leading-5 ${
            demoMode
              ? "bg-amber-50 text-amber-700 border-t border-amber-200"
              : "bg-rose-50 text-rose-700 border-t border-rose-200"
          }`}
        >
          {errorMessage}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-3 py-2.5">
        <button
          type="button"
          onClick={() => void markAllAsRead()}
          disabled={unreadCount === 0 || loading}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-white hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          <CheckCheck className="h-3.5 w-3.5" />
          Mark all read
        </button>
        <div className="flex items-center gap-2">
          {demoMode && (
            <button
              type="button"
              onClick={() => void loadNotifications()}
              disabled={loading}
              className="rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:opacity-40"
            >
              Retry live
            </button>
          )}
          <button
            type="button"
            onClick={() => void clearAll()}
            disabled={notifications.length === 0 || loading}
            className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear all
          </button>
        </div>
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
        onClick={togglePanel}
        disabled={!enabled}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors hover:border-[var(--brand-500)]/40 hover:text-[var(--brand-700)] disabled:cursor-wait disabled:opacity-70 sm:h-8 sm:w-8 sm:rounded-lg"
        aria-label="Open notifications"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <Bell className="w-5 h-5 text-current" />
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

      {toast !== null &&
        canUseDOM &&
        createPortal(
          <div
            role="alert"
            aria-live="polite"
            className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-3 z-[1500] flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-3 duration-300 sm:bottom-5 sm:right-5 sm:w-80"
          >
            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100`}>
              {(() => {
                const style = kindStyles[toast.kind];
                const Icon = style.icon;
                return <Icon className={`h-4 w-4 ${style.iconClassName}`} />;
              })()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-500">New notification</p>
              <p className="mt-0.5 line-clamp-2 text-sm font-medium text-slate-900">{toast.title}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setToast(null);
                if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
              }}
              className="mt-0.5 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Dismiss notification toast"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}
