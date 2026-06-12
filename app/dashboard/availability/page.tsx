"use client";

import AvailabilityEditor from "@/app/components/profile/AvailabilityEditor";
import { Clock } from "lucide-react";

export default function AvailabilityPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-slate-100 p-2.5">
          <Clock className="h-5 w-5 text-slate-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Availability</h1>
          <p className="mt-1 text-sm text-slate-500">
            Set your weekly working hours so customers can book time with you.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <AvailabilityEditor />
      </div>
    </div>
  );
}
