"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Home,
  LayoutDashboard,
  LogIn,
  Plus,
  Store,
  User,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { User as SupabaseUser } from "@supabase/supabase-js";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/market/crossing-republik", label: "Explore", icon: Store },
] as const;

const authItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
] as const;

const guestItems = [
  { href: "/?signin=true", label: "Sign In", icon: LogIn },
] as const;

const ctaItem = { href: "/onboarding/provider/locality", label: "List Business", icon: Plus } as const;

export function MobileBottomNav() {
  const pathname = usePathname();
  const [user, setUser] = useState<SupabaseUser | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) setUser(data.session.user);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener?.subscription.unsubscribe();
  }, []);

  const isNavItemActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const userSpecificItems = user ? authItems : guestItems;

  const allItems = [...navItems, ...userSpecificItems, ctaItem];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[var(--layer-mobile-nav)] border-t border-slate-200/90 bg-white/98 shadow-[0_-14px_36px_-28px_rgba(15,23,42,0.42)] backdrop-blur-none lg:hidden"
      aria-label="Main navigation"
    >
      <div className="flex px-2 pt-2 [padding-bottom:calc(env(safe-area-inset-bottom)+0.5rem)]">
        {allItems.map((item) => {
          const isActive = isNavItemActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex min-h-[4.15rem] flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-semibold transition ${
                isActive
                  ? "bg-[var(--brand-50)] text-[var(--brand-700)]"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
              {isActive ? (
                <span className="absolute top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--brand-600)]" />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
