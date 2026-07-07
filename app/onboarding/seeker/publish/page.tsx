"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, MessageCircle, Search, ShoppingBag } from "lucide-react";

function ConfettiBurst() {
  const particles = useMemo(() => {
    return Array.from({ length: 36 }, (_, i) => ({
      id: i,
      color: ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"][i % 6],
      angle: (i / 36) * 360,
      distance: 80 + Math.random() * 120,
      size: 4 + Math.random() * 6,
      delay: Math.random() * 0.3,
    }));
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            width: p.size,
            height: p.size,
            borderRadius: Math.random() > 0.5 ? "50%" : "2px",
            backgroundColor: p.color,
            animation: `confetti-burst 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${p.delay}s forwards`,
            opacity: 0,
            transform: `translate(-50%, -50%) rotate(${p.angle}deg)`,
            "--tx": `${Math.cos((p.angle * Math.PI) / 180) * p.distance}px`,
            "--ty": `${Math.sin((p.angle * Math.PI) / 180) * p.distance - 40}px`,
          } as React.CSSProperties}
        />
      ))}
      <style jsx>{`
        @keyframes confetti-burst {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
          20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% {
            opacity: 0;
            transform: translate(
              calc(-50% + var(--tx)),
              calc(-50% + var(--ty))
            ) scale(0.5);
          }
        }
      `}</style>
    </div>
  );
}

export default function SeekerOnboardingPublishPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("profiles").upsert({
        id: user.id,
        seeker_onboarding_completed: true,
      }, { onConflict: "id" });
      setSaving(false);
      setTimeout(() => setShowConfetti(true), 200);
    })();
  }, []);

  if (saving) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--ink-500)]" />
      </div>
    );
  }

  const actions = [
    {
      icon: Search,
      label: "Browse providers",
      desc: "Find trusted service providers near you",
      href: "/dashboard/providers",
    },
    {
      icon: ShoppingBag,
      label: "Explore the marketplace",
      desc: "See what&apos;s available in your area",
      href: "/dashboard",
    },
    {
      icon: MessageCircle,
      label: "Post a help request",
      desc: "Tell providers what you need",
      href: "/dashboard/tasks",
    },
  ];

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      {showConfetti ? <ConfettiBurst /> : null}

      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        </div>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-[var(--ink-950)]">
          You&apos;re all set!
        </h1>
        <p className="mt-2 text-sm text-[var(--ink-500)]">
          Your profile is ready. Here&apos;s where to go next.
        </p>
      </div>

      <div className="mt-8 space-y-3">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => router.push(action.href)}
            className="flex w-full items-center gap-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-4 text-left transition hover:border-[var(--border-strong)] hover:shadow-sm"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-soft)]">
              <action.icon className="h-6 w-6 text-[var(--ink-700)]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--ink-950)]">{action.label}</p>
              <p className="text-xs text-[var(--ink-500)]">{action.desc}</p>
            </div>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => router.push("/dashboard")}
        className="mt-8 flex w-full items-center justify-center rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        Go to dashboard
      </button>
    </div>
  );
}
