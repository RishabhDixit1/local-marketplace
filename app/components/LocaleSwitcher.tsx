"use client";

import { useState, useRef, useEffect } from "react";
import { Languages, Check } from "lucide-react";
import { useLocaleContext } from "@/lib/i18n-context";
import type { Locale } from "@/lib/i18n";
import { SUPPORTED_LOCALES } from "@/lib/i18n";

const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  hi: "हिन्दी",
  bn: "বাংলা",
  ta: "தமிழ்",
  te: "తెలుగు",
  mr: "मराठी",
};

export default function LocaleSwitcher() {
  const { locale, changeLocale } = useLocaleContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        title="Switch language"
      >
        <Languages className="h-3.5 w-3.5" />
        {LOCALE_LABELS[locale]}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-900/10">
          {SUPPORTED_LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => { changeLocale(l); setOpen(false); }}
              className={`flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-xs font-medium transition hover:bg-slate-50 ${
                l === locale ? "text-[var(--brand-700)]" : "text-slate-700"
              }`}
            >
              <span className="flex-1">{LOCALE_LABELS[l]}</span>
              {l === locale && <Check className="h-3.5 w-3.5 text-[var(--brand-600)]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
