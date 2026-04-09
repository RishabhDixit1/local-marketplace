"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  MapPin,
  Star,
  Wrench,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type {
  GetLaunchpadDraftResponse,
  LaunchpadDraftRecord,
  PublishLaunchpadDraftResponse,
} from "@/lib/api/launchpad";

export default function LaunchpadReviewPage() {
  const router = useRouter();
  const params = useSearchParams();
  const draftId = params.get("draft") ?? undefined;

  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<LaunchpadDraftRecord | null>(null);
  const [loadError, setLoadError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [showServices, setShowServices] = useState(true);
  const [showFaq, setShowFaq] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Session expired.");

        const url = draftId
          ? `/api/launchpad/draft?draft_id=${encodeURIComponent(draftId)}`
          : "/api/launchpad/draft";
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const payload = (await res.json().catch(() => null)) as GetLaunchpadDraftResponse | null;

        if (!active) return;
        if (!res.ok || !payload?.ok) {
          setLoadError(payload && !payload.ok ? payload.message : "Could not load draft.");
        } else {
          const ok = payload as Extract<GetLaunchpadDraftResponse, { ok: true }>;
          if (!ok.draft) {
            setLoadError("Draft not found. Please go back and try again.");
          } else {
            setDraft(ok.draft);
          }
        }
      } catch (err) {
        if (active) setLoadError(err instanceof Error ? err.message : "Could not load draft.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [draftId]);

  const handlePublish = async () => {
    setPublishing(true);
    setPublishError("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Session expired.");

      const res = await fetch("/api/launchpad/publish", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ draftId }),
      });
      const payload = (await res.json().catch(() => null)) as PublishLaunchpadDraftResponse | null;

      if (!res.ok || !payload?.ok) {
        throw new Error(
          payload && !payload.ok
            ? (payload as Extract<PublishLaunchpadDraftResponse, { ok: false }>).message
            : "Publish failed."
        );
      }

      setPublished(true);
      setTimeout(() => {
        const typed = payload as Extract<PublishLaunchpadDraftResponse, { ok: true }>;
        router.push(typed.profilePath || "/dashboard/profile");
      }, 1600);
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : "Could not publish. Please try again.");
      setPublishing(false);
    }
  };

  // ─── loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-60 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-[var(--brand-700)]" />
      </div>
    );
  }

  if (loadError || !draft) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <p className="text-base font-semibold text-rose-700">{loadError || "Draft not found."}</p>
          <button
            type="button"
            onClick={() => router.push("/dashboard/launchpad")}
            className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[var(--brand-900)] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--brand-700)]"
          >
            <ArrowLeft className="h-4 w-4" /> Go back
          </button>
        </div>
      </div>
    );
  }

  const gp = draft.generatedProfile;
  const services = draft.generatedServices ?? [];
  const products = draft.generatedProducts ?? [];
  const faq = draft.generatedFaq ?? [];
  const areas = draft.generatedServiceAreas ?? [];
  const offeringCount = services.length + products.length;

  return (
    <div className="mx-auto max-w-2xl">
      {/* back link */}
      <button
        type="button"
        onClick={() => router.push("/dashboard/launchpad")}
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Edit answers
      </button>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Review Your Business Pack</h1>
        <p className="mt-1 text-sm text-slate-500">
          Check what will be published to your profile and storefront listings. This will not create a marketplace feed post.
        </p>
      </div>

      <div className="space-y-5">

        {/* ── Profile bio ───────────────────────────────── */}
        {gp && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--brand-50)] text-[var(--brand-700)]">
                <Star className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">Profile</h2>
            </div>
            <p className="mb-1 text-base font-semibold text-slate-900">{gp.fullName}</p>
            {gp.location ? (
              <p className="mb-2 flex items-center gap-1 text-sm text-slate-500">
                <MapPin className="h-3.5 w-3.5 shrink-0" /> {gp.location}
              </p>
            ) : null}
            <p className="text-sm leading-relaxed text-slate-700">{gp.bio}</p>
            {gp.interests.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {gp.interests.slice(0, 8).map((tag) => (
                  <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Services & Products ───────────────────────── */}
        {offeringCount > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setShowServices((p) => !p)}
              className="flex w-full items-center justify-between px-5 py-4"
            >
              <div className="flex items-center gap-2">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--brand-50)] text-[var(--brand-700)]">
                  <Wrench className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-bold text-slate-900">
                  {services.length > 0 && products.length === 0
                    ? `${services.length} Service${services.length === 1 ? "" : "s"}`
                    : products.length > 0 && services.length === 0
                    ? `${products.length} Product${products.length === 1 ? "" : "s"}`
                    : `${services.length} Services + ${products.length} Products`}
                </h2>
              </div>
              {showServices ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>
            {showServices && (
              <div className="divide-y divide-slate-100 border-t border-slate-100 px-5 pb-4">
                {[...services, ...products].map((item, i) => (
                  <div key={i} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      {item.price && item.price > 0 ? (
                        <span className="shrink-0 text-sm font-bold text-[var(--brand-700)]">
                          ₹{item.price.toLocaleString("en-IN")}
                        </span>
                      ) : null}
                    </div>
                    {item.description ? (
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500 line-clamp-2">{item.description}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Service areas ─────────────────────────────── */}
        {areas.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--brand-50)] text-[var(--brand-700)]">
                <MapPin className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">Service Areas</h2>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {areas.map((area) => (
                <span key={area} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                  {area}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* ── FAQ ───────────────────────────────────────── */}
        {faq.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setShowFaq((p) => !p)}
              className="flex w-full items-center justify-between px-5 py-4"
            >
              <h2 className="text-sm font-bold text-slate-900">FAQ ({faq.length})</h2>
              {showFaq ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>
            {showFaq && (
              <div className="divide-y divide-slate-100 border-t border-slate-100 px-5 pb-4">
                {faq.map((item, i) => (
                  <div key={i} className="py-3">
                    <p className="text-sm font-semibold text-slate-900">{item.question}</p>
                    <p className="mt-0.5 text-sm text-slate-600">{item.answer}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* publish error */}
        {publishError ? (
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{publishError}</p>
        ) : null}

        {/* CTA */}
        <button
          type="button"
          onClick={() => void handlePublish()}
          disabled={publishing || published}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand-900)] py-4 text-base font-bold text-white shadow-md transition hover:bg-[var(--brand-700)] disabled:opacity-60 active:scale-[0.98]"
        >
          {publishing ? (
            <><Loader2 className="h-5 w-5 animate-spin" /> Publishing…</>
          ) : published ? (
            <><CheckCircle2 className="h-5 w-5" /> Published!</>
          ) : (
            "Publish to Profile"
          )}
        </button>

        <p className="pb-6 text-center text-xs text-slate-400">
          You can always edit your profile and listings from the profile page after publishing.
        </p>
      </div>
    </div>
  );
}
