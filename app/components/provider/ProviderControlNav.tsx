"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BriefcaseBusiness, ClipboardList, Wallet } from "lucide-react";

const providerTabs = [
  { href: "/dashboard/provider", label: "Control", icon: BriefcaseBusiness },
  { href: "/dashboard/provider/listings", label: "Listings", icon: BarChart3 },
  { href: "/dashboard/provider/orders", label: "Orders", icon: ClipboardList },
  { href: "/dashboard/provider/earnings", label: "Earnings", icon: Wallet },
] as const;

const isActiveTab = (pathname: string, href: string) => {
  if (href === "/dashboard/provider") {
    return (
      pathname === href ||
      (pathname.startsWith("/dashboard/provider/") &&
        !pathname.startsWith("/dashboard/provider/listings") &&
        !pathname.startsWith("/dashboard/provider/orders") &&
        !pathname.startsWith("/dashboard/provider/earnings"))
    );
  }

  return pathname === href || pathname.startsWith(`${href}/`);
};

export default function ProviderControlNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Provider controls">
      {providerTabs.map((tab) => {
        const active = isActiveTab(pathname, tab.href);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            title={tab.label}
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-2.5 text-[13px] font-semibold transition ${
              active
                ? "border-[var(--brand-900)] bg-[var(--brand-900)] text-white shadow-[0_10px_24px_-18px_rgba(15,23,42,0.85)]"
                : "border-slate-200 bg-white text-slate-600 hover:border-[var(--brand-500)]/35 hover:text-slate-900"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{tab.label}</span>
            <span className="sr-only md:hidden">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
