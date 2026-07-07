"use client";

import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, ShieldCheck, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { storeLocalAuthSession } from "@/lib/localAuth";
import { useLocaleContext } from "@/lib/i18n-context";
import { appName } from "@/lib/branding";

interface ProviderCardData {
  id: string;
  name: string;
  services?: string[];
  role?: string;
  location?: string;
}

interface SignInModalProps {
  show: boolean;
  contactProvider: ProviderCardData | null;
  onClose: () => void;
  onAuthComplete: () => void;
}

export function SignInModal({ show, contactProvider, onClose, onAuthComplete }: SignInModalProps) {
  const router = useRouter();
  const { t } = useLocaleContext();
  const [emailAddress, setEmailAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [otpStep, setOtpStep] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const contactProviderRef = useRef(contactProvider);
  contactProviderRef.current = contactProvider;

  const isEmailLike = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const completeAuth = useCallback(
    async (user: User) => {
      const { ensureProfileForUser, resolveCurrentProfileDestination } = await import("@/lib/profile/client");
      const profile = await ensureProfileForUser(user).catch(() => null);
      const target = contactProviderRef.current
        ? `/dashboard/chat?providerId=${contactProviderRef.current.id}`
        : resolveCurrentProfileDestination(profile);
      setOtpStep(false);
      setVerificationCode("");
      onClose();
      onAuthComplete();
      router.replace(target);
    },
    [onClose, onAuthComplete, router],
  );

  useEffect(() => {
    let active = true;
    const bootstrapSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active || !session?.user) return;
      await completeAuth(session.user);
    };
    void bootstrapSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "SIGNED_IN" && session?.user) {
        void completeAuth(session.user);
      }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [completeAuth]);

  const sendEmailLink = async () => {
    setErrorMessage("");
    setInfoMessage("");
    setOtpStep(false);
    setVerificationCode("");
    const email = emailAddress.trim().toLowerCase();
    if (!isEmailLike(email)) { setErrorMessage("Enter a valid email address."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/send-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; emailSent?: boolean; message?: string } | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || payload?.message || "Unable to send magic link.");
      setOtpStep(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send magic link.";
      if (/rate|too many/i.test(message)) setErrorMessage("Too many requests. Wait 60 seconds.");
      else setErrorMessage(message);
    } finally { setLoading(false); }
  };

  const verifyOtpCode = async () => {
    setErrorMessage("");
    setInfoMessage("");
    const code = verificationCode.trim();
    if (!code || code.length < 6) { setErrorMessage("Enter the complete code from your email."); return; }
    setVerifying(true);
    const email = emailAddress.trim().toLowerCase();

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });
      if (error) throw error;
      if (data?.user) {
        await completeAuth(data.user);
        return;
      }
    } catch {
      // GoTrue is unreachable — try custom fallback
    }

    try {
      const response = await fetch("/api/auth/verify-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: code }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        user?: { id: string; email: string };
        session?: Record<string, unknown>;
        accessToken?: string;
        refreshToken?: string;
      };
      if (!payload.ok) throw new Error(payload.error || "Invalid or expired code.");

      if (payload.accessToken && payload.user) {
        storeLocalAuthSession({
          user: payload.user as { id: string; email: string },
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken || "",
        });
      }

      if (payload.session) {
        const { error: sessionError } = await supabase.auth.setSession(
          payload.session as never,
        );
        if (!sessionError) return;
      }

      if (payload.user) {
        await completeAuth(payload.user as unknown as User);
        return;
      }
      setErrorMessage("Signed in, but could not load your profile. Try refreshing.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid or expired code.";
      setErrorMessage(message);
    } finally { setVerifying(false); }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 px-4 pt-[10vh] pb-8 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-[var(--surface-border)] bg-[var(--surface-elevated)] shadow-2xl">
        <button
          type="button"
          onClick={() => { setOtpStep(false); setVerificationCode(""); setErrorMessage(""); setInfoMessage(""); onClose(); }}
          className="absolute right-4 top-4 rounded-xl p-1.5 text-[var(--ink-500)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--ink-700)]"
          aria-label={t("common.close")}
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-6 sm:p-8">
          {contactProvider ? (
            <div className="mb-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--brand-700)]">{t("auth.contactProvider")}</p>
              <h2 className="mt-1.5 text-xl font-semibold text-[var(--ink-950)]">
                {contactProvider.name}
              </h2>
              <p className="mt-1 text-xs text-[var(--ink-500)]">
                {contactProvider.services?.[0] || contactProvider.role} &middot; {contactProvider.location}
              </p>
              <div className="mt-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4">
                <p className="text-xs text-[var(--ink-700)]">{t("auth.signInToContact")}</p>
              </div>
            </div>
          ) : null}

          <div className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--brand-700)]">{t("auth.secureAccess")}</p>
            <h2 className="mt-1.5 text-2xl font-semibold text-[var(--ink-950)]">
              {t("auth.welcome", { appName })}
            </h2>
            <p className="mt-1.5 text-sm leading-[1.55] text-[var(--ink-500)]">
              {t("auth.signInSubtitle")}
            </p>
          </div>

          <div className="space-y-3">
            {otpStep ? (
              <div className="space-y-4 py-2 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--ink-950)]">{t("auth.checkEmail")}</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--ink-500)]">
                    {t("auth.codeSent", { email: emailAddress })}
                  </p>
                </div>
                <div className="space-y-2">
                  <input type="text" inputMode="numeric" autoComplete="one-time-code"
                    placeholder={t("auth.enterCode")}
                    className="w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-4 py-3 text-center text-lg font-mono tracking-widest text-[var(--ink-950)] placeholder:text-sm placeholder:tracking-normal placeholder:text-[var(--ink-500)] outline-none transition hover:border-[var(--border-strong)] focus:border-[var(--brand-500)] focus:ring-4 focus:ring-[var(--brand-ring)]"
                    value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void verifyOtpCode(); }}
                    maxLength={8}
                    autoFocus
                  />
                  <button type="button" onClick={verifyOtpCode} disabled={verifying || verificationCode.trim().length < 6}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-900)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55"
                  >{verifying ? t("auth.verifying") : t("auth.verifyAndSignIn")}{!verifying && <ArrowRight size={15} />}</button>
                </div>
                <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-3 text-left">
                  <p className="text-xs leading-[1.6] text-[var(--ink-500)]">
                    {t("auth.codeValid")}{" "}
                     <button type="button" onClick={() => { setOtpStep(false); setInfoMessage(""); setErrorMessage(""); setVerificationCode(""); }}
                      className="text-[var(--brand-700)] underline underline-offset-2 transition hover:text-[var(--brand-500)]">{t("auth.differentEmail")}</button>{" "}
                    {t("common.or")}{" "}
                    <button type="button" onClick={() => { setVerificationCode(""); void sendEmailLink(); }}
                      className="text-[var(--brand-700)] underline underline-offset-2 transition hover:text-[var(--brand-500)]">{t("auth.resendCode")}</button>.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[var(--ink-700)]">{t("auth.emailLabel")}</label>
                  <input type="email" inputMode="email" autoComplete="email" placeholder={t("auth.emailPlaceholder")}
                    className="w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-4 py-3 text-sm text-[var(--ink-950)] placeholder:text-[var(--ink-500)] outline-none transition hover:border-[var(--border-strong)] focus:border-[var(--brand-500)] focus:ring-4 focus:ring-[var(--brand-ring)]"
                    value={emailAddress} onChange={(e) => setEmailAddress(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void sendEmailLink(); }}
                  />
                </div>
                <button type="button" onClick={sendEmailLink} disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-900)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55"
                >{loading ? t("auth.sending") : t("auth.sendCode")}{!loading && <ArrowRight size={15} />}</button>
                <div className="flex items-start gap-2.5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-soft)] px-3 py-2.5">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-500)]" />
                  <p className="text-xs leading-[1.55] text-[var(--ink-500)]">{t("auth.noPasswordNote")}</p>
                </div>
              </>
            )}

            {infoMessage && !otpStep ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-700">{infoMessage}</div>
            ) : null}
            {errorMessage ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-600">{errorMessage}</div>
            ) : null}
          </div>

        </div>
      </div>
    </div>
  );
}
