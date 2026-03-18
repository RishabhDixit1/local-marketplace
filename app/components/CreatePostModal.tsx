"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  AlertCircle,
  Clock3,
  FileAudio2,
  FileImage,
  FileVideo2,
  Loader2,
  MapPin,
  Mic,
  Paperclip,
  Sparkles,
  Square,
  Wallet,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type {
  PostMode,
  PostType,
  PublishNeedRequest,
  PublishNeedResponse,
  PublishPostRequest,
  PublishPostResponse,
} from "@/lib/api/publish";

type Props = {
  open: boolean;
  onClose: () => void;
  onPublished?: (result?: PublishPostResult) => void | Promise<void>;
};

export type PublishPostResult = {
  postType: PostType;
  helpRequestId?: string;
  matchedCount?: number;
};

type Notice = { message: string } | null;
type UploadedMedia = { name: string; url: string; type: string };
type FieldErrors = Partial<Record<"title" | "details" | "category" | "budget" | "location" | "date" | "time" | "media", string>>;

type CategoryOption = {
  label: string;
  value: string;
};

const OTHER_CATEGORY_VALUE = "__other__";

const categoryOptions: Record<PostType, CategoryOption[]> = {
  need: [
    { label: "Electrician", value: "Electrician" },
    { label: "Plumber", value: "Plumber" },
    { label: "Cleaning", value: "Cleaning" },
    { label: "Appliance repair", value: "Appliance Repair" },
    { label: "Moving or delivery", value: "Moving & Delivery" },
    { label: "Tutoring", value: "Tutoring" },
    { label: "IT support", value: "IT Support" },
    { label: "Home services", value: "Home Services" },
    { label: "Other", value: OTHER_CATEGORY_VALUE },
  ],
  service: [
    { label: "Home services", value: "Home Services" },
    { label: "Repairs", value: "Repairs" },
    { label: "Cleaning", value: "Cleaning" },
    { label: "Beauty & wellness", value: "Beauty & Wellness" },
    { label: "Tutoring & classes", value: "Tutoring & Classes" },
    { label: "Tech support", value: "Tech Support" },
    { label: "Moving & delivery", value: "Moving & Delivery" },
    { label: "Personal assistance", value: "Personal Assistance" },
    { label: "Other", value: OTHER_CATEGORY_VALUE },
  ],
  product: [
    { label: "Home essentials", value: "Home Essentials" },
    { label: "Electronics", value: "Electronics" },
    { label: "Tools & hardware", value: "Tools & Hardware" },
    { label: "Furniture", value: "Furniture" },
    { label: "Repair parts", value: "Repair Parts" },
    { label: "Office supplies", value: "Office Supplies" },
    { label: "Health & wellness", value: "Health & Wellness" },
    { label: "Auto parts", value: "Auto Parts" },
    { label: "Other", value: OTHER_CATEGORY_VALUE },
  ],
};

const typeLabels: Record<PostType, { title: string; copy: string }> = {
  need: { title: "Need help", copy: "Publish a real local request." },
  service: { title: "Offer service", copy: "Share a trustworthy service offer." },
  product: { title: "List product", copy: "Add a real catalog item or product." },
};

const urgencyWindows = ["Within 1 hour", "Today", "Within 24 hours", "This week", "Flexible"];
const SCHEDULE_VALUE = "__schedule__";
const TITLE_MAX = 90;
const DETAILS_MAX = 800;
const MAX_ATTACHMENTS = 6;
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MEDIA_BUCKET = "post-media";
const DEDUP_KEY = "local-marketplace-last-post-signature-v1";
const DEDUP_WINDOW_MS = 90 * 1000;

const fieldClass = (hasError = false) =>
  `w-full rounded-2xl border bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4 sm:py-3 ${
    hasError
      ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
      : "border-slate-200 focus:border-[var(--brand-500)]/40 focus:ring-[var(--brand-500)]/10"
  }`;

const customCategoryPlaceholder: Record<PostType, string> = {
  need: "Describe the kind of help you need",
  service: "Describe the service category",
  product: "Describe the product category",
};

