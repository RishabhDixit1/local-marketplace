/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, SquarePen, Upload, X } from "lucide-react";
import { fetchProfileByUserId, saveCurrentUserProfile, uploadProfileAvatar } from "@/lib/profile/client";
import type { ProfileFormValues } from "@/lib/profile/types";
import { toProfileFormValues } from "@/lib/profile/utils";
import { supabase } from "@/lib/supabase";
import { setPublicProfileModalOpen } from "@/app/components/profile/publicProfileModalState";

type PublicProfileAvatarEditProps = {
  profileUserId: string;
  displayName: string;
  avatarUrl: string;
  initialValues: ProfileFormValues;
  triggerMode?: "icon" | "image";
};

export default function PublicProfileAvatarEdit({
  profileUserId,
  displayName,
  avatarUrl,
  initialValues,
  triggerMode = "icon",
}: PublicProfileAvatarEditProps) {
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

  const handleFileSelect = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Avatar must be 5MB or smaller.");
      return;
    }

    setErrorMessage("");
    setSelectedFile(file);
  };

  const closeDialog = () => {
    if (uploading) return;
    resetDialogState();
    setDialogOpen(false);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setErrorMessage("Choose a photo to continue.");
      return;
    }

    setErrorMessage("");
    setUploading(true);

    try {
      if (!viewerId) {
        throw new Error("You need to be signed in to update your profile picture.");
      }

      const publicUrl = await uploadProfileAvatar({ userId: profileUserId, file: selectedFile });
      const latestProfile = await fetchProfileByUserId(viewerId, { id: viewerId, email: viewerEmail || "" }).catch(() => null);
      const baseValues = latestProfile ? toProfileFormValues(latestProfile) : initialValues;
      await saveCurrentUserProfile({
        user: { id: viewerId, email: viewerEmail || "" },
        values: {
          ...baseValues,
          avatarUrl: publicUrl,
          email: viewerEmail || baseValues.email,
        },
      });
      resetDialogState();
      setDialogOpen(false);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to upload avatar right now.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      {triggerMode === "image" ? (
        <div className={`public-profile-avatar-trigger group absolute inset-0 z-10 rounded-full transition ${dialogOpen ? "pointer-events-none opacity-0" : "opacity-100"}`}>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="absolute inset-0 rounded-full"
            aria-label="Update profile picture"
            title="Update profile picture"
          />
          <div className="pointer-events-none absolute inset-0 rounded-full bg-slate-950/0 transition duration-200 group-hover:bg-slate-950/28">
            <div className="flex h-full items-center justify-center opacity-0 transition duration-200 group-hover:opacity-100">
              <span className="rounded-full border border-white/25 bg-slate-950/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white backdrop-blur">
                Edit
              </span>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className={`public-profile-avatar-trigger absolute bottom-1.5 right-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-white shadow-[0_16px_28px_-18px_rgba(15,23,42,0.6)] transition hover:bg-slate-800 ${dialogOpen ? "pointer-events-none opacity-0" : "opacity-100"}`}
          aria-label="Update profile picture"
          title="Update profile picture"
        >
          <SquarePen className="h-3.5 w-3.5" />
        </button>
      )}

      {!dialogOpen ? null : (
        <div className="fixed inset-0 z-[4000] grid place-items-center bg-slate-950/24 px-4 py-6 backdrop-blur-xl sm:px-6 sm:py-8">
          <div className="absolute inset-0" onClick={closeDialog} />

          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Update profile picture"
            tabIndex={-1}
            className="relative z-10 flex w-full max-w-3xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_35px_120px_-45px_rgba(15,23,42,0.55)] sm:max-h-[calc(100vh-3rem)]"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 sm:px-8">
              <div>
                <h2 className="text-[1.9rem] font-semibold tracking-tight text-slate-950 sm:text-[2.1rem]">Add a profile photo</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
                  Update the image shown on your public profile.
                </p>
              </div>

              <button
                type="button"
                onClick={closeDialog}
                disabled={uploading}
                className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200 hover:text-slate-900 disabled:opacity-50 sm:h-14 sm:w-14"
                aria-label="Close picture dialog"
              >
                <X className="h-6 w-6 sm:h-7 sm:w-7" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8 sm:px-8">
              <div className="mx-auto max-w-2xl">
                <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50/70 p-5 sm:p-6">
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-5">
                      <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-[5px] border-white bg-slate-950 text-2xl font-semibold text-white shadow-[0_18px_36px_-22px_rgba(15,23,42,0.42)] sm:h-28 sm:w-28">
                        {previewUrl || avatarUrl ? (
                          <img src={previewUrl || avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                        ) : (
                          <span>{displayName.slice(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="space-y-2">
                        <p className="text-base font-semibold text-slate-950 sm:text-lg">{displayName}</p>
                        <p className="text-sm leading-6 text-slate-500">
                          PNG, JPG, WEBP, or GIF up to 5MB.
                        </p>
                      </div>
                    </div>

                    <button
                      ref={uploadButtonRef}
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      disabled={uploading}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-slate-400 bg-white px-5 py-2.5 text-base font-semibold text-slate-700 transition hover:border-slate-500 hover:text-slate-900 disabled:opacity-60"
                    >
                      <Upload className="h-4.5 w-4.5" />
                      Upload photo
                    </button>
                  </div>
                </div>

                <input
                  ref={inputRef}
                  type="file"
                  className="hidden"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      handleFileSelect(file);
                    }
                    event.currentTarget.value = "";
                  }}
                />
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-between gap-4 border-t border-slate-200 px-6 py-5 sm:px-8">
              <div className="min-h-6 text-sm text-rose-600">{errorMessage || ""}</div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={closeDialog}
                  disabled={uploading}
                  className="inline-flex min-h-12 items-center rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleUpload()}
                  disabled={uploading || !selectedFile}
                  className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#0a66c2] px-7 py-3 text-base font-semibold text-white transition hover:bg-[#004182] disabled:opacity-60"
                >
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                  {uploading ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
