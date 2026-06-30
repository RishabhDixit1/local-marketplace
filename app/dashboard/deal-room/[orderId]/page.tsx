"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Home, Loader2, MessageCircle } from "lucide-react";
import QuoteRoom from "@/app/components/quotes/QuoteRoom";
import { supabase } from "@/lib/supabase";

export default function DealRoomPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = typeof params.orderId === "string" ? params.orderId : null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [helpRequestId, setHelpRequestId] = useState<string | null>(null);
  const [orderNotFound, setOrderNotFound] = useState(false);

  const fetchContext = useCallback(async () => {
    if (!orderId) {
      setError("No order specified.");
      setLoading(false);
      return;
    }

    try {
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .select("id, help_request_id, consumer_id, provider_id, status")
        .eq("id", orderId)
        .maybeSingle();

      if (orderErr || !order) {
        setOrderNotFound(true);
        setError("Order not found.");
        setLoading(false);
        return;
      }

      setHelpRequestId(order.help_request_id || null);
    } catch {
      setError("Failed to load deal room context.");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void fetchContext();
  }, [fetchContext]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleOpenChat = useCallback(() => {
    if (helpRequestId) {
      router.push(`/dashboard/chat?recipientId=${encodeURIComponent(helpRequestId)}`);
    }
  }, [helpRequestId, router]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex items-center justify-center gap-3 py-20 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading deal room...
        </div>
      </div>
    );
  }

  if (error || orderNotFound) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
          <p className="text-base font-semibold text-slate-900">{error || "Deal room not found."}</p>
          <p className="text-sm text-slate-500">The order may have been deleted or you may not have access.</p>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand-900)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-800)]"
          >
            <Home className="h-4 w-4" /> Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-2 text-xs text-slate-400">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="hover:text-slate-600"
        >
          Dashboard
        </button>
        <span>/</span>
        <button
          type="button"
          onClick={handleBack}
          className="hover:text-slate-600"
        >
          Deal Room
        </button>
        <span>/</span>
        <span className="font-medium text-slate-700">{orderId?.slice(0, 8)}</span>
      </nav>

      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Deal Room</h1>
            <p className="text-xs text-slate-500">Quote, scope, and job workspace</p>
          </div>
        </div>
        {helpRequestId && (
          <button
            type="button"
            onClick={handleOpenChat}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300"
          >
            <MessageCircle className="h-3.5 w-3.5" /> Chat
          </button>
        )}
      </div>

      {/* QuoteRoom component with realtime subscription */}
      <DealRoomWithRealtime
        orderId={orderId}
        helpRequestId={helpRequestId}
        onBack={handleBack}
      />
    </div>
  );
}

function DealRoomWithRealtime({
  orderId,
  helpRequestId,
  onBack,
}: {
  orderId: string | null;
  helpRequestId: string | null;
  onBack: () => void;
}) {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!orderId && !helpRequestId) return;

    const channel = supabase
      .channel(`deal-room-${orderId || helpRequestId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "quote_drafts",
          filter: orderId
            ? `order_id=eq.${orderId}`
            : `help_request_id=eq.${helpRequestId}`,
        },
        () => {
          setRefreshKey((k) => k + 1);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "quote_attachments",
          filter: `quote_id=in.(${orderId ? `(select id from quote_drafts where order_id='${orderId}')` : `(select id from quote_drafts where help_request_id='${helpRequestId}')`})`,
        },
        () => {
          setRefreshKey((k) => k + 1);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orderId, helpRequestId]);

  return (
    <QuoteRoom
      key={refreshKey}
      orderId={orderId}
      helpRequestId={helpRequestId}
      surface="tasks"
      onBack={onBack}
    />
  );
}
