"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Loader2, Upload, X } from "lucide-react";
import { fetchProfileByUserId, saveCurrentUserProfile, uploadProfileAvatar } from "@/lib/profile/client";
import type { ProfileFormValues } from "@/lib/profile/types";
import { toProfileFormValues } from "@/lib/profile/utils";
import { supabase } from "@/lib/supabase";
import { setPublicProfileModalOpen } from "@/app/components/profile/publicProfileModalState";

type PublicProfileCoverEditProps = {
  profileUserId: string;
  displayName: string;
  coverImageUrl: string;
  initialValues: ProfileFormValues;
};

export default function PublicProfileCoverEdit({
  profileUserId,
  displayName,
  coverImageUrl,
  initialValues,
}: PublicProfileCoverEditProps) {
  const router = useRouter();
  const [isSelf, setIsSelf] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [viewerEmail, setViewerEmail] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const uploadButtonRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;

    const loadViewer = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser().catch(() => ({
        data: { user: null },
      }));

      if (!active) return;
      setViewerId(user?.id || null);
      setViewerEmail(user?.email || null);
      setIsSelf(Boolean(user?.id && user.id === profileUserId));
    };

    void loadViewer();

    return () => {
      active = false;
    };
  }, [profileUserId]);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(nextPreviewUrl);

    return () => {
      URL.revokeObjectURL(nextPreviewUrl);
    };
  }, [selectedFile]);

  useEffect(() => {
    if (!dialogOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setPublicProfileModalOpen(true);
    dialogRef.current?.focus();
    uploadButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      setPublicProfileModalOpen(false);
    };
  }, [dialogOpen]);

  if (!isSelf) return null;

  const resetDialogState = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setErrorMessage("");
  };

  const closeDialog = () => {
    if (uploading) return;
    resetDialogState();
    setDialogOpen(false);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setErrorMessage("Choose a cover image to continue.");
      return;
    }

    if (!viewerId) {
      setErrorMessage("You need to be signed in to update your cover image.");
      return;
    }

    setErrorMessage("");
    setUploading(true);

    try {
      const publicUrl = await uploadProfileAvatar({ userId: profileUserId, file: selectedFile });
      const latestProfile = await fetchProfileByUserId(viewerId, { id: viewerId, email: viewerEmail || "" }).catch(() => null);
      const baseValues = latestProfile ? toProfileFormValues(latestProfile) : initialValues;

      await saveCurrentUserProfile({
        user: { id: viewerId, email: viewerEmail || "" },
        values: {
          ...baseValues,
          backgroundImageUrl: publicUrl,
          email: viewerEmail || baseValues.email,
        },
      });

      resetDialogState();
      setDialogOpen(false);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update cover image right now.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className="public-profile-header-action absolute left-3 top-3 z-20 inline-flex h-7 max-w-[calc(50%-1rem)] items-center gap-1 rounded-full border border-white/20 bg-white/12 px-2.5 text-[10px] font-semibold text-white shadow-[0_12px_30px_-20px_rgba(15,23,42,0.45)] backdrop-blur-md transition hover:bg-white/20 sm:left-5 sm:top-4 sm:h-9 sm:max-w-none sm:gap-1.5 sm:px-3.5 sm:text-xs"
      >
        <ImageUp className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
        <span className="truncate">Edit cover</span>
      </button>

      {!dialogOpen ? null : (
        <div className="fixed inset-0 z-[4000] grid place-items-center bg-slate-950/24 px-4 py-6 backdrop-blur-xl sm:px-6 sm:py-8">
          <div className="absolute inset-0" onClick={closeDialog} />

          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Update cover image"
            tabIndex={-1}
            className="relative z-10 flex w-full max-w-4xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_35px_120px_-45px_rgba(15,23,42,0.55)] sm:max-h-[calc(100vh-3rem)]"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 sm:px-8">
              <div>
                <h2 className="text-[1.7rem] font-semibold tracking-tight text-slate-950 sm:text-[1.95rem]">Update cover image</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
                  Refresh the background shown on {displayName}&apos;s profile header.
                </p>
              </div>

              <button
                type="button"
                onClick={closeDialog}
                disabled={uploading}
                className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200 hover:text-slate-900 disabled:opacity-50 sm:h-14 sm:w-14"
                aria-label="Close cover dialog"
              >
                <X className="h-6 w-6 sm:h-7 sm:w-7" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8 sm:px-8">
              <div className="mx-auto max-w-3xl">
                <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50/70 p-5 sm:p-6">
                  <div className="overflow-hidden rounded-[1.4rem] border border-slate-200 bg-slate-950">
                    {previewUrl || coverImageUrl ? (
                      <img src={previewUrl || coverImageUrl} alt={`${displayName} cover`} className="h-56 w-full object-cover sm:h-72" />
                    ) : (
                      <div className="flex h-56 w-full items-center justify-center bg-[linear-gradient(125deg,#eff6ff_0%,#dbeafe_24%,#c7d2fe_58%,#e0e7ff_100%)] sm:h-72">
                        <span className="rounded-full border border-slate-300 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-700">
                          No cover image yet
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-base font-semibold text-slate-950 sm:text-lg">{displayName}</p>
                      <p className="text-sm leading-6 text-slate-500">PNG, JPG, WEBP, or GIF up to 5MB.</p>
                    </div>

                    <button
                      ref={uploadButtonRef}
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      disabled={uploading}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-slate-400 bg-white px-5 py-2.5 text-base font-semibold text-slate-700 transition hover:border-slate-500 hover:text-slate-900 disabled:opacity-60"
                    >
                      <Upload className="h-4.5 w-4.5" />
                      Choose cover image
                    </button>
                  </div>

                  {errorMessage ? <p className="mt-4 text-sm text-rose-600">{errorMessage}</p> : null}

                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) {
                        setErrorMessage("Cover image must be 5MB or smaller.");
                        return;
                      }
                      setErrorMessage("");
                      setSelectedFile(file);
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 px-6 py-5 sm:px-8">
              <button
                type="button"
                onClick={closeDialog}
                disabled={uploading}
                className="inline-flex min-h-11 items-center rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleUpload()}
                disabled={uploading}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}
                {uploading ? "Saving..." : "Save cover"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
