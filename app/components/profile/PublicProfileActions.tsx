"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, MessageCircle, SquarePen, UserCheck, UserPlus, XCircle, Zap } from "lucide-react";
import {
  deriveConnectionState,
  listCurrentUserConnectionRows,
  respondToConnectionRequest,
  sendConnectionRequest,
  type ConnectionRequestRow,
} from "@/lib/connections";
import { getOrCreateDirectConversationId } from "@/lib/directMessages";
import { supabase } from "@/lib/supabase";

type PublicProfileActionsProps = {
  profileUserId: string;
  accessHref: string;
  accessLabel: string;
  contactHref: string;
};

export default function PublicProfileActions({
  profileUserId,
  accessHref,
  accessLabel,
  contactHref,
}: PublicProfileActionsProps) {
  const router = useRouter();
  const [authResolved, setAuthResolved] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [connectionRows, setConnectionRows] = useState<ConnectionRequestRow[]>([]);
  const [connectionBusy, setConnectionBusy] = useState(false);
  const [messageBusy, setMessageBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const isSelf = Boolean(viewerId && viewerId === profileUserId);
  const connectionState = useMemo(
    () => deriveConnectionState(viewerId, profileUserId, connectionRows),
    [connectionRows, profileUserId, viewerId]
  );
  const canMessage = isSelf || connectionState.kind === "accepted";

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

  const redirectToSignIn = useCallback(() => {
    router.push("/");
  }, [router]);

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

    if (connectionState.kind !== "accepted") {
      setNotice("Connect with this member first to start a direct chat.");
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
  }, [connectionState.kind, isSelf, profileUserId, redirectToSignIn, router, viewerId]);

  const handleLiveTalk = useCallback(async () => {
    setNotice(null);

    if (isSelf) {
      router.push("/dashboard/chat");
      return;
    }

    if (!viewerId) {
      redirectToSignIn();
      return;
    }

    if (connectionState.kind !== "accepted") {
      setNotice("Connect with this member first to start Live Talk.");
      return;
    }

    setMessageBusy(true);

    try {
      const conversationId = await getOrCreateDirectConversationId(supabase, viewerId, profileUserId);
      router.push(`/dashboard/chat?open=${conversationId}&liveTalk=1`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to start Live Talk right now.");
    } finally {
      setMessageBusy(false);
    }
  }, [connectionState.kind, isSelf, profileUserId, redirectToSignIn, router, viewerId]);

  const connectButton = (() => {
    if (isSelf) {
      return (
        <button
          type="button"
          onClick={() => router.push("/dashboard/profile")}
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          <SquarePen className="h-4 w-4" />
          Edit profile
        </button>
      );
    }

    if (connectionState.kind === "accepted") {
      return (
        <div className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700">
          <UserCheck className="h-4 w-4" />
          Connected
        </div>
      );
    }

    if (connectionState.kind === "outgoing_pending") {
      return (
        <div className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-700">
          <Loader2 className={`h-4 w-4 ${connectionBusy ? "animate-spin" : ""}`} />
          Request sent
        </div>
      );
    }

    return (
      <button
        type="button"
        disabled={connectionBusy}
        onClick={() => void handleConnect()}
        className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {connectionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
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
    <div className="w-full">
      <div className="grid gap-3 sm:grid-cols-2">
        {connectButton}

        <button
          type="button"
          disabled={messageBusy || (!isSelf && authResolved && !!viewerId && !canMessage)}
          onClick={() => void handleMessage()}
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          {messageBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
          {isSelf ? "Open chat" : authResolved && !viewerId ? "Sign in to message" : canMessage ? "Message" : "Chat after connect"}
        </button>

        <button
          type="button"
          disabled={messageBusy || (!isSelf && authResolved && !!viewerId && !canMessage)}
          onClick={() => void handleLiveTalk()}
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-cyan-200 bg-cyan-50 px-5 py-3 text-sm font-semibold text-cyan-800 transition hover:border-cyan-300 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
        >
          {messageBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {authResolved && !viewerId ? "Sign in for Live Talk" : canMessage ? "Start Live Talk" : "Live Talk after connect"}
        </button>

        <a
          href={accessHref}
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white"
        >
          <ExternalLink className="h-4 w-4" />
          {accessLabel}
        </a>

        <a
          href={contactHref}
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white"
        >
          <ExternalLink className="h-4 w-4" />
          View contact
        </a>
      </div>

      {connectionState.kind === "incoming_pending" && connectionState.requestId ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={connectionBusy}
            onClick={() => void handleDecision("rejected")}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-70"
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
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-70"
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

      {notice ? <p className="mt-3 text-xs leading-5 text-slate-600">{notice}</p> : null}
    </div>
  );
}