const buildPostSignature = (params: {
  userId: string;
  type: PostType;
  mode: PostMode;
  title: string;
  details: string;
  category: string;
  budget: string;
  locationLabel: string;
  radiusKm: number;
  neededWithin: string;
  scheduleDate: string;
  scheduleTime: string;
}) =>
  [
    params.userId,
    params.type,
    params.mode,
    params.title.trim().toLowerCase(),
    params.details.trim().toLowerCase(),
    params.category.trim().toLowerCase(),
    params.budget.trim().toLowerCase(),
    params.locationLabel.trim().toLowerCase(),
    params.radiusKm,
    params.neededWithin.trim().toLowerCase(),
    params.scheduleDate.trim().toLowerCase(),
    params.scheduleTime.trim().toLowerCase(),
  ].join("|");

const formatBytes = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const pickAttachmentIcon = (mimeType: string) => {
  if (mimeType.startsWith("image/")) return <FileImage className="h-4 w-4 text-emerald-600" />;
  if (mimeType.startsWith("video/")) return <FileVideo2 className="h-4 w-4 text-violet-600" />;
  if (mimeType.startsWith("audio/")) return <FileAudio2 className="h-4 w-4 text-amber-600" />;
  return <Paperclip className="h-4 w-4 text-slate-500" />;
};

