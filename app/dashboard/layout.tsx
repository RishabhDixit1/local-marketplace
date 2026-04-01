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
import { appName } from "@/lib/branding";
import { scheduleClientIdleTask } from "@/lib/clientIdle";
import useUnreadChatCount from "@/lib/hooks/useUnreadChatCount";
import { buildPublicProfilePath, isProfileOnboardingComplete } from "@/lib/profile/utils";
import {
  AlertTriangle,
  Bookmark,
  ClipboardList,
  ChevronsLeft,
  ChevronsRight,
  Home,
  LogOut,
  MessageCircle,
  Newspaper,
  Plus,
  Settings,
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

const navigationTabs = [
  { name: "Welcome", path: "/dashboard/welcome", icon: Home },
  { name: "Explore", path: "/dashboard", icon: Newspaper },
  { name: "People", path: "/dashboard/people", icon: Users },
  { name: "Tasks", path: "/dashboard/tasks", icon: ClipboardList },
  { name: "Chat", path: "/dashboard/chat", icon: MessageCircle },
];

const STARTUP_CHECK_SESSION_KEY = "serviq-startup-check-ran";

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

function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, loading: profileLoading } = useProfileContext();
  const [desktopNavCollapsed, setDesktopNavCollapsed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [shellEnhancementsPrimed, setShellEnhancementsPrimed] = useState(false);
  const [showStartupIssues, setShowStartupIssues] = useState(false);
  const [startupIssues, setStartupIssues] = useState<string[]>([]);
  const [startupFixInstructions, setStartupFixInstructions] = useState<string[]>([]);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const { showPrompt } = useDashboardPromptState();
  const [openCreatePost, setOpenCreatePost] = useState(false);
  const [openQuickActions, setOpenQuickActions] = useState(false);
  const shellEnhancementsReady = authReady && shellEnhancementsPrimed;
  const chatUnreadCount = useUnreadChatCount(authReady && shellEnhancementsReady);
  const myProfileHref =
    !profileLoading && profile && isProfileOnboardingComplete(profile)
      ? buildPublicProfilePath(profile) || "/dashboard/profile"
      : "/dashboard/profile";
  const chatBadgeLabel = chatUnreadCount > 9 ? "9+" : chatUnreadCount > 0 ? String(chatUnreadCount) : null;

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
          className={`hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-r lg:border-slate-200 lg:bg-white lg:shadow-[0_20px_46px_-42px_rgba(15,23,42,0.65)] lg:transition-[width] lg:duration-200 ${
            desktopNavCollapsed ? "lg:w-24" : "lg:w-72"
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
              <button
                type="button"
                onClick={() => setDesktopNavCollapsed((current) => !current)}
                className="hidden lg:inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:border-[var(--brand-500)]/40 hover:text-[var(--brand-700)]"
                aria-label={desktopNavCollapsed ? "Expand navigation" : "Collapse navigation"}
                title={desktopNavCollapsed ? "Expand navigation" : "Collapse navigation"}
              >
                {desktopNavCollapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <nav className={`flex-1 py-6 space-y-2 overflow-y-auto ${desktopNavCollapsed ? "px-2" : "px-4"}`}>
            {navigationTabs.map((tab) => {
              const isActive = pathname === tab.path;
              const Icon = tab.icon;
              const isChatTab = tab.path === "/dashboard/chat";
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
                    <span className="relative inline-flex shrink-0">
                      <Icon className="w-5 h-5 shrink-0" />
                      {desktopNavCollapsed && isChatTab && chatBadgeLabel ? (
                        <span className="absolute -right-2 -top-2 inline-flex min-w-[1.3rem] items-center justify-center rounded-full bg-rose-500 px-1 py-0.5 text-[10px] font-bold leading-none text-white ring-2 ring-white">
                          {chatBadgeLabel}
                        </span>
                      ) : null}
                    </span>
                    {desktopNavCollapsed ? <span className="sr-only">{tab.name}</span> : tab.name}
                  </span>
                  {!desktopNavCollapsed && isChatTab && chatBadgeLabel ? (
                    <span
                      className={`inline-flex min-w-[1.45rem] items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold leading-none ${
                        isActive ? "bg-white/18 text-white ring-1 ring-white/20" : "bg-rose-500 text-white"
                      }`}
                      aria-label={`${chatUnreadCount} unread chat messages`}
                    >
                      {chatBadgeLabel}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className={`border-t border-slate-200 space-y-2 ${desktopNavCollapsed ? "px-2 py-4" : "px-4 py-4"}`}>
            <Link
              href="/dashboard/settings"
              title={desktopNavCollapsed ? "Settings" : undefined}
              className={`w-full flex items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:border-[var(--brand-500)]/45 hover:text-slate-900 ${
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
              className={`w-full flex items-center rounded-xl bg-white border border-slate-200 transition-colors hover:border-[var(--brand-500)]/45 ${
                desktopNavCollapsed ? "justify-center px-3 py-3" : "gap-3 px-4 py-3"
              }`}
              aria-label="Open my profile"
            >
              <div className="w-8 h-8 rounded-lg bg-[var(--brand-900)] flex items-center justify-center">
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
              className={`w-full flex items-center justify-center rounded-xl bg-slate-900 font-semibold text-white transition-colors hover:bg-slate-800 ${
                desktopNavCollapsed ? "px-3 py-3" : "gap-2 px-4 py-2.5"
              }`}
              onClick={() => setShowLogoutConfirm(true)}
              title={desktopNavCollapsed ? "Logout" : undefined}
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
              {!desktopNavCollapsed && <span className="text-sm">Logout</span>}
            </button>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
            <div className="h-16 px-4 sm:px-6 lg:px-8 flex items-center gap-3">
              <div className="relative flex items-center gap-3 min-w-0">
                {/* Mobile (xs): S mark as user-menu trigger */}
                <div className="sm:hidden">
                  <button
                    type="button"
                    onClick={() => setShowUserMenu((p) => !p)}
                    aria-label="Open user menu"
                    aria-expanded={showUserMenu}
                    className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-400)]"
                  >
                    <ServiQLogo markOnly />
                  </button>
                </div>
                {/* Tablet (sm–lg): compact logo as user-menu trigger */}
                <div className="hidden sm:block lg:hidden min-w-0">
                  <button
                    type="button"
                    onClick={() => setShowUserMenu((p) => !p)}
                    aria-label="Open user menu"
                    aria-expanded={showUserMenu}
                    className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-400)]"
                  >
                    <ServiQLogo compact className="max-w-[180px]" />
                  </button>
                </div>

                {/* User menu dropdown */}
                {showUserMenu && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowUserMenu(false)}
                      className="fixed inset-0 z-[1250]"
                      aria-hidden
                    />
                    <div className="absolute left-0 top-full z-[1251] mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15">
                      {/* Profile name header */}
                      {profile?.full_name ? (
                        <div className="border-b border-slate-100 px-4 py-3">
                          <p className="truncate text-sm font-bold text-slate-900">{profile.full_name}</p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">ServiQ account</p>
                        </div>
                      ) : null}
                      <div className="p-1.5">
                        <button
                          type="button"
                          onClick={() => { setShowUserMenu(false); router.push(myProfileHref); }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          <User className="h-4 w-4 shrink-0 text-slate-400" />
                          My Profile
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowUserMenu(false); router.push("/dashboard/saved"); }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          <Bookmark className="h-4 w-4 shrink-0 text-slate-400" />
                          Saved
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowUserMenu(false); router.push("/dashboard/settings"); }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          <Settings className="h-4 w-4 shrink-0 text-slate-400" />
                          Settings
                        </button>
                        <div className="my-1 border-t border-slate-100" />
                        <button
                          type="button"
                          onClick={() => { setShowUserMenu(false); setShowLogoutConfirm(true); }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                        >
                          <LogOut className="h-4 w-4 shrink-0" />
                          Logout
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="hidden md:flex min-w-0 flex-1 justify-center px-2">
                <DashboardPromptBar placement="header" />
              </div>

              <div className="ml-auto flex shrink-0 items-center gap-2">
                {/* Saved & Profile only visible on md+ — on mobile these live in the bottom nav */}
                <Link
                  href="/dashboard/saved"
                  className="hidden md:inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 transition-colors hover:border-[var(--brand-500)]/40 hover:text-[var(--brand-700)]"
                  aria-label="Open saved posts"
                  title="Saved posts"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Saved</span>
                </Link>
                <AvailabilityToggle />
                <NotificationCenter enabled={shellEnhancementsReady} />
                <Link
                  href={myProfileHref}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:border-[var(--brand-500)]/40 hover:text-[var(--brand-700)]"
                  aria-label="Open profile"
                  title="My profile"
                >
                  <User className="w-4 h-4" />
                </Link>
              </div>
            </div>
            {showPrompt ? (
              <div className="border-t border-slate-200/80 px-4 pb-3 pt-3 md:hidden">
                <DashboardPromptBar placement="header" />
              </div>
            ) : null}
          </header>

          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:py-8 lg:pb-8">
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

      {!pathname.startsWith("/dashboard/chat") && !pathname.startsWith("/dashboard/create_post") && (
        <>
          <button
            type="button"
            onClick={() => setOpenQuickActions((current) => !current)}
            aria-label="Open quick actions"
            className="fixed bottom-[5.25rem] right-4 z-[1100] inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-900)] text-white shadow-lg transition hover:bg-[var(--brand-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-400)] focus-visible:ring-offset-2 lg:bottom-6 lg:right-6"
          >
            <Plus className="h-6 w-6" />
          </button>

          {openQuickActions ? (
            <>
              <button
                type="button"
                onClick={() => setOpenQuickActions(false)}
                aria-hidden
                className="fixed inset-0 z-[1098] bg-slate-950/10"
              />
              <div className="fixed bottom-[8.5rem] right-4 z-[1101] w-[220px] rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl lg:bottom-24 lg:right-6">
                <button
                  type="button"
                  onClick={() => {
                    setOpenQuickActions(false);
                    router.push("/dashboard/provider/add-service");
                  }}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Add Service
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenQuickActions(false);
                    router.push("/dashboard/provider/add-product");
                  }}
                  className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Add Product
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenQuickActions(false);
                    setOpenCreatePost(true);
                  }}
                  className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Post Requirement
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenQuickActions(false);
                    setOpenCreatePost(true);
                  }}
                  className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Post Job
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenQuickActions(false);
                    router.push("/dashboard/launchpad");
                  }}
                  className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Set Up Business
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
          onPublished={(result?: PublishPostResult) => {
            setOpenCreatePost(false);
            if (result?.postType === "service" || result?.postType === "product") {
              router.push("/dashboard/profile");
            } else if (result?.postType === "need") {
              router.push("/dashboard");
            }
          }}
        />
      )}

      <CartDrawer />

      {/* ── Mobile bottom navigation bar ───────────────────────────── */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-[1200] flex items-stretch border-t border-slate-200 bg-white/95 backdrop-blur-md"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Main navigation"
      >
        {navigationTabs.map((tab) => {
          const isActive = pathname === tab.path;
          const Icon = tab.icon;
          const isChatTab = tab.path === "/dashboard/chat";
          return (
            <Link
              key={tab.path}
              href={tab.path}
              className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-semibold transition-colors ${
                isActive ? "text-[var(--brand-700)]" : "text-slate-500"
              }`}
              aria-label={tab.name}
            >
              <span className="relative">
                <Icon className="h-5 w-5" />
                {isChatTab && chatBadgeLabel ? (
                  <span className="absolute -right-2 -top-1.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-rose-500 px-0.5 py-px text-[9px] font-bold leading-none text-white ring-1 ring-white">
                    {chatBadgeLabel}
                  </span>
                ) : null}
              </span>
              <span>{tab.name}</span>
              {isActive ? (
                <span className="absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-t-full bg-[var(--brand-700)]" />
              ) : null}
            </Link>
          );
        })}
      </nav>


      {showLogoutConfirm ? (
        <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
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
