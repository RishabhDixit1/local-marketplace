"use client";

import { useEffect, useState } from "react";
import SavedFeedView from "@/app/dashboard/components/SavedFeedView";
import { Bell, Bookmark, Loader2, Settings } from "lucide-react";
import { fetchAuthedJson } from "@/lib/clientApi";
import { supabase } from "@/lib/supabase";

type SettingsPayload = {
  ok: boolean;
  settings?: {
    order_notifications: boolean;
    promo_notifications: boolean;
    message_notifications: boolean;
  };
  message?: string;
};

type SettingsState = {
  order_notifications: boolean;
  promo_notifications: boolean;
  message_notifications: boolean;
};

type SettingsSection = "notifications" | "saved";

const isSettingsSection = (value: string | null): value is SettingsSection => value === "notifications" || value === "saved";

const Toggle = ({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) => (
  <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
    <span className="text-sm font-medium text-slate-700">{label}</span>
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
        checked ? "bg-indigo-600" : "bg-slate-300"
      } disabled:opacity-60`}
      aria-pressed={checked}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${checked ? "translate-x-5" : "translate-x-0.5"}`}
      />
    </button>
  </label>
);

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>(() => {
    if (typeof window === "undefined") return "notifications";
    const section = new URLSearchParams(window.location.search).get("section");
    return isSettingsSection(section) ? section : "notifications";
  });
  const [state, setState] = useState<SettingsState>({
    order_notifications: true,
    promo_notifications: true,
    message_notifications: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string>("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const payload = await fetchAuthedJson<SettingsPayload>(supabase, "/api/user-settings");
        if (!active) return;
        if (!payload.ok || !payload.settings) {
          setError(payload.message || "Unable to load settings.");
        } else {
          setState(payload.settings);
        }
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load settings.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (activeSection === "notifications") {
      params.delete("section");
    } else {
      params.set("section", activeSection);
    }
    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [activeSection]);

  const updateSetting = async (patch: Partial<SettingsState>) => {
    setSaving(true);
    setError("");
    const previousState = state;
    const optimistic = { ...state, ...patch };
    setState(optimistic);

    try {
      const payload = await fetchAuthedJson<SettingsPayload>(supabase, "/api/user-settings", {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      if (!payload.ok || !payload.settings) {
        throw new Error(payload.message || "Unable to save settings.");
      }
      setState(payload.settings);
      setToast("Settings updated");
    } catch (saveError) {
      setState(previousState);
      setError(saveError instanceof Error ? saveError.message : "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-[1180px] space-y-5">
      <section className="rounded-3xl bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_48%,#082f49_100%)] p-5 text-white shadow-lg">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Settings className="h-6 w-6" /> Settings
        </h1>
        <p className="mt-1 text-sm text-white/90">Control your ServiQ preferences and manage the posts you have saved.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            {
              value: "notifications" as const,
              label: "Notifications",
              icon: Bell,
              description: "Alerts for orders, promos, and messages",
            },
            {
              value: "saved" as const,
              label: "Saved",
              icon: Bookmark,
              description: "Revisit posts from Welcome and Explore",
            },
          ].map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.value;

            return (
              <button
                key={section.value}
                type="button"
                onClick={() => setActiveSection(section.value)}
                className={`inline-flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                  isActive
                    ? "border-white/30 bg-white/15 text-white"
                    : "border-white/15 bg-white/10 text-white/80 hover:border-white/25 hover:bg-white/15"
                }`}
              >
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${isActive ? "bg-white/20" : "bg-slate-950/20"}`}>
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{section.label}</span>
                  <span className="block text-xs text-white/75">{section.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {activeSection === "notifications" ? (
        <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Bell className="h-4 w-4 text-slate-600" />
            <h2 className="text-sm font-semibold text-slate-800">Notifications</h2>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading settings...
            </div>
          ) : (
            <div className="space-y-2">
              <Toggle
                label="Order notifications"
                checked={state.order_notifications}
                disabled={saving}
                onChange={(value) => void updateSetting({ order_notifications: value })}
              />
              <Toggle
                label="Promo notifications"
                checked={state.promo_notifications}
                disabled={saving}
                onChange={(value) => void updateSetting({ promo_notifications: value })}
              />
              <Toggle
                label="Message notifications"
                checked={state.message_notifications}
                disabled={saving}
                onChange={(value) => void updateSetting({ message_notifications: value })}
              />
            </div>
          )}

          {error ? <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p> : null}
        </section>
      ) : (
        <SavedFeedView embedded />
      )}

      {toast ? (
        <div className="fixed bottom-4 left-1/2 z-[1200] -translate-x-1/2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
