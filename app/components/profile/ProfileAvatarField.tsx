"use client";

import { Camera, Loader2, Trash2, Upload } from "lucide-react";
import { useRef } from "react";

export default function ProfileAvatarField({
  name,
  avatarUrl,
  uploading,
  disabled,
  onUpload,
  onRemove,
}: {
  name: string;
  avatarUrl: string;
  uploading?: boolean;
  disabled?: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-[28px] border border-white bg-white text-3xl font-semibold uppercase text-slate-900 shadow-sm">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={name || "Profile avatar"} className="h-full w-full object-cover" />
          ) : (
            <span>{(name || "LM").slice(0, 2)}</span>
          )}
          <div className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-slate-950/65 to-transparent pb-2 pt-6 text-white">
            <Camera className="h-4 w-4" />
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900">Avatar</p>
          <p className="max-w-md text-sm leading-6 text-slate-600">
            Upload a clear photo or business mark. It appears across the marketplace and public business cards.
          </p>
          <p className="text-xs text-slate-500">PNG, JPG, GIF, or WebP up to 5MB.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUpload(file);
            event.currentTarget.value = "";
          }}
        />
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-indigo-300 hover:text-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? "Uploading..." : avatarUrl ? "Replace avatar" : "Upload avatar"}
        </button>
        {avatarUrl ? (
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={onRemove}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-rose-300 hover:text-rose-700 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            <Trash2 className="h-4 w-4" />
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}
