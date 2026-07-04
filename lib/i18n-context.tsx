"use client";

import { createContext, useContext, useCallback, useState, useRef, useEffect } from "react";
import { getStoredLocale, setStoredLocale, t, type Locale } from "@/lib/i18n";

interface LocaleContextValue {
  locale: Locale;
  changeLocale: (locale: Locale) => void;
  t: (path: string, vars?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  children,
  defaultLocale,
}: {
  children: React.ReactNode;
  defaultLocale: Locale;
}) {
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const hydrated = useRef(false);

  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      const stored = getStoredLocale();
      if (stored !== defaultLocale) {
        setLocale(stored);
      }
    }
  }, [defaultLocale]);

  const changeLocale = useCallback((newLocale: Locale) => {
    setStoredLocale(newLocale);
    setLocale(newLocale);
    document.documentElement.lang = newLocale;
  }, []);

  const translate = useCallback(
    (path: string, vars?: Record<string, string | number>) => {
      let result = t(locale, path);
      if (vars) {
        for (const [key, value] of Object.entries(vars)) {
          result = result.replace(`{${key}}`, String(value));
        }
      }
      return result;
    },
    [locale],
  );

  return (
    <LocaleContext.Provider value={{ locale, changeLocale, t: translate }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocaleContext() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocaleContext must be used within a LocaleProvider");
  }
  return ctx;
}
