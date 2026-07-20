"use client";

import Link from "next/link";
import { useLocaleContext } from "@/lib/i18n-context";
import LocaleSwitcher from "@/app/components/LocaleSwitcher";

export function AppFooter() {
  const { t } = useLocaleContext();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--surface-border)] bg-[var(--surface-app)] pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-xs text-[var(--ink-500)]">
            {t("footer.copyright", { year })}
          </p>
          <nav className="grid grid-cols-2 gap-x-6 gap-y-2 sm:flex sm:items-center sm:gap-6">
            <Link href="/privacy" className="text-xs text-[var(--ink-500)] hover:text-[var(--ink-700)] transition">
              {t("footer.privacy")}
            </Link>
            <Link href="/terms" className="text-xs text-[var(--ink-500)] hover:text-[var(--ink-700)] transition">
              {t("footer.terms")}
            </Link>
            <Link href="/support" className="text-xs text-[var(--ink-500)] hover:text-[var(--ink-700)] transition">
              {t("footer.helpCentre")}
            </Link>
            <Link href="/contact" className="text-xs text-[var(--ink-500)] hover:text-[var(--ink-700)] transition">
              {t("footer.contactUs")}
            </Link>
          </nav>
          <LocaleSwitcher />
        </div>
      </div>
    </footer>
  );
}
