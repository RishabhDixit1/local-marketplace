import Link from "next/link";
import { Compass, ShoppingCart, ClipboardList, MessageCircle, User, Bookmark } from "lucide-react";

const quickLinks = [
  { href: "/dashboard", label: "Browse Marketplace", desc: "Find services and providers near you", icon: Compass },
  { href: "/dashboard/orders", label: "My Orders", desc: "Track your active and past orders", icon: ShoppingCart },
  { href: "/dashboard/tasks", label: "My Tasks", desc: "View and manage your tasks", icon: ClipboardList },
  { href: "/dashboard/chat", label: "Messages", desc: "Chat with providers and customers", icon: MessageCircle },
  { href: "/dashboard/profile", label: "My Profile", desc: "Edit your profile and preferences", icon: User },
  { href: "/dashboard/saved", label: "Saved Items", desc: "View your bookmarked posts", icon: Bookmark },
];

export default function WelcomePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
      <div className="text-center">
        <h1 style={{ fontFamily: "var(--font-display)" }} className="text-3xl font-extrabold tracking-tight text-[var(--ink-950)]">Welcome to ServiQ</h1>
        <p className="mt-2 text-[var(--ink-700)]">Your local marketplace connecting you with trusted providers.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {quickLinks.map((link) => (
          <Link key={link.href} href={link.href}
            className="rounded-2xl border-[var(--surface-border)] bg-[var(--surface-elevated)] p-5 transition-colors hover:border-[var(--border-strong)]">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand-50)]">
              <link.icon className="h-5 w-5 text-[var(--brand-600)]" />
            </div>
            <h3 className="font-semibold text-[var(--ink-950)]">{link.label}</h3>
            <p className="mt-1 text-sm text-[var(--ink-500)]">{link.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
