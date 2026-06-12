"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarCheck, CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";

type Booking = {
  id: string;
  order_id: string;
  provider_id: string;
  consumer_id: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  order_title: string | null;
  order_status: string | null;
  consumer_name: string;
  consumer_avatar: string | null;
  provider_name: string;
  provider_avatar: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: "border-blue-200 bg-blue-50 text-blue-700",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-rose-200 bg-rose-50 text-rose-600",
  rescheduled: "border-amber-200 bg-amber-50 text-amber-700",
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchBookings = useCallback(async () => {
    try {
      const res = await fetch("/api/provider/bookings");
      const json = await res.json();
      if (json.ok) setBookings(json.bookings);
      else setError(json.message || "Failed to load bookings.");
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchBookings(); }, [fetchBookings]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const now = new Date();
  const upcoming = bookings.filter(
    (b) => b.status === "confirmed" && new Date(`${b.scheduled_date}T${b.start_time}`) >= now
  );
  const past = bookings.filter(
    (b) => b.status !== "confirmed" || new Date(`${b.scheduled_date}T${b.start_time}`) < now
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-slate-100 p-2.5">
          <CalendarCheck className="h-5 w-5 text-slate-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Bookings</h1>
          <p className="mt-1 text-sm text-slate-500">
            View and manage your scheduled appointments.
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>
      )}

      {bookings.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <CalendarCheck className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-600">No bookings yet</p>
          <p className="mt-1 text-xs text-slate-400">
            When someone books your time, it will show up here.
          </p>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Upcoming</h2>
              <div className="space-y-3">
                {upcoming.map((b) => (
                  <BookingCard key={b.id} booking={b} />
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Past</h2>
              <div className="space-y-3">
                {past.map((b) => (
                  <BookingCard key={b.id} booking={b} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function BookingCard({ booking }: { booking: Booking }) {
  const date = new Date(booking.scheduled_date);
  const dayName = date.toLocaleDateString("en-IN", { weekday: "short" });
  const monthDay = date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  const statusIcon = {
    confirmed: <Clock className="h-3.5 w-3.5" />,
    completed: <CheckCircle2 className="h-3.5 w-3.5" />,
    cancelled: <XCircle className="h-3.5 w-3.5" />,
    rescheduled: <Clock className="h-3.5 w-3.5" />,
  }[booking.status] ?? <Clock className="h-3.5 w-3.5" />;

  return (
    <Link
      href={`/orders/${booking.order_id}`}
      className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm sm:p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-slate-900">
              {booking.order_title || `Order #${booking.order_id.slice(0, 8)}`}
            </h3>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${
                STATUS_COLORS[booking.status] ?? "border-slate-200 bg-slate-50 text-slate-600"
              }`}
            >
              {statusIcon}
              {booking.status}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            with <span className="font-medium text-slate-700">{booking.consumer_name}</span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold text-slate-900">{dayName}</p>
          <p className="text-xs text-slate-500">{monthDay}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
        </span>
      </div>
      {booking.notes && (
        <p className="mt-2 text-xs text-slate-400 italic">{booking.notes}</p>
      )}
    </Link>
  );
}
