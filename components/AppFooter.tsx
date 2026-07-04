"use client";

import Link from "next/link";
import { useLocaleContext } from "@/lib/i18n-context";
import LocaleSwitcher from "@/app/components/LocaleSwitcher";

export function AppFooter() {
  const { t } = useLocaleContext();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-xs text-slate-500">
            {t("footer.copyright", { year })}
          </p>
          <nav className="flex items-center gap-6">
            <Link href="/privacy" className="text-xs text-slate-500 hover:text-slate-700 transition">
              {t("footer.privacy")}
            </Link>
            <Link href="/terms" className="text-xs text-slate-500 hover:text-slate-700 transition">
              {t("footer.terms")}
            </Link>
            <Link href="/support" className="text-xs text-slate-500 hover:text-slate-700 transition">
              {t("footer.helpCentre")}
            </Link>
            <Link href="/contact" className="text-xs text-slate-500 hover:text-slate-700 transition">
              {t("footer.contactUs")}
            </Link>
          </nav>
          <LocaleSwitcher />
        </div>
      </div>
    </footer>
  );
}
