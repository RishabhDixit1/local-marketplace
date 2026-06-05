import Link from "next/link";
import { appName } from "@/lib/branding";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--surface-app)] px-4 text-center">
      <div className="flex flex-col items-center gap-2">
        <span className="text-[8rem] font-black leading-none tracking-tighter text-[var(--brand-300)] sm:text-[10rem]">
          404
        </span>
        <h1 className="text-2xl font-bold text-[var(--ink-950)] sm:text-3xl">
          Page not found
        </h1>
        <p className="max-w-md text-sm text-[var(--ink-500)] sm:text-base">
          The page you&apos;re looking for doesn&apos;t exist or has been
          moved. Let&apos;s get you back on track.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand-500)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Go home
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-2.5 text-sm font-semibold text-[var(--ink-700)] transition hover:bg-[var(--surface-soft)]"
        >
          Dashboard
        </Link>
      </div>
      <p className="mt-8 text-xs text-[var(--ink-500)]">{appName}</p>
    </div>
  );
}