export default function CreatePostModal({ open, onClose, onPublished }: Props) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const [type, setType] = useState<PostType>("need");
  const [mode, setMode] = useState<PostMode>("urgent");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [category, setCategory] = useState(categoryOptions.need[0].value);
  const [customCategory, setCustomCategory] = useState("");
  const [budget, setBudget] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [radiusKm, setRadiusKm] = useState(8);
  const [neededWithin, setNeededWithin] = useState(urgencyWindows[0]);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("10:30");
  const [flexibleTiming, setFlexibleTiming] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  const timingValue = mode === "schedule" ? SCHEDULE_VALUE : neededWithin;
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const publishLabel = useMemo(() => {
    if (type === "need") return mode === "schedule" ? "Schedule request" : "Publish request";
    if (type === "service") return mode === "schedule" ? "Schedule service" : "Publish service";
    return mode === "schedule" ? "Schedule product" : "Publish product";
  }, [mode, type]);
  const resolvedCategory = category === OTHER_CATEGORY_VALUE ? customCategory.trim() : category.trim();
  const usingCustomCategory = category === OTHER_CATEGORY_VALUE;

  const resetRecorder = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {}
    }
    recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
    recorderRef.current = null;
    recorderStreamRef.current = null;
    setRecordingVoice(false);
  };

  const clearForm = () => {
    resetRecorder();
    setType("need");
    setMode("urgent");
    setTitle("");
    setDetails("");
    setCategory(categoryOptions.need[0].value);
    setCustomCategory("");
    setBudget("");
    setLocationLabel("");
    setRadiusKm(8);
    setNeededWithin(urgencyWindows[0]);
    setScheduleDate("");
    setScheduleTime("10:30");
    setFlexibleTiming(false);
    setAttachments([]);
    setPublishing(false);
    setNotice(null);
    setErrors({});
  };

  const closeModal = () => {
    clearForm();
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data: profile } = await supabase.from("profiles").select("location").eq("id", user.id).maybeSingle<{ location?: string | null }>();
      const nextLocation = typeof profile?.location === "string" ? profile.location.trim() : "";
      if (!cancelled && nextLocation) {
        setLocationLabel((current) => current.trim() || nextLocation);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!categoryOptions[type].some((option) => option.value === category)) {
      setCategory(categoryOptions[type][0].value);
    }
  }, [category, type]);

  useEffect(() => () => resetRecorder(), []);

  const appendAttachments = (selected: File[]) => {
    if (!selected.length) return;
    let nextError = "";
    const valid: File[] = [];
    for (const file of selected) {
      const supported = file.type.startsWith("image/") || file.type.startsWith("video/") || file.type.startsWith("audio/");
      if (!supported) {
        nextError = `${file.name} is not supported.`;
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        nextError = `${file.name} is larger than 25 MB.`;
        continue;
      }
      valid.push(file);
    }
    setAttachments((current) => {
      const merged = [...current, ...valid];
      if (merged.length > MAX_ATTACHMENTS) nextError = `You can upload up to ${MAX_ATTACHMENTS} files.`;
      return merged.slice(0, MAX_ATTACHMENTS);
    });
    setErrors((current) => ({ ...current, media: nextError || undefined }));
    setNotice(nextError ? { message: nextError } : null);
  };

  const handleAttachmentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = "";
    appendAttachments(selected);
  };

  const startVoiceRecording = async () => {
    if (recordingVoice || publishing) return;
    if (attachments.length >= MAX_ATTACHMENTS) {
      const message = `You can upload up to ${MAX_ATTACHMENTS} files.`;
      setErrors((current) => ({ ...current, media: message }));
      setNotice({ message });
      return;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setNotice({ message: "Voice recording is not supported in this browser." });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((value) => MediaRecorder.isTypeSupported(value));
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunks.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        if (blob.size > 0) {
          const extension = recorder.mimeType.includes("mp4") ? "m4a" : recorder.mimeType.includes("ogg") ? "ogg" : "webm";
          appendAttachments([new File([blob], `voice-note-${Date.now()}.${extension}`, { type: blob.type || "audio/webm" })]);
        }
        stream.getTracks().forEach((track) => track.stop());
        recorderRef.current = null;
        recorderStreamRef.current = null;
        setRecordingVoice(false);
      };
      recorder.onerror = () => {
        stream.getTracks().forEach((track) => track.stop());
        recorderRef.current = null;
        recorderStreamRef.current = null;
        setRecordingVoice(false);
        setNotice({ message: "Could not save the voice note." });
      };
      recorderRef.current = recorder;
      recorderStreamRef.current = stream;
      setRecordingVoice(true);
      setNotice(null);
      recorder.start();
    } catch {
      setNotice({ message: "Microphone access is required to record a voice note." });
    }
  };

  const uploadAttachments = async (userId: string): Promise<UploadedMedia[]> => {
    if (!attachments.length) return [];
    const uploaded: UploadedMedia[] = [];
    for (const file of attachments) {
      const extension = file.name.split(".").pop() || "bin";
      const filePath = `posts/${userId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(filePath, file, { contentType: file.type, upsert: false });
      if (error) throw new Error(`Failed to upload "${file.name}". Check the "${MEDIA_BUCKET}" bucket and policies.`);
      const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(filePath);
      uploaded.push({ name: file.name, url: data.publicUrl, type: file.type });
    }
    return uploaded;
  };

  const resolveRequestCoordinates = async (userId: string) => {
    const browserCoordinates = await new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
      if (typeof navigator === "undefined" || !("geolocation" in navigator)) return resolve(null);
      const timeoutId = window.setTimeout(() => resolve(null), 2800);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          window.clearTimeout(timeoutId);
          resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        },
        () => {
          window.clearTimeout(timeoutId);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 2500, maximumAge: 60000 }
      );
    });
    if (browserCoordinates) return browserCoordinates;
    const { data: profile } = await supabase.from("profiles").select("latitude,longitude").eq("id", userId).maybeSingle();
    const latitude = Number((profile as { latitude?: number | null } | null)?.latitude);
    const longitude = Number((profile as { longitude?: number | null } | null)?.longitude);
    return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
  };

  const publishPost = async () => {
    const trimmedTitle = title.trim();
    const trimmedDetails = details.trim();
    const trimmedLocation = locationLabel.trim();
    const parsedBudget = Number(budget.replace(/[^\d.]/g, ""));
    const nextErrors: FieldErrors = {};
    if (!trimmedTitle) nextErrors.title = "Add a short title.";
    else if (trimmedTitle.length > TITLE_MAX) nextErrors.title = `Keep the title under ${TITLE_MAX} characters.`;
    if (trimmedDetails.length > DETAILS_MAX) nextErrors.details = `Keep the details under ${DETAILS_MAX} characters.`;
    if (!resolvedCategory) nextErrors.category = usingCustomCategory ? "Add a category for Other." : "Choose a category.";
    if (budget.trim() && (!Number.isFinite(parsedBudget) || parsedBudget <= 0)) nextErrors.budget = "Enter a valid amount or leave it blank.";
    if (!trimmedLocation) nextErrors.location = "Add a real location or neighborhood.";
    if (mode === "schedule" && !scheduleDate) nextErrors.date = "Select a date.";
    if (mode === "schedule" && !flexibleTiming && !scheduleTime) nextErrors.time = "Select a time or make it flexible.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setNotice({ message: "Please fix the highlighted fields before publishing." });
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user || null;
    const accessToken = session?.access_token || "";
    if (!user || !accessToken) {
      setNotice({ message: "Please sign in again before publishing." });
      return;
    }

    const signature = buildPostSignature({
      userId: user.id,
      type,
      mode,
      title: trimmedTitle,
      details: trimmedDetails,
      category: resolvedCategory,
      budget,
      locationLabel: trimmedLocation,
      radiusKm,
      neededWithin,
      scheduleDate,
      scheduleTime,
    });

    if (typeof window !== "undefined") {
      try {
        const previous = window.localStorage.getItem(DEDUP_KEY);
        if (previous) {
          const parsed = JSON.parse(previous) as { signature?: string; createdAt?: number };
          if (parsed.signature === signature && Number.isFinite(parsed.createdAt) && Date.now() - Number(parsed.createdAt) < DEDUP_WINDOW_MS) {
            setNotice({ message: "This looks like a duplicate of the post you just submitted." });
            return;
          }
        }
      } catch {
        window.localStorage.removeItem(DEDUP_KEY);
      }
    }

    setPublishing(true);
    setNotice(null);
    try {
      const media = await uploadAttachments(user.id);
      const payloadBase = {
        title: trimmedTitle,
        details: trimmedDetails,
        category: resolvedCategory,
        budget: Number.isFinite(parsedBudget) && parsedBudget > 0 ? parsedBudget : null,
        locationLabel: trimmedLocation,
        radiusKm,
        mode,
        neededWithin,
        scheduleDate,
        scheduleTime: flexibleTiming ? "" : scheduleTime,
        flexibleTiming,
        media,
      };

      let result: PublishPostResult = { postType: type };
      if (type === "need") {
        const coordinates = await resolveRequestCoordinates(user.id);
        const response = await fetch("/api/needs/publish", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ ...payloadBase, postType: "need", latitude: coordinates?.latitude || null, longitude: coordinates?.longitude || null } satisfies PublishNeedRequest),
        });
        const payload = (await response.json().catch(() => null)) as PublishNeedResponse | null;
        if (!response.ok || !payload?.ok) {
          const message = payload && "message" in payload ? payload.message : "Failed to publish your request.";
          const detailsMessage = payload && "details" in payload ? payload.details : "";
          throw new Error(detailsMessage ? `${message} ${detailsMessage}` : message);
        }
        result = { postType: type, helpRequestId: payload.helpRequestId, matchedCount: Number(payload.matchedCount || 0) };
      } else {
        const response = await fetch("/api/posts/publish", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ ...payloadBase, postType: type } satisfies PublishPostRequest),
        });
        const payload = (await response.json().catch(() => null)) as PublishPostResponse | null;
        if (!response.ok || !payload?.ok) {
          const message = payload && "message" in payload ? payload.message : "Failed to publish your post.";
          const detailsMessage = payload && "details" in payload ? payload.details : "";
          throw new Error(detailsMessage ? `${message} ${detailsMessage}` : message);
        }
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem(DEDUP_KEY, JSON.stringify({ signature, createdAt: Date.now() }));
      }
      await onPublished?.(result);
      closeModal();
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : "Unable to publish right now." });
    } finally {
      setPublishing(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[3000] overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-4">
      <div className="flex min-h-full items-start justify-center sm:items-center">
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="my-auto flex w-full max-w-3xl max-h-[calc(100vh-1.5rem)] flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_35px_120px_-45px_rgba(15,23,42,0.55)] sm:max-h-[calc(100vh-2rem)]"
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-3.5 sm:px-6">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-500)]/20 bg-[var(--brand-50)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-700)]">
                <Sparkles className="h-3.5 w-3.5" />
                ServiQ composer
              </span>
              <h2 className="mt-2.5 text-2xl font-semibold tracking-tight text-slate-950 sm:text-[1.9rem]">Create post</h2>
              <p className="mt-1 text-sm text-slate-600">Clean, local, and real. Nearby people should understand the post at a glance.</p>
            </div>
            <button
              type="button"
              onClick={closeModal}
              disabled={publishing}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-800 disabled:opacity-60"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {(["need", "service", "product"] as PostType[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setType(option)}
                  className={`rounded-[1.35rem] border px-4 py-3.5 text-left transition ${
                    type === option ? "border-[var(--brand-500)]/45 bg-[var(--brand-50)]" : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-950">{typeLabels[option].title}</p>
                  <p className="mt-1 text-xs leading-4.5 text-slate-500">{typeLabels[option].copy}</p>
                </button>
              ))}
            </div>

            <div className="grid gap-4 rounded-[1.8rem] border border-slate-200 bg-slate-50/60 p-4">
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="text-sm font-semibold text-slate-800">Title</label>
                  <span className="text-xs text-slate-400">{title.trim().length}/{TITLE_MAX}</span>
                </div>
                <input
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    setErrors((current) => ({ ...current, title: undefined }));
                  }}
                  placeholder={type === "need" ? "Need a plumber for a kitchen leak" : type === "service" ? "Home electrical repair visit" : "Voltage tester and repair kit"}
                  className={fieldClass(!!errors.title)}
                />
                {errors.title ? <p className="mt-2 text-xs text-rose-600">{errors.title}</p> : null}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="text-sm font-semibold text-slate-800">Details</label>
                  <span className="text-xs text-slate-400">{details.trim().length}/{DETAILS_MAX}</span>
                </div>
                <textarea
                  rows={4}
                  value={details}
                  onChange={(event) => {
                    setDetails(event.target.value);
                    setErrors((current) => ({ ...current, details: undefined }));
                  }}
                  placeholder="Add the important context, scope, or expectations."
                  className={`${fieldClass(!!errors.details)} min-h-[112px] resize-y`}
                />
                {errors.details ? <p className="mt-2 text-xs text-rose-600">{errors.details}</p> : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="block text-sm font-semibold text-slate-800">Category</label>
                    <span className="text-[11px] text-slate-500">Pick the closest fit or choose Other.</span>
                  </div>
                  <select
                    value={category}
                    onChange={(event) => {
                      setCategory(event.target.value);
                      setErrors((current) => ({ ...current, category: undefined }));
                    }}
                    className={fieldClass(!!errors.category)}
                  >
                    {categoryOptions[type].map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {usingCustomCategory ? (
                    <input
                      value={customCategory}
                      onChange={(event) => {
                        setCustomCategory(event.target.value);
                        setErrors((current) => ({ ...current, category: undefined }));
                      }}
                      placeholder={customCategoryPlaceholder[type]}
                      className={`${fieldClass(!!errors.category)} mt-3`}
                    />
                  ) : null}
                  {errors.category ? <p className="mt-2 text-xs text-rose-600">{errors.category}</p> : null}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-800">Budget or price</label>
                  <div className="relative">
                    <Wallet className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={budget}
                      inputMode="decimal"
                      onChange={(event) => {
                        setBudget(event.target.value.replace(/[^\d.,]/g, ""));
                        setErrors((current) => ({ ...current, budget: undefined }));
                      }}
                      placeholder="Optional"
                      className={`${fieldClass(!!errors.budget)} pl-11`}
                    />
                  </div>
                  {errors.budget ? <p className="mt-2 text-xs text-rose-600">{errors.budget}</p> : <p className="mt-2 text-xs text-slate-500">Leave blank if you want replies with quotes.</p>}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_220px]">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-800">Location</label>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={locationLabel}
                      onChange={(event) => {
                        setLocationLabel(event.target.value);
                        setErrors((current) => ({ ...current, location: undefined }));
                      }}
                      placeholder="Area, neighborhood, or landmark"
                      className={`${fieldClass(!!errors.location)} pl-11`}
                    />
                  </div>
                  {errors.location ? <p className="mt-2 text-xs text-rose-600">{errors.location}</p> : <p className="mt-2 text-xs text-slate-500">We use your saved coordinates when available.</p>}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-800">Search radius</label>
                  <select value={String(radiusKm)} onChange={(event) => setRadiusKm(Number(event.target.value))} className={fieldClass(false)}>
                    {[3, 5, 8, 12, 20, 30].map((value) => (
                      <option key={value} value={value}>
                        {value} km
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-800">Timing</label>
                  <div className="relative">
                    <Clock3 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <select
                      value={timingValue}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        if (nextValue === SCHEDULE_VALUE) setMode("schedule");
                        else {
                          setMode("urgent");
                          setNeededWithin(nextValue);
                        }
                        setErrors((current) => ({ ...current, date: undefined, time: undefined }));
                      }}
                      className={`${fieldClass(false)} pl-11`}
                    >
                      {urgencyWindows.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                      <option value={SCHEDULE_VALUE}>Schedule for later</option>
                    </select>
                  </div>
                </div>

                {mode === "schedule" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-800">Date</label>
                      <input
                        type="date"
                        min={today}
                        value={scheduleDate}
                        onChange={(event) => {
                          setScheduleDate(event.target.value);
                          setErrors((current) => ({ ...current, date: undefined }));
                        }}
                        className={fieldClass(!!errors.date)}
                      />
                      {errors.date ? <p className="mt-2 text-xs text-rose-600">{errors.date}</p> : null}
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-800">Time</label>
                      <input
                        type="time"
                        disabled={flexibleTiming}
                        value={scheduleTime}
                        onChange={(event) => {
                          setScheduleTime(event.target.value);
                          setErrors((current) => ({ ...current, time: undefined }));
                        }}
                        className={fieldClass(!!errors.time)}
                      />
                      {errors.time ? <p className="mt-2 text-xs text-rose-600">{errors.time}</p> : null}
                    </div>
                  </div>
                ) : (
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600">Choose a fast response window or schedule a later slot.</div>
                )}
              </div>

              {mode === "schedule" ? (
                <label className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <input type="checkbox" checked={flexibleTiming} onChange={(event) => setFlexibleTiming(event.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                  Timing is flexible
                </label>
              ) : null}
            </div>

            <div className="rounded-[1.8rem] border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Media</p>
                  <p className="mt-1 text-sm text-slate-500">Upload images, video, or audio that actually helps someone respond.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-[var(--brand-500)]/35 hover:text-[var(--brand-700)]">
                    <Paperclip className="h-4 w-4" />
                    Add media
                    <input type="file" multiple accept="image/*,video/*,audio/*" onChange={handleAttachmentChange} className="hidden" />
                  </label>
                  <button
                    type="button"
                    onClick={recordingVoice ? () => recorderRef.current?.stop() : () => void startVoiceRecording()}
                    disabled={publishing}
                    className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition disabled:opacity-60 ${
                      recordingVoice ? "border-rose-300 bg-rose-50 text-rose-700" : "border-slate-200 bg-white text-slate-700 hover:border-[var(--brand-500)]/35 hover:text-[var(--brand-700)]"
                    }`}
                  >
                    {recordingVoice ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    {recordingVoice ? "Stop recording" : "Voice note"}
                  </button>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">Up to {MAX_ATTACHMENTS} files, 25 MB each.</p>
              {errors.media ? <p className="mt-2 text-xs text-rose-600">{errors.media}</p> : null}

              {attachments.length ? (
                <div className="mt-4 space-y-2">
                  {attachments.map((file, index) => (
                    <div key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white bg-white">{pickAttachmentIcon(file.type)}</span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
                          <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:text-rose-700">
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">No media added yet.</div>
              )}
            </div>

            {notice ? (
              <div className="flex items-start gap-3 rounded-[1.4rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{notice.message}</span>
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">This keeps the current ServiQ auth, storage bucket, and publish routes intact.</p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={closeModal} disabled={publishing} className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-60">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void publishPost()}
                  disabled={publishing}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,var(--brand-900),var(--brand-700))] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60 sm:w-auto sm:min-w-[180px]"
                >
                  {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {publishing ? "Publishing..." : publishLabel}
                </button>
              </div>
            </div>
          </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
