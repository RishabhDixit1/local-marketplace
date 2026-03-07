"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import NotificationCenter from "@/app/components/NotificationCenter";
import {
  Bookmark,
  ChevronsLeft,
  ChevronsRight,
  Compass,
  Home,
  LogOut,
  Menu,
  MessageCircle,
  Package,
  Sparkles,
  User,
  Users,
  X,
} from "lucide-react";

const navigationTabs = [
  { name: "Welcome", path: "/dashboard/welcome", icon: Sparkles },
  { name: "Posts", path: "/dashboard", icon: Home },
  { name: "People", path: "/dashboard/people", icon: Users },
  { name: "Tasks", path: "/dashboard/tasks", icon: Package },
  { name: "Chat", path: "/dashboard/chat", icon: MessageCircle },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [desktopNavCollapsed, setDesktopNavCollapsed] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let active = true;

    const verifySession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;

      if (!session?.user) {
        router.replace("/");
        return;
      }

      setAuthReady(true);
    };

    void verifySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;

      if (!session?.user) {
        setAuthReady(false);
        router.replace("/");
        return;
      }

      setAuthReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  if (!authReady) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-b from-slate-100 via-indigo-50 to-slate-100">
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
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-indigo-50 to-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <aside
          className={`hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-r lg:border-slate-200/90 lg:bg-white/85 lg:backdrop-blur-xl lg:transition-[width] lg:duration-200 ${
            desktopNavCollapsed ? "lg:w-24" : "lg:w-72"
          }`}
        >
          <div className={`border-b border-slate-200 ${desktopNavCollapsed ? "px-3 py-5" : "px-6 py-6"}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
                  <Home className="w-6 h-6 text-white" />
                </div>
                {!desktopNavCollapsed && (
                  <div>
                    <h1 className="text-lg font-bold text-slate-900">Local Marketplace</h1>
                    <p className="text-xs text-slate-500">Connect & Collaborate</p>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDesktopNavCollapsed((current) => !current)}
                className="hidden lg:inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
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
              return (
                <Link
                  key={tab.path}
                  href={tab.path}
                  title={desktopNavCollapsed ? tab.name : undefined}
                  className={`flex items-center rounded-xl text-sm font-semibold transition-all duration-200 ${
                    desktopNavCollapsed ? "justify-center px-3 py-3" : "gap-3 px-4 py-3"
                  } ${
                    isActive
                      ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {desktopNavCollapsed ? <span className="sr-only">{tab.name}</span> : tab.name}
                </Link>
              );
            })}
          </nav>

          <div className={`border-t border-slate-200 space-y-2 ${desktopNavCollapsed ? "px-2 py-4" : "px-4 py-4"}`}>
            <button
              onClick={() => router.push("/dashboard/profile")}
              title={desktopNavCollapsed ? "My Profile" : undefined}
              className={`w-full flex items-center rounded-xl bg-white border border-slate-200 hover:border-indigo-400 transition-colors ${
                desktopNavCollapsed ? "justify-center px-3 py-3" : "gap-3 px-4 py-3"
              }`}
              aria-label="Open my profile"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              {!desktopNavCollapsed && (
                <div className="text-left">
                  <p className="text-sm font-semibold text-slate-900">My Profile</p>
                  <p className="text-xs text-slate-500">Manage account</p>
                </div>
              )}
            </button>
            <button
              className={`w-full flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-colors ${
                desktopNavCollapsed ? "px-3 py-3" : "gap-2 px-4 py-2.5"
              }`}
              onClick={handleLogout}
              title={desktopNavCollapsed ? "Logout" : undefined}
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
              {!desktopNavCollapsed && <span className="text-sm">Logout</span>}
            </button>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
            <div className="h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  className="lg:hidden p-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
                  onClick={() => setMenuOpen(true)}
                  aria-label="Open navigation menu"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div className="lg:hidden flex items-center gap-2 min-w-0">
                  <Compass className="w-5 h-5 text-indigo-600 shrink-0" />
                  <span className="text-sm font-semibold text-slate-800 truncate">Local Marketplace</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard/saved"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-600"
                  aria-label="Open saved posts"
                  title="Saved posts"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Saved</span>
                </Link>
                <NotificationCenter />
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">{children}</main>
        </div>
      </div>

      <div
        className={`lg:hidden fixed inset-0 z-[1300] transition-opacity duration-200 ${
          menuOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <button
          aria-label="Close navigation menu"
          onClick={() => setMenuOpen(false)}
          className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        />
        <aside
          className={`absolute left-0 top-0 h-full w-[86vw] max-w-xs bg-white border-r border-slate-200 p-4 flex flex-col transition-transform duration-200 ${
            menuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 flex items-center justify-center">
                <Home className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Local Marketplace</p>
                <p className="text-xs text-slate-500">Navigation</p>
              </div>
            </div>
            <button
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="mt-4 space-y-2">
            {navigationTabs.map((tab) => {
              const isActive = pathname === tab.path;
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.path}
                  href={tab.path}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                    isActive
                      ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.name}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto pt-4 border-t border-slate-200 space-y-2">
            <button
              onClick={() => {
                setMenuOpen(false);
                router.push("/dashboard/profile");
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-800"
            >
              <User className="w-4 h-4" />
              My Profile
            </button>
            <button
              onClick={() => {
                handleLogout();
                setMenuOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
