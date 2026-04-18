"use client";

import { useEffect, useState } from "react";
import { Plus, ClipboardList, Sparkles } from "lucide-react";
import Link from "next/link";

type ProviderQuickAddFABProps = {
  show?: boolean;
};

export function ProviderQuickAddFAB({ show = false }: ProviderQuickAddFABProps) {
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const syncModalState = () => {
      const nextModalOpen = document.body.getAttribute("data-public-profile-modal-open") === "true";
      setModalOpen(nextModalOpen);
      if (nextModalOpen) {
        setOpen(false);
      }
    };

    syncModalState();

    const observer = new MutationObserver(syncModalState);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-public-profile-modal-open"],
    });

    return () => observer.disconnect();
  }, []);

  if (!show || modalOpen) return null;

  return (
    <>
      {/* Floating Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Open quick actions"
        aria-expanded={open}
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-3 z-40 flex h-12 w-12 items-center justify-center rounded-[1.35rem] bg-[var(--brand-900)] text-white shadow-lg transition hover:bg-[var(--brand-700)] hover:shadow-xl md:bottom-8 md:right-8 md:h-14 md:w-14 md:rounded-full"
      >
        <Plus className="h-5 w-5 md:h-6 md:w-6" />
      </button>

      {/* Menu */}
      {open && (
        <>
          {/* Backdrop */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-hidden
            className="fixed inset-0 z-30"
          />

          {/* PopoverMenu */}
          <div className="fixed bottom-[calc(6.2rem+env(safe-area-inset-bottom))] right-3 z-40 flex flex-col gap-2 md:bottom-28 md:right-8">
            <Link
              href="/dashboard?compose=1"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-md transition hover:bg-slate-50"
            >
              <ClipboardList className="h-4 w-4" />
              Post a Need
            </Link>
            <Link
              href="/dashboard/launchpad"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-md transition hover:bg-slate-50"
            >
              <Sparkles className="h-4 w-4" />
              Business AI
            </Link>
          </div>
        </>
      )}
    </>
  );
}
