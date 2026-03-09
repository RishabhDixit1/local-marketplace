"use client";

import { Globe, Mail, Phone } from "lucide-react";

type ContactErrors = Partial<Record<"email" | "phone" | "website", string>>;

const fieldStyles = (hasError: boolean) =>
  `min-h-12 w-full rounded-2xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 ${
    hasError
      ? "border-rose-300 focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
      : "border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
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
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Mail className="h-4 w-4 text-slate-500" />
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
        <p className={`text-sm ${errors.email ? "text-rose-600" : "text-slate-500"}`}>
          {errors.email || (emailReadOnly ? "Synced from your login email." : "Used for confirmations and notifications.")}
        </p>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Phone className="h-4 w-4 text-slate-500" />
          Phone
        </label>
        <input
          type="tel"
          value={phone}
          disabled={disabled}
          onChange={(event) => onChange("phone", event.target.value)}
          placeholder="+1 555 123 4567"
          className={fieldStyles(Boolean(errors.phone))}
        />
        <p className={`text-sm ${errors.phone ? "text-rose-600" : "text-slate-500"}`}>
          {errors.phone || "Optional, but useful for urgent local coordination."}
        </p>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Globe className="h-4 w-4 text-slate-500" />
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
        <p className={`text-sm ${errors.website ? "text-rose-600" : "text-slate-500"}`}>
          {errors.website || "Add a portfolio or business site if you have one."}
        </p>
      </div>
    </div>
  );
}
