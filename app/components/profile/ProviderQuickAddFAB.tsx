"use client";

import { useEffect, useState } from "react";
import { Plus, Package, Briefcase, ClipboardList, BadgePlus } from "lucide-react";
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
        aria-label="Quick add service or product"
        aria-expanded={open}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-900)] text-white shadow-lg transition hover:bg-[var(--brand-700)] hover:shadow-xl md:bottom-8 md:right-8"
      >
        <Plus className="h-6 w-6" />
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
          <div className="fixed bottom-24 right-6 z-40 flex flex-col gap-2 md:bottom-28 md:right-8">
            <Link
              href="/dashboard/provider/add-service"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-md transition hover:bg-slate-50"
            >
              <Briefcase className="h-4 w-4" />
              Offer Service
            </Link>
            <Link
              href="/dashboard/provider/add-product"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-md transition hover:bg-slate-50"
            >
              <Package className="h-4 w-4" />
              List Product
            </Link>
            <Link
              href="/dashboard/create_post?intent=requirement"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-md transition hover:bg-slate-50"
            >
              <ClipboardList className="h-4 w-4" />
              Post a Need
            </Link>
            <Link
              href="/dashboard/provider"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-md transition hover:bg-slate-50"
            >
              <BadgePlus className="h-4 w-4" />
              Manage Store
            </Link>
          </div>
        </>
      )}
    </>
  );
}
