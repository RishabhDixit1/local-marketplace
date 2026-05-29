"use client";

import { Languages } from "lucide-react";
import { useLocale } from "@/lib/hooks/useLocale";

export default function LocaleSwitcher() {
  const { locale, changeLocale } = useLocale();

  return (
    <button
      type="button"
      onClick={() => changeLocale(locale === "en" ? "hi" : "en")}
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
      title="Switch language"
    >
      <Languages className="h-3.5 w-3.5" />
      {locale === "en" ? "हिन्दी" : "English"}
    </button>
  );
}
