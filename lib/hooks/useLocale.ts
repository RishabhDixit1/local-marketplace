"use client";

import { useCallback, useEffect, useState } from "react";
import { getStoredLocale, setStoredLocale, t, type Locale } from "@/lib/i18n";

export function useLocale() {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    setLocale(getStoredLocale());
  }, []);

  const changeLocale = useCallback((newLocale: Locale) => {
    setStoredLocale(newLocale);
    setLocale(newLocale);
  }, []);

  const translate = useCallback((path: string) => t(locale, path), [locale]);

  return { locale, changeLocale, translate };
}
