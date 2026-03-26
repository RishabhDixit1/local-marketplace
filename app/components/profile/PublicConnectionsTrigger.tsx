"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { deriveConnectionState, listCurrentUserConnectionRows, type ConnectionRequestRow } from "@/lib/connections";
import type { PublicProfileConnection } from "@/lib/profile/public";
import { supabase } from "@/lib/supabase";
import { setPublicProfileModalOpen } from "@/app/components/profile/publicProfileModalState";

type PublicConnectionsTriggerProps = {
  profileUserId: string;
  label: string;
  connections: PublicProfileConnection[];
  className?: string;
};

export default function PublicConnectionsTrigger({
  profileUserId,
  label,
  connections,
  className,
}: PublicConnectionsTriggerProps) {
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [connectionRows, setConnectionRows] = useState<ConnectionRequestRow[]>([]);
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;

      if (user?.id) {
        setViewerId(user.id);
        const rows = await listCurrentUserConnectionRows(user.id).catch(() => []);
        if (active) {
          setConnectionRows(rows);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [profileUserId]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setPublicProfileModalOpen(true);
    dialogRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      setPublicProfileModalOpen(false);
    };
  }, [open]);

  const canViewConnections = useMemo(() => {
    if (!viewerId) return false;
    if (viewerId === profileUserId) return true;
    return deriveConnectionState(viewerId, profileUserId, connectionRows).kind === "accepted";
  }, [connectionRows, profileUserId, viewerId]);

  const closeDialog = () => setOpen(false);
  const triggerClassName = className || "mt-2 text-sm font-semibold text-slate-700 transition hover:text-[#0a66c2] sm:mt-3 sm:text-base";

  if (!canViewConnections) {
    return <p className={triggerClassName}>{label}</p>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={triggerClassName}
      >
        {label}
      </button>

      {!open ? null : (
        <div className="fixed inset-0 z-[4000] grid place-items-center bg-slate-950/42 px-4 py-6 backdrop-blur-xl">
          <div className="absolute inset-0" onClick={closeDialog} />

          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Connections"
            tabIndex={-1}
            className="relative z-10 flex w-full max-w-2xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_80px_-40px_rgba(15,23,42,0.55)]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Connections</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  {connections.length} connection{connections.length === 1 ? "" : "s"}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeDialog}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close connections"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {connections.length > 0 ? (
                <div className="space-y-3">
                  {connections.map((connection) => (
                    <Link
                      key={connection.id}
                      href={connection.publicPath}
                      onClick={closeDialog}
                      className="flex items-center gap-4 rounded-[22px] border border-slate-200 bg-white px-4 py-3 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-700">
                        {connection.avatarUrl ? (
                          <img src={connection.avatarUrl} alt={connection.displayName} className="h-full w-full object-cover" />
                        ) : (
                          connection.displayName
                            .split(" ")
                            .map((part) => part[0] || "")
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-slate-950">{connection.displayName}</p>
                        <p className="truncate text-sm text-slate-500">{connection.location || "Location not added"}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  No connections to show yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
