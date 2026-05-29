"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Loader2, Plus, Save, Trash2 } from "lucide-react";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Slot = {
  day_of_week: number;
  start_time: string;
  end_time: string;
};

export default function AvailabilityEditor() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const fetchSlots = useCallback(async () => {
    try {
      const res = await fetch("/api/provider/availability");
      const json = await res.json();
      if (json.ok) setSlots(json.slots);
    } catch {
      setMessage("Failed to load availability.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchSlots(); }, [fetchSlots]);

  const addSlot = (day: number) => {
    setSlots((prev) => [...prev, { day_of_week: day, start_time: "09:00", end_time: "17:00" }]);
  };

  const updateSlot = (index: number, field: keyof Slot, value: string | number) => {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeSlot = (index: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  };

  const saveSlots = async () => {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/provider/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slots),
      });
      const json = await res.json();
      if (json.ok) {
        setMessage("Availability saved!");
      } else {
        setMessage(json.message || "Failed to save.");
      }
    } catch {
      setMessage("Network error.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  const groupedSlots = DAY_LABELS.map((_, dayIdx) => ({
    day: dayIdx,
    label: DAY_LABELS[dayIdx],
    fullLabel: DAY_FULL[dayIdx],
    daySlots: slots.filter((s) => s.day_of_week === dayIdx),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">Weekly availability</h3>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveSlots()}
          className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      <div className="space-y-2">
        {groupedSlots.map(({ day, label, fullLabel, daySlots }) => (
          <div key={day} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-900">
                {fullLabel}
                {daySlots.length > 0 && (
                  <span className="ml-2 text-xs text-emerald-600">{daySlots.length} slot{daySlots.length > 1 ? "s" : ""}</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => addSlot(day)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {daySlots.map((slot, idx) => {
              const globalIdx = slots.findIndex(
                (s) => s === slot && s.day_of_week === day
              );
              // Find actual index in slots array
              const actualIdx = slots.findIndex(
                (s, i) => i >= slots.findIndex((x) => x.day_of_week === day) && s.day_of_week === day && s.start_time === slot.start_time && s.end_time === slot.end_time
              );

              return (
                <div key={`${day}-${idx}`} className="mt-2 flex items-center gap-2">
                  <input
                    type="time"
                    value={slot.start_time}
                    onChange={(e) => updateSlot(globalIdx >= 0 ? globalIdx : idx, "start_time", e.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-blue-400"
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <input
                    type="time"
                    value={slot.end_time}
                    onChange={(e) => updateSlot(globalIdx >= 0 ? globalIdx : idx, "end_time", e.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-blue-400"
                  />
                  <button
                    type="button"
                    onClick={() => removeSlot(globalIdx >= 0 ? globalIdx : idx)}
                    className="rounded-full p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}

            {daySlots.length === 0 && (
              <p className="mt-1 text-xs text-slate-400">No slots set. Click + to add one.</p>
            )}
          </div>
        ))}
      </div>

      {message && (
        <p className={`text-xs font-medium ${message === "Availability saved!" ? "text-emerald-600" : "text-rose-600"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
