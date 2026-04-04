"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageCircle, BadgeIndianRupee, Send, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getOrCreateDirectConversationId } from "@/lib/directMessages";
import { sendConnectionRequest } from "@/lib/connections";
import { formatPaymentRailList } from "@/lib/paymentFlow";
import type { MarketplaceServiceRecord } from "@/lib/profile/marketplace";

const formatMoney = (value: number | null) => {
  if (!Number.isFinite(Number(value)) || !value) return "Contact for pricing";
  return `INR ${Number(value).toLocaleString("en-IN")}`;
};

const renderPaymentMethods = (methods: string[]) => {
  const rails = formatPaymentRailList(methods);
  return rails.length > 0 ? rails.slice(0, 4).join(" • ") : "Flexible payment methods";
};

export default function ServicesSection({
  profileId,
  displayName,
  services,
}: {
  profileId: string;
  displayName: string;
  services: MarketplaceServiceRecord[];
}) {
  const router = useRouter();
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"chat" | "hire" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setViewerId(data.user?.id || null);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timerId = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timerId);
  }, [notice]);

  const isSelf = useMemo(() => Boolean(viewerId && viewerId === profileId), [profileId, viewerId]);

  const handleChat = useCallback(
    async (service: MarketplaceServiceRecord) => {
      if (isSelf) {
        router.push("/dashboard/chat");
        return;
      }

      if (!viewerId) {
        router.push("/");
        return;
      }

      setBusy("chat");
      setNotice(null);
      try {
        const conversationId = await getOrCreateDirectConversationId(supabase, viewerId, profileId);
        router.push(`/dashboard/chat?open=${conversationId}&service=${service.id}`);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Unable to start chat.");
      } finally {
        setBusy(null);
      }
    },
    [isSelf, profileId, router, viewerId]
  );

  const handleHire = useCallback(
    async (service: MarketplaceServiceRecord) => {
      if (isSelf) {
        router.push("/dashboard/provider/listings");
        return;
      }

      if (!viewerId) {
        router.push("/");
        return;
      }

      setBusy("hire");
      setNotice(null);
      try {
        await sendConnectionRequest(profileId);
        setNotice(`Request sent to ${displayName}.`);
        router.push(`/dashboard/chat?open=${service.id}`);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Unable to send request.");
      } finally {
        setBusy(null);
      }
    },
    [displayName, isSelf, profileId, router, viewerId]
  );

  return (
    <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-lg shadow-slate-200/50 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Offerings</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Services</h2>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
          <Sparkles className="h-3.5 w-3.5" />
          {services.length} live
        </div>
      </div>

      {notice ? <p className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{notice}</p> : null}

      {services.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {services.map((service) => (
            <article key={service.id} className="flex h-full flex-col rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold tracking-tight text-slate-950">{service.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{service.area || "Local area"}</p>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm">
                  {service.service_type}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Price</p>
                  <p className="mt-1 text-base font-semibold text-slate-950">
                    <BadgeIndianRupee className="mr-1 inline-block h-4 w-4 align-[-2px]" />
                    {formatMoney(service.price)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rating</p>
                  <p className="mt-1 text-base font-semibold text-slate-950">
                    {service.rating > 0 ? service.rating.toFixed(1) : "New"}{" "}
                    <span className="text-xs font-normal text-slate-500">({service.review_count} reviews)</span>
                  </p>
                </div>
              </div>

              <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">
                {service.description || "Detailed service description will appear here."}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {service.payment_methods.length > 0 ? (
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
                    {renderPaymentMethods(service.payment_methods)}
                  </span>
                ) : (
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
                    Flexible payments
                  </span>
                )}
                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium capitalize text-slate-700 shadow-sm">
                  {service.availability}
                </span>
              </div>

              <div className="mt-auto grid gap-2 pt-5 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void handleChat(service)}
                  disabled={busy !== null}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950 disabled:opacity-60"
                >
                  {busy === "chat" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                  Chat
                </button>
                <button
                  type="button"
                  onClick={() => void handleHire(service)}
                  disabled={busy !== null}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {busy === "hire" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Hire
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
          No services added yet.
        </div>
      )}
    </section>
  );
}
