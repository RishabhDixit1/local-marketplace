import { cookies } from "next/headers";
import type { Locale } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n";
import en from "@/messages/en.json";
import hi from "@/messages/hi.json";
import bn from "@/messages/bn.json";
import ta from "@/messages/ta.json";
import te from "@/messages/te.json";
import mr from "@/messages/mr.json";

const messages: Record<Locale, Record<string, Record<string, string>>> = {
  en,
  hi,
  bn,
  ta,
  te,
  mr,
};

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

export async function getServerLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const stored = cookieStore.get("serviq-locale")?.value;
  if (stored && isLocale(stored)) return stored;
  return "en";
}

export async function serverT(path: string): Promise<string> {
  const locale = await getServerLocale();
  return resolve(locale, path) ?? resolve("en", path) ?? path;
}
