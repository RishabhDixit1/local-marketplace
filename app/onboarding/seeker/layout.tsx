"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const STEPS = [
  { number: 1, label: "Welcome", path: "/onboarding/seeker" },
  { number: 2, label: "Profile", path: "/onboarding/seeker/profile" },
  { number: 3, label: "Ready", path: "/onboarding/seeker/publish" },
];

export default function SeekerOnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const currentStep = STEPS.findIndex((s) => s.path === pathname);
  const progress = currentStep >= 0 ? ((currentStep + 1) / STEPS.length) * 100 : 0;

  return (
    <div className="flex min-h-screen flex-col bg-[#f8fafc]">
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
            ServiQ
          </Link>
          <span className="text-xs text-slate-400">
            Step {currentStep + 1} of {STEPS.length}
          </span>
        </div>
        <div className="mx-auto mt-3 max-w-2xl">
          <div className="h-1.5 rounded-full bg-slate-100">
            <div
              className="h-1.5 rounded-full bg-slate-900 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between">
            {STEPS.map((step, i) => (
              <span
                key={step.number}
                className={`text-xs font-medium ${
                  i <= currentStep ? "text-slate-900" : "text-slate-300"
                }`}
              >
                {step.label}
              </span>
            ))}
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
