"use client";

import { useRef, useState } from "react";
import { ImageIcon, Loader2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getAccessToken } from "@/lib/clientApi";
import { compressImageFile } from "@/lib/clientImageCompression";
import { LISTING_IMAGE_MAX_BYTES, formatUploadLimit } from "@/lib/mediaLimits";

type Props = {
  value: string;
  onChange: (url: string) => void;
  className?: string;
};

export default function ImageUploadField({ value, onChange, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const prepared = (await compressImageFile(file, { maxBytes: LISTING_IMAGE_MAX_BYTES })).file;
      if (prepared.size > LISTING_IMAGE_MAX_BYTES) {
        throw new Error(`Photo must be ${formatUploadLimit(LISTING_IMAGE_MAX_BYTES)} or smaller after compression.`);
      }
      const token = await getAccessToken(supabase);
      const form = new FormData();
      form.append("file", prepared);
      const res = await fetch("/api/upload/listing-image", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const json = (await res.json()) as { ok: boolean; url?: string; message?: string };
      if (!json.ok || !json.url) throw new Error(json.message ?? "Upload failed.");
      onChange(json.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={className}>
      {value ? (
        <div className="relative w-full aspect-video overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Listing preview" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/70 text-white hover:bg-slate-900 transition"
            aria-label="Remove image"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-8 text-sm text-slate-500 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-60"
        >
          {uploading ? (
            <><Loader2 className="h-5 w-5 animate-spin" /> Uploading…</>
          ) : (
            <><ImageIcon className="h-5 w-5" /> Click to upload photo (max {formatUploadLimit(LISTING_IMAGE_MAX_BYTES)})</>
          )}
        </button>
      )}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";          // Reset so same file can be re-selected
        }}
      />
    </div>
  );
}
