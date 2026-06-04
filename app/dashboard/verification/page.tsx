"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, CheckCircle2, FileUp, Loader2, ShieldCheck, Upload, X } from "lucide-react";
import { fetchAuthedJson } from "@/lib/clientApi";
import { supabase } from "@/lib/supabase";
import { useProfileContext } from "@/app/components/profile/ProfileContext";
import { calculateVerificationStatus, verificationLabel } from "@/lib/business";

const DOCUMENT_TYPES = [
  { value: "id_proof", label: "ID Proof (Aadhaar, PAN, DL)" },
  { value: "address_proof", label: "Address Proof" },
  { value: "business_license", label: "Business License / GST" },
  { value: "professional_certificate", label: "Professional Certificate" },
  { value: "insurance", label: "Insurance Certificate" },
  { value: "guarantee", label: "Service Guarantee Document" },
];

type Document = {
  id: string;
  document_type: string;
  file_url: string;
  status: string;
  reviewer_notes: string | null;
  submitted_at: string;
};

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  unverified: { label: "Not Submitted", className: "bg-slate-100 text-slate-600" },
  pending: { label: "Under Review", className: "bg-amber-50 text-amber-700" },
  verified: { label: "Verified", className: "bg-emerald-50 text-emerald-700" },
  rejected: { label: "Rejected", className: "bg-rose-50 text-rose-700" },
};

export default function VerificationPage() {
  const { profile } = useProfileContext();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState(DOCUMENT_TYPES[0].value);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");

  const status = profile?.verification_status || "unverified";
  const badge = STATUS_BADGES[status] || STATUS_BADGES.unverified;

  const progression = useMemo(() => {
    const completion = profile?.profile_completion_percent ?? 0;
    const hasServices = (profile?.services?.length ?? 0) > 0;
    const hasBio = (profile?.bio?.length ?? 0) > 20;
    const hasTrustScore = (profile?.trust_score ?? 0) >= 60;
    const phoneVerified = (profile?.verification_level ?? "") === "phone" || (profile?.verification_level ?? "") === "identity" || (profile?.verification_level ?? "") === "business";
    const idVerified = (profile?.verification_level ?? "") === "identity" || (profile?.verification_level ?? "") === "business";

    return [
      {
        label: "Complete profile",
        met: completion >= 70 && hasBio && hasServices,
        detail: "70% profile completion, bio, and at least 1 service",
      },
      {
        label: "Verify phone / email",
        met: phoneVerified,
        detail: "Verify your phone number or email",
      },
      {
        label: "Upload ID document",
        met: idVerified,
        detail: "Submit a government-issued ID for verification",
      },
      {
        label: "Build trust score",
        met: hasTrustScore,
        detail: "Complete jobs and earn positive reviews (score ≥ 60)",
      },
    ];
  }, [profile]);

  const fetchDocuments = useCallback(async () => {
    const data = await fetchAuthedJson<{ ok: boolean; documents: Document[] }>(
      supabase, "/api/verification/documents", { method: "GET" }
    );
    if (data?.ok) setDocuments(data.documents);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      await fetchDocuments();
      if (!cancelled) setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [fetchDocuments]);

  const handleUpload = async () => {
    if (!file) { setMessage("Select a file first."); return; }
    setUploading(true);
    setMessage("");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("document_type", selectedType);
    const data = await fetchAuthedJson<{ ok: boolean; message?: string; fileUrl?: string }>(
      supabase, "/api/verification/documents", { method: "POST", body: formData }
    );
    if (data?.ok) {
      setMessage("Document uploaded. Submit for review once ready.");
      setFile(null);
      await fetchDocuments();
    } else {
      setMessage(data?.message || "Upload failed.");
    }
    setUploading(false);
  };

  const handleSubmit = async () => {
    setMessage("");
    const data = await fetchAuthedJson<{ ok: boolean; message?: string }>(
      supabase, "/api/verification/submit", { method: "POST" }
    );
    setMessage(data?.message || (data?.ok ? "Submitted!" : "Error"));
    if (data?.ok) await fetchDocuments();
  };

  const pendingCount = documents.filter((d) => d.status === "pending").length;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-3 pb-8 pt-5 sm:px-6 sm:pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Verification</h1>
          <p className="text-sm text-slate-500">Get verified to build trust with customers.</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${badge.className}`}>
          <ShieldCheck className="h-3.5 w-3.5" />
          {badge.label}
        </span>
      </div>

      {/* Badge progression */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-bold text-slate-900 mb-1">Verification Progress</h2>
        <p className="text-xs text-slate-500 mb-4">
          {status === "verified" ? "Your profile is verified. Great job!" : "Complete these steps to get verified."}
        </p>
        <div className="space-y-3">
          {progression.map((step) => (
            <div key={step.label} className={`flex items-start gap-3 rounded-xl p-3 ${step.met ? "bg-emerald-50" : "bg-slate-50"}`}>
              <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${step.met ? "bg-emerald-500" : "bg-slate-300"}`}>
                {step.met ? <CheckCircle2 className="h-4 w-4 text-white" /> : <div className="h-2 w-2 rounded-full bg-white" />}
              </div>
              <div>
                <p className={`text-sm font-semibold ${step.met ? "text-emerald-800" : "text-slate-700"}`}>{step.label}</p>
                <p className="text-xs text-slate-500">{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-bold text-slate-900 mb-3">Upload Documents</h2>
        <p className="text-xs text-slate-500 mb-4">
          Upload at least one government-issued ID or business document. We&apos;ll review and verify your profile.
        </p>

        <div className="space-y-3">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-400)]"
          >
            {DOCUMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600 transition hover:border-[var(--brand-400)] hover:bg-[var(--brand-50)]">
            <Upload className="h-4 w-4" />
            {file ? file.name : "Choose file (PNG, JPG, PDF, max 10MB)"}
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            {file && (
              <button type="button" onClick={() => setFile(null)} className="ml-auto text-slate-400 hover:text-rose-500">
                <X className="h-4 w-4" />
              </button>
            )}
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading || !file}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-900)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--brand-700)] disabled:opacity-60"
            >
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
              {uploading ? "Uploading..." : "Upload"}
            </button>
            {pendingCount > 0 && (
              <button
                type="button"
                onClick={handleSubmit}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--brand-300)] bg-[var(--brand-50)] px-4 py-2 text-xs font-semibold text-[var(--brand-700)] transition hover:bg-[var(--brand-100)]"
              >
                <BadgeCheck className="h-3.5 w-3.5" />
                Submit for Review
              </button>
            )}
          </div>

          {message && (
            <p className="text-xs text-slate-600 bg-slate-50 rounded-xl px-3 py-2">{message}</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-bold text-slate-900 mb-3">Document History</h2>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
        ) : documents.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-6">No documents uploaded yet.</p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => {
              const typeLabel = DOCUMENT_TYPES.find((t) => t.value === doc.document_type)?.label || doc.document_type;
              const statusBadge = STATUS_BADGES[doc.status] || STATUS_BADGES.unverified;
              return (
                <div key={doc.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{typeLabel}</p>
                    <p className="text-[10px] text-slate-400">{new Date(doc.submitted_at).toLocaleDateString()}</p>
                    {doc.reviewer_notes && (
                      <p className="text-[10px] text-rose-500 mt-0.5">{doc.reviewer_notes}</p>
                    )}
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadge.className}`}>
                    {statusBadge.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
