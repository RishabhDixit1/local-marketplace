"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import { ProfileProvider, useProfileContext } from "@/app/components/profile/ProfileContext";
import { useCart } from "@/app/components/store/CartContext";
import { appName } from "@/lib/branding";
import { scheduleClientIdleTask } from "@/lib/clientIdle";
import useUnreadChatCount from "@/lib/hooks/useUnreadChatCount";
import { buildPublicProfilePath, isProfileOnboardingComplete } from "@/lib/profile/utils";
import {
  AlertTriangle,
  BriefcaseBusiness,
  Bookmark,
  ClipboardList,
  ChevronsLeft,
  ChevronsRight,
  Home,
  LogOut,
  Map,
  MessageCircle,
  Newspaper,
  Plus,
  Settings,
  ShoppingBag,
  User,
  Users,
} from "lucide-react";

import type { PublishPostResult } from "@/app/components/CreatePostModal";

const CreatePostModal = dynamic(() => import("@/app/components/CreatePostModal").then((mod) => mod.default), {
  ssr: false,
});

const AvailabilityToggle = dynamic(
  () => import("@/app/components/AvailabilityToggle").then((m) => ({ default: m.AvailabilityToggle })),
  { ssr: false }
);

const CartDrawer = dynamic(
  () => import("@/app/components/store/CartDrawer").then((m) => ({ default: m.CartDrawer })),
  { ssr: false }
);

const GlobalMapView = dynamic(
  () => import("@/app/dashboard/components/GlobalMapView"),
  { ssr: false }
);

const baseNavigationTabs = [
  { name: "Welcome", path: "/dashboard/welcome", icon: Home },
  { name: "Explore", path: "/dashboard", icon: Newspaper },
  { name: "People", path: "/dashboard/people", icon: Users },
  { name: "Tasks", path: "/dashboard/tasks", icon: ClipboardList },
  { name: "Control", path: "/dashboard/provider", icon: BriefcaseBusiness },
];

const STARTUP_CHECK_SESSION_KEY = "serviq-startup-check-ran";

const isNavigationTabActive = (pathname: string, path: string) =>
  path === "/dashboard/provider" ? pathname === path || pathname.startsWith("/dashboard/provider/") : pathname === path;

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
        unreadCount > 0 ? `Open chat inbox, ${unreadCount} unread message${unreadCount === 1 ? "" : "s"}` : "Open chat inbox"
      }
      aria-current={active ? "page" : undefined}
      title="Chat"
      className={`relative ${className} ${active ? "border-[var(--brand-500)]/60 bg-[var(--brand-900)] text-white" : ""}`}
    >
      <MessageCircle className="h-4 w-4" />
      {badgeLabel ? (
        <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-rose-500 px-1 py-0.5 text-[9px] font-bold leading-none text-white ring-2 ring-white">
          {badgeLabel}
        </span>
      ) : null}
    </Link>
  );
}

