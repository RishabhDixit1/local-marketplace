"use client";

import { useEffect, useMemo, useState } from "react";
import { Globe, Mail, MapPin, Phone, X } from "lucide-react";
import { setPublicProfileModalOpen } from "@/app/components/profile/publicProfileModalState";

type PublicContactInfoTriggerProps = {
  displayName: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  location: string | null;
};

const getWebsiteHref = (value: string | null) => {
  if (!value) return null;

  try {
    const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(normalized).toString();
  } catch {
    return null;
  }
};

export default function PublicContactInfoTrigger({
  displayName,
  email,
  phone,
  website,
  location,
}: PublicContactInfoTriggerProps) {
  const [open, setOpen] = useState(false);

  const websiteHref = useMemo(() => getWebsiteHref(website), [website]);

  useEffect(() => {
    if (!open) return;

    setPublicProfileModalOpen(true);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      setPublicProfileModalOpen(false);
    };
  }, [open]);

  const contactRows = [
    {
      label: "Email",
      value: email || "Not shared publicly",
      href: email ? `mailto:${email}` : null,
      icon: <Mail className="h-4 w-4" />,
    },
    {
      label: "Phone",
      value: phone || "Not shared publicly",
      href: phone ? `tel:${phone}` : null,
      icon: <Phone className="h-4 w-4" />,
    },
    {
      label: "Website",
      value: websiteHref || "Not shared publicly",
      href: websiteHref,
      icon: <Globe className="h-4 w-4" />,
    },
    {
      label: "Location",
      value: location || "Not shared publicly",
      href: null,
      icon: <MapPin className="h-4 w-4" />,
    },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-semibold text-[#0a66c2] transition hover:text-[#004182] hover:underline"
      >
        Contact info
      </button>

      {!open ? null : (
        <div className="fixed inset-0 z-[4000] grid place-items-center bg-slate-950/96 px-4 py-8 backdrop-blur-md">
          <div className="absolute inset-0" onClick={() => setOpen(false)} />

          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${displayName} contact information`}
            className="relative z-10 w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.55)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Contact info</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{displayName}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">Public contact details shared on this profile.</p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close contact info"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 space-y-3">
              {contactRows.map((row) => {
                const content = (
                  <div className="flex items-start gap-3 rounded-[18px] border border-slate-200 bg-[#f8fafc] px-4 py-3">
                    <div className="mt-0.5 text-slate-500">{row.icon}</div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{row.label}</p>
                      <p className="mt-1 break-all text-sm leading-6 text-slate-700">{row.value}</p>
                    </div>
                  </div>
                );

                if (!row.href) {
                  return <div key={row.label}>{content}</div>;
                }

                return (
                  <a key={row.label} href={row.href} target={row.label === "Website" ? "_blank" : undefined} rel="noreferrer" className="block">
                    {content}
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
