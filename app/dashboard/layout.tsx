"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "../../lib/supabase";
import NotificationCenter from "@/app/components/NotificationCenter";
import {
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-indigo-50 to-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-72 lg:flex-col lg:border-r lg:border-slate-200/90 lg:bg-white/85 lg:backdrop-blur-xl">
          <div className="px-6 py-6 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
                <Home className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">Local Marketplace</h1>
                <p className="text-xs text-slate-500">Connect & Collaborate</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navigationTabs.map((tab) => {
              const isActive = pathname === tab.path;
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.path}
                  href={tab.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.name}
                </Link>
              );
            })}
          </nav>

          <div className="px-4 py-4 border-t border-slate-200 space-y-3">
            <button
              onClick={() => router.push("/dashboard/profile")}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-slate-200 hover:border-indigo-400 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-slate-900">My Profile</p>
                <p className="text-xs text-slate-500">Manage account</p>
              </div>
            </button>
            <button
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-colors"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Logout</span>
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
