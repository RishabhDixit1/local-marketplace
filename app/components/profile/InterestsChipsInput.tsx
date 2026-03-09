"use client";

import { Plus, Sparkles, X } from "lucide-react";

export default function InterestsChipsInput({
  label,
  description,
  placeholder,
  values,
  inputValue,
  error,
  disabled,
  onInputChange,
  onAdd,
  onRemove,
}: {
  label: string;
  description: string;
  placeholder: string;
  values: string[];
  inputValue: string;
  error?: string;
  disabled?: boolean;
  onInputChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-semibold text-slate-900">{label}</label>
        <p className="text-sm leading-6 text-slate-600">{description}</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={inputValue}
          disabled={disabled}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onAdd();
            }
          }}
          className={`min-h-12 flex-1 rounded-2xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 ${
            error ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100" : "border-slate-200"
          }`}
          placeholder={placeholder}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={onAdd}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Plus className="h-4 w-4" />
          Add tag
        </button>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="flex min-h-14 flex-wrap gap-2 rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-3">
        {values.length > 0 ? (
          values.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm"
            >
              <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
              {value}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onRemove(value)}
                className="rounded-full p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label={`Remove ${value}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))
        ) : (
          <p className="text-sm text-slate-500">No tags added yet.</p>
        )}
      </div>
    </div>
  );
}
