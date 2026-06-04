"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const PUBLIC_VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const DISMISSED_KEY = "serviq_notification_banner_dismissed";

function getInitialStatus(): "idle" | "granted" | "denied" | "unsupported" | "subscribed" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission === "granted" ? "granted" : "idle";
}

function getInitialDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
}

export default function PushNotificationSubscriber() {
  const [status, setStatus] = useState<"idle" | "granted" | "denied" | "unsupported" | "subscribed">(getInitialStatus);
  const [dismissed, setDismissed] = useState(getInitialDismissed);

  useEffect(() => {
    if (status !== "granted") return;
    if (!PUBLIC_VAPID_KEY) return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    const subscribe = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const existingSub = await registration.pushManager.getSubscription();
        if (existingSub) {
          setStatus("subscribed");
          return;
        }

        const sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: PUBLIC_VAPID_KEY,
        });

        const subJSON = sub.toJSON();
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session?.access_token || cancelled) return;

        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.session.access_token}`,
          },
          body: JSON.stringify({
            endpoint: subJSON.endpoint,
            keys: { p256dh: subJSON.keys?.p256dh, auth: subJSON.keys?.auth },
          }),
        });

        if (!cancelled) setStatus("subscribed");
      } catch {
        // Browser may block subscription
      }
    };

    void subscribe();

    return () => { cancelled = true; };
  }, [status]);

  if (status !== "idle") return null;
  if (!("Notification" in window) || Notification.permission !== "default") return null;
  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "true");
    } catch {
      // localStorage not available
    }
  };

  const handleEnable = async () => {
    const result = await Notification.requestPermission();
    setStatus(result === "granted" ? "granted" : "denied");
    handleDismiss();
  };

  return (
    <>
      {/* Desktop: rendered inline in sidebar */}
      <div className="hidden lg:block">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900">Stay updated</p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Get notified when providers respond.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Dismiss"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <button
            type="button"
            onClick={handleEnable}
            className="mt-2 w-full rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-800"
          >
            Enable notifications
          </button>
        </div>
      </div>

      {/* Mobile: fixed bottom banner */}
      <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[var(--layer-floating-action)] mx-2 lg:hidden">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-lg shadow-slate-900/10">
          <p className="min-w-0 flex-1 text-[11px] font-semibold text-slate-900">
            Stay updated — get notified when providers respond.
          </p>
          <button
            type="button"
            onClick={handleEnable}
            className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-800"
          >
            Enable
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Dismiss"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
