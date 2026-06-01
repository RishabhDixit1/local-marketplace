"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, Loader2, LogOut, Moon, Shield, Sun, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type UserSettings = {
  order_notifications: boolean;
  promo_notifications: boolean;
  message_notifications: boolean;
};

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<UserSettings>({
    order_notifications: true,
    promo_notifications: true,
    message_notifications: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from("user_settings")
          .select("order_notifications,promo_notifications,message_notifications")
          .eq("user_id", user.id)
          .maybeSingle();

        if (data) {
          setSettings(data as UserSettings);
        }
      } catch {
        // Defaults will be used
      } finally {
        setLoading(false);
      }
    };

    void loadSettings();

    const stored = localStorage.getItem("serviq-theme");
    if (stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      setTheme("dark");
    }
  }, []);

  const saveSettings = useCallback(async () => {
    setSaving(true);
    setSaveError("");
    setSaveSuccess(false);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("user_settings").upsert({
        user_id: user.id,
        ...settings,
      }, { onConflict: "user_id" });

      if (error) throw error;
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }, [settings]);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("serviq-theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  const deleteAccount = useCallback(async () => {
    if (deleteConfirmText !== "DELETE") return;
    setDeleting(true);
    try {
      await supabase.auth.signOut();
      router.replace("/");
    } catch {
      setDeleting(false);
    }
  }, [deleteConfirmText, router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-600">Manage your preferences and account.</p>
      </div>

      {/* Notification Preferences */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-slate-500" />
          <div>
            <h2 className="text-base font-semibold text-slate-900">Notifications</h2>
            <p className="text-xs text-slate-500">Control which updates you receive.</p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <ToggleRow
            icon={<Bell className="h-4 w-4" />}
            label="Order updates"
            description="Emails when order status changes"
            checked={settings.order_notifications}
            onChange={(checked) => setSettings((prev) => ({ ...prev, order_notifications: checked }))}
          />
          <ToggleRow
            icon={<Bell className="h-4 w-4" />}
            label="Promotional emails"
            description="Tips, new features, and community updates"
            checked={settings.promo_notifications}
            onChange={(checked) => setSettings((prev) => ({ ...prev, promo_notifications: checked }))}
          />
          <ToggleRow
            icon={<Bell className="h-4 w-4" />}
            label="Message notifications"
            description="New messages and connection requests"
            checked={settings.message_notifications}
            onChange={(checked) => setSettings((prev) => ({ ...prev, message_notifications: checked }))}
          />
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveSettings()}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Saving..." : "Save preferences"}
          </button>
          {saveSuccess ? (
            <span className="text-sm font-medium text-emerald-600">Saved!</span>
          ) : null}
          {saveError ? (
            <span className="text-sm font-medium text-rose-600">{saveError}</span>
          ) : null}
        </div>
      </section>

      {/* Appearance */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <Moon className="h-5 w-5 text-slate-500" />
          <div>
            <h2 className="text-base font-semibold text-slate-900">Appearance</h2>
            <p className="text-xs text-slate-500">Toggle between light and dark mode.</p>
          </div>
        </div>

        <div className="mt-5">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 transition hover:bg-slate-50"
          >
            <div className="flex items-center gap-3">
              {theme === "light" ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-indigo-500" />}
              <span className="text-sm font-medium text-slate-900">
                {theme === "light" ? "Light mode" : "Dark mode"}
              </span>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {theme === "light" ? "Light" : "Dark"}
            </span>
          </button>
        </div>
      </section>

      {/* Account */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-slate-500" />
          <div>
            <h2 className="text-base font-semibold text-slate-900">Account</h2>
            <p className="text-xs text-slate-500">Session and account management.</p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" />
            Sign out of all devices
          </button>

          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="flex w-full items-center gap-3 rounded-xl border border-rose-200 px-4 py-3 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete account
          </button>
        </div>
      </section>

      {/* Logout Confirm */}
      {showLogoutConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-900">Sign out?</h2>
            <p className="mt-2 text-sm text-slate-600">You can sign back in anytime with a magic link.</p>
            <div className="mt-6 flex gap-3 justify-end">
              <button onClick={() => setShowLogoutConfirm(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button>
              <button onClick={async () => { await supabase.auth.signOut(); router.replace("/"); }} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">Sign out</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Delete Confirm */}
      {showDeleteConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-rose-100 p-2 text-rose-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Delete account?</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  This is permanent. Your profile, listings, and data will be removed. Type <strong>DELETE</strong> to confirm.
                </p>
              </div>
            </div>
            <input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder='Type "DELETE" to confirm'
              className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-rose-300 focus:ring-4 focus:ring-rose-100"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button>
              <button
                disabled={deleteConfirmText !== "DELETE" || deleting}
                onClick={() => void deleteAccount()}
                className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete account"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 px-4 py-3 transition hover:bg-slate-50">
      <div className="flex items-center gap-3 min-w-0">
        <span className="shrink-0 text-slate-400">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900">{label}</p>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 shrink-0 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
      />
    </label>
  );
}
