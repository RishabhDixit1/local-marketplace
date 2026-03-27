"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPin, MessageCircle, SquarePen, UserCheck, UserPlus, X, XCircle } from "lucide-react";
import ProfileContactFields from "@/app/components/profile/ProfileContactFields";
import {
  deriveConnectionState,
  listCurrentUserConnectionRows,
  respondToConnectionRequest,
  sendConnectionRequest,
  type ConnectionRequestRow,
} from "@/lib/connections";
import { saveCurrentUserProfile } from "@/lib/profile/client";
import { buildPublicProfilePath, normalizeTopics } from "@/lib/profile/utils";
import { validateProfileValues } from "@/lib/profile/validation";
import type { ProfileFormValues, ProfileValidationErrors } from "@/lib/profile/types";
import { getOrCreateDirectConversationId } from "@/lib/directMessages";
import { supabase } from "@/lib/supabase";
import { setPublicProfileModalOpen } from "@/app/components/profile/publicProfileModalState";

type PublicProfileActionsProps = {
  profileUserId: string;
  displayName: string;
  initialValues: ProfileFormValues;
};

export default function PublicProfileActions({ profileUserId, displayName, initialValues }: PublicProfileActionsProps) {
  const router = useRouter();
  const [authResolved, setAuthResolved] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [viewerEmail, setViewerEmail] = useState<string | null>(null);
  const [connectionRows, setConnectionRows] = useState<ConnectionRequestRow[]>([]);
  const [connectionBusy, setConnectionBusy] = useState(false);
  const [messageBusy, setMessageBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editValues, setEditValues] = useState<ProfileFormValues>(initialValues);
  const [editErrors, setEditErrors] = useState<ProfileValidationErrors>({});
  const [editBusy, setEditBusy] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const editDialogRef = useRef<HTMLDivElement | null>(null);
  const firstNameInputRef = useRef<HTMLInputElement | null>(null);

  const isSelf = Boolean(viewerId && viewerId === profileUserId);
  const connectionState = useMemo(
    () => deriveConnectionState(viewerId, profileUserId, connectionRows),
    [connectionRows, profileUserId, viewerId]
  );

  const refreshConnections = useCallback(async (currentViewerId: string) => {
    const rows = await listCurrentUserConnectionRows(currentViewerId);
    setConnectionRows(rows);
    return rows;
  }, []);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!active) return;

        if (user?.id) {
          setViewerId(user.id);
          setViewerEmail(user.email || null);
          const rows = await listCurrentUserConnectionRows(user.id).catch(() => []);
          if (active) {
            setConnectionRows(rows);
          }
        }
      } finally {
        if (active) {
          setAuthResolved(true);
        }
      }
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, [profileUserId]);

  useEffect(() => {
    setEditValues(initialValues);
    setEditErrors({});
    const parts = initialValues.fullName.trim().split(/\s+/).filter(Boolean);
    setFirstName(parts[0] || "");
    setLastName(parts.slice(1).join(" "));
  }, [initialValues]);

  useEffect(() => {
    if (!editDialogOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setPublicProfileModalOpen(true);
    editDialogRef.current?.focus();
    firstNameInputRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      setPublicProfileModalOpen(false);
    };
  }, [editDialogOpen]);

  const redirectToSignIn = useCallback(() => {
    router.push("/");
  }, [router]);

  const closeEditDialog = useCallback(() => {
    if (editBusy) return;
    setEditDialogOpen(false);
  }, [editBusy]);

  const handleConnect = useCallback(async () => {
    setNotice(null);

    if (isSelf) {
      router.push("/dashboard/profile");
      return;
    }

    if (!viewerId) {
      redirectToSignIn();
      return;
    }

    setConnectionBusy(true);

    try {
      const previousState = deriveConnectionState(viewerId, profileUserId, connectionRows);
      await sendConnectionRequest(profileUserId);
      await refreshConnections(viewerId);
      setNotice(
        previousState.kind === "incoming_pending"
          ? "Connection accepted. You can coordinate directly now."
          : "Connection request sent."
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to update the connection request.");
    } finally {
      setConnectionBusy(false);
    }
  }, [connectionRows, isSelf, profileUserId, redirectToSignIn, refreshConnections, router, viewerId]);

  const handleDecision = useCallback(
    async (decision: "accepted" | "rejected" | "cancelled") => {
      if (!connectionState.requestId || !viewerId) return;

      setNotice(null);
      setConnectionBusy(true);

      try {
        await respondToConnectionRequest({
          requestId: connectionState.requestId,
          decision,
        });
        await refreshConnections(viewerId);
        setNotice(
          decision === "accepted"
            ? "Connection accepted."
            : decision === "rejected"
            ? "Connection declined."
            : "Connection request cancelled."
        );
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Unable to update the connection request.");
      } finally {
        setConnectionBusy(false);
      }
    },
    [connectionState.requestId, refreshConnections, viewerId]
  );

  const handleMessage = useCallback(async () => {
    setNotice(null);

    if (isSelf) {
      router.push("/dashboard/chat");
      return;
    }

    if (!viewerId) {
      redirectToSignIn();
      return;
    }

    setMessageBusy(true);

    try {
      const conversationId = await getOrCreateDirectConversationId(supabase, viewerId, profileUserId);
      router.push(`/dashboard/chat?open=${conversationId}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to open a chat right now.");
    } finally {
      setMessageBusy(false);
    }
  }, [isSelf, profileUserId, redirectToSignIn, router, viewerId]);

  const handleEditSave = useCallback(async () => {
    if (!viewerId) return;

    const combinedFullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
    const normalizedValues: ProfileFormValues = {
      ...editValues,
      fullName: combinedFullName,
      email: viewerEmail || editValues.email,
    };
    const validationErrors = validateProfileValues(normalizedValues, { mode: "submit" });
    setEditErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setEditBusy(true);
    setNotice(null);

    try {
      const savedProfile = await saveCurrentUserProfile({
        user: { id: viewerId, email: viewerEmail || "" },
        values: normalizedValues,
      });
      setEditDialogOpen(false);
      const nextPublicPath = buildPublicProfilePath(savedProfile);
      if (nextPublicPath) {
        router.replace(nextPublicPath);
        router.refresh();
      } else {
        router.refresh();
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save profile right now.");
    } finally {
      setEditBusy(false);
    }
  }, [editValues, firstName, lastName, router, viewerEmail, viewerId]);

  const connectButton = (() => {
    if (isSelf) {
      return (
        <button
          type="button"
          onClick={() => {
            setEditValues(initialValues);
            setEditErrors({});
            setEditDialogOpen(true);
          }}
          className="inline-flex w-full min-h-8 items-center justify-center gap-1.5 rounded-full border border-slate-900 bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-800 sm:min-h-9 sm:w-auto sm:px-4 sm:text-xs"
        >
          <SquarePen className="h-4 w-4" />
          Edit profile
        </button>
      );
    }

    if (connectionState.kind === "accepted") {
      return (
        <div className="inline-flex w-full min-h-8 items-center justify-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 sm:min-h-9 sm:w-auto sm:px-4 sm:text-xs">
          <UserCheck className="h-3.5 w-3.5" />
          Connected
        </div>
      );
    }

    if (connectionState.kind === "outgoing_pending") {
      return (
        <div className="inline-flex w-full min-h-8 items-center justify-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700 sm:min-h-9 sm:w-auto sm:px-4 sm:text-xs">
          <Loader2 className={`h-3.5 w-3.5 ${connectionBusy ? "animate-spin" : ""}`} />
          Request sent
        </div>
      );
    }

    return (
      <button
        type="button"
        disabled={connectionBusy}
        onClick={() => void handleConnect()}
        className="inline-flex w-full min-h-8 items-center justify-center gap-1.5 rounded-full border border-[#0a66c2] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#0a66c2] transition hover:bg-[#edf3f8] disabled:cursor-not-allowed disabled:opacity-70 sm:min-h-9 sm:w-auto sm:px-4 sm:text-xs"
      >
        {connectionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
        {!authResolved || viewerId
          ? connectionState.kind === "incoming_pending"
            ? "Accept connection"
            : connectionState.kind === "rejected" || connectionState.kind === "cancelled"
            ? "Connect again"
            : "Connect"
          : "Sign in to connect"}
      </button>
    );
  })();

  return (
    <>
      <div className={`public-profile-primary-actions w-full transition ${editDialogOpen ? "pointer-events-none opacity-0" : "opacity-100"}`}>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
          {connectButton}

          <button
            type="button"
            disabled={messageBusy}
            onClick={() => void handleMessage()}
            className="inline-flex w-full min-h-8 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:min-h-9 sm:w-auto sm:px-4 sm:text-xs"
          >
            {messageBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
            {isSelf ? "Open chat" : authResolved && !viewerId ? "Sign in to chat" : "Chat"}
          </button>
        </div>
        {connectionState.kind === "incoming_pending" && connectionState.requestId ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={connectionBusy}
              onClick={() => void handleDecision("rejected")}
              className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-70"
            >
              <XCircle className="h-3.5 w-3.5" />
              Decline
            </button>
          </div>
        ) : null}

        {connectionState.kind === "outgoing_pending" && connectionState.requestId ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={connectionBusy}
              onClick={() => void handleDecision("cancelled")}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-70"
            >
              <XCircle className="h-3.5 w-3.5" />
              Cancel request
            </button>
          </div>
        ) : null}

        {!viewerId && authResolved && !isSelf ? (
          <p className="mt-3 text-xs leading-5 text-slate-500">
            This page is public. Sign in to connect or start a direct message with this member.
          </p>
        ) : null}

        {notice ? <p className="mt-3 text-sm leading-6 text-slate-600">{notice}</p> : null}
      </div>

      {!editDialogOpen ? null : (
        <div className="fixed inset-0 z-[4000] grid place-items-center bg-slate-950/24 px-4 py-6 backdrop-blur-xl sm:px-6 sm:py-8">
          <div className="absolute inset-0" onClick={closeEditDialog} />

          <div
            ref={editDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Edit public profile"
            tabIndex={-1}
            className="relative z-10 flex w-full max-w-3xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_80px_-40px_rgba(15,23,42,0.55)] sm:max-h-[calc(100vh-3rem)]"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Edit profile</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{displayName}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">Update the details shown on your public profile.</p>
              </div>

              <button
                type="button"
                onClick={closeEditDialog}
                disabled={editBusy}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                aria-label="Close profile editor"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
              <div className="grid gap-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-900">First name</label>
                    <input
                      ref={firstNameInputRef}
                      type="text"
                      value={firstName}
                      disabled={editBusy}
                      onChange={(event) => setFirstName(event.target.value)}
                      className={`min-h-12 w-full rounded-2xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition ${
                        editErrors.fullName ? "border-rose-300 focus:ring-4 focus:ring-rose-100" : "border-slate-200 focus:ring-4 focus:ring-indigo-100"
                      }`}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-900">Last name</label>
                    <input
                      type="text"
                      value={lastName}
                      disabled={editBusy}
                      onChange={(event) => setLastName(event.target.value)}
                      className={`min-h-12 w-full rounded-2xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition ${
                        editErrors.fullName ? "border-rose-300 focus:ring-4 focus:ring-rose-100" : "border-slate-200 focus:ring-4 focus:ring-indigo-100"
                      }`}
                    />
                    {editErrors.fullName ? <p className="text-sm text-rose-600">{editErrors.fullName}</p> : null}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <MapPin className="h-4 w-4 text-slate-500" />
                      Location
                    </label>
                    <input
                      type="text"
                      value={editValues.location}
                      disabled={editBusy}
                      onChange={(event) => setEditValues((current) => ({ ...current, location: event.target.value }))}
                      className={`min-h-12 w-full rounded-2xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition ${
                        editErrors.location ? "border-rose-300 focus:ring-4 focus:ring-rose-100" : "border-slate-200 focus:ring-4 focus:ring-indigo-100"
                      }`}
                    />
                    {editErrors.location ? <p className="text-sm text-rose-600">{editErrors.location}</p> : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-900">About</label>
                  <textarea
                    value={editValues.bio}
                    disabled={editBusy}
                    onChange={(event) => setEditValues((current) => ({ ...current, bio: event.target.value }))}
                    rows={6}
                    className="min-h-[160px] w-full rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-sm leading-6 text-slate-900 outline-none transition focus:ring-4 focus:ring-indigo-100"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-900">Skills</label>
                  <textarea
                    value={editValues.interests.join(", ")}
                    disabled={editBusy}
                    onChange={(event) =>
                      setEditValues((current) => ({
                        ...current,
                        interests: normalizeTopics(event.target.value.split(",")),
                      }))
                    }
                    rows={3}
                    placeholder="Recruiting, Talent acquisition, Account management"
                    className={`min-h-[112px] w-full rounded-[24px] border bg-white px-4 py-4 text-sm leading-6 text-slate-900 outline-none transition ${
                      editErrors.interests
                        ? "border-rose-300 focus:ring-4 focus:ring-rose-100"
                        : "border-slate-200 focus:ring-4 focus:ring-indigo-100"
                    }`}
                  />
                  <p className="text-xs leading-5 text-slate-500">Separate skills with commas.</p>
                  {editErrors.interests ? <p className="text-sm text-rose-600">{editErrors.interests}</p> : null}
                </div>

                <ProfileContactFields
                  email={viewerEmail || editValues.email}
                  phone={editValues.phone}
                  website={editValues.website}
                  emailReadOnly={Boolean(viewerEmail)}
                  disabled={editBusy}
                  errors={editErrors}
                  onChange={(field, value) => setEditValues((current) => ({ ...current, [field]: value }))}
                />
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 px-6 py-5">
              <button
                type="button"
                onClick={closeEditDialog}
                disabled={editBusy}
                className="inline-flex min-h-11 items-center rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleEditSave()}
                disabled={editBusy}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {editBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SquarePen className="h-4 w-4" />}
                {editBusy ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
