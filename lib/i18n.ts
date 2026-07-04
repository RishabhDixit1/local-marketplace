import en from "@/messages/en.json";
import hi from "@/messages/hi.json";
import bn from "@/messages/bn.json";
import ta from "@/messages/ta.json";
import te from "@/messages/te.json";
import mr from "@/messages/mr.json";

export type Locale = "en" | "hi" | "bn" | "ta" | "te" | "mr";

export const SUPPORTED_LOCALES: Locale[] = ["en", "hi", "bn", "ta", "te", "mr"];

const messages: Record<Locale, Record<string, Record<string, string>>> = {
  en,
  hi,
  bn,
  ta,
  te,
  mr,
};

const STORAGE_KEY = "serviq-locale";
const COOKIE_NAME = "serviq-locale";

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

export function isLocale(value: string): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}

export function getStoredLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && isLocale(stored)) return stored;

  const browserLang = navigator.language?.split("-")[0] || "en";
  if (isLocale(browserLang)) return browserLang;
  if (browserLang === "und") return "en";

  return "en";
}

export function setStoredLocale(locale: Locale) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, locale);
    document.cookie = `${COOKIE_NAME}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  }
}
