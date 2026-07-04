"use client";

import { useCallback, useState } from "react";
import { getStoredLocale, setStoredLocale, t, type Locale } from "@/lib/i18n";

export function useLocale(defaultLocale?: Locale) {
  const [locale, setLocale] = useState<Locale>(() => defaultLocale || getStoredLocale());

  const changeLocale = useCallback((newLocale: Locale) => {
    setStoredLocale(newLocale);
    setLocale(newLocale);
    document.documentElement.lang = newLocale;
  }, []);

  const translate = useCallback((path: string, vars?: Record<string, string | number>) => {
    let result = t(locale, path);
    if (vars) {
      for (const [key, value] of Object.entries(vars)) {
        result = result.replace(`{${key}}`, String(value));
      }
    }
    return result;
  }, [locale]);

  return { locale, changeLocale, translate };
}
