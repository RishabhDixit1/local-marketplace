"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useState } from "react";
import { ArrowRight, Flame, Search } from "lucide-react";

const CATEGORIES = [
  { id: "home-repairs", label: "Home repairs & maintenance", icon: "🔧", popular: true },
  { id: "cleaning", label: "Cleaning & pest control", icon: "🧹", popular: true },
  { id: "electrical", label: "Electrical & plumbing", icon: "⚡", popular: true },
  { id: "painting", label: "Painting & decoration", icon: "🎨", popular: true },
  { id: "moving", label: "Packing & moving", icon: "📦" },
  { id: "beauty", label: "Salon & spa at home", icon: "💇" },
  { id: "tutoring", label: "Tutoring & classes", icon: "📚" },
  { id: "health", label: "Health & fitness", icon: "💪" },
  { id: "photography", label: "Photography & events", icon: "📸" },
  { id: "tech", label: "Tech support & repairs", icon: "💻" },
  { id: "automotive", label: "Automotive services", icon: "🚗" },
  { id: "other", label: "Something else", icon: "✨" },
];

export default function SeekerOnboardingWelcomePage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleCategory = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const continueFlow = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      interests: selected,
      metadata: { seeker_categories: selected },
    }, { onConflict: "id" });
    if (error) {
      setSaving(false);
      return;
    }
    router.push("/onboarding/seeker/profile");
  };

  const popular = CATEGORIES.filter((c) => c.popular);
  const rest = CATEGORIES.filter((c) => !c.popular);

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-soft)]">
          <Search className="h-7 w-7 text-[var(--ink-700)]" />
        </div>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-[var(--ink-950)]">
          What do you need help with?
        </h1>
        <p className="mt-2 text-sm text-[var(--ink-500)]">
          Pick the services you&apos;re looking for. We&apos;ll find the best providers near you.
        </p>
      </div>

      <div className="mt-8">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-500)]">Popular near you</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {popular.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => toggleCategory(cat.id)}
              className={`flex items-center gap-2.5 rounded-xl border px-4 py-3.5 text-left text-sm font-medium transition ${
                selected.includes(cat.id)
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-[var(--surface-border)] bg-[var(--surface-elevated)] text-[var(--ink-700)] hover:border-[var(--border-strong)]"
              }`}
            >
              <span className="text-lg">{cat.icon}</span>
              <span>{cat.label}</span>
              {selected.includes(cat.id) ? null : (
                <span className="ml-auto rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-600">Popular</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-500)]">More services</span>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {rest.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => toggleCategory(cat.id)}
              className={`flex items-center gap-2.5 rounded-xl border px-4 py-3.5 text-left text-sm font-medium transition ${
                selected.includes(cat.id)
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-[var(--surface-border)] bg-[var(--surface-elevated)] text-[var(--ink-700)] hover:border-[var(--border-strong)]"
              }`}
            >
              <span className="text-lg">{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 space-y-3">
        <button
          type="button"
          disabled={saving}
          onClick={continueFlow}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Continue"}
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => router.push("/onboarding/seeker/profile")}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-3 text-sm font-medium text-[var(--ink-700)] transition hover:bg-[var(--surface-soft)]"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
