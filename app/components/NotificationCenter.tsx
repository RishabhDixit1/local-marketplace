"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  CheckCheck,
  MessageCircle,
  ShieldCheck,
  Star,
  Truck,
  UserRoundCheck,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

type NotificationKind =
  | "booking"
  | "message"
  | "review"
  | "security"
  | "payment"
  | "profile";

type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  createdAt: string;
  timeLabel: string;
  unread: boolean;
  cta: string;
};

type SeedNotificationTemplate = Omit<NotificationItem, "id" | "createdAt" | "timeLabel" | "unread"> & {
  minutesAgo: number;
};

type LiveNotificationTemplate = Omit<NotificationItem, "id" | "createdAt" | "timeLabel" | "unread">;

const seedTemplates: SeedNotificationTemplate[] = [
  {
    kind: "booking",
    title: "Booking confirmed",
    message: "Sarah accepted your plumbing request for tomorrow at 10:30 AM.",
    minutesAgo: 4,
    cta: "Open task",
  },
  {
    kind: "message",
    title: "New message",
    message: "Marcus sent pricing details for your custom shelving request.",
    minutesAgo: 18,
    cta: "Reply",
  },
  {
    kind: "review",
    title: "New review posted",
    message: "Michael left a 5-star review on your profile.",
    minutesAgo: 52,
    cta: "View review",
  },
  {
    kind: "profile",
    title: "Profile strength increased",
    message: "Your profile is now 85% complete. Add one more project photo to reach 90%.",
    minutesAgo: 140,
    cta: "Update profile",
  },
  {
    kind: "payment",
    title: "Payout scheduled",
    message: "$180.00 payout is scheduled to arrive by Monday.",
    minutesAgo: 285,
    cta: "View payout",
  },
  {
    kind: "security",
    title: "Account protected",
    message: "Two-factor authentication was enabled successfully.",
    minutesAgo: 680,
    cta: "Security settings",
  },
];

const liveTemplates: LiveNotificationTemplate[] = [
  {
    kind: "message",
    title: "Unread chat",
    message: "Priya asked if you can arrive 20 minutes earlier.",
    cta: "Reply now",
  },
  {
    kind: "booking",
    title: "Urgent request nearby",
    message: "A customer 1.3 miles away requested same-day service.",
    cta: "View request",
  },
  {
    kind: "payment",
    title: "Payment received",
    message: "$65.00 payment was released for your recent delivery.",
    cta: "Open wallet",
  },
  {
    kind: "review",
    title: "Review reminder",
    message: "Rate your latest completed order to boost trust score.",
    cta: "Rate order",
  },
  {
    kind: "profile",
    title: "Provider match found",
    message: "Two providers now match your saved furniture assembly request.",
    cta: "View matches",
  },
  {
    kind: "security",
    title: "New login",
    message: "Your account was accessed from a known device in San Jose, CA.",
    cta: "Review activity",
  },
];

const kindStyles: Record<
  NotificationKind,
  { icon: LucideIcon; iconClassName: string; badgeClassName: string }
> = {
  booking: {
    icon: Truck,
    iconClassName: "text-blue-600",
    badgeClassName: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200",
  },
  message: {
    icon: MessageCircle,
    iconClassName: "text-violet-600",
    badgeClassName: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-200",
  },
  review: {
    icon: Star,
    iconClassName: "text-amber-600",
    badgeClassName: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200",
  },
  security: {
    icon: ShieldCheck,
    iconClassName: "text-emerald-600",
    badgeClassName: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200",
  },
  payment: {
    icon: WalletCards,
    iconClassName: "text-cyan-600",
    badgeClassName: "bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-200",
  },
  profile: {
    icon: UserRoundCheck,
    iconClassName: "text-indigo-600",
    badgeClassName: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200",
  },
};

const LIVE_POLL_MS = 15000;
const CLOCK_REFRESH_MS = 30000;
const MAX_NOTIFICATIONS = 22;

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

const buildSeedNotifications = () => {
  const now = Date.now();
  return seedTemplates.map((template, index) => ({
    ...template,
    id: `seed-${index + 1}`,
    createdAt: new Date(now - template.minutesAgo * 60 * 1000).toISOString(),
    timeLabel: formatTimeAgo(now, new Date(now - template.minutesAgo * 60 * 1000).toISOString()),
    unread: index < 3,
  }));
};

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(() =>
    buildSeedNotifications()
  );

  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const liveCursorRef = useRef(0);

  const unreadCount = useMemo(
    () => notifications.filter((item) => item.unread).length,
    [notifications]
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          timeLabel: formatTimeAgo(now, item.createdAt),
        }))
      );
    }, CLOCK_REFRESH_MS);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNotifications((current) => {
        const template = liveTemplates[liveCursorRef.current % liveTemplates.length];
        liveCursorRef.current += 1;

        const incoming: NotificationItem = {
          ...template,
          id: `live-${liveCursorRef.current}-${Date.now()}`,
          createdAt: new Date().toISOString(),
          timeLabel: "Just now",
          unread: true,
        };

        return [incoming, ...current].slice(0, MAX_NOTIFICATIONS);
      });
    }, LIVE_POLL_MS);

    return () => window.clearInterval(timer);
  }, []);

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

  const markAsRead = (id: string) => {
    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, unread: false } : item))
    );
  };

  const markAllAsRead = () => {
    setNotifications((current) => current.map((item) => ({ ...item, unread: false })));
  };

  const resetDemoFeed = () => {
    liveCursorRef.current = 0;
    setNotifications(buildSeedNotifications());
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setIsOpen((open) => !open)}
        className="relative p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-label="Open notifications"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <Bell className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-red-500 rounded-full flex items-center justify-center text-white text-[11px] font-bold leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 sm:hidden"
            onClick={() => setIsOpen(false)}
            aria-label="Close notifications"
          />

          <div
            ref={panelRef}
            className="fixed inset-x-4 top-[4.5rem] z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:absolute sm:right-0 sm:left-auto sm:top-full sm:mt-2 sm:w-[24rem] dark:border-slate-700 dark:bg-slate-800"
            role="dialog"
            aria-label="Notifications panel"
          >
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">Notifications</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {unreadCount} unread · New demo alerts every {LIVE_POLL_MS / 1000}s
                  </p>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-900/20 dark:text-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </div>
              </div>
            </div>

            <ul className="max-h-[min(65vh,28rem)] overflow-y-auto">
              {notifications.map((item) => {
                const style = kindStyles[item.kind];
                const Icon = style.icon;

                return (
                  <li
                    key={item.id}
                    className="border-b border-slate-100 dark:border-slate-700 last:border-b-0"
                  >
                    <button
                      type="button"
                      onClick={() => markAsRead(item.id)}
                      className={`w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors ${
                        item.unread ? "bg-sky-50/60 dark:bg-sky-900/10" : ""
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700">
                          <Icon className={`h-4 w-4 ${style.iconClassName}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white leading-5">
                              {item.title}
                            </p>
                            <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
                              {item.timeLabel}
                            </span>
                          </div>
                          <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-5">
                            {item.message}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.badgeClassName}`}
                            >
                              {item.cta}
                            </span>
                            {item.unread && (
                              <span className="text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                                New
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="grid grid-cols-1 gap-2 p-3 border-t border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-2">
              <button
                type="button"
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <CheckCheck className="h-4 w-4" />
                Mark all read
              </button>
              <button
                type="button"
                onClick={resetDemoFeed}
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                Reset demo
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
