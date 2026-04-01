"use client";

import { useEffect, useState } from "react";
import { Bell, Loader2, Settings } from "lucide-react";
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

  const updateSetting = async (patch: Partial<SettingsState>) => {
    setSaving(true);
    setError("");
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
      setState(state);
      setError(saveError instanceof Error ? saveError.message : "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-[900px] space-y-5">
      <section className="rounded-3xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 p-5 text-white shadow-lg">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Settings className="h-6 w-6" /> Settings
        </h1>
        <p className="mt-1 text-sm text-white/90">Control your ServiQ notification preferences.</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
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

      {toast ? (
        <div className="fixed bottom-4 left-1/2 z-[1200] -translate-x-1/2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
