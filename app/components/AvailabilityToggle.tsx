"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, RadioTower } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchAuthedJson } from "@/lib/clientApi";

export type OnlineStatus = "available" | "busy" | "offline";

const STATUS_CONFIG: Record<OnlineStatus, { label: string; dot: string }> = {
  available: { label: "Online", dot: "bg-emerald-400" },
  busy: { label: "Busy", dot: "bg-amber-400" },
  offline: { label: "Offline", dot: "bg-slate-500" },
};

const STORAGE_KEY = "serviq_provider_status_v1";

const readStoredStatus = (): OnlineStatus => {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw === "available" || raw === "busy" || raw === "offline") return raw;
  } catch {
    // ignore
  }
  return "available";
};

async function sendPresencePing(status: OnlineStatus) {
  await fetchAuthedJson(supabase, "/api/presence/ping", {
    method: "POST",
    body: JSON.stringify({
      isOnline: status !== "offline",
      availability: status,
      responseSlaMinutes: status === "busy" ? 30 : 15,
    }),
  });
}

export function AvailabilityToggle() {
  const [status, setStatus] = useState<OnlineStatus>("available");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Hydrate from localStorage after mount
  useEffect(() => {
    setStatus(readStoredStatus());
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const changeStatus = useCallback(async (next: OnlineStatus) => {
    setOpen(false);
    if (next === status) return;
    setSaving(true);
    try {
      await sendPresencePing(next);
      setStatus(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore storage errors
      }
    } catch {
      // Silently fail — heartbeat will eventually sync
    } finally {
      setSaving(false);
    }
  }, [status]);

  const cfg = STATUS_CONFIG[status];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Change availability status"
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
      >
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
        ) : (
          <span className={`h-2 w-2 rounded-full ${cfg.dot}`} aria-hidden />
        )}
        <span className="hidden sm:inline">{cfg.label}</span>
        <RadioTower className="h-3.5 w-3.5 text-slate-500 sm:hidden" />
        <ChevronDown className="hidden h-3 w-3 text-slate-500 sm:block" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Choose availability"
          className="absolute right-0 top-full z-50 mt-1.5 min-w-[9rem] rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-xl"
        >
          {(Object.keys(STATUS_CONFIG) as OnlineStatus[]).map((s) => {
            const c = STATUS_CONFIG[s];
            return (
              <button
                key={s}
                type="button"
                role="option"
                aria-selected={s === status}
                onClick={() => void changeStatus(s)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition hover:bg-slate-800 ${
                  s === status ? "text-white" : "text-slate-300"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${c.dot}`} aria-hidden />
                {c.label}
                {s === status && (
                  <span className="ml-auto text-[10px] font-normal text-slate-500">current</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
