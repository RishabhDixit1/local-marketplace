"use client";

import { usePathname } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

const STEPS = [
  { label: "Location", path: "/onboarding/provider/locality" },
  { label: "Availability", path: "/onboarding/provider/availability" },
  { label: "Business Profile", path: "/onboarding/provider/profile" },
  { label: "Publish", path: "/onboarding/provider/publish" },
];

export default function ProviderOnboardingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentIdx = STEPS.findIndex((s) => pathname.startsWith(s.path));

  return (
    <div className="mx-auto min-h-screen w-full max-w-xl px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, idx) => {
            const isCompleted = idx < currentIdx;
            const isActive = idx === currentIdx;
            return (
              <div key={step.label} className="flex items-center gap-2">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                  isCompleted
                    ? "bg-emerald-500 text-white"
                    : isActive
                    ? "bg-[var(--brand-900)] text-white ring-4 ring-[var(--brand-ring)]"
                    : "bg-slate-100 text-slate-400"
                }`}>
                  {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                </div>
                <span className={`hidden text-xs font-semibold sm:block ${
                  isActive ? "text-[var(--brand-900)]" : isCompleted ? "text-emerald-600" : "text-slate-400"
                }`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 h-1 rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-[var(--brand-900)] transition-all"
            style={{ width: `${(currentIdx / (STEPS.length - 1)) * 100}%` }}
          />
        </div>
      </div>
      {children}
    </div>
  );
}
