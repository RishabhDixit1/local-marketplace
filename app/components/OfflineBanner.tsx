"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);

    setOffline(!navigator.onLine);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[var(--layer-mobile-nav)] translate-y-0 animate-slide-down">
      <div className="flex items-center justify-center gap-2 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700 shadow-sm border-b border-amber-200">
        <WifiOff className="h-3.5 w-3.5 shrink-0" />
        You are offline. Some features may be unavailable.
      </div>
    </div>
  );
}
