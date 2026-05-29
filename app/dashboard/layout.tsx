"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { supabase } from "../../lib/supabase";
import NotificationCenter from "@/app/components/NotificationCenter";
import { CartProvider } from "@/app/components/store/CartContext";
import {
  DashboardPromptBar,
  DashboardPromptProvider,
  useDashboardPromptState,
} from "@/app/components/prompt/DashboardPromptContext";
import ServiQLogo from "@/app/components/ServiQLogo";
import OnboardingGuard from "@/app/components/profile/OnboardingGuard";
import QuickOnboardingSheet from "@/app/components/profile/QuickOnboardingSheet";
import {
  ProfileProvider,
  useProfileContext,
} from "@/app/components/profile/ProfileContext";
import { appName } from "@/lib/branding";
import { scheduleClientIdleTask } from "@/lib/clientIdle";
import useUnreadChatCount from "@/lib/hooks/useUnreadChatCount";
import {
  buildPublicProfilePath,
  isProfileOnboardingComplete,
} from "@/lib/profile/utils";
import { fetchAuthedJson } from "@/lib/clientApi";
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  Bell,
  Building2,
  ClipboardList,
  ChevronsLeft,
  ChevronsRight,
  Gift,
  LogOut,
  MessageCircle,
  Plus,
  Rocket,
  Shield,
  ShoppingCart,
  Store,
  User,
  Users,
} from "lucide-react";
import PushNotificationSubscriber from "@/app/components/PushNotificationSubscriber";

import type { PublishPostResult } from "@/app/components/CreatePostModal";

const CreatePostModal = dynamic(
  () => import("@/app/components/CreatePostModal").then((mod) => mod.default),
  {
    ssr: false,
  },
);

const CartDrawer = dynamic(
  () =>
    import("@/app/components/store/CartDrawer").then((m) => ({
      default: m.CartDrawer,
    })),
  { ssr: false },
);

const baseNavigationTabs = [
  { name: "Market", path: "/dashboard", icon: Store },
  { name: "My Work", path: "/dashboard/tasks", icon: ClipboardList },
  { name: "Profile", path: "/dashboard/profile", icon: User },
];

const secondaryNavItems = [
  { name: "People", path: "/dashboard/people", icon: Users },
  { name: "Providers", path: "/dashboard/providers", icon: Store },
  { name: "Orders", path: "/dashboard/orders", icon: ShoppingCart },
  { name: "Notifications", path: "/dashboard/notifications", icon: Bell },
  { name: "Chat", path: "/dashboard/chat", icon: MessageCircle },
  { name: "Launchpad", path: "/dashboard/launchpad", icon: Rocket },
  { name: "Referrals", path: "/dashboard/referrals", icon: Gift },
  { name: "Payouts", path: "/dashboard/payouts", icon: Banknote },
  { name: "Verification", path: "/dashboard/verification", icon: BadgeCheck },
  { name: "Workspaces", path: "/dashboard/workspaces", icon: Building2 },
];

const STARTUP_CHECK_SESSION_KEY = "serviq-startup-check-ran";

const isNavigationTabActive = (pathname: string, path: string) =>
  pathname === path;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProfileProvider>
      <DashboardPromptProvider>
        <CartProvider>
          <DashboardShell>{children}</DashboardShell>
        </CartProvider>
      </DashboardPromptProvider>
    </ProfileProvider>
  );
}

