"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "../../lib/supabase";

const tabs = [
  { name: "Welcome", path: "/dashboard/welcome" },
  { name: "Posts", path: "/dashboard" },
  { name: "People", path: "/dashboard/people" },
  { name: "Tasks", path: "/dashboard/tasks" },
  { name: "Chat", path: "/dashboard/chat" },
  { name: "Ratings", path: "/dashboard/ratings" },
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
    <div className="min-h-screen bg-gray-100">
      {/* NAVBAR */}
      <nav className="bg-white shadow px-6 py-3 flex justify-between items-center sticky top-0 z-50">
        {/* LOGO */}
        <div className="text-xl font-bold text-indigo-600">
          Local Marketplace
        </div>

        {/* DESKTOP NAV */}
        <div className="hidden md:flex gap-3">
          {tabs.map((tab) => (
            <Link
              key={tab.path}
              href={tab.path}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
                pathname === tab.path
                  ? "bg-indigo-600 text-white shadow"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {tab.name}
            </Link>
          ))}
        </div>

        {/* RIGHT ACTIONS */}
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <button
            onClick={() => router.push("/dashboard/profile")}
            className="w-9 h-9 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center hover:bg-indigo-700 transition"
            title="View Profile"
          >
            U
          </button>

          {/* Logout */}
          <button
            className="hidden md:block text-red-500 font-semibold hover:underline"
            onClick={handleLogout}
          >
            Logout
          </button>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-gray-600"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            ☰
          </button>
        </div>
      </nav>

      {/* MOBILE MENU */}
      {menuOpen && (
        <div className="bg-white shadow-md md:hidden flex flex-col px-4 py-3 gap-2">
          {tabs.map((tab) => (
            <Link
              key={tab.path}
              href={tab.path}
              onClick={() => setMenuOpen(false)}
              className={`px-3 py-2 rounded text-sm font-semibold ${
                pathname === tab.path
                  ? "bg-indigo-600 text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              {tab.name}
            </Link>
          ))}

          <button
            className="text-red-500 font-semibold text-left px-3 py-2"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      )}

      {/* PAGE CONTENT */}
      <main className="p-4 max-w-6xl mx-auto">{children}</main>
    </div>
  );
}
