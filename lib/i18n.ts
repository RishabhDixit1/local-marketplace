import en from "@/messages/en.json";
import hi from "@/messages/hi.json";

export type Locale = "en" | "hi";

const messages: Record<Locale, Record<string, Record<string, string>>> = {
  en,
  hi,
};

const STORAGE_KEY = "serviq-locale";

function resolve(locale: Locale, path: string): string | undefined {
  const parts = path.split(".");
  let current: unknown = messages[locale];

  for (const part of parts) {
    if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return typeof current === "string" ? current : undefined;
}

export function t(locale: Locale, path: string): string {
  return resolve(locale, path) ?? resolve("en", path) ?? path;
}

export function tWithFallback(locale: Locale, path: string): string {
  return resolve(locale, path) ?? resolve("en", path) ?? path;
}

export function getStoredLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "hi" || stored === "en") return stored;

  const browserLang = navigator.language?.startsWith("hi") ? "hi" : "en";
  return browserLang;
}

export function setStoredLocale(locale: Locale) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, locale);
}