function DashboardChatShortcut({
  active,
  badgeLabel,
  unreadCount,
  className,
}: {
  active: boolean;
  badgeLabel: string | null;
  unreadCount: number;
  className: string;
}) {
  return (
    <Link
      href="/dashboard/chat"
      aria-label={
        unreadCount > 0
          ? `Open chat inbox, ${unreadCount} unread message${unreadCount === 1 ? "" : "s"}`
          : "Open chat inbox"
      }
      aria-current={active ? "page" : undefined}
      title="Chat"
      className={`relative ${className} ${
        active
          ? "!border-[var(--brand-500)]/60 !bg-[var(--brand-900)] !text-white hover:!border-[var(--brand-500)]/60 hover:!text-white"
          : ""
      }`}
    >
      <MessageCircle className={`h-4 w-4 ${active ? "text-white" : ""}`} />
      {badgeLabel ? (
        <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-rose-500 px-1 py-0.5 text-[9px] font-bold leading-none text-white ring-2 ring-white">
          {badgeLabel}
        </span>
      ) : null}
    </Link>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading: profileLoading } = useProfileContext();
  const [desktopNavManuallyCollapsed, setDesktopNavManuallyCollapsed] =
    useState(false);
  const [desktopNavAutoCollapsed, setDesktopNavAutoCollapsed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notificationCloseSignal, setNotificationCloseSignal] = useState(0);
  const [authReady, setAuthReady] = useState(false);
  const [shellEnhancementsPrimed, setShellEnhancementsPrimed] = useState(false);
  const [showStartupIssues, setShowStartupIssues] = useState(false);
  const [startupIssues, setStartupIssues] = useState<string[]>([]);
  const [startupFixInstructions, setStartupFixInstructions] = useState<
    string[]
  >([]);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { showPrompt } = useDashboardPromptState();
  const [openCreatePost, setOpenCreatePost] = useState(false);
  const userMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const userMenuPanelRef = useRef<HTMLDivElement | null>(null);
  const [userMenuDesktopStyle, setUserMenuDesktopStyle] =
    useState<CSSProperties>({
      top: 0,
      left: 0,
      width: "16rem",
    });
  const shellEnhancementsReady = authReady && shellEnhancementsPrimed;
  const currentUserId = user?.id ?? null;
  const chatUnreadCount = useUnreadChatCount(
    authReady && shellEnhancementsReady,
    currentUserId,
  );
  const myProfileHref =
    !profileLoading && profile && isProfileOnboardingComplete(profile)
      ? buildPublicProfilePath(profile) || "/dashboard/profile"
      : "/dashboard/profile";
  const publicProfileMenuLabel =
    myProfileHref === "/dashboard/profile"
      ? "Complete Profile"
      : "View Public Profile";
  const navigationTabs = baseNavigationTabs;
  const desktopNavCollapsed =
    desktopNavAutoCollapsed || desktopNavManuallyCollapsed;
  const isDesktopUserMenu = !desktopNavAutoCollapsed;
  const canUseDOM = typeof document !== "undefined";
  const chatBadgeLabel =
    chatUnreadCount > 9
      ? "9+"
      : chatUnreadCount > 0
        ? String(chatUnreadCount)
        : null;
  const isChatRouteActive = pathname === "/dashboard/chat";
  const isFeedLandingRoute =
    pathname === "/dashboard";
  const hideFloatingPostAction =
    pathname.startsWith("/dashboard/chat") ||
    pathname.startsWith("/dashboard/tasks") ||
    pathname.startsWith("/dashboard/create_post") ||
    (desktopNavAutoCollapsed && isFeedLandingRoute);
  const shellIconButtonClassName =
    "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:border-[var(--brand-500)]/40 hover:text-[var(--brand-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-400)] focus-visible:ring-offset-2 md:h-9 md:w-9 md:rounded-xl";

  const updateUserMenuPosition = useCallback((anchor?: HTMLElement | null) => {
    if (typeof window === "undefined") return;

    const trigger = anchor ?? userMenuTriggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const panelWidth = 256;
    const viewportPadding = 12;
    const left = Math.min(
      Math.max(viewportPadding, rect.right - panelWidth),
      Math.max(viewportPadding, window.innerWidth - panelWidth - viewportPadding),
    );

    setUserMenuDesktopStyle({
      top: rect.bottom + 8,
      left,
      width: `${panelWidth}px`,
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const syncDesktopNavCollapse = () => {
      setDesktopNavAutoCollapsed(mediaQuery.matches);
    };

    syncDesktopNavCollapse();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncDesktopNavCollapse);
      return () =>
        mediaQuery.removeEventListener("change", syncDesktopNavCollapse);
    }

    mediaQuery.addListener(syncDesktopNavCollapse);
    return () => mediaQuery.removeListener(syncDesktopNavCollapse);
  }, []);

  useEffect(() => {
    let active = true;
    let redirectTimer: number | null = null;

    const verifySession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;

      if (session?.user) {
        setAuthReady(true);
        return;
      }

      // Give auth callbacks a short window to hydrate session before redirecting.
      redirectTimer = window.setTimeout(async () => {
        if (!active) return;
        const {
          data: { session: retrySession },
        } = await supabase.auth.getSession();

        if (!active) return;
        if (retrySession?.user) {
          setAuthReady(true);
          return;
        }

        setAuthReady(false);
        setShellEnhancementsPrimed(false);
        router.replace("/");
      }, 8000);
    };

    void verifySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (session?.user) {
        if (redirectTimer) {
          window.clearTimeout(redirectTimer);
          redirectTimer = null;
        }
        setAuthReady(true);
        return;
      }

      if (event === "SIGNED_OUT") {
        setAuthReady(false);
        setShellEnhancementsPrimed(false);
        router.replace("/");
        return;
      }
    });

    return () => {
      active = false;
      if (redirectTimer) {
        window.clearTimeout(redirectTimer);
      }
      subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (!authReady || shellEnhancementsPrimed) return;

    const cancelIdleTask = scheduleClientIdleTask(() => {
      setShellEnhancementsPrimed(true);
    }, 1800);

    return cancelIdleTask;
  }, [authReady, shellEnhancementsPrimed]);

  useEffect(() => {
    if (!authReady || !shellEnhancementsReady) return;
    let active = true;

    const runStartupCheck = async () => {
      if (
        typeof window !== "undefined" &&
        window.sessionStorage.getItem(STARTUP_CHECK_SESSION_KEY) === "1"
      ) {
        return;
      }

      if (!active) return;

      try {
        const payload = await fetchAuthedJson<{
          ok?: boolean;
          admin?: boolean;
          issues?: string[];
          fixInstructions?: string[];
        }>(supabase, "/api/system/startup-check", {
          method: "GET",
        });

        if (!active) return;

        const adminStatus = payload?.admin === true;
        setIsAdmin(adminStatus);

        if (!adminStatus) {
          setShowStartupIssues(false);
          setStartupIssues([]);
          setStartupFixInstructions([]);
          return;
        }

        const issues = Array.isArray(payload.issues)
          ? payload.issues.filter(Boolean)
          : [];
        const fixInstructions = Array.isArray(payload.fixInstructions)
          ? payload.fixInstructions.filter(Boolean)
          : [];

        setStartupIssues(issues);
        setStartupFixInstructions(fixInstructions);
        setShowStartupIssues(!payload.ok && issues.length > 0);

        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(STARTUP_CHECK_SESSION_KEY, "1");
        }
      } catch {
        // Ignore startup-check transport errors for non-blocking UX.
      }
    };

    void runStartupCheck();

    return () => {
      active = false;
    };
  }, [authReady, shellEnhancementsReady]);

  useEffect(() => {
    if (!authReady || !shellEnhancementsReady) return;
    let active = true;

    const pingPresence = async () => {
      if (!active) return;

      try {
        await fetchAuthedJson(supabase, "/api/presence/ping", {
          method: "POST",
          body: JSON.stringify({
            isOnline: document.visibilityState === "visible",
            availability:
              document.visibilityState === "visible" ? "available" : "away",
            responseSlaMinutes: 15,
          }),
        });
      } catch {
        // Presence ping is best effort.
      }
    };

    void pingPresence();
    const presenceIntervalId = window.setInterval(() => {
      void pingPresence();
    }, 45 * 1000);

    const handleVisibilityChange = () => {
      void pingPresence();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(presenceIntervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [authReady, shellEnhancementsReady]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setShowUserMenu(false);
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [pathname]);

  useEffect(() => {
    if (!showUserMenu || !isDesktopUserMenu) return;

    const handleLayoutChange = () => {
      updateUserMenuPosition();
    };

    window.addEventListener("resize", handleLayoutChange);
    window.addEventListener("scroll", handleLayoutChange, true);

    return () => {
      window.removeEventListener("resize", handleLayoutChange);
      window.removeEventListener("scroll", handleLayoutChange, true);
    };
  }, [isDesktopUserMenu, showUserMenu, updateUserMenuPosition]);

  useEffect(() => {
    if (!showUserMenu) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        userMenuPanelRef.current?.contains(target) ||
        userMenuTriggerRef.current?.contains(target)
      ) {
        return;
      }

      setShowUserMenu(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowUserMenu(false);
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
  }, [showUserMenu]);

  useEffect(() => {
    if (!showUserMenu || isDesktopUserMenu) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isDesktopUserMenu, showUserMenu]);

  if (!authReady) {
    return (
      <div className="min-h-screen grid place-items-center bg-[var(--surface-app)]">
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 shadow-sm">
          Loading dashboard...
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Auth state change handler will redirect; push is a safety net.
  };

  const userMenu =
    showUserMenu && canUseDOM
      ? createPortal(
          <>
            {!isDesktopUserMenu ? (
              <button
                type="button"
                onClick={() => setShowUserMenu(false)}
                className="fixed inset-0 z-[var(--layer-popover-backdrop)] bg-slate-950/10"
                aria-hidden
              />
            ) : null}
            <div
              ref={userMenuPanelRef}
              className={`z-[var(--layer-popover)] overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white shadow-2xl shadow-slate-900/15 ${
                isDesktopUserMenu
                  ? "fixed rounded-2xl"
                  : "fixed inset-x-3 top-[calc(env(safe-area-inset-top)+4.75rem)]"
              }`}
              style={isDesktopUserMenu ? userMenuDesktopStyle : undefined}
            >
              <div className="border-b border-slate-100 px-4 py-3.5">
                <p className="truncate text-sm font-bold text-slate-900">
                  {profile?.full_name || profile?.name || appName}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  ServiQ account
                </p>
              </div>
              <div className="p-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    router.push(myProfileHref);
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  <User className="h-4 w-4 shrink-0 text-slate-400" />
                  {publicProfileMenuLabel}
                </button>
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      router.push("/dashboard/admin");
                    }}
                    className="mt-1 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                  >
                    <Shield className="h-4 w-4 shrink-0 text-slate-400" />
                    Admin
                  </button>
                ) : null}
                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowLogoutConfirm(true);
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  Logout
                </button>
              </div>
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <div className="min-h-screen overflow-x-clip bg-[var(--surface-app)] text-slate-900">
      <div className="flex min-h-screen">
        <aside
          className={`hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-r lg:border-slate-200 lg:bg-white lg:shadow-[0_20px_46px_-42px_rgba(15,23,42,0.65)] lg:transition-[width] lg:duration-200 ${
            desktopNavCollapsed ? "md:w-24" : "md:w-72"
          }`}
        >
          <div
            className={`border-b border-slate-200 ${desktopNavCollapsed ? "px-3 py-5" : "px-6 py-6"}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                {desktopNavCollapsed ? (
                  <ServiQLogo
                    compact
                    markOnly
                    href="/dashboard"
                    ariaLabel="Open Market dashboard"
                  />
                ) : (
                  <ServiQLogo
                    className="max-w-[220px]"
                    href="/dashboard"
                    ariaLabel="Open Market dashboard"
                  />
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setDesktopNavManuallyCollapsed((current) => !current)
                  }
                  className="hidden lg:inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:border-[var(--brand-500)]/40 hover:text-[var(--brand-700)]"
                  aria-label={
                    desktopNavCollapsed
                      ? "Expand navigation"
                      : "Collapse navigation"
                  }
                  title={
                    desktopNavCollapsed
                      ? "Expand navigation"
                      : "Collapse navigation"
                  }
                >
                  {desktopNavCollapsed ? (
                    <ChevronsRight className="w-4 h-4" />
                  ) : (
                    <ChevronsLeft className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <nav
            className={`flex-1 py-6 space-y-2 overflow-y-auto ${desktopNavCollapsed ? "px-2" : "px-4"}`}
          >
            {navigationTabs.map((tab) => {
              const isActive = isNavigationTabActive(pathname, tab.path);
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.path}
                  href={tab.path}
                  title={desktopNavCollapsed ? tab.name : undefined}
                  className={`flex items-center rounded-xl text-sm font-semibold transition-all duration-200 ${
                    desktopNavCollapsed
                      ? "justify-center px-3 py-3"
                      : "justify-between px-4 py-3"
                  } ${
                    isActive
                      ? "bg-[var(--brand-900)] text-white shadow-[0_12px_26px_-18px_rgba(15,23,42,0.85)]"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <span
                    className={`flex min-w-0 items-center ${desktopNavCollapsed ? "" : "gap-3"}`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    {desktopNavCollapsed ? (
                      <span className="sr-only">{tab.name}</span>
                    ) : (
                      tab.name
                    )}
                  </span>
                </Link>
              );
            })}
          </nav>

          {!desktopNavCollapsed && secondaryNavItems.length > 0 && (
            <div className="border-t border-slate-100 px-4 py-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                More
              </p>
              <div className="space-y-1">
                {secondaryNavItems.map((item) => {
                  const isActive = isNavigationTabActive(pathname, item.path);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                        isActive
                          ? "bg-slate-100 text-slate-900"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          <div
            className={`border-t border-slate-200 ${desktopNavCollapsed ? "px-2 py-4" : "px-4 py-4"}`}
          >
            <div
              className={`rounded-[1.65rem] border border-slate-200 bg-slate-50/85 shadow-[0_18px_36px_-34px_rgba(15,23,42,0.55)] ${
                desktopNavCollapsed
                  ? "space-y-2 px-2 py-2.5"
                  : "space-y-2.5 px-3 py-3"
              }`}
            >
              <button
                className={`w-full flex items-center justify-center rounded-2xl bg-slate-900 font-semibold text-white transition-colors hover:bg-slate-800 ${
                  desktopNavCollapsed ? "px-3 py-3" : "gap-2 px-4 py-3"
                }`}
                onClick={() => setShowLogoutConfirm(true)}
                title={desktopNavCollapsed ? "Logout" : undefined}
                aria-label="Logout"
              >
                <LogOut className="w-4 h-4" />
                {!desktopNavCollapsed && (
                  <span className="text-sm">Logout</span>
                )}
              </button>
            </div>
          </div>
        </aside>

        <div className="flex-1 flex min-w-0 flex-col overflow-x-clip">
          <header className="sticky top-0 z-40 overflow-x-clip border-b border-slate-200/80 bg-white/96 shadow-[0_10px_24px_-22px_rgba(15,23,42,0.45)] backdrop-blur-none md:bg-white/92 md:shadow-[0_16px_30px_-28px_rgba(15,23,42,0.55)] md:backdrop-blur-xl">
            <div
              className="flex min-h-16 items-center gap-2.5 px-3 sm:px-6 sm:gap-3 lg:px-8"
              style={{ paddingTop: "env(safe-area-inset-top)" }}
            >
              <div className="relative flex min-w-0 shrink-0 items-center gap-3">
                {/* Mobile (xs): logo shortcut to Welcome */}
                <div className="sm:hidden">
                  <ServiQLogo
                    markOnly
                    href="/dashboard"
                    ariaLabel="Open Market dashboard"
                  />
                </div>
                {/* Tablet (sm-lg): compact logo shortcut to Welcome */}
                <div className="hidden sm:block lg:hidden min-w-0">
                  <ServiQLogo
                    compact
                    className="max-w-[180px]"
                    href="/dashboard"
                    ariaLabel="Open Market dashboard"
                  />
                </div>
              </div>

              <div className="hidden lg:flex min-w-0 flex-1 justify-center px-2">
                <DashboardPromptBar placement="header" />
              </div>

              <div className="ml-auto flex shrink-0 items-center gap-1 max-[360px]:gap-0.5 sm:gap-1.5">
                <DashboardChatShortcut
                  active={isChatRouteActive}
                  badgeLabel={chatBadgeLabel}
                  unreadCount={chatUnreadCount}
                  className={shellIconButtonClassName}
                />
                {/* Map icon — visible on all screen sizes */}
                {/* Cart button — visible on all screen sizes */}
                <NotificationCenter
                  enabled={shellEnhancementsReady}
                  userId={currentUserId}
                  closeSignal={notificationCloseSignal}
                  onOpenChange={(isOpen) => {
                    if (isOpen) {
                      setShowUserMenu(false);
                    }
                  }}
                />
                <div className="relative z-[var(--layer-popover)]">
                  <button
                    ref={userMenuTriggerRef}
                    type="button"
                    onClick={(event) => {
                      const nextOpen = !showUserMenu;
                      if (nextOpen) {
                        updateUserMenuPosition(event.currentTarget);
                        setNotificationCloseSignal((current) => current + 1);
                      }
                      setShowUserMenu(nextOpen);
                    }}
                    aria-label="Open account menu"
                    aria-expanded={showUserMenu}
                    title="Account"
                    className={`${shellIconButtonClassName} ${
                      showUserMenu
                        ? "border-[var(--brand-500)]/60 text-[var(--brand-700)]"
                        : ""
                    }`}
                  >
                    <User className="w-4 h-4" />
                  </button>
                </div>
                {userMenu}
              </div>
            </div>
            {showPrompt ? (
              <div className="border-t border-slate-200/80 px-3 pb-3 pt-2.5 sm:px-4 lg:hidden">
                <DashboardPromptBar placement="header" />
              </div>
            ) : null}
          </header>

          <main className="flex-1 overflow-x-clip px-3 pt-4 pb-[calc(8.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-6 sm:pb-8 lg:px-8 lg:py-8 lg:pb-8">
            {showStartupIssues && (
              <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-800">
                <p className="text-sm font-semibold">
                  Startup schema checks need admin action
                </p>
                <ul className="mt-2 list-disc pl-5 text-xs space-y-1">
                  {startupIssues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
                {startupFixInstructions.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold">Fix instructions</p>
                    <ul className="mt-1 list-disc pl-5 text-xs space-y-1">
                      {startupFixInstructions.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            <OnboardingGuard>{children}</OnboardingGuard>
            <QuickOnboardingSheet />
            <PushNotificationSubscriber />
          </main>
        </div>
      </div>

      {!hideFloatingPostAction && (
        <button
          type="button"
          onClick={() => {
            setShowUserMenu(false);
            setOpenCreatePost(true);
          }}
          aria-label="Post a need"
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-[var(--layer-floating-action)] inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--brand-900)] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-400)] focus-visible:ring-offset-2 md:bottom-6 md:right-6 md:min-h-12 md:px-5"
        >
          <Plus className="h-4 w-4" />
          <span>Post Need</span>
        </button>
      )}
      {openCreatePost && (
        <CreatePostModal
          open={openCreatePost}
          onClose={() => setOpenCreatePost(false)}
          allowedPostTypes={["need"]}
          onPublished={(result?: PublishPostResult) => {
            setOpenCreatePost(false);
            if (result?.helpRequestId) {
              router.push(
                `/dashboard?focus=${encodeURIComponent(result.helpRequestId)}&source=create_post`,
              );
            } else if (result?.postType === "need") {
              router.push("/dashboard");
            }
          }}
        />
      )}

      <CartDrawer />

      {/* ── Mobile bottom navigation bar ───────────────────────────── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-[var(--layer-mobile-nav)] border-t border-slate-200/90 bg-white/98 shadow-[0_-14px_36px_-28px_rgba(15,23,42,0.42)] backdrop-blur-none lg:hidden"
        aria-label="Main navigation"
      >
        <div
          className="grid gap-1 px-2 pt-2 [padding-bottom:calc(env(safe-area-inset-bottom)+0.5rem)]"
          style={{
            gridTemplateColumns: `repeat(${navigationTabs.length}, minmax(0, 1fr))`,
          }}
        >
          {navigationTabs.map((tab) => {
            const isActive = isNavigationTabActive(pathname, tab.path);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.path}
                href={tab.path}
                className={`relative flex min-h-[4.15rem] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-semibold transition ${
                  navigationTabs.length >= 5 ? "text-[9px]" : "text-[10px]"
                } ${
                  isActive
                    ? "bg-[var(--brand-50)] text-[var(--brand-700)]"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
                aria-label={tab.name}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="h-5 w-5" />
                <span>{tab.name}</span>
                {isActive ? (
                  <span className="absolute top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--brand-600)]" />
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>

      {showLogoutConfirm ? (
        <div className="fixed inset-0 z-[var(--layer-modal)] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-900/20">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-amber-100 p-2 text-amber-700">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-slate-900">
                  Log out of {appName}?
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  You can always sign back in with a magic link sent to your
                  email. Any unsaved local changes on open pages will be
                  lost.
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  void handleLogout();
                }}
                className="inline-flex items-center justify-center rounded-2xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
