"use client";

import { useState } from "react";

const primaryVideoSrc = "https://videos.pexels.com/video-files/3195394/3195394-hd_1920_1080_25fps.mp4";
const fallbackVideoSrc = "https://videos.pexels.com/video-files/3015488/3015488-hd_1920_1080_24fps.mp4";
const AUTH_HARD_TIMEOUT_MS = 30000;
const AUTH_REACHABILITY_TIMEOUT_MS = 5000;

const cleanUrl = (value: string | undefined): string => value?.trim().replace(/\/+$/, "") ?? "";
const isAbortLikeMessage = (value: string): boolean =>
  /aborterror|signal is aborted|aborted without reason/i.test(value);

const getSupabaseConfig = (): { url: string; host: string; anonKey: string } | null => {
  const url = cleanUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

  if (!url || !anonKey) return null;

  try {
    return {
      url,
      host: new URL(url).host,
      anonKey,
    };
  } catch {
    return null;
  }
};

const buildSupabaseReachabilityMessage = (host: string): string =>
  `Browser could not complete Supabase auth request (${host}). Check VPN/firewall and disable ad-block/privacy extensions, then retry.`;

type SendLinkResponse = {
  ok: boolean;
  error?: string;
};

const probeSupabaseAuthReachability = async (url: string): Promise<boolean> => {
  const healthPromise = fetch(`${url}/auth/v1/health`, {
    method: "GET",
    cache: "no-store",
  })
    .then(() => true)
    .catch(() => false);

  let timeoutId: number | undefined;
  const timeoutPromise = new Promise<boolean>((resolve) => {
    timeoutId = window.setTimeout(() => resolve(false), AUTH_REACHABILITY_TIMEOUT_MS);
  });

  try {
    return await Promise.race([healthPromise, timeoutPromise]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const withHardTimeout = async <T,>(promise: Promise<T>, timeoutMs = AUTH_HARD_TIMEOUT_MS): Promise<T> => {
    let timeoutId: number | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = window.setTimeout(() => {
        reject(new Error(`Request timed out after ${Math.round(timeoutMs / 1000)} seconds.`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
    }
  };

  const login = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage("Enter your email address to continue.");
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setErrorMessage("No internet connection. Reconnect and try again.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    const browserOrigin = cleanUrl(typeof window !== "undefined" ? window.location.origin : "");
    if (!browserOrigin) {
      setErrorMessage("Could not resolve app URL for auth redirect. Please refresh and try again.");
      setLoading(false);
      setSent(false);
      return;
    }

    const redirectTo = `${browserOrigin}/auth/callback`;
    const supabaseConfig = getSupabaseConfig();

    if (!supabaseConfig) {
      setErrorMessage(
        "Supabase config is invalid. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local."
      );
      setLoading(false);
      setSent(false);
      return;
    }

    try {
      const response = await withHardTimeout(
        fetch("/api/auth/send-link", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: trimmedEmail,
            redirectTo,
          }),
        }),
        AUTH_HARD_TIMEOUT_MS
      );
      const payload = (await response.json().catch(() => null)) as SendLinkResponse | null;

      if (!response.ok || !payload?.ok) {
        const message = payload?.error || "Unable to send login link right now.";

        if (/redirect|site url|not allowed|url/i.test(message)) {
          setErrorMessage(
            `Auth redirect is not allowed. Add ${redirectTo} in Supabase Auth Redirect URLs.`
          );
        } else if (isAbortLikeMessage(message)) {
          setErrorMessage("Request was interrupted before completion. Retry in a few seconds.");
        } else if (/fetch|network|failed to fetch|load failed|dns|firewall|vpn/i.test(message)) {
          const isSupabaseReachable = await probeSupabaseAuthReachability(supabaseConfig.url);

          if (!isSupabaseReachable) {
            setErrorMessage(buildSupabaseReachabilityMessage(supabaseConfig.host));
          } else {
            setErrorMessage(
              "Network request failed in the browser. Disable VPN/ad-block/privacy extensions and retry."
            );
          }
        } else if (/rate|too many/i.test(message)) {
          setErrorMessage("Too many requests. Wait a minute and try again.");
        } else {
          setErrorMessage(message);
        }

        setSent(false);
        return;
      }

      setErrorMessage("");
      setSent(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send login link right now.";
      if (/timed out/i.test(message)) {
        const isSupabaseReachable = await probeSupabaseAuthReachability(supabaseConfig.url);

        if (!isSupabaseReachable) {
          setErrorMessage(buildSupabaseReachabilityMessage(supabaseConfig.host));
        } else {
          setErrorMessage(
            "Auth server is taking too long. The link may still arrive shortly, or you can retry now."
          );
        }
      } else if (isAbortLikeMessage(message)) {
        setErrorMessage("Request was interrupted before completion. Retry in a few seconds.");
      } else if (/fetch|network|failed to fetch|load failed/i.test(message)) {
        setErrorMessage(buildSupabaseReachabilityMessage(supabaseConfig.host));
      } else {
        setErrorMessage(
          "Network/auth request failed. Verify Supabase URL/anon key and allowed redirect URLs, then retry."
        );
      }
      setSent(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell min-h-screen relative overflow-hidden bg-slate-950 flex items-center justify-center px-6 py-10">
      <video
        autoPlay
        muted
        loop
        playsInline
        disablePictureInPicture
        className="video-layer absolute inset-0 h-full w-full object-cover scale-110 blur-[8px] opacity-40"
        aria-hidden="true"
      >
        <source src={primaryVideoSrc} type="video/mp4" />
        <source src={fallbackVideoSrc} type="video/mp4" />
      </video>

      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/80 via-violet-700/65 to-fuchsia-600/70" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.24),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.18),transparent_40%)]" />

      <div className="aurora absolute -top-24 -left-20 w-96 h-96 rounded-full bg-cyan-300/20 blur-3xl" />
      <div className="aurora absolute -bottom-28 -right-16 w-96 h-96 rounded-full bg-pink-300/30 blur-3xl" />
      <div className="aurora-delayed absolute top-1/3 left-1/2 -translate-x-1/2 w-[28rem] h-[28rem] rounded-full bg-violet-200/20 blur-3xl" />

      <div className="relative max-w-6xl w-full grid md:grid-cols-2 gap-8 items-center">
        <div className="text-white space-y-6 fade-up">
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight">
            Find Local Services.
            <br />
            <span className="text-yellow-300">In Real Time.</span>
          </h1>

          <p className="text-lg text-white/95 max-w-xl">
            A social marketplace for your neighborhood.
            Post what you need and connect instantly with nearby providers.
          </p>

          <div className="inline-flex items-center rounded-full border border-white/35 bg-white/10 backdrop-blur-md px-4 py-2 text-sm font-medium text-white/95 glow-tag">
            One login for seekers and providers
          </div>

          <div className="chips flex flex-wrap gap-3">
            <div className="bg-white/12 backdrop-blur-md px-4 py-2 rounded-lg text-sm border border-white/20">
              Live matching
            </div>
            <div className="bg-white/12 backdrop-blur-md px-4 py-2 rounded-lg text-sm border border-white/20">
              Community driven
            </div>
            <div className="bg-white/12 backdrop-blur-md px-4 py-2 rounded-lg text-sm border border-white/20">
              Location first
            </div>
          </div>
        </div>

        <div className="login-card bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl p-8 space-y-6 fade-up-delayed border border-white/60">
          <div className="text-center space-y-2">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-800">
              Join Your Local Network
            </h2>
            <p className="text-slate-500 text-sm">
              Login as a seeker or provider. Same account, endless opportunities.
            </p>
          </div>

          {!sent ? (
            <>
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700">Email Address</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-300 transition bg-white/95 text-slate-900 placeholder:text-slate-400 caret-slate-900"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {!!errorMessage && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {errorMessage}
                </div>
              )}

              <button
                onClick={login}
                disabled={loading}
                className="cta-btn w-full bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white py-3 rounded-lg font-semibold hover:scale-[1.02] transition-transform shadow-lg disabled:opacity-80 disabled:cursor-not-allowed"
              >
                {loading ? "Sending Secure Link..." : "Send Login Link"}
              </button>

              <p className="text-xs text-slate-500 text-center">
                Passwordless login. Secure by default.
              </p>
            </>
          ) : (
            <div className="text-center space-y-4 fade-up">
              <div className="mx-auto h-12 w-12 rounded-full bg-emerald-100 text-emerald-700 font-bold grid place-items-center">
                OK
              </div>
              <h3 className="text-lg font-semibold text-slate-800">Check Your Email</h3>
              <p className="text-gray-500 text-sm">
                We sent a secure login link to:
                <br />
                <span className="font-medium">{email}</span>
              </p>

              <p className="text-xs text-slate-500">
                Delivery can take 30-90 seconds. Check spam/promotions if needed.
              </p>

              {!!errorMessage && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {errorMessage}
                </div>
              )}

              <button
                onClick={login}
                disabled={loading}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? "Sending..." : "Send Again"}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-4 text-white/75 text-xs">
        Built for local communities. Powered by Supabase and Next.js.
      </div>

      <style jsx>{`
        .video-layer {
          filter: saturate(1.15) contrast(1.12);
        }

        .page-shell::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image: radial-gradient(rgba(255, 255, 255, 0.13) 1px, transparent 1px);
          background-size: 36px 36px;
          mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.08));
          animation: drift 20s linear infinite;
        }

        .fade-up {
          animation: fadeUp 0.75s ease-out both;
        }

        .fade-up-delayed {
          animation: fadeUp 0.95s ease-out 0.14s both;
        }

        .aurora {
          animation: float 10s ease-in-out infinite;
        }

        .aurora-delayed {
          animation: float 12s ease-in-out 0.8s infinite;
        }

        .glow-tag {
          box-shadow: 0 0 28px rgba(255, 255, 255, 0.16);
          animation: pulseGlow 2.8s ease-in-out infinite;
        }

        .chips > div {
          animation: riseIn 0.55s ease-out both;
        }

        .chips > div:nth-child(2) {
          animation-delay: 0.12s;
        }

        .chips > div:nth-child(3) {
          animation-delay: 0.24s;
        }

        .login-card {
          animation: cardFloat 5.5s ease-in-out infinite;
        }

        .cta-btn {
          position: relative;
          overflow: hidden;
        }

        .cta-btn::after {
          content: "";
          position: absolute;
          top: 0;
          left: -42%;
          width: 35%;
          height: 100%;
          background: linear-gradient(120deg, transparent, rgba(255, 255, 255, 0.35), transparent);
          transform: skewX(-20deg);
          animation: shimmer 2.6s ease-in-out infinite;
        }

        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(22px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes riseIn {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes float {
          0%,
          100% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(0, -18px, 0);
          }
        }

        @keyframes pulseGlow {
          0%,
          100% {
            box-shadow: 0 0 26px rgba(255, 255, 255, 0.14);
          }
          50% {
            box-shadow: 0 0 34px rgba(255, 255, 255, 0.26);
          }
        }

        @keyframes cardFloat {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-7px);
          }
        }

        @keyframes shimmer {
          0% {
            left: -42%;
          }
          100% {
            left: 112%;
          }
        }

        @keyframes drift {
          from {
            transform: translate3d(0, 0, 0);
          }
          to {
            transform: translate3d(-36px, -18px, 0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .aurora,
          .aurora-delayed,
          .chips > div,
          .fade-up,
          .fade-up-delayed,
          .glow-tag,
          .login-card,
          .cta-btn::after,
          .page-shell::before {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