function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading: profileLoading } = useProfileContext();
  const [desktopNavManuallyCollapsed, setDesktopNavManuallyCollapsed] = useState(false);
  const [desktopNavAutoCollapsed, setDesktopNavAutoCollapsed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [shellEnhancementsPrimed, setShellEnhancementsPrimed] = useState(false);
  const [showStartupIssues, setShowStartupIssues] = useState(false);
  const [startupIssues, setStartupIssues] = useState<string[]>([]);
  const [startupFixInstructions, setStartupFixInstructions] = useState<string[]>([]);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showGlobalMap, setShowGlobalMap] = useState(false);
  const { totalItems: cartCount, openCart } = useCart();
  const { showPrompt } = useDashboardPromptState();
  const [openCreatePost, setOpenCreatePost] = useState(false);
  const [openQuickActions, setOpenQuickActions] = useState(false);
  const shellEnhancementsReady = authReady && shellEnhancementsPrimed;
  const currentUserId = user?.id ?? null;
  const chatUnreadCount = useUnreadChatCount(authReady && shellEnhancementsReady, currentUserId);
  const myProfileHref =
    !profileLoading && profile && isProfileOnboardingComplete(profile)
      ? buildPublicProfilePath(profile) || "/dashboard/profile"
      : "/dashboard/profile";
  const navigationTabs = baseNavigationTabs;
  const desktopNavCollapsed = desktopNavAutoCollapsed || desktopNavManuallyCollapsed;
  const chatBadgeLabel = chatUnreadCount > 9 ? "9+" : chatUnreadCount > 0 ? String(chatUnreadCount) : null;
  const isChatRouteActive = pathname === "/dashboard/chat";
  const hideFloatingQuickActions =
    pathname.startsWith("/dashboard/chat") || pathname.startsWith("/dashboard/create_post");
  const shellIconButtonClassName =
    "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors hover:border-[var(--brand-500)]/40 hover:text-[var(--brand-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-400)] focus-visible:ring-offset-2 sm:h-8 sm:w-8 sm:rounded-lg";

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const syncDesktopNavCollapse = () => {
      setDesktopNavAutoCollapsed(mediaQuery.matches);
    };

    syncDesktopNavCollapse();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncDesktopNavCollapse);
      return () => mediaQuery.removeEventListener("change", syncDesktopNavCollapse);
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
        setAccessToken(session.access_token || "");
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
          setAccessToken(retrySession.access_token || "");
          setAuthReady(true);
          return;
        }

        setAccessToken("");
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
        setAccessToken(session.access_token || "");
        setAuthReady(true);
        return;
      }

      if (event === "SIGNED_OUT") {
        setAccessToken("");
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
    if (!authReady || !accessToken || !shellEnhancementsReady) return;
    let active = true;

    const runStartupCheck = async () => {
      if (typeof window !== "undefined" && window.sessionStorage.getItem(STARTUP_CHECK_SESSION_KEY) === "1") {
        return;
      }

      if (!active || !accessToken) return;

      try {
        const response = await fetch("/api/system/startup-check", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const payload = (await response.json().catch(() => null)) as {
          ok?: boolean;
          admin?: boolean;
          issues?: string[];
          fixInstructions?: string[];
        } | null;

        if (!active) return;

        if (!payload?.admin) {
          setShowStartupIssues(false);
          setStartupIssues([]);
          setStartupFixInstructions([]);
          return;
        }

        const issues = Array.isArray(payload.issues) ? payload.issues.filter(Boolean) : [];
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
  }, [accessToken, authReady, shellEnhancementsReady]);

  useEffect(() => {
    if (!authReady || !accessToken || !shellEnhancementsReady) return;
    let active = true;

    const pingPresence = async () => {
      if (!active || !accessToken) return;

      try {
        await fetch("/api/presence/ping", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            isOnline: document.visibilityState === "visible",
            availability: document.visibilityState === "visible" ? "available" : "away",
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
  }, [accessToken, authReady, shellEnhancementsReady]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setShowUserMenu(false);
      setOpenQuickActions(false);
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [pathname]);

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
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-[var(--surface-app)] text-slate-900">
      <div className="flex min-h-screen">
        <aside
          className={`hidden md:sticky md:top-0 md:flex md:h-screen md:flex-col md:border-r md:border-slate-200 md:bg-white md:shadow-[0_20px_46px_-42px_rgba(15,23,42,0.65)] md:transition-[width] md:duration-200 ${
            desktopNavCollapsed ? "md:w-24" : "md:w-72"
          }`}
        >
          <div className={`border-b border-slate-200 ${desktopNavCollapsed ? "px-3 py-5" : "px-6 py-6"}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                {desktopNavCollapsed ? (
                  <ServiQLogo compact markOnly href="/dashboard/welcome" ariaLabel="Open Welcome dashboard" />
                ) : (
                  <ServiQLogo className="max-w-[220px]" href="/dashboard/welcome" ariaLabel="Open Welcome dashboard" />
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setDesktopNavManuallyCollapsed((current) => !current)}
                  className="hidden lg:inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:border-[var(--brand-500)]/40 hover:text-[var(--brand-700)]"
                  aria-label={desktopNavCollapsed ? "Expand navigation" : "Collapse navigation"}
                  title={desktopNavCollapsed ? "Expand navigation" : "Collapse navigation"}
                >
                  {desktopNavCollapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <nav className={`flex-1 py-6 space-y-2 overflow-y-auto ${desktopNavCollapsed ? "px-2" : "px-4"}`}>
            {navigationTabs.map((tab) => {
              const isActive = isNavigationTabActive(pathname, tab.path);
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.path}
                  href={tab.path}
                  title={desktopNavCollapsed ? tab.name : undefined}
                  className={`flex items-center rounded-xl text-sm font-semibold transition-all duration-200 ${
                    desktopNavCollapsed ? "justify-center px-3 py-3" : "justify-between px-4 py-3"
                  } ${
                    isActive
                      ? "bg-[var(--brand-900)] text-white shadow-[0_12px_26px_-18px_rgba(15,23,42,0.85)]"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <span className={`flex min-w-0 items-center ${desktopNavCollapsed ? "" : "gap-3"}`}>
                    <Icon className="w-5 h-5 shrink-0" />
                    {desktopNavCollapsed ? <span className="sr-only">{tab.name}</span> : tab.name}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className={`border-t border-slate-200 ${desktopNavCollapsed ? "px-2 py-4" : "px-4 py-4"}`}>
            <div
              className={`rounded-[1.65rem] border border-slate-200 bg-slate-50/85 shadow-[0_18px_36px_-34px_rgba(15,23,42,0.55)] ${
                desktopNavCollapsed ? "space-y-2 px-2 py-2.5" : "space-y-2.5 px-3 py-3"
              }`}
            >
              <Link
                href="/dashboard/settings"
                title={desktopNavCollapsed ? "Settings" : undefined}
                className={`w-full flex items-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:border-[var(--brand-500)]/45 hover:text-slate-900 ${
                  desktopNavCollapsed ? "justify-center px-3 py-3" : "gap-3 px-4 py-3"
                }`}
                aria-label="Settings"
              >
                <Settings className="w-5 h-5 shrink-0" />
                {!desktopNavCollapsed && <span className="text-sm font-semibold">Settings</span>}
              </Link>
              <button
                onClick={() => router.push(myProfileHref)}
                title={desktopNavCollapsed ? "My Profile" : undefined}
                className={`w-full flex items-center rounded-2xl border border-slate-200 bg-white shadow-sm transition-colors hover:border-[var(--brand-500)]/45 ${
                  desktopNavCollapsed ? "justify-center px-3 py-3" : "gap-3 px-4 py-3"
                }`}
                aria-label="Open my profile"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--brand-900)]">
                  <User className="w-4 h-4 text-white" />
                </div>
                {!desktopNavCollapsed && (
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-900">My Profile</p>
                    <p className="text-xs text-slate-500">
                      {myProfileHref === "/dashboard/profile" ? "Complete profile" : "View public profile"}
                    </p>
                  </div>
                )}
              </button>
              <button
                className={`w-full flex items-center justify-center rounded-2xl bg-slate-900 font-semibold text-white transition-colors hover:bg-slate-800 ${
                  desktopNavCollapsed ? "px-3 py-3" : "gap-2 px-4 py-3"
                }`}
                onClick={() => setShowLogoutConfirm(true)}
                title={desktopNavCollapsed ? "Logout" : undefined}
                aria-label="Logout"
              >
                <LogOut className="w-4 h-4" />
                {!desktopNavCollapsed && <span className="text-sm">Logout</span>}
              </button>
            </div>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/92 shadow-[0_16px_30px_-28px_rgba(15,23,42,0.55)] backdrop-blur-xl">
            <div
              className="flex min-h-16 items-center gap-2.5 px-3 sm:px-6 sm:gap-3 lg:px-8"
              style={{ paddingTop: "env(safe-area-inset-top)" }}
            >
              <div className="relative flex min-w-0 shrink-0 items-center gap-3">
                {/* Mobile (xs): logo shortcut to Welcome */}
                <div className="sm:hidden">
                  <ServiQLogo markOnly href="/dashboard/welcome" ariaLabel="Open Welcome dashboard" />
                </div>
                {/* Tablet (sm-lg): compact logo shortcut to Welcome */}
                <div className="hidden sm:block lg:hidden min-w-0">
                  <ServiQLogo compact className="max-w-[180px]" href="/dashboard/welcome" ariaLabel="Open Welcome dashboard" />
                </div>
              </div>

              <div className="hidden md:flex min-w-0 flex-1 justify-center px-2">
                <DashboardPromptBar placement="header" />
              </div>

              <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
                <DashboardChatShortcut
                  active={isChatRouteActive}
                  badgeLabel={chatBadgeLabel}
                  unreadCount={chatUnreadCount}
                  className={shellIconButtonClassName}
                />
                {/* Map icon — visible on all screen sizes */}
                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    setOpenQuickActions(false);
                    setShowGlobalMap(true);
                  }}
                  aria-label="Open map view"
                  title="Map view"
                  className={shellIconButtonClassName}
                >
                  <Map className="w-4 h-4" />
                </button>
                {/* Cart button — visible on all screen sizes */}
                <button
                  type="button"
                  onClick={openCart}
                  aria-label={cartCount > 0 ? `Open cart, ${cartCount} item${cartCount === 1 ? "" : "s"}` : "Open cart"}
                  title="Cart"
                  className={`relative ${shellIconButtonClassName}`}
                >
                  <ShoppingBag className="w-4 h-4" />
                  {cartCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[var(--brand-900)] px-0.5 text-[9px] font-bold leading-none text-white">
                      {cartCount > 9 ? "9+" : cartCount}
                    </span>
                  )}
                </button>
                <AvailabilityToggle />
                <NotificationCenter enabled={shellEnhancementsReady} userId={currentUserId} />
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenQuickActions(false);
                      setShowUserMenu((current) => !current);
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

                  {showUserMenu ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowUserMenu(false)}
                        className="fixed inset-0 z-[var(--layer-popover-backdrop)] bg-slate-950/10 md:bg-transparent"
                        aria-hidden
                      />
                      <div className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+4.75rem)] z-[var(--layer-popover)] overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white shadow-2xl shadow-slate-900/15 md:absolute md:right-0 md:top-full md:mt-2 md:w-64 md:rounded-2xl md:inset-x-auto">
                        <div className="border-b border-slate-100 px-4 py-3.5">
                          <p className="truncate text-sm font-bold text-slate-900">
                            {profile?.full_name || profile?.name || appName}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">ServiQ account</p>
                        </div>
                        <div className="p-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowUserMenu(false);
                              router.push("/dashboard/saved");
                            }}
                            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            <Bookmark className="h-4 w-4 shrink-0 text-slate-400" />
                            Saved
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowUserMenu(false);
                              router.push(myProfileHref);
                            }}
                            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            <User className="h-4 w-4 shrink-0 text-slate-400" />
                            View Profile
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowUserMenu(false);
                              router.push("/dashboard/settings");
                            }}
                            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            <Settings className="h-4 w-4 shrink-0 text-slate-400" />
                            Settings
                          </button>
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
                    </>
                  ) : null}
                </div>
              </div>
            </div>
            {showPrompt ? (
              <div className="border-t border-slate-200/80 px-3 pb-3 pt-2.5 sm:px-4 md:hidden">
                <DashboardPromptBar placement="header" />
              </div>
            ) : null}
          </header>

          <main className="flex-1 px-3 pt-4 pb-[calc(6.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-6 sm:pb-8 lg:px-8 md:py-8 md:pb-8">
            {showStartupIssues && (
              <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-800">
                <p className="text-sm font-semibold">Startup schema checks need admin action</p>
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
          </main>
        </div>
      </div>

      {!hideFloatingQuickActions && (
        <>
          <button
            type="button"
            onClick={() => {
              setShowUserMenu(false);
              setOpenQuickActions((current) => !current);
            }}
            aria-label="Open quick actions"
            aria-expanded={openQuickActions}
            className={`fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-4 z-[var(--layer-floating-action)] inline-flex h-14 w-14 items-center justify-center rounded-[1.65rem] bg-[var(--brand-900)] text-white shadow-[0_20px_44px_-24px_rgba(15,23,42,0.8)] transition hover:bg-[var(--brand-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-400)] focus-visible:ring-offset-2 md:bottom-6 md:right-6 ${
              openQuickActions ? "rotate-45 bg-[var(--brand-700)]" : ""
            }`}
          >
            <Plus className="h-6 w-6" />
          </button>

          {openQuickActions ? (
            <>
              <button
                type="button"
                onClick={() => setOpenQuickActions(false)}
                aria-hidden
                className="fixed inset-0 z-[var(--layer-popover-backdrop)] bg-slate-950/15"
              />
              <div className="fixed inset-x-3 bottom-[calc(6.95rem+env(safe-area-inset-bottom))] z-[var(--layer-popover)] rounded-[1.75rem] border border-slate-200 bg-white p-2.5 shadow-2xl shadow-slate-900/15 md:bottom-24 md:right-6 md:left-auto md:w-[220px] md:rounded-2xl md:p-2">
                <div className="px-1 pb-2 md:hidden">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Quick actions</p>
                  <p className="mt-1 text-sm text-slate-600">Publish or manage something fast from anywhere in the dashboard.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOpenQuickActions(false);
                    router.push("/dashboard/provider/add-service");
                  }}
                  className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 md:rounded-xl md:border-transparent md:py-2"
                >
                  Offer Service
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenQuickActions(false);
                    router.push("/dashboard/provider/add-product");
                  }}
                  className="mt-1.5 w-full rounded-2xl border border-slate-200 px-3 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 md:mt-1 md:rounded-xl md:border-transparent md:py-2"
                >
                  List Product
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenQuickActions(false);
                    setOpenCreatePost(true);
                  }}
                  className="mt-1.5 w-full rounded-2xl border border-slate-200 px-3 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 md:mt-1 md:rounded-xl md:border-transparent md:py-2"
                >
                  Post a Need
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenQuickActions(false);
                    router.push("/dashboard/provider");
                  }}
                  className="mt-1.5 w-full rounded-2xl border border-slate-200 px-3 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 md:mt-1 md:rounded-xl md:border-transparent md:py-2"
                >
                  Manage Store
                </button>
              </div>
            </>
          ) : null}
        </>
      )}
      {openCreatePost && (
        <CreatePostModal
          open={openCreatePost}
          onClose={() => setOpenCreatePost(false)}
          allowedPostTypes={["need"]}
          onPublished={(result?: PublishPostResult) => {
            setOpenCreatePost(false);
            if (result?.helpRequestId) {
              router.push(`/dashboard?focus=${encodeURIComponent(result.helpRequestId)}&source=create_post`);
            } else if (result?.postType === "need") {
              router.push("/dashboard");
            }
          }}
        />
      )}

      <CartDrawer />

      <GlobalMapView open={showGlobalMap} onClose={() => setShowGlobalMap(false)} />

      {/* ── Mobile bottom navigation bar ───────────────────────────── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-[var(--layer-mobile-nav)] border-t border-slate-200/90 bg-white/95 shadow-[0_-18px_44px_-30px_rgba(15,23,42,0.55)] backdrop-blur-xl md:hidden"
        aria-label="Main navigation"
      >
        <div
          className="grid gap-1 px-2 pt-2 [padding-bottom:calc(env(safe-area-inset-bottom)+0.5rem)]"
          style={{ gridTemplateColumns: `repeat(${navigationTabs.length}, minmax(0, 1fr))` }}
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
                {isActive ? <span className="absolute top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--brand-600)]" /> : null}
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
                <h2 className="text-lg font-semibold text-slate-900">Log out of {appName}?</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  You can always sign back in with your phone number and password, use OTP recovery if you forget it, or open an email magic link. Any unsaved local changes on open pages will be lost.
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
