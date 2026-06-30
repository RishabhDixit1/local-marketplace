"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  MapPin,
  Pencil,
  RotateCcw,
  Sparkles,
  Star,
  Wrench,
} from "lucide-react";
import { fetchAuthedJson } from "@/lib/clientApi";
import { supabase } from "@/lib/supabase";
import type {
  GenerateLaunchpadDraftResponse,
  GetLaunchpadDraftResponse,
  LaunchpadDraftRecord,
  PublishLaunchpadDraftResponse,
} from "@/lib/api/launchpad";

function ProfileSection({
  gp,
  onEdit,
  onRegenerate,
  editing,
  onSave,
  onCancelEdit,
}: {
  gp: LaunchpadDraftRecord["generatedProfile"];
  onEdit: () => void;
  onRegenerate: () => void;
  editing: boolean;
  onSave: (updated: NonNullable<LaunchpadDraftRecord["generatedProfile"]>) => void;
  onCancelEdit: () => void;
}) {
  const [local, setLocal] = useState(gp);

  useEffect(() => {
    setLocal(gp);
  }, [gp]);

  if (!gp) return null;

  if (editing) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-slate-900">Edit Profile</h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 text-xs font-semibold text-slate-600">Business Name</label>
            <input
              type="text"
              value={local?.fullName || ""}
              onChange={(e) => setLocal((prev) => (prev ? { ...prev, fullName: e.target.value } : prev))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 text-xs font-semibold text-slate-600">Location</label>
            <input
              type="text"
              value={local?.location || ""}
              onChange={(e) => setLocal((prev) => (prev ? { ...prev, location: e.target.value } : prev))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 text-xs font-semibold text-slate-600">Bio</label>
            <textarea
              value={local?.bio || ""}
              onChange={(e) => setLocal((prev) => (prev ? { ...prev, bio: e.target.value } : prev))}
              rows={4}
              className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 text-xs font-semibold text-slate-600">Tags (comma-separated)</label>
            <input
              type="text"
              value={(local?.interests || []).join(", ")}
              onChange={(e) =>
                setLocal((prev) =>
                  prev
                    ? {
                        ...prev,
                        interests: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                      }
                    : prev
                )
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onCancelEdit}
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => local && onSave(local)}
              className="flex-1 rounded-xl bg-[var(--brand-900)] px-3 py-2 text-sm font-semibold text-white"
            >
              Save
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--brand-50)] text-[var(--brand-700)]">
            <Star className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-bold text-slate-900">Profile</h2>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            title="Edit profile"
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50"
            title="Regenerate with AI"
          >
            <RotateCcw className="h-3 w-3" /> Regenerate
          </button>
        </div>
      </div>
      <p className="mb-1 mt-3 text-base font-semibold text-slate-900">{gp.fullName}</p>
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
  );
}

