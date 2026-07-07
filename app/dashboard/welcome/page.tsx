import Link from "next/link";

const quickLinks = [
  { href: "/dashboard", label: "Browse Marketplace", desc: "Find services and providers near you" },
  { href: "/dashboard/orders", label: "My Orders", desc: "Track your active and past orders" },
  { href: "/dashboard/tasks", label: "My Tasks", desc: "View and manage your tasks" },
  { href: "/dashboard/chat", label: "Messages", desc: "Chat with providers and customers" },
  { href: "/dashboard/profile", label: "My Profile", desc: "Edit your profile and preferences" },
  { href: "/dashboard/saved", label: "Saved Items", desc: "View your bookmarked posts" },
];

export default function WelcomePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-[var(--ink-950)]">Welcome to ServiQ</h1>
        <p className="mt-2 text-[var(--ink-700)]">Your local marketplace connecting you with trusted providers.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {quickLinks.map((link) => (
          <Link key={link.href} href={link.href}
            className="rounded-2xl border-[var(--surface-border)] bg-[var(--surface-elevated)] p-5 transition-colors hover:border-[var(--border-strong)]">
            <h3 className="font-semibold text-[var(--ink-950)]">{link.label}</h3>
            <p className="mt-1 text-sm text-[var(--ink-500)]">{link.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
