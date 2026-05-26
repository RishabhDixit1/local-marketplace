"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import ServiQLogo from "@/app/components/ServiQLogo";
import { appName, appTagline } from "@/lib/branding";

export default function SetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (!session?.user) {
        router.replace("/");
        return;
      }
      const providers = session.user.app_metadata?.providers as string[] | undefined;
      if (session.user.user_metadata?.password_set && providers?.includes("email")) {
        router.replace("/dashboard");
        return;
      }
      setCheckingSession(false);
    });
    return () => { cancelled = true; };
  }, [router]);

  const handleSubmit = async () => {
    setErrorMessage("");
    const pw = newPassword.trim();
    const confirm = confirmPassword.trim();
    if (pw.length < 6) { setErrorMessage("Password must be at least 6 characters."); return; }
    if (pw !== confirm) { setErrorMessage("Passwords do not match."); return; }
    setLoading(true);
    try {
      const { error: pwError } = await supabase.auth.updateUser({ password: pw });
      if (pwError) throw pwError;
      const { error: metaError } = await supabase.auth.updateUser({
        data: { password_set: true },
      });
      if (metaError) throw metaError;
      const { ensureProfileForUser, resolveCurrentProfileDestination } = await import("@/lib/profile/client");
      const { data: { user } } = await supabase.auth.getUser();
      const profile = user ? await ensureProfileForUser(user).catch(() => null) : null;
      router.replace(resolveCurrentProfileDestination(profile));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to set password.";
      setErrorMessage(message);
    } finally { setLoading(false); }
  };

  if (checkingSession) {
    return (
      <main className="min-h-screen grid place-items-center bg-[var(--surface-app)] px-6 py-10">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-[0_24px_60px_-38px_rgba(15,23,42,0.45)] space-y-3 startup-fade">
          <div className="flex justify-center">
            <ServiQLogo compact href="/" ariaLabel="Open homepage" />
          </div>
          <p className="text-sm text-slate-600">Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen grid place-items-center bg-[var(--surface-app)] px-6 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_24px_60px_-38px_rgba(15,23,42,0.45)] space-y-5 startup-fade">
        <div className="flex justify-center">
          <ServiQLogo compact href="/" ariaLabel="Open homepage" />
        </div>
        <div className="text-center space-y-1">
          <h1 className="brand-display text-xl font-semibold text-slate-900">Create a Password</h1>
          <p className="text-sm text-slate-500">
            Set a password for your {appName} account so you can sign in on mobile.
          </p>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-600">New Password</label>
            <input
              type="password"
              placeholder="At least 6 characters"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition hover:border-slate-300 focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-200)]"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleSubmit(); }}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-600">Confirm Password</label>
            <input
              type="password"
              placeholder="Re-enter your password"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition hover:border-slate-300 focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-200)]"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleSubmit(); }}
            />
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-900)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)] active:scale-[0.98] disabled:opacity-55"
          >
            {loading ? "Saving\u2026" : "Set Password"}
          </button>
          {errorMessage ? (
            <div className="rounded-xl border border-rose-400/[0.2] bg-rose-400/[0.08] px-3.5 py-2.5 text-xs text-rose-600">{errorMessage}</div>
          ) : null}
        </div>
        <p className="text-center text-[11px] text-slate-400">{appTagline}</p>
      </div>
    </main>
  );
}
