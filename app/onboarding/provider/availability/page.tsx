"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Clock, Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchAuthedJson } from "@/lib/clientApi";
import { Input } from "@/app/components/ui/Input";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Slot = { day_of_week: number; start_time: string; end_time: string };

const defaultSlots: Slot[] = [
  { day_of_week: 1, start_time: "09:00", end_time: "13:00" },
  { day_of_week: 1, start_time: "14:00", end_time: "18:00" },
  { day_of_week: 2, start_time: "09:00", end_time: "13:00" },
  { day_of_week: 2, start_time: "14:00", end_time: "18:00" },
  { day_of_week: 3, start_time: "09:00", end_time: "13:00" },
  { day_of_week: 3, start_time: "14:00", end_time: "18:00" },
  { day_of_week: 4, start_time: "09:00", end_time: "13:00" },
  { day_of_week: 4, start_time: "14:00", end_time: "18:00" },
  { day_of_week: 5, start_time: "09:00", end_time: "13:00" },
  { day_of_week: 5, start_time: "14:00", end_time: "18:00" },
  { day_of_week: 6, start_time: "09:00", end_time: "14:00" },
];

export default function ProviderAvailabilityOnboarding() {
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchExisting = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      try {
        const res = await fetch(`/api/provider/availability?provider_id=${user.id}`);
        const json = await res.json();
        if (json.ok && json.slots?.length > 0) {
          setSlots(json.slots.map((s: { day_of_week: number; start_time: string; end_time: string }) => ({
            day_of_week: s.day_of_week,
            start_time: s.start_time.slice(0, 5),
            end_time: s.end_time.slice(0, 5),
          })));
        } else {
          setSlots(defaultSlots);
        }
      } catch {
        setSlots(defaultSlots);
      } finally {
        setLoading(false);
      }
    };
    void fetchExisting();
  }, []);

  const addSlot = (day: number) => {
    setSlots((prev) => [...prev, { day_of_week: day, start_time: "09:00", end_time: "17:00" }]);
  };

  const removeSlot = (idx: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateSlot = (idx: number, field: keyof Slot, value: string | number) => {
    setSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const handleSubmit = useCallback(async () => {
    setSaving(true);
    setError("");
    try {
      const result = await fetchAuthedJson<{ ok: boolean; message?: string }>(
        supabase,
        "/api/provider/availability",
        {
          method: "POST",
          body: JSON.stringify(slots),
        }
      );
      if (result?.ok) {
        router.push("/onboarding/provider/profile");
      } else {
        setError(result?.message || "Failed to save availability");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }, [slots, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const daysWithSlots = DAYS.map((day, dayIdx) => ({
    day,
    dayIdx,
    daySlots: slots.filter((s) => s.day_of_week === dayIdx),
  }));

  return (
    <div>
      <div className="mb-6">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-100)]">
          <Clock className="h-6 w-6 text-[var(--brand-700)]" />
        </div>
        <h1 className="text-center text-xl font-bold text-slate-900">Set your availability</h1>
        <p className="mt-1 text-center text-sm text-slate-500">
          Let customers know when they can book your services
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>
      )}

      <div className="space-y-4">
        {daysWithSlots.map(({ day, dayIdx, daySlots }) => (
          <div key={dayIdx} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-700">{day}</label>
              <button
                type="button"
                onClick={() => addSlot(dayIdx)}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition hover:border-[var(--brand-300)] hover:text-[var(--brand-700)]"
              >
                <Plus className="h-3 w-3" /> Add slot
              </button>
            </div>
            {daySlots.length === 0 ? (
              <p className="text-xs text-slate-400">No availability set</p>
            ) : (
              <div className="space-y-2">
                {daySlots.map((slot, slotIdx) => {
                  const globalIdx = slots.indexOf(slot);
                  return (
                    <div key={slotIdx} className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={slot.start_time}
                        onChange={(e) => updateSlot(globalIdx, "start_time", e.target.value)}
                      />
                      <span className="text-xs text-slate-400">to</span>
                      <Input
                        type="time"
                        value={slot.end_time}
                        onChange={(e) => updateSlot(globalIdx, "end_time", e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => removeSlot(globalIdx)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={saving || slots.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand-900)] px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[var(--brand-800)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving...
            </>
          ) : (
            "Continue"
          )}
        </button>
        <button
          type="button"
          onClick={() => router.push("/onboarding/provider/profile")}
          className="w-full rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
