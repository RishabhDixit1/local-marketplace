"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const CONSENT_KEY = "serviq-cookie-consent";

type ConsentChoice = "accepted" | "rejected";

export function getCookieConsent(): ConsentChoice | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CONSENT_KEY) as ConsentChoice | null;
}

export default function CookieConsentBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) {
      const timer = setTimeout(() => setShow(true), 600);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setShow(false);
  };

  const reject = () => {
    localStorage.setItem(CONSENT_KEY, "rejected");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[var(--layer-toast)] border-t border-slate-200 bg-white px-4 py-4 shadow-2xl shadow-black/10 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
        <p className="text-sm leading-relaxed text-slate-600">
          We use essential cookies for authentication and security. We also use
          anonymous analytics to improve the experience.{" "}
          <Link
            href="/legal/cookie-policy"
            className="font-medium text-[var(--brand-700)] underline underline-offset-2 hover:text-[var(--brand-900)]"
          >
            Learn more
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={reject}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Reject non-essential
          </button>
          <button
            type="button"
            onClick={accept}
            className="rounded-xl bg-[var(--brand-900)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--brand-800)]"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
