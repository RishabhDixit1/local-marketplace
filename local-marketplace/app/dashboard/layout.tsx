"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  Home,
  Users,
  Package,
  MessageCircle,
  Star,
  User,
  LogOut,
  Menu,
  X,
  Bell,
  Settings,
  Sparkles
} from "lucide-react";

const navigationTabs = [
  { name: "Welcome", path: "/dashboard/welcome", icon: Sparkles },
  { name: "Posts", path: "/dashboard", icon: Home },
  { name: "People", path: "/dashboard/people", icon: Users },
  { name: "Tasks", path: "/dashboard/tasks", icon: Package },
  { name: "Chat", path: "/dashboard/chat", icon: MessageCircle },
  { name: "Ratings", path: "/dashboard/ratings", icon: Star },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const notifications = [
    { id: 1, text: "Sarah accepted your plumbing request", time: "5m ago", unread: true },
    { id: 2, text: "New review from Michael Chen", time: "1h ago", unread: true },
    { id: 3, text: "Your profile is 80% complete", time: "2h ago", unread: false },
  ];

  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      
      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* LOGO */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
                <Home className="w-6 h-6 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Local Marketplace
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Connect & Collaborate
                </p>
              </div>
            </div>

            {/* DESKTOP NAV */}
            <div className="hidden lg:flex items-center gap-2">
              {navigationTabs.map((tab) => {
                const isActive = pathname === tab.path;
                const Icon = tab.icon;
                
                return (
                  <Link
                    key={tab.path}
                    href={tab.path}
                    className={`relative group flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                      isActive
                        ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.name}</span>
                    {isActive && (
                      <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-white rounded-t-full"></div>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* RIGHT ACTIONS */}
            <div className="flex items-center gap-2">
              
              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Bell className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                  {unreadCount > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      {unreadCount}
                    </div>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                      <h3 className="font-bold text-slate-900 dark:text-white">Notifications</h3>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className={`p-4 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer ${
                            notif.unread ? "bg-blue-50 dark:bg-blue-900/10" : ""
                          }`}
                        >
                          <p className="text-sm text-slate-900 dark:text-white font-medium">
                            {notif.text}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {notif.time}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-900">
                      <button className="w-full text-center text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                        View All Notifications
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Settings */}
              <button
                onClick={() => router.push("/dashboard/settings")}
                className="hidden md:flex p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Settings className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>

              {/* Profile Avatar */}
              <button
                onClick={() => router.push("/dashboard/profile")}
                className="relative group"
                title="View Profile"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110">
                  <User className="w-5 h-5" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white dark:border-slate-900 rounded-full"></div>
              </button>

              {/* Logout (Desktop) */}
              <button
                className="hidden md:flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm">Logout</span>
              </button>

              {/* Mobile Menu Button */}
              <button
                className="lg:hidden p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                onClick={() => setMenuOpen(!menuOpen)}
              >
                {menuOpen ? (
                  <X className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                ) : (
                  <Menu className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* MOBILE MENU */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm">
          <div className="absolute top-16 left-0 right-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="max-h-[calc(100vh-4rem)] overflow-y-auto">
              <div className="p-4 space-y-2">
                {navigationTabs.map((tab) => {
                  const isActive = pathname === tab.path;
                  const Icon = tab.icon;
                  
                  return (
                    <Link
                      key={tab.path}
                      href={tab.path}
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                        isActive
                          ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {tab.name}
                    </Link>
                  );
                })}

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <button
                    onClick={() => {
                      router.push("/dashboard/settings");
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200"
                  >
                    <Settings className="w-5 h-5" />
                    Settings
                  </button>

                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold bg-red-500 hover:bg-red-600 text-white transition-all duration-200"
                    onClick={() => {
                      handleLogout();
                      setMenuOpen(false);
                    }}
                  >
                    <LogOut className="w-5 h-5" />
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAGE CONTENT */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {children}
      </main>

      {/* FOOTER */}
      <footer className="mt-12 border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 flex items-center justify-center">
                  <Home className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                  Local Marketplace
                </h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Connect with trusted service providers and grow your local network.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-slate-900 dark:text-white mb-3">Quick Links</h4>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li><a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">How It Works</a></li>
                <li><a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Safety Guidelines</a></li>
                <li><a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Support</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-slate-900 dark:text-white mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li><a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Cookie Policy</a></li>
                <li><a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Contact Us</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-800 text-center text-sm text-slate-600 dark:text-slate-400">
            <p>© 2024 Local Marketplace. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}