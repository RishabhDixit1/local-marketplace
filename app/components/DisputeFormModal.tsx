"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchAuthedJson } from "@/lib/clientApi";
import { AlertCircle, Gavel, Loader2, X } from "lucide-react";

type DisputeFormModalProps = {
  orderId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

const DISPUTE_REASONS = [
  { value: "service_not_provided", label: "Service not provided" },
  { value: "poor_quality", label: "Poor quality work" },
  { value: "late_delivery", label: "Late delivery" },
  { value: "wrong_item", label: "Wrong item/service" },
  { value: "pricing_issue", label: "Pricing / billing issue" },
  { value: "communication", label: "Communication breakdown" },
  { value: "other", label: "Other" },
];

export default function DisputeFormModal({ orderId, open, onClose, onSuccess }: DisputeFormModalProps) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = async () => {
    if (!reason) {
      setError("Please select a reason.");
      return;
    }
    if (!description.trim() || description.trim().length < 10) {
      setError("Please describe the issue in detail (at least 10 characters).");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetchAuthedJson<{ ok: boolean }>(supabase, "/api/disputes", {
        method: "POST",
        body: JSON.stringify({ orderId, reason, description: description.trim() }),
      });

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        setError("Failed to submit dispute. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setReason("");
      setDescription("");
      setError("");
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[var(--layer-modal)] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={handleClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-[1] flex max-h-[min(88vh,600px)] w-full max-w-lg flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_30px_80px_-35px_rgba(15,23,42,0.45)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-amber-100 p-2 text-amber-700">
              <Gavel className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Dispute</p>
              <h3 className="mt-0.5 text-xl font-semibold tracking-tight text-slate-950">File a dispute</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-900">Reason</label>
              <select
                value={reason}
                onChange={(e) => { setReason(e.target.value); setError(""); }}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
              >
                <option value="">Select a reason...</option>
                {DISPUTE_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-900">Description</label>
              <textarea
                value={description}
                onChange={(e) => { setDescription(e.target.value); setError(""); }}
                rows={5}
                placeholder="Describe what went wrong in detail..."
                className="min-h-[140px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
              />
              <p className="text-xs text-slate-400 text-right">{description.length} / 2000</p>
            </div>

            {error ? (
              <div className="flex items-start gap-2 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 px-6 py-5">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="inline-flex min-h-11 items-center rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting || !reason || description.trim().length < 10}
            onClick={() => void handleSubmit()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {submitting ? "Submitting..." : "Submit dispute"}
          </button>
        </div>
      </div>
    </div>
  );
}