function OfferingsSection({
  services,
  products,
  generationSource,
  onEdit,
  onRegenerate,
  editing,
  onSave,
  onCancelEdit,
}: {
  services: LaunchpadDraftRecord["generatedServices"];
  products: LaunchpadDraftRecord["generatedProducts"];
  generationSource: LaunchpadDraftRecord["generationSource"];
  onEdit: () => void;
  onRegenerate: () => void;
  editing: boolean;
  onSave: (items: Array<{ title: string; description: string; price: number | null }>) => void;
  onCancelEdit: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [local, setLocal] = useState([...services, ...products]);

  useEffect(() => {
    setLocal([...services, ...products]);
  }, [services, products]);

  const count = services.length + products.length;
  if (count === 0) return null;

  if (editing) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-slate-900">Edit Services & Products</h2>
        <div className="space-y-3">
          {local.map((item, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => {
                    const updated = [...local];
                    updated[i] = { ...updated[i], title: e.target.value };
                    setLocal(updated);
                  }}
                  className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  placeholder="Title"
                />
                <input
                  type="number"
                  value={item.price ?? ""}
                  onChange={(e) => {
                    const updated = [...local];
                    updated[i] = { ...updated[i], price: e.target.value ? Number(e.target.value) : null };
                    setLocal(updated);
                  }}
                  className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  placeholder="Price"
                />
              </div>
              <textarea
                value={item.description}
                onChange={(e) => {
                  const updated = [...local];
                  updated[i] = { ...updated[i], description: e.target.value };
                  setLocal(updated);
                }}
                rows={2}
                className="mt-2 w-full resize-none rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                placeholder="Description"
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancelEdit}
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(local)}
            className="flex-1 rounded-xl bg-[var(--brand-900)] px-3 py-2 text-sm font-semibold text-white"
          >
            Save
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between px-5 py-4">
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
            {generationSource === "ai" && (
              <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">
                AI Generated
              </span>
            )}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50"
          >
            <RotateCcw className="h-3 w-3" /> Regenerate
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((p) => !p)}
            className="text-slate-400"
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {!collapsed && (
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
  );
}

function FaqSection({
  faq,
  onEdit,
  onRegenerate,
  editing,
  onSave,
  onCancelEdit,
}: {
  faq: LaunchpadDraftRecord["generatedFaq"];
  onEdit: () => void;
  onRegenerate: () => void;
  editing: boolean;
  onSave: (items: Array<{ question: string; answer: string }>) => void;
  onCancelEdit: () => void;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const [local, setLocal] = useState(faq);

  useEffect(() => {
    setLocal(faq);
  }, [faq]);

  if (faq.length === 0) return null;

  if (editing) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-slate-900">Edit FAQ</h2>
        <div className="space-y-3">
          {local.map((item, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-3">
              <input
                type="text"
                value={item.question}
                onChange={(e) => {
                  const updated = [...local];
                  updated[i] = { ...updated[i], question: e.target.value };
                  setLocal(updated);
                }}
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-semibold"
                placeholder="Question"
              />
              <textarea
                value={item.answer}
                onChange={(e) => {
                  const updated = [...local];
                  updated[i] = { ...updated[i], answer: e.target.value };
                  setLocal(updated);
                }}
                rows={2}
                className="mt-2 w-full resize-none rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                placeholder="Answer"
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancelEdit}
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(local)}
            className="flex-1 rounded-xl bg-[var(--brand-900)] px-3 py-2 text-sm font-semibold text-white"
          >
            Save
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between px-5 py-4">
        <h2 className="text-sm font-bold text-slate-900">FAQ ({faq.length})</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50"
          >
            <RotateCcw className="h-3 w-3" /> Regenerate
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((p) => !p)}
            className="text-slate-400"
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {!collapsed && (
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
  );
}

export default function LaunchpadReviewPage() {
  const router = useRouter();
  const params = useSearchParams();
  const draftId = params.get("draft") ?? undefined;

  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<LaunchpadDraftRecord | null>(null);
  const [loadError, setLoadError] = useState("");

  const [generating, setGenerating] = useState(false);
  const [generatingSection, setGeneratingSection] = useState<string | null>(null);

  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [publishError, setPublishError] = useState("");

  const [editingSection, setEditingSection] = useState<string | null>(null);

  const loadDraft = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const url = draftId
        ? `/api/launchpad/draft?draft_id=${encodeURIComponent(draftId)}`
        : "/api/launchpad/draft";
      const payload = await fetchAuthedJson<GetLaunchpadDraftResponse>(supabase, url);

      if (!payload.ok) {
        setLoadError(payload.message || "Could not load draft.");
      } else {
        const ok = payload as Extract<GetLaunchpadDraftResponse, { ok: true }>;
        if (!ok.draft) {
          setLoadError("Draft not found. Please go back and try again.");
        } else {
          setDraft(ok.draft);
        }
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load draft.");
    } finally {
      setLoading(false);
    }
  }, [draftId]);

  useEffect(() => {
    void loadDraft();
  }, [loadDraft]);

  const handleGenerate = async () => {
    if (!draft) return;
    setGenerating(true);
    try {
      const payload = await fetchAuthedJson<GenerateLaunchpadDraftResponse>(
        supabase,
        "/api/launchpad/generate",
        {
          method: "POST",
          body: JSON.stringify({ draftId: draft.id }),
        }
      );
      if (!payload.ok) {
        throw new Error(payload.message || "Generation failed.");
      }
      setDraft(payload.draft);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not generate. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerateSection = async (section: string) => {
    if (!draft) return;
    setGeneratingSection(section);
    try {
      const payload = await fetchAuthedJson<GenerateLaunchpadDraftResponse>(
        supabase,
        "/api/launchpad/generate",
        {
          method: "POST",
          body: JSON.stringify({ draftId: draft.id }),
        }
      );
      if (!payload.ok) {
        throw new Error(payload.message || "Regeneration failed.");
      }
      setDraft(payload.draft);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not regenerate. Please try again.");
    } finally {
      setGeneratingSection(null);
    }
  };

  const handleEditSection = (section: string) => {
    setEditingSection(editingSection === section ? null : section);
  };

  const handleSaveSection = (
    section: string,
    updated: Partial<LaunchpadDraftRecord["generatedProfile"]> | Array<{ title: string; description: string; price: number | null }> | Array<{ question: string; answer: string }>
  ) => {
    if (!draft) return;
    const updatedDraft = { ...draft };
    if (section === "profile") {
      updatedDraft.generatedProfile = updated as NonNullable<LaunchpadDraftRecord["generatedProfile"]>;
    } else if (section === "offerings") {
      const items = updated as Array<{ title: string; description: string; price: number | null }>;
      const svcCount = draft.generatedServices.length;
      updatedDraft.generatedServices = items.slice(0, svcCount).map((item, i) => ({
        ...draft.generatedServices[i],
        title: item.title,
        description: item.description,
        price: item.price,
      }));
      updatedDraft.generatedProducts = items.slice(svcCount).map((item, i) => ({
        ...draft.generatedProducts[i],
        title: item.title,
        description: item.description,
        price: item.price,
      }));
    } else if (section === "faq") {
      updatedDraft.generatedFaq = updated as Array<{ question: string; answer: string }>;
    }
    setDraft(updatedDraft);
    setEditingSection(null);
  };

  const handlePublish = async () => {
    setPublishing(true);
    setPublishError("");

    try {
      const payload = await fetchAuthedJson<PublishLaunchpadDraftResponse>(
        supabase,
        "/api/launchpad/publish",
        {
          method: "POST",
          body: JSON.stringify({ draftId }),
        }
      );

      if (!payload.ok) {
        throw new Error(payload.message || "Publish failed.");
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

  // ─── loading ────────────────────────────────────────────────────────────
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

  const isDraft = draft.status === "draft";

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
        <h1 className="text-xl font-bold text-slate-900">Review Your Business AI Pack</h1>
        <p className="mt-1 text-sm text-slate-500">
          {isDraft
            ? "Your answers are saved. Generate your business content to review before publishing."
            : "Check what will be published to your profile and storefront listings."}
        </p>
      </div>

      <div className="space-y-5">
        {/* ── If draft, show generate CTA ──────────────────── */}
        {isDraft ? (
          <section className="rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50 p-6 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-indigo-500" />
            <h2 className="mt-3 text-lg font-bold text-indigo-900">Ready to generate your content?</h2>
            <p className="mt-1 text-sm text-indigo-700">
              We&apos;ll create your business profile, services, pricing, and FAQ using AI or a smart template.
            </p>
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={generating}
              className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-base font-bold text-white transition hover:bg-indigo-500 disabled:opacity-60"
            >
              {generating ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Generating…</>
              ) : (
                <><Sparkles className="h-5 w-5" /> Generate My Business Content</>
              )}
            </button>
          </section>
        ) : generating ? (
          <section className="rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50 p-6 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-500" />
            <h2 className="mt-3 text-lg font-bold text-indigo-900">Generating your content…</h2>
            <p className="mt-1 text-sm text-indigo-700">
              Creating your profile bio, service listings, pricing, and FAQ.
            </p>
          </section>
        ) : null}

        {/* ── Profile bio ───────────────────────────────── */}
        {gp && (
          <ProfileSection
            gp={gp}
            onEdit={() => handleEditSection("profile")}
            onRegenerate={() => void handleRegenerateSection("profile")}
            editing={editingSection === "profile"}
            onSave={(updated) => handleSaveSection("profile", updated)}
            onCancelEdit={() => setEditingSection(null)}
          />
        )}

        {/* ── Services & Products ───────────────────────── */}
        {(services.length > 0 || products.length > 0) && (
          <OfferingsSection
            services={services}
            products={products}
            generationSource={draft.generationSource}
            onEdit={() => handleEditSection("offerings")}
            onRegenerate={() => void handleRegenerateSection("offerings")}
            editing={editingSection === "offerings"}
            onSave={(updated) => handleSaveSection("offerings", updated)}
            onCancelEdit={() => setEditingSection(null)}
          />
        )}

        {/* ── Service areas ─────────────────────────────── */}
        {areas.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--brand-50)] text-[var(--brand-700)]">
                <MapPin className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">Service Areas</h2>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
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
          <FaqSection
            faq={faq}
            onEdit={() => handleEditSection("faq")}
            onRegenerate={() => void handleRegenerateSection("faq")}
            editing={editingSection === "faq"}
            onSave={(updated) => handleSaveSection("faq", updated)}
            onCancelEdit={() => setEditingSection(null)}
          />
        )}

        {/* publish error */}
        {publishError ? (
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{publishError}</p>
        ) : null}

        {/* ── Publish CTA ───────────────────────────────── */}
        {!isDraft && !generating && (
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
        )}

        <p className="pb-6 text-center text-xs text-slate-400">
          You can always edit your profile and listings from the profile page after publishing.
        </p>
      </div>
    </div>
  );
}
