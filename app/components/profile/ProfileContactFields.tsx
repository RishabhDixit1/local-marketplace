"use client";

import { Globe, Mail, Phone } from "lucide-react";

type ContactErrors = Partial<Record<"email" | "phone" | "website", string>>;

const fieldStyles = (hasError: boolean) =>
  `min-h-12 w-full rounded-2xl border bg-[var(--surface-elevated)] px-4 py-3 text-sm text-[var(--ink-950)] outline-none transition placeholder:text-[var(--ink-500)] ${
    hasError
      ? "border-rose-300 focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
      : "border-[var(--surface-border)] focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
  }`;

export default function ProfileContactFields({
  email,
  phone,
  website,
  emailReadOnly,
  disabled,
  errors,
  onChange,
}: {
  email: string;
  phone: string;
  website: string;
  emailReadOnly?: boolean;
  disabled?: boolean;
  errors: ContactErrors;
  onChange: (field: "email" | "phone" | "website", value: string) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-[var(--ink-950)]">
          <Mail className="h-4 w-4 text-[var(--ink-500)]" />
          Email
        </label>
        <input
          type="email"
          value={email}
          disabled={disabled || emailReadOnly}
          readOnly={emailReadOnly}
          onChange={(event) => onChange("email", event.target.value)}
          placeholder="you@example.com"
          className={fieldStyles(Boolean(errors.email))}
        />
        <p className={`text-sm ${errors.email ? "text-rose-600" : "text-[var(--ink-500)]"}`}>
          {errors.email || (emailReadOnly ? "Synced from your login email." : "Used for confirmations and notifications.")}
        </p>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-[var(--ink-950)]">
          <Phone className="h-4 w-4 text-[var(--ink-500)]" />
          Mobile number
        </label>
        <input
          type="tel"
          value={phone}
          disabled={disabled}
          inputMode="numeric"
          maxLength={10}
          onChange={(event) => onChange("phone", event.target.value.replace(/\D/g, "").slice(0, 10))}
          placeholder="9876543210"
          className={fieldStyles(Boolean(errors.phone))}
        />
        <p className={`text-sm ${errors.phone ? "text-rose-600" : "text-[var(--ink-500)]"}`}>
          {errors.phone || "Use a 10-digit mobile number."}
        </p>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-[var(--ink-950)]">
          <Globe className="h-4 w-4 text-[var(--ink-500)]" />
          Website
        </label>
        <input
          type="url"
          value={website}
          disabled={disabled}
          onChange={(event) => onChange("website", event.target.value)}
          placeholder="yourwebsite.com"
          className={fieldStyles(Boolean(errors.website))}
        />
        <p className={`text-sm ${errors.website ? "text-rose-600" : "text-[var(--ink-500)]"}`}>
          {errors.website || "Add a portfolio or business site if you have one."}
        </p>
      </div>
    </div>
  );
}
