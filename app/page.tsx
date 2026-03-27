"use client";

import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  KeyRound,
  Mail,
  LogIn,
  RefreshCcw,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import {
  ensureProfileForUser,
  fetchProfileByUserId,
  resolveCurrentProfileDestination,
  saveCurrentUserProfile,
} from "@/lib/profile/client";
import type { ProfileRecord } from "@/lib/profile/types";
import { normalizePhone, toProfileFormValues } from "@/lib/profile/utils";
import ServiQLogo from "@/app/components/ServiQLogo";
import { appName, appTagline } from "@/lib/branding";

type AuthMode = "login" | "signup" | "reset" | "email";
type AuthStep = "phone" | "otp" | "profile_setup" | "reset_password";

const PASSWORD_MIN_LENGTH = 8;

const COUNTRY_CODE_OPTIONS: Array<{ code: string; label: string; dial: string }> = [
  { code: "IN", label: "India (+91)", dial: "+91" },
  { code: "US", label: "United States (+1)", dial: "+1" },
  { code: "GB", label: "United Kingdom (+44)", dial: "+44" },
  { code: "AE", label: "United Arab Emirates (+971)", dial: "+971" },
  { code: "SA", label: "Saudi Arabia (+966)", dial: "+966" },
  { code: "SG", label: "Singapore (+65)", dial: "+65" },
  { code: "AU", label: "Australia (+61)", dial: "+61" },
  { code: "CA", label: "Canada (+1)", dial: "+1" },
  { code: "DE", label: "Germany (+49)", dial: "+49" },
];

const cleanDialCode = (value: string) => {
  const raw = value.replace(/[^\d+]/g, "");
  if (!raw) return "";
  return raw.startsWith("+") ? raw : `+${raw}`;
};

const cleanPhoneDigits = (value: string) => value.replace(/\D/g, "");

const isEmailLike = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const toE164Phone = (dialCodeRaw: string, phoneRaw: string): string | null => {
  const dialCode = cleanDialCode(dialCodeRaw);
  const dialDigits = dialCode.replace("+", "");
  let subscriberDigits = cleanPhoneDigits(phoneRaw);

  if (!dialDigits || !subscriberDigits) return null;

  // India-friendly handling for local leading zero.
  if (dialDigits === "91" && subscriberDigits.length === 11 && subscriberDigits.startsWith("0")) {
    subscriberDigits = subscriberDigits.slice(1);
  }

  const combinedDigits = `${dialDigits}${subscriberDigits}`;
  if (combinedDigits.length < 8 || combinedDigits.length > 15) return null;

  return `+${combinedDigits}`;
};

const toProfilePhone = (rawValue: string | null | undefined) => {
  const normalized = normalizePhone(rawValue);
  if (!normalized) return "";
  if (normalized.length <= 10) return normalized;
  return normalized.slice(-10);
};

const isGenericProfileName = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return !normalized || normalized === "local member" || normalized === "local-user";
};

const inferInitialFullName = (user: User | null, profile: ProfileRecord | null) => {
  const metadata = (user?.user_metadata || {}) as Record<string, unknown>;
  const metadataName = typeof metadata.full_name === "string" ? metadata.full_name.trim() : "";
  if (metadataName && !isGenericProfileName(metadataName)) return metadataName;

  const profileName = (profile?.full_name || profile?.name || "").trim();
  if (profileName && !isGenericProfileName(profileName)) return profileName;

  return "";
};

const shouldShowFirstTimeSetup = (user: User, profile: ProfileRecord | null) => {
  const metadata = (user.user_metadata || {}) as Record<string, unknown>;
  const setupCompleted = metadata.phone_setup_completed === true;
  const nameCandidate = inferInitialFullName(user, profile);

  return !setupCompleted || !nameCandidate;
};

