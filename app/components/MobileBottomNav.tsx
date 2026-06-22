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
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export type MobileNavItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  onClick?: () => void;
  isActive?: boolean;
};

const defaultNavItems = [
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

export function MobileBottomNav({ items }: { items?: MobileNavItem[] }) {
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

  const allItems: MobileNavItem[] = items ?? [
    ...defaultNavItems,
    ...(user ? authItems : guestItems),
    ctaItem,
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[var(--layer-mobile-nav)] border-t border-slate-200/90 bg-white/98 shadow-[0_-14px_36px_-28px_rgba(15,23,42,0.42)] backdrop-blur-none md:hidden"
      aria-label="Main navigation"
    >
      <div
        className="grid gap-1 px-2 pt-2 [padding-bottom:calc(env(safe-area-inset-bottom)+0.5rem)]"
        style={{
          gridTemplateColumns: `repeat(${allItems.length}, minmax(0, 1fr))`,
        }}
      >
        {allItems.map((item) => {
          const active = item.isActive ?? (item.href ? isNavItemActive(item.href) : false);
          const Icon = item.icon;
          const content = (
            <>
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
              {active ? (
                <span className="absolute top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--brand-600)]" />
              ) : null}
            </>
          );
          const className = `relative flex min-h-[4.15rem] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-semibold transition ${
            active
              ? "bg-[var(--brand-50)] text-[var(--brand-700)]"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
          }`;

          if (item.href) {
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={item.onClick}
                className={className}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
              >
                {content}
              </Link>
            );
          }

          return (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className={className}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
            >
              {content}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
