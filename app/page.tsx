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

  const [authMode, setAuthMode] = useState<AuthMode>("email");
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
          ? `Reset code sent to ${e164}. Enter the 6-digit code to continue.`
          : `OTP sent to ${e164}. Enter the 6-digit code to continue.`
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

  const emailLinkSent = authMode === "email" && infoMessage.startsWith("Magic link sent");

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#070e1b]">
      {/* Ambient background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute left-0 top-0 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-teal-500/[0.07] blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[600px] w-[600px] translate-x-1/3 translate-y-1/3 rounded-full bg-cyan-400/[0.05] blur-[100px]" />
        <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/[0.04] blur-[80px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-[1440px] flex-col lg:flex-row">
        <div className="mb-4 flex items-center justify-between gap-3">
          <ServiQLogo compact href="/" ariaLabel="Open homepage" />
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">
            Human-centered service network
          </span>
        </div>

        {/* â•â•â•â•â•â•â• LEFT â€” Hero Panel â•â•â•â•â•â•â• */}
        <div className="relative flex flex-col overflow-hidden px-8 pb-10 pt-8 text-white lg:w-[54%] lg:min-h-screen lg:justify-between lg:px-14 lg:py-14">
          {/* Faint grid texture */}
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
              backgroundSize: "52px 52px",
            }}
          />
          {/* Gradient accent */}
          <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-cyan-400/[0.12] blur-3xl" aria-hidden="true" />

          {/* Logo */}
          <div className="relative z-10">
            <ServiQLogo
              href="/"
              ariaLabel="ServiQ home"
              showTagline
              wordmarkClassName="text-white"
              taglineClassName="text-white/50"
              markClassName="border-white/20 bg-white/10 text-white shadow-black/30"
              markDotClassName="bg-cyan-400"
              qClassName="text-cyan-400"
              qRingClassName="border-cyan-400/50"
            />
          </div>

          {/* Hero copy */}
          <div className="relative z-10 mt-14 lg:mt-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.3em] text-cyan-400">
              Trusted For Everyday Urgency
            </p>
            <h1 className="brand-display mt-4 text-[2.6rem] font-semibold leading-[1.1] tracking-[-0.025em] text-white sm:text-5xl lg:text-[3rem]">
              Reliable help<br className="hidden lg:block" /> for real life,<br />
              delivered by<br className="hidden lg:block" /> people nearby.
            </h1>
            <p className="mt-5 max-w-sm text-[0.93rem] leading-relaxed text-white/55 sm:text-base">
              {appTagline}
            </p>

            {/* How it works */}
            <div className="mt-8 flex flex-wrap items-start gap-y-4">
              {[
                { step: "01", title: "Post your need", desc: "Describe what you need in seconds." },
                { step: "02", title: "Get matched", desc: "Nearby providers respond fast." },
                { step: "03", title: "Track & complete", desc: "Real-time workflow in one place." },
              ].map((item, idx) => (
                <div key={item.step} className="flex items-start">
                  <div className="flex flex-col gap-1 pr-5">
                    <span className="text-[10px] font-bold tracking-widest text-cyan-500/80">{item.step}</span>
                    <span className="text-xs font-semibold text-white/80">{item.title}</span>
                    <span className="text-[11px] leading-4 text-white/40">{item.desc}</span>
                  </div>
                  {idx < 2 && (
                    <div className="mb-auto mr-5 mt-3 h-px w-6 shrink-0 bg-gradient-to-r from-white/20 to-transparent" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Feature cards */}
          <div className="relative z-10 mt-10 grid grid-cols-2 gap-3 lg:mt-0">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 backdrop-blur-sm transition hover:bg-white/[0.06]">
              <div className="mb-2 flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
                <p className="text-[12.5px] font-semibold text-white/90">Verified ecosystem</p>
              </div>
              <p className="text-[11px] leading-[1.6] text-white/45">Every profile carries trust signals before any conversation starts.</p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 backdrop-blur-sm transition hover:bg-white/[0.06]">
              <div className="mb-2 flex items-center gap-2">
                <Clock3 className="h-3.5 w-3.5 text-cyan-400" />
                <p className="text-[12.5px] font-semibold text-white/90">Fast turnaround</p>
              </div>
              <p className="text-[11px] leading-[1.6] text-white/45">Post needs in seconds and get real responses from people nearby.</p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 backdrop-blur-sm transition hover:bg-white/[0.06]">
              <div className="mb-2 flex items-center gap-2">
                <ArrowRight className="h-3.5 w-3.5 text-cyan-400" />
                <p className="text-[12.5px] font-semibold text-white/90">No-friction access</p>
              </div>
              <p className="text-[11px] leading-[1.6] text-white/45">Sign in with a magic link â€” no password required to get started.</p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 backdrop-blur-sm transition hover:bg-white/[0.06]">
              <div className="mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />
                <p className="text-[12.5px] font-semibold text-white/90">End-to-end workflow</p>
              </div>
              <p className="text-[11px] leading-[1.6] text-white/45">From posting a need to real-time order tracking, all in one place.</p>
            </div>
          </div>
        </div>

        {/* â•â•â•â•â•â•â• RIGHT â€” Auth Panel â•â•â•â•â•â•â• */}
        <div className="flex flex-1 items-center justify-center px-5 py-10 lg:px-12 lg:py-14">
          <div className="w-full max-w-[420px] startup-fade-delay">
            {/* Glass card */}
            <div className="overflow-hidden rounded-[28px] border border-white/[0.1] bg-white/[0.05] shadow-[0_40px_120px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
              <div className="p-7 sm:p-9">
                {/* Heading */}
                <div className="mb-6">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan-400/80">
                    Secure Access
                  </p>
                  <h2 className="brand-display mt-1.5 text-[1.65rem] font-semibold leading-tight text-white">
                    Welcome to {appName}
                  </h2>
                  <p className="mt-1.5 text-[0.8rem] leading-[1.55] text-white/45">
                    {authMode === "email"
                      ? "Enter your email to receive a secure magic link. Works for new and existing users."
                      : authMode === "login"
                        ? "Sign in with your registered phone number and password."
                        : authMode === "signup"
                          ? "Create your account â€” phone verification coming soon."
                          : "Reset your password via phone verification â€” coming soon."}
                  </p>
                </div>

                {/* Tab bar */}
                <div className="mb-6 grid grid-cols-4 gap-1 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-1">
                  {(
                    [
                      { mode: "email" as const, label: "Magic Link", icon: Mail },
                      { mode: "login" as const, label: "Login", icon: LogIn },
                      { mode: "signup" as const, label: "Sign Up", icon: UserPlus },
                      { mode: "reset" as const, label: "Reset", icon: RefreshCcw },
                    ] as const
                  ).map(({ mode, label, icon: Icon }) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => resetAuthFlow(mode)}
                      className={`relative inline-flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold transition ${
                        authMode === mode
                          ? "bg-white text-slate-900 shadow-md"
                          : "text-white/40 hover:text-white/70"
                      }`}
                    >
                      <Icon size={13} />
                      <span>{label}</span>
                      {mode === "email" && authMode !== "email" && (
                        <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-cyan-400" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Form area */}
                <div className="space-y-4">

                  {/* â”€â”€ EMAIL MAGIC LINK â”€â”€ */}
                  {authMode === "email" ? (
                    emailLinkSent ? (
                      <div className="space-y-5 py-2 text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.1]">
                          <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-base font-semibold text-white">Magic link sent!</p>
                          <p className="mt-1 text-xs leading-5 text-white/45">
                            We emailed a secure link to<br />
                            <span className="font-medium text-white/75">{emailAddress}</span>
                          </p>
                        </div>
                        <div className="space-y-2">
                          <a
                            href="https://mail.google.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.08] px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/[0.12] hover:text-white"
                          >
                            Open Gmail
                            <ArrowRight size={13} />
                          </a>
                          <a
                            href="https://outlook.live.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.08] px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/[0.12] hover:text-white"
                          >
                            Open Outlook
                            <ArrowRight size={13} />
                          </a>
                        </div>
                        <div className="rounded-xl border border-white/[0.07] bg-white/[0.04] p-3 text-left">
                          <p className="text-[11px] leading-[1.6] text-white/35">
                            Link valid for 24 hours. Check spam if you don&apos;t see it.{" "}
                            <button
                              type="button"
                              onClick={() => { setInfoMessage(""); setErrorMessage(""); }}
                              className="text-cyan-400 underline underline-offset-2 transition hover:text-cyan-300"
                            >
                              Use a different email
                            </button>{" "}
                            or{" "}
                            <button
                              type="button"
                              onClick={() => { setInfoMessage(""); void sendEmailLink(); }}
                              className="text-cyan-400 underline underline-offset-2 transition hover:text-cyan-300"
                            >
                              resend
                            </button>
                            .
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-white/60">
                            Email address
                          </label>
                          <input
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            placeholder="you@example.com"
                            className="focus-ring w-full rounded-xl border border-white/[0.12] bg-white/[0.07] px-4 py-3 text-sm text-white placeholder:text-white/25 transition hover:border-white/20 focus:border-cyan-500/60 focus:bg-white/[0.09]"
                            value={emailAddress}
                            onChange={(event) => setEmailAddress(event.target.value)}
                            onKeyDown={(event) => { if (event.key === "Enter") void sendEmailLink(); }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={sendEmailLink}
                          disabled={loading}
                          className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          {loading ? "Sending magic link..." : "Send Magic Link"}
                          {!loading && <ArrowRight size={15} />}
                        </button>
                        <div className="flex items-start gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.04] px-3.5 py-3">
                          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400/60" />
                          <p className="text-[11.5px] leading-[1.55] text-white/40">
                            Works for new and returning users. No password needed â€” just open the link from your inbox.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => resetAuthFlow("login")}
                          className="w-full text-center text-xs font-medium text-white/30 transition hover:text-white/60"
                        >
                          Have a password? Sign in with phone â†’
                        </button>
                      </>
                    )
                  ) : null}

                  {/* â”€â”€ PHONE PASSWORD LOGIN â”€â”€ */}
                  {authMode === "login" ? (
                    <>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-white/60">Phone number</label>
                        <div className="grid grid-cols-[10.5rem_1fr] gap-2">
                          <select
                            className="focus-ring w-full rounded-xl border border-white/[0.12] bg-white/[0.07] px-3 py-3 text-sm text-white/80 transition hover:border-white/20"
                            value={countryCode}
                            onChange={(event) => setCountryCode(event.target.value)}
                          >
                            {COUNTRY_CODE_OPTIONS.map((option) => (
                              <option key={option.code} value={option.dial} className="bg-slate-900 text-white">
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <input
                            type="tel"
                            inputMode="numeric"
                            placeholder="9876543210"
                            className="focus-ring w-full rounded-xl border border-white/[0.12] bg-white/[0.07] px-4 py-3 text-sm text-white placeholder:text-white/25 transition hover:border-white/20 focus:border-cyan-500/60"
                            value={phoneNumber}
                            onChange={(event) => setPhoneNumber(cleanPhoneDigits(event.target.value).slice(0, 14))}
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-white/60">Password</label>
                        <input
                          type="password"
                          placeholder="Your account password"
                          className="focus-ring w-full rounded-xl border border-white/[0.12] bg-white/[0.07] px-4 py-3 text-sm text-white placeholder:text-white/25 transition hover:border-white/20 focus:border-cyan-500/60"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          onKeyDown={(event) => { if (event.key === "Enter") void loginWithPassword(); }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={loginWithPassword}
                        disabled={loading}
                        className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-white/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        {loading ? "Signing in..." : "Sign In"}
                        {!loading && <ArrowRight size={15} />}
                      </button>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => resetAuthFlow("reset")}
                          className="text-xs text-white/35 transition hover:text-white/65"
                        >
                          Forgot password?
                        </button>
                        <button
                          type="button"
                          onClick={() => resetAuthFlow("signup")}
                          className="text-xs font-semibold text-cyan-400 transition hover:text-cyan-300"
                        >
                          New here? Sign up
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-white/[0.08]" />
                        <span className="text-[10.5px] text-white/25">or</span>
                        <div className="h-px flex-1 bg-white/[0.08]" />
                      </div>
                      <button
                        type="button"
                        onClick={() => resetAuthFlow("email")}
                        className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-white/55 transition hover:bg-white/[0.08] hover:text-white/80"
                      >
                        <Mail size={13} />
                        Continue with Email Link instead
                      </button>
                    </>
                  ) : null}

                  {/* â”€â”€ SIGNUP / RESET (OTP-based â€” temporarily unavailable) â”€â”€ */}
                  {authMode === "signup" || authMode === "reset" ? (
                    <>
                      <div className="flex items-start gap-3 rounded-xl border border-amber-400/[0.2] bg-amber-400/[0.07] px-3.5 py-3">
                        <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-amber-400/80" />
                        <div>
                          <p className="text-[12px] font-semibold text-amber-300/90">
                            Phone verification temporarily unavailable
                          </p>
                          <p className="mt-0.5 text-[11px] leading-[1.5] text-amber-300/55">
                            Use Email Link to create or access your account instantly â€” no OTP required.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => resetAuthFlow("email")}
                        className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-400 active:scale-[0.98]"
                      >
                        <Mail size={15} />
                        Continue with Email Link
                      </button>
                      <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-white/[0.07]" />
                        <span className="text-[10.5px] text-white/25">or try phone verification</span>
                        <div className="h-px flex-1 bg-white/[0.07]" />
                      </div>
                      <div className="space-y-3 opacity-60">
                        {step === "phone" ? (
                          <>
                            <div className="space-y-1.5">
                              <label className="block text-xs font-semibold text-white/50">Phone number</label>
                              <div className="grid grid-cols-[10.5rem_1fr] gap-2">
                                <select
                                  className="focus-ring w-full rounded-xl border border-white/[0.1] bg-white/[0.05] px-3 py-3 text-sm text-white/70"
                                  value={countryCode}
                                  onChange={(event) => setCountryCode(event.target.value)}
                                >
                                  {COUNTRY_CODE_OPTIONS.map((option) => (
                                    <option key={option.code} value={option.dial} className="bg-slate-900 text-white">
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="tel"
                                  inputMode="numeric"
                                  placeholder="9876543210"
                                  className="focus-ring w-full rounded-xl border border-white/[0.1] bg-white/[0.05] px-4 py-3 text-sm text-white/80 placeholder:text-white/20"
                                  value={phoneNumber}
                                  onChange={(event) => setPhoneNumber(cleanPhoneDigits(event.target.value).slice(0, 14))}
                                />
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={sendOtp}
                              disabled={loading}
                              className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-white/55 transition hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {loading ? "Sending..." : authMode === "reset" ? "Send reset code" : "Send OTP"}
                              {!loading && <ArrowRight size={14} />}
                            </button>
                          </>
                        ) : null}
                        {step === "otp" ? (
                          <>
                            <div className="space-y-1.5">
                              <label className="block text-xs font-semibold text-white/50">OTP code</label>
                              <input
                                inputMode="numeric"
                                maxLength={6}
                                placeholder="123456"
                                className="focus-ring w-full rounded-xl border border-white/[0.1] bg-white/[0.05] px-4 py-3 text-sm text-white/80 placeholder:text-white/20"
                                value={otpCode}
                                onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                              />
                              <p className="text-[11px] text-white/35">Code sent to {resolvedPhone}.</p>
                            </div>
                            <button
                              type="button"
                              onClick={verifyOtp}
                              disabled={loading}
                              className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-white/55 disabled:opacity-50"
                            >
                              {loading ? "Verifying..." : "Verify OTP"}
                              {!loading && <CheckCircle2 size={14} />}
                            </button>
                          </>
                        ) : null}
                        {step === "profile_setup" ? (
                          <>
                            <div className="space-y-1.5">
                              <label className="block text-xs font-semibold text-white/50">Full name</label>
                              <input
                                type="text"
                                placeholder="Your full name"
                                className="focus-ring w-full rounded-xl border border-white/[0.1] bg-white/[0.07] px-4 py-3 text-sm text-white/80 placeholder:text-white/20"
                                value={fullName}
                                onChange={(event) => setFullName(event.target.value)}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="block text-xs font-semibold text-white/50">Set password</label>
                              <input
                                type="password"
                                placeholder="At least 8 characters"
                                className="focus-ring w-full rounded-xl border border-white/[0.1] bg-white/[0.07] px-4 py-3 text-sm text-white/80 placeholder:text-white/20"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="block text-xs font-semibold text-white/50">Confirm password</label>
                              <input
                                type="password"
                                placeholder="Re-enter password"
                                className="focus-ring w-full rounded-xl border border-white/[0.1] bg-white/[0.07] px-4 py-3 text-sm text-white/80 placeholder:text-white/20"
                                value={confirmPassword}
                                onChange={(event) => setConfirmPassword(event.target.value)}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={finishFirstTimeSetup}
                              disabled={loading}
                              className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-white/55 disabled:opacity-50"
                            >
                              {loading ? "Finishing setup..." : "Complete Signup"}
                              {!loading && <KeyRound size={14} />}
                            </button>
                          </>
                        ) : null}
                        {step === "reset_password" ? (
                          <>
                            <div className="space-y-1.5">
                              <label className="block text-xs font-semibold text-white/50">New password</label>
                              <input
                                type="password"
                                placeholder="At least 8 characters"
                                className="focus-ring w-full rounded-xl border border-white/[0.1] bg-white/[0.07] px-4 py-3 text-sm text-white/80 placeholder:text-white/20"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="block text-xs font-semibold text-white/50">Confirm new password</label>
                              <input
                                type="password"
                                placeholder="Re-enter password"
                                className="focus-ring w-full rounded-xl border border-white/[0.1] bg-white/[0.07] px-4 py-3 text-sm text-white/80 placeholder:text-white/20"
                                value={confirmPassword}
                                onChange={(event) => setConfirmPassword(event.target.value)}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={finishPasswordReset}
                              disabled={loading}
                              className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-white/55 disabled:opacity-50"
                            >
                              {loading ? "Updating password..." : "Update password"}
                              {!loading && <KeyRound size={14} />}
                            </button>
                          </>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => resetAuthFlow("login")}
                        className="text-xs text-white/30 transition hover:text-white/60"
                      >
                        {authMode === "signup" ? "Already have an account? Login â†’" : "Back to login â†’"}
                      </button>
                    </>
                  ) : null}

                  {/* Status messages */}
                  {infoMessage && !emailLinkSent ? (
                    <div className="rounded-xl border border-emerald-400/[0.2] bg-emerald-400/[0.08] px-3.5 py-2.5 text-xs text-emerald-300/90">
                      {infoMessage}
                    </div>
                  ) : null}
                  {errorMessage ? (
                    <div className="rounded-xl border border-rose-400/[0.2] bg-rose-400/[0.08] px-3.5 py-2.5 text-xs text-rose-300/90">
                      {errorMessage}
                    </div>
                  ) : null}
                  {loading && loadingLabel ? (
                    <p className="text-[11px] text-white/30">{loadingLabel}</p>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Footer */}
            <p className="mt-5 text-center text-[11px] text-white/20">
              {appName} â€” Built for local communities Â· Powered by Supabase &amp; Next.js
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