export default function LoginPage() {
  const router = useRouter();

  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [step, setStep] = useState<AuthStep>("phone");
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [resolvedPhone, setResolvedPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const resetAuthFlow = useCallback((nextMode: AuthMode) => {
    setAuthMode(nextMode);
    setStep("phone");
    setResolvedPhone("");
    setOtpCode("");
    setFullName("");
    setPassword("");
    setConfirmPassword("");
    setInfoMessage("");
    setErrorMessage("");
    setLoading(false);
  }, []);

  const loadingLabel = useMemo(() => {
    if (!loading) return "";
    if (authMode === "email") return "Sending magic link...";
    if (authMode === "login") return "Signing you in...";
    if (step === "phone") return authMode === "reset" ? "Sending reset code..." : "Sending OTP...";
    if (step === "otp") return "Verifying OTP...";
    if (step === "reset_password") return "Updating your password...";
    return "Saving your details...";
  }, [authMode, loading, step]);

  const completeAuth = useCallback(
    async (user: User) => {
      const profile = await ensureProfileForUser(user).catch(() => null);

      if (authMode === "signup" && shouldShowFirstTimeSetup(user, profile)) {
        setStep("profile_setup");
        setFullName(inferInitialFullName(user, profile));
        setResolvedPhone(user.phone || resolvedPhone);
        setInfoMessage("Phone verified. Add your full name and password to finish account setup.");
        return;
      }

      router.replace(resolveCurrentProfileDestination(profile));
    },
    [authMode, resolvedPhone, router]
  );

  useEffect(() => {
    let active = true;

    const bootstrapSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active || !session?.user) return;
      await completeAuth(session.user);
    };

    void bootstrapSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "SIGNED_IN" && session?.user) {
        void completeAuth(session.user);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [completeAuth]);

  const loginWithPassword = async () => {
    setErrorMessage("");
    setInfoMessage("");

    const e164 = toE164Phone(countryCode, phoneNumber);
    if (!e164) {
      setErrorMessage("Select a country code and enter a valid phone number.");
      return;
    }

    const secret = password.trim();
    if (!secret) {
      setErrorMessage("Enter your password.");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        phone: e164,
        password: secret,
      });

      if (error) throw error;

      const user = data.user || (await supabase.auth.getUser()).data.user;
      if (!user) {
        throw new Error("Sign-in succeeded, but your session was not created. Try again.");
      }

      await completeAuth(user);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sign in right now.";
      setErrorMessage(
        /invalid|credential|password|not found/i.test(message)
          ? "Phone or password is incorrect. If this is your first time, use Sign Up or Email Link."
          : message
      );
    } finally {
      setLoading(false);
    }
  };

  const sendEmailLink = async () => {
    setErrorMessage("");
    setInfoMessage("");

    const email = emailAddress.trim().toLowerCase();
    if (!isEmailLike(email)) {
      setErrorMessage("Enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/send-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Unable to send magic link right now.");
      }

      setInfoMessage(`Magic link sent to ${email}. Open the email to continue.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send magic link right now.";
      if (/rate|too many/i.test(message)) {
        setErrorMessage("Too many requests. Wait 60 seconds and try again.");
      } else {
        setErrorMessage(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async () => {
    setErrorMessage("");
    setInfoMessage("");

    const e164 = toE164Phone(countryCode, phoneNumber);
    if (!e164) {
      setErrorMessage("Select a country code and enter a valid phone number.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: e164,
        options: {
          shouldCreateUser: authMode !== "reset",
          channel: "sms",
        },
      });

      if (error) {
        throw error;
      }

      setResolvedPhone(e164);
      setStep("otp");
      setOtpCode("");
      setInfoMessage(
        authMode === "reset"
          ? `Reset code requested for ${e164}. Enter the 6-digit code to continue.`
          : `OTP requested for ${e164}. Enter the 6-digit code to continue.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send OTP right now.";
      if (/rate|too many/i.test(message)) {
        setErrorMessage("Too many requests. Wait 60 seconds and try again.");
      } else {
        setErrorMessage(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setErrorMessage("");

    if (!resolvedPhone) {
      setErrorMessage("Phone number context is missing. Please request a new OTP.");
      setStep("phone");
      return;
    }

    const token = otpCode.trim();
    if (!/^\d{6}$/.test(token)) {
      setErrorMessage("Enter the 6-digit OTP code.");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: resolvedPhone,
        token,
        type: "sms",
      });

      if (error) throw error;

      const user = data.user || (await supabase.auth.getUser()).data.user;
      if (!user) {
        throw new Error("Session was not created after OTP verification. Try again.");
      }

      if (authMode === "reset") {
        setStep("reset_password");
        setInfoMessage(`Phone verified. Create a new password for ${resolvedPhone}.`);
        return;
      }

      await completeAuth(user);
    } catch (error) {
      const message = error instanceof Error ? error.message : "OTP verification failed.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const finishFirstTimeSetup = async () => {
    setErrorMessage("");

    const normalizedName = fullName.trim();
    if (normalizedName.length < 2) {
      setErrorMessage("Enter your full name (at least 2 characters).");
      return;
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      setErrorMessage(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Password and confirm password do not match.");
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Your session expired. Please verify OTP again.");
      }

      const { error: updateAuthError } = await supabase.auth.updateUser({
        password,
        data: {
          full_name: normalizedName,
          phone_setup_completed: true,
        },
      });

      if (updateAuthError) throw updateAuthError;

      const currentProfile = await fetchProfileByUserId(user.id, user).catch(() => null);
      const baseValues = toProfileFormValues(currentProfile);

      const nextProfile = await saveCurrentUserProfile({
        user: {
          id: user.id,
          email: user.email || "",
        },
        values: {
          ...baseValues,
          fullName: normalizedName,
          phone: toProfilePhone(baseValues.phone || user.phone || resolvedPhone),
          email: baseValues.email || user.email || "",
        },
      });

      router.replace(resolveCurrentProfileDestination(nextProfile || currentProfile));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to finish setup.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const finishPasswordReset = async () => {
    setErrorMessage("");

    if (password.length < PASSWORD_MIN_LENGTH) {
      setErrorMessage(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Password and confirm password do not match.");
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Your session expired. Please verify OTP again.");
      }

      const { error: updateAuthError } = await supabase.auth.updateUser({
        password,
      });

      if (updateAuthError) throw updateAuthError;

      await completeAuth(user);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update your password.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--surface-app)] px-4 py-5 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl startup-fade">
        <div className="mb-4 flex items-center justify-between gap-3">
          <ServiQLogo compact href="/" ariaLabel="Open homepage" />
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">
            Human-centered service network
          </span>
        </div>

        <section className="relative overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_38px_90px_-52px_rgba(15,23,42,0.45)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_16%,rgba(20,184,166,0.08),transparent_42%),radial-gradient(circle_at_86%_86%,rgba(14,165,233,0.08),transparent_44%)]" />

          <div className="relative grid lg:grid-cols-[1.08fr_0.92fr]">
            <div className="relative overflow-hidden bg-[linear-gradient(158deg,var(--brand-900)_0%,var(--brand-700)_100%)] p-7 text-white sm:p-10">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:36px_36px]" />

              <div className="relative">
                <ServiQLogo
                  href="/"
                  ariaLabel="Open homepage"
                  showTagline
                  wordmarkClassName="text-white"
                  taglineClassName="text-white/70"
                  markClassName="border-white/30 bg-white/10 text-white shadow-black/20"
                  markDotClassName="bg-cyan-300"
                  qClassName="text-cyan-300"
                  qRingClassName="border-cyan-300/60"
                />

                <p className="mt-10 text-xs uppercase tracking-[0.22em] text-cyan-100/80">Trusted For Everyday Urgency</p>
                <h1 className="brand-display mt-3 text-4xl font-semibold leading-tight sm:text-5xl">
                  Reliable help for real life, delivered by people nearby.
                </h1>
                <p className="mt-5 max-w-xl text-base text-slate-100/92 sm:text-lg">{appTagline}</p>

                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/18 bg-white/10 p-4 backdrop-blur-sm">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <ShieldCheck size={16} className="text-cyan-200" />
                      Verified ecosystem
                    </p>
                    <p className="mt-2 text-xs text-slate-100/80">Profiles, context, and trust signals before each conversation.</p>
                  </div>
                  <div className="rounded-2xl border border-white/18 bg-white/10 p-4 backdrop-blur-sm">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <Clock3 size={16} className="text-cyan-200" />
                      Fast turnaround
                    </p>
                    <p className="mt-2 text-xs text-slate-100/80">Post needs in seconds and start response threads immediately.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-7 sm:p-10 lg:p-12 startup-fade-delay">
              <div className="mx-auto w-full max-w-md">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Secure Access</p>
                <h2 className="brand-display mt-2 text-3xl font-semibold text-slate-900 sm:text-[2rem]">Welcome to {appName}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {authMode === "login"
                    ? "Returning users sign in with phone and password. Email link access is available too."
                    : authMode === "signup"
                      ? "First-time users verify their phone number, then add their full name and password."
                      : authMode === "reset"
                        ? "We verify phone ownership first, then let you set a new password."
                        : "Open the magic link we send to your email. New accounts can access the app without a password."}
                </p>

                <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 sm:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => resetAuthFlow("login")}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                      authMode === "login"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <LogIn size={14} />
                    Login
                  </button>
                  <button
                    type="button"
                    onClick={() => resetAuthFlow("signup")}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                      authMode === "signup"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <UserPlus size={14} />
                    Sign Up
                  </button>
                  <button
                    type="button"
                    onClick={() => resetAuthFlow("reset")}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                      authMode === "reset"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <RefreshCcw size={14} />
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => resetAuthFlow("email")}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                      authMode === "email"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Mail size={14} />
                    Email Link
                  </button>
                </div>

                <div className="mt-6 space-y-4">
                  {authMode === "login" ? (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Phone number</label>
                        <div className="grid grid-cols-[12rem_1fr] gap-2">
                          <select
                            className="focus-ring w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900"
                            value={countryCode}
                            onChange={(event) => setCountryCode(event.target.value)}
                          >
                            {COUNTRY_CODE_OPTIONS.map((option) => (
                              <option key={option.code} value={option.dial}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <input
                            type="tel"
                            inputMode="numeric"
                            placeholder="9876543210"
                            className="focus-ring w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400"
                            value={phoneNumber}
                            onChange={(event) => setPhoneNumber(cleanPhoneDigits(event.target.value).slice(0, 14))}
                          />
                        </div>
                        <p className="text-xs text-slate-500">Choose country code from the list, then enter mobile number only.</p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Password</label>
                        <input
                          type="password"
                          placeholder="Your account password"
                          className="focus-ring w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                        />
                      </div>

                      <button
                        onClick={loginWithPassword}
                        disabled={loading}
                        className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-900)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)] disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {loading ? "Signing in..." : "Login"}
                        {!loading ? <CheckCircle2 size={14} /> : null}
                      </button>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => resetAuthFlow("reset")}
                          className="text-sm font-semibold text-slate-600 transition hover:text-slate-900"
                        >
                          Forgot password?
                        </button>
                        <button
                          type="button"
                          onClick={() => resetAuthFlow("signup")}
                          className="text-sm font-semibold text-[var(--brand-700)] transition hover:text-[var(--brand-900)]"
                        >
                          New here? Sign up
                        </button>
                      </div>
                    </>
                  ) : null}

                  {authMode === "email" ? (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Email address</label>
                        <input
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          placeholder="you@example.com"
                          className="focus-ring w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400"
                          value={emailAddress}
                          onChange={(event) => setEmailAddress(event.target.value)}
                        />
                      </div>

                      <button
                        onClick={sendEmailLink}
                        disabled={loading}
                        className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-900)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)] disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {loading ? "Sending magic link..." : "Send Magic Link"}
                        {!loading ? <ArrowRight size={14} /> : null}
                      </button>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Email link access</p>
                        <p className="mt-1 text-sm text-slate-700">
                          This works for new and returning users. Open the link from your inbox to continue.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => resetAuthFlow("login")}
                        className="text-sm font-semibold text-[var(--brand-700)] transition hover:text-[var(--brand-900)]"
                      >
                        Prefer phone login? Switch back
                      </button>
                    </>
                  ) : null}

                  {authMode === "signup" || authMode === "reset" ? (
                    <>
                      {step === "phone" ? (
                        <>
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Phone number</label>
                            <div className="grid grid-cols-[12rem_1fr] gap-2">
                              <select
                                className="focus-ring w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900"
                                value={countryCode}
                                onChange={(event) => setCountryCode(event.target.value)}
                              >
                                {COUNTRY_CODE_OPTIONS.map((option) => (
                                  <option key={option.code} value={option.dial}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="tel"
                                inputMode="numeric"
                                placeholder="9876543210"
                                className="focus-ring w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400"
                                value={phoneNumber}
                                onChange={(event) => setPhoneNumber(cleanPhoneDigits(event.target.value).slice(0, 14))}
                              />
                            </div>
                            <p className="text-xs text-slate-500">Choose country code from the list, then enter mobile number only.</p>
                          </div>

                          <button
                            onClick={sendOtp}
                            disabled={loading}
                            className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-900)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)] disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {loading ? (authMode === "reset" ? "Sending reset code..." : "Sending OTP...") : authMode === "reset" ? "Send reset code" : "Send OTP"}
                            {!loading ? <ArrowRight size={14} /> : null}
                          </button>
                        </>
                      ) : null}

                      {step === "otp" ? (
                        <>
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">OTP code</label>
                            <input
                              inputMode="numeric"
                              maxLength={6}
                              placeholder="123456"
                              className="focus-ring w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400"
                              value={otpCode}
                              onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                            />
                            <p className="text-xs text-slate-500">
                              {authMode === "reset"
                                ? `Code sent to ${resolvedPhone}. Verify it to reset your password.`
                                : `Code sent to ${resolvedPhone}. OTP expires quickly.`}
                            </p>
                          </div>

                          <button
                            onClick={verifyOtp}
                            disabled={loading}
                            className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-900)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)] disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {loading ? "Verifying..." : authMode === "reset" ? "Verify reset code" : "Verify OTP"}
                            {!loading ? <CheckCircle2 size={14} /> : null}
                          </button>

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={sendOtp}
                              disabled={loading}
                              className="focus-ring inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-70"
                            >
                              Resend {authMode === "reset" ? "code" : "OTP"}
                            </button>
                            <button
                              onClick={() => {
                                setStep("phone");
                                setOtpCode("");
                                setErrorMessage("");
                                setInfoMessage("");
                                setResolvedPhone("");
                              }}
                              disabled={loading}
                              className="focus-ring inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-70"
                            >
                              Change phone
                            </button>
                          </div>
                        </>
                      ) : null}

                      {step === "profile_setup" ? (
                        <>
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Full name</label>
                            <input
                              type="text"
                              placeholder="Your full name"
                              className="focus-ring w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400"
                              value={fullName}
                              onChange={(event) => setFullName(event.target.value)}
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Set password</label>
                            <input
                              type="password"
                              placeholder="At least 8 characters"
                              className="focus-ring w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400"
                              value={password}
                              onChange={(event) => setPassword(event.target.value)}
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Confirm password</label>
                            <input
                              type="password"
                              placeholder="Re-enter password"
                              className="focus-ring w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400"
                              value={confirmPassword}
                              onChange={(event) => setConfirmPassword(event.target.value)}
                            />
                          </div>

                          <button
                            onClick={finishFirstTimeSetup}
                            disabled={loading}
                            className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-900)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)] disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {loading ? "Finishing setup..." : "Complete Signup"}
                            {!loading ? <KeyRound size={14} /> : null}
                          </button>
                        </>
                      ) : null}

                      {step === "reset_password" ? (
                        <>
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">New password</label>
                            <input
                              type="password"
                              placeholder="At least 8 characters"
                              className="focus-ring w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400"
                              value={password}
                              onChange={(event) => setPassword(event.target.value)}
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Confirm new password</label>
                            <input
                              type="password"
                              placeholder="Re-enter password"
                              className="focus-ring w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400"
                              value={confirmPassword}
                              onChange={(event) => setConfirmPassword(event.target.value)}
                            />
                          </div>

                          <button
                            onClick={finishPasswordReset}
                            disabled={loading}
                            className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-900)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)] disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {loading ? "Updating password..." : "Update password"}
                            {!loading ? <KeyRound size={14} /> : null}
                          </button>
                        </>
                      ) : null}

                      {authMode === "signup" ? (
                        <button
                          type="button"
                          onClick={() => resetAuthFlow("login")}
                          className="text-sm font-semibold text-[var(--brand-700)] transition hover:text-[var(--brand-900)]"
                        >
                          Already have an account? Login
                        </button>
                      ) : authMode === "reset" ? (
                        <button
                          type="button"
                          onClick={() => resetAuthFlow("login")}
                          className="text-sm font-semibold text-[var(--brand-700)] transition hover:text-[var(--brand-900)]"
                        >
                          Back to login
                        </button>
                      ) : null}
                    </>
                  ) : null}

                  {infoMessage ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                      {infoMessage}
                    </div>
                  ) : null}

                  {errorMessage ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                      {errorMessage}
                    </div>
                  ) : null}

                  {loading && loadingLabel ? (
                    <p className="text-xs text-slate-500">{loadingLabel}</p>
                  ) : null}
                </div>

                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    <LogIn size={13} />
                    Password login
                  </p>
                  <p className="mt-1 text-sm text-slate-700">Returning users sign in with the phone number and password they created.</p>
                </div>

                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    <RefreshCcw size={13} />
                    OTP signup and reset
                  </p>
                  <p className="mt-1 text-sm text-slate-700">New users verify once, then set name + password. Forgot password uses OTP recovery.</p>
                </div>

                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    <Mail size={13} />
                    Email magic link
                  </p>
                  <p className="mt-1 text-sm text-slate-700">Send a secure link to the inbox for fast access without a password.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <p className="mt-4 text-center text-xs text-slate-500">
          {appName} is built for local communities. Powered by Supabase and Next.js.
        </p>
      </div>
    </div>
  );
}
