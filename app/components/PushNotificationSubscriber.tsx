"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const PUBLIC_VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function getInitialStatus(): "idle" | "granted" | "denied" | "unsupported" | "subscribed" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission === "granted" ? "granted" : "idle";
}

export default function PushNotificationSubscriber() {
  const [status, setStatus] = useState<"idle" | "granted" | "denied" | "unsupported" | "subscribed">(getInitialStatus);

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

  return (
    <div className="fixed bottom-24 right-4 z-50 max-w-xs rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-900/10 md:bottom-6">
      <p className="text-sm font-semibold text-slate-900">Stay updated</p>
      <p className="mt-1 text-xs text-slate-500">
        Get notified when providers respond to your requests.
      </p>
      <button
        type="button"
        onClick={async () => {
          const result = await Notification.requestPermission();
          setStatus(result === "granted" ? "granted" : "denied");
        }}
        className="mt-3 w-full rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
      >
        Enable notifications
      </button>
    </div>
  );
}
