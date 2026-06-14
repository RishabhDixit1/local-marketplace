"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Flag, MoreVertical, ShieldOff } from "lucide-react";
import { supabase } from "@/lib/supabase";

type ProfileMoreMenuProps = {
  profileUserId: string;
  displayName: string;
};

type DialogState = "idle" | "report" | "block_confirm" | "unblock_confirm";

export default function ProfileMoreMenu({ profileUserId, displayName }: ProfileMoreMenuProps) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogState>("idle");
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const reportReasonRef = useRef<HTMLSelectElement | null>(null);
  const reportDescRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const res = await fetch(`/api/block?userId=${profileUserId}`);
      const json = await res.json();
      if (json.ok) setBlocked(json.blocked);
    };
    void check();
  }, [open, profileUserId]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleBlock = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockedId: profileUserId }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message ?? "Failed to block user");
      setBlocked(true);
      setDialog("idle");
      setSuccess(`${displayName} has been blocked.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }, [profileUserId, displayName]);

  const handleUnblock = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/block?blockedId=${encodeURIComponent(profileUserId)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message ?? "Failed to unblock user");
      setBlocked(false);
      setDialog("idle");
      setSuccess(`${displayName} has been unblocked.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }, [profileUserId, displayName]);

  const handleReport = useCallback(async () => {
    const reason = reportReasonRef.current?.value;
    const description = reportDescRef.current?.value.trim() || undefined;
    if (!reason) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "provider",
          targetId: profileUserId,
          reason,
          description,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message ?? "Failed to submit report");
      setDialog("idle");
      setSuccess("Report submitted. Our team will review it.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }, [profileUserId]);

  const handleMenuClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen((prev) => !prev);
  }, []);

  const [viewerId, setViewerId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setViewerId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!success) return;
    const id = setTimeout(() => setSuccess(null), 3000);
    return () => clearTimeout(id);
  }, [success]);

  if (!viewerId || viewerId === profileUserId) return null;

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        onClick={handleMenuClick}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        aria-label="More actions"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-2xl">
          <button
            type="button"
            onClick={() => { setOpen(false); setDialog("report"); }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <Flag className="h-4 w-4 text-slate-400" />
            Report
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); setDialog(blocked ? "unblock_confirm" : "block_confirm"); }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <ShieldOff className="h-4 w-4 text-slate-400" />
            {blocked ? "Unblock" : "Block"}
          </button>
        </div>
      )}

      {dialog === "report" && (
        <div className="fixed inset-0 z-[var(--layer-modal)] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setDialog("idle")} />
          <div className="relative z-[1] w-full max-w-md rounded-[28px] bg-white p-6 shadow-[0_30px_80px_-35px_rgba(15,23,42,0.45)]">
            <h3 className="text-xl font-semibold text-slate-900">Report {displayName}</h3>
            <p className="mt-1 text-sm text-slate-500">Why are you reporting this user?</p>

            <div className="mt-4 space-y-3">
              <select
                ref={reportReasonRef}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
              >
                <option value="">Select a reason…</option>
                <option value="spam">Spam or suspicious</option>
                <option value="inappropriate">Inappropriate content</option>
                <option value="harassment">Harassment or bullying</option>
                <option value="fake">Fake profile or identity</option>
                <option value="scam">Scam or fraud</option>
                <option value="other">Other</option>
              </select>

              <textarea
                ref={reportDescRef}
                rows={3}
                placeholder="Additional details (optional)"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
              />
            </div>

            {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDialog("idle")}
                disabled={busy}
                className="inline-flex min-h-10 items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleReport}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {busy ? "Submitting..." : "Submit report"}
              </button>
            </div>
          </div>
        </div>
      )}

      {(dialog === "block_confirm" || dialog === "unblock_confirm") && (
        <div className="fixed inset-0 z-[var(--layer-modal)] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setDialog("idle")} />
          <div className="relative z-[1] w-full max-w-sm rounded-[28px] bg-white p-6 shadow-[0_30px_80px_-35px_rgba(15,23,42,0.45)]">
            <ShieldOff className="mx-auto h-10 w-10 text-slate-400" />
            <h3 className="mt-3 text-center text-xl font-semibold text-slate-900">
              {dialog === "block_confirm" ? `Block ${displayName}?` : `Unblock ${displayName}?`}
            </h3>
            <p className="mt-1 text-center text-sm text-slate-500">
              {dialog === "block_confirm"
                ? "They won't be able to message you or interact with your content."
                : "They will be able to message you and interact with your content again."}
            </p>

            {error && <p className="mt-3 text-center text-sm text-rose-600">{error}</p>}

            <div className="mt-5 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setDialog("idle")}
                disabled={busy}
                className="inline-flex min-h-10 items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={dialog === "block_confirm" ? handleBlock : handleUnblock}
                className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-slate-300 ${
                  dialog === "block_confirm" ? "bg-rose-600 hover:bg-rose-700" : "bg-slate-900 hover:bg-slate-800"
                }`}
              >
                {dialog === "block_confirm" ? "Block" : "Unblock"}
              </button>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="fixed inset-0 z-[var(--layer-toast)] flex items-start justify-center pt-12 px-4 pointer-events-none">
          <div className="pointer-events-auto rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-2xl">
            {success}
          </div>
        </div>
      )}
    </div>
  );
}
