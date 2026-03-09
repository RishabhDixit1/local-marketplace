"use client";

import { BriefcaseBusiness, UserRound } from "lucide-react";
import type { ProfileRoleFamily } from "@/lib/profile/types";

const options: Array<{
  value: ProfileRoleFamily;
  title: string;
  description: string;
  icon: typeof BriefcaseBusiness;
  accent: string;
}> = [
  {
    value: "provider",
    title: "Service Provider",
    description: "Offer services or products and get discovered by nearby seekers.",
    icon: BriefcaseBusiness,
    accent: "from-sky-500 to-indigo-500",
  },
  {
    value: "seeker",
    title: "Looking for Services",
    description: "Describe your needs clearly so local providers can respond faster.",
    icon: UserRound,
    accent: "from-fuchsia-500 to-rose-500",
  },
];

export default function ProfileRoleToggle({
  value,
  onChange,
  disabled,
}: {
  value: ProfileRoleFamily;
  onChange: (value: ProfileRoleFamily) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {options.map((option) => {
        const Icon = option.icon;
        const active = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`group relative overflow-hidden rounded-[26px] border p-5 text-left transition focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-70 ${
              active
                ? "border-transparent bg-slate-950 text-white shadow-xl shadow-slate-900/20"
                : "border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300 hover:bg-white"
            }`}
          >
            <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${option.accent} ${active ? "opacity-100" : "opacity-55"}`} />
            <div className="flex items-start gap-4">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                  active ? "bg-white/10 text-white" : "bg-white text-slate-900 shadow-sm"
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold">{option.title}</p>
                <p className={`mt-1 text-sm leading-6 ${active ? "text-white/75" : "text-slate-600"}`}>{option.description}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
