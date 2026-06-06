"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, MessageCircle, Search, ShoppingBag } from "lucide-react";

export default function SeekerOnboardingPublishPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("profiles").upsert({
        id: user.id,
        seeker_onboarding_completed: true,
      }, { onConflict: "id" });
      setSaving(false);
    })();
  }, []);

  if (saving) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
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
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
          You&apos;re all set!
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Your profile is ready. Here&apos;s where to go next.
        </p>
      </div>

      <div className="mt-8 space-y-3">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => router.push(action.href)}
            className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 hover:shadow-sm"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100">
              <action.icon className="h-6 w-6 text-slate-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">{action.label}</p>
              <p className="text-xs text-slate-500">{action.desc}</p>
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
