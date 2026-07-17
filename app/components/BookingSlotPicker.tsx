"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchAuthedJson } from "@/lib/clientApi";

type Props = {
  orderId: string;
  providerId: string;
  onBooked: () => void;
};

type Slot = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

export default function BookingSlotPicker({ orderId, providerId, onBooked }: Props) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedStart, setSelectedStart] = useState("");
  const [selectedEnd, setSelectedEnd] = useState("");
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);
  const [error, setError] = useState("");

  const fetchSlots = useCallback(async () => {
    try {
      const json = await fetchAuthedJson<{ ok: boolean; slots?: Slot[] }>(supabase, `/api/provider/availability?provider_id=${providerId}`);
      if (json.ok) setSlots(json.slots ?? []);
    } catch {
      setError("Failed to load availability.");
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => { void fetchSlots(); }, [fetchSlots]);

  // Generate next 14 days as available dates
  const today = new Date();
  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return d;
  });

  const availableSlotsForDate = (date: Date): { start: string; end: string }[] => {
    const dayOfWeek = date.getDay();
    return slots
      .filter((s) => s.day_of_week === dayOfWeek)
      .map((s) => ({ start: s.start_time.slice(0, 5), end: s.end_time.slice(0, 5) }));
  };

  const handleBook = async () => {
    if (!selectedDate || !selectedStart || !selectedEnd) return;
    setBooking(true);
    setError("");
    try {
      const json = await fetchAuthedJson<{ ok: boolean; message?: string }>(supabase, `/api/orders/${orderId}/book-slot`, {
        method: "POST",
        body: JSON.stringify({
          scheduled_date: selectedDate,
          start_time: selectedStart,
          end_time: selectedEnd,
        }),
      });
      if (json.ok) {
        setBooked(true);
        onBooked();
      } else {
        setError(json.message || "Failed to book.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setBooking(false);
    }
  };

  if (booked) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Appointment booked! Check the order for details.
      </div>
    );
  }

  if (loading) {
    return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-[var(--ink-500)]" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-[var(--ink-500)]" />
        <h3 className="text-sm font-semibold text-[var(--ink-950)]">Book a time slot</h3>
      </div>

      {slots.length === 0 ? (
        <p className="text-sm text-[var(--ink-500)]">Provider hasn&apos;t set their availability yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-7">
            {dates.map((date) => {
              const dateStr = date.toISOString().split("T")[0];
              const daySlots = availableSlotsForDate(date);
              const isSelected = selectedDate === dateStr;
              const isPast = date < new Date(today.getTime() - 86400000);
              const hasSlots = daySlots.length > 0;

              return (
                <button
                  key={dateStr}
                  type="button"
                  disabled={isPast || !hasSlots}
                  onClick={() => {
                    setSelectedDate(dateStr);
                    if (daySlots.length > 0) {
                      setSelectedStart(daySlots[0].start);
                      setSelectedEnd(daySlots[0].end);
                    }
                  }}
                  className={`rounded-xl border p-2 text-center text-xs transition ${
                    isSelected
                      ? "border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                      : isPast || !hasSlots
                      ? "border-slate-100 dark:border-[var(--surface-border)] text-[var(--ink-500)] cursor-not-allowed"
                      : "border-[var(--surface-border)] text-[var(--ink-700)] hover:border-blue-200 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                  }`}
                >
                  <p className="font-semibold">{date.toLocaleDateString("en-IN", { weekday: "short" })}</p>
                  <p className="text-lg font-bold">{date.getDate()}</p>
                  {hasSlots && <p className="text-[10px] text-[var(--ink-500)]">{daySlots.length} slot{daySlots.length > 1 ? "s" : ""}</p>}
                </button>
              );
            })}
          </div>

          {selectedDate && (
            <div className="rounded-2xl border border-blue-100 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-950/30 p-4">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                {new Date(selectedDate).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {availableSlotsForDate(new Date(selectedDate)).map((slot) => (
                  <button
                    key={`${slot.start}-${slot.end}`}
                    type="button"
                    onClick={() => {
                      setSelectedStart(slot.start);
                      setSelectedEnd(slot.end);
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      selectedStart === slot.start && selectedEnd === slot.end
                        ? "border-blue-400 dark:border-blue-500 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200"
                        : "border-[var(--surface-border)] bg-[var(--surface-elevated)] text-[var(--ink-700)] hover:border-blue-200 dark:hover:border-blue-700"
                    }`}
                  >
                    <Clock className="h-3 w-3" />
                    {slot.start} - {slot.end}
                  </button>
                ))}
              </div>

              {selectedStart && selectedEnd && (
                <button
                  type="button"
                  disabled={booking}
                  onClick={() => void handleBook()}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {booking ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                  {booking ? "Booking..." : `Book ${selectedStart} - ${selectedEnd}`}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
