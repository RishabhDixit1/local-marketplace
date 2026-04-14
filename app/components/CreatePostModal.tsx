"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, Check, FileAudio, Film, Loader2, MapPin, Paperclip, X } from "lucide-react";
import { fetchAuthedJson } from "@/lib/clientApi";
import {
  formatCoordinatePair,
  isUsableLocationLabel,
  requestBrowserCoordinates,
} from "@/lib/geo";
import { supabase } from "@/lib/supabase";
import type {
  PostType,
  PublishNeedRequest,
  PublishPostRequest,
  PublishNeedResponse,
  PublishPostResponse,
} from "@/lib/api/publish";

// 
// Types
// 

type Props = {
  open: boolean;
  onClose: () => void;
  onPublished?: (result?: PublishPostResult) => void | Promise<void>;
  allowedPostTypes?: PostType[];
};

export type PublishPostResult = {
  postType: PostType;
  helpRequestId?: string;
  matchedCount?: number;
};

// 
// Static data
// 

const TITLE_MAX = 160;
const DETAILS_MAX = 1200;
const MAX_ATTACHMENTS = 6;
const MAX_FILE_SIZE = 25 * 1024 * 1024;

const CATEGORIES = [
  "Plumber",
  "Electrician",
  "AC Repair",
  "Carpenter",
  "Painter",
  "Cleaning",
  "RO Service",
  "Appliance Repair",
  "Mechanic",
  "Mobile Repair",
  "Computer Repair",
  "Tutor",
  "Delivery",
  "Tailor",
  "Beautician",
  "Photographer",
  "CCTV",
  "Internet / WiFi",
  "Other",
] as const;

const TYPE_OPTIONS: { value: PostType; label: string; emoji: string }[] = [
  { value: "need", label: "Need Help", emoji: "" },
  { value: "service", label: "Offer Service", emoji: "" },
  { value: "product", label: "List Product", emoji: "" },
];
const DEFAULT_ALLOWED_POST_TYPES: PostType[] = ["need", "service", "product"];

const PLACEHOLDERS: Record<string, string> = {
  Plumber: "Need plumber for tap leakage",
  Electrician: "Need electrician for switch repair",
  Cleaning: "Need home cleaning tomorrow",
  "AC Repair": "Need AC servicing today",
  Carpenter: "Need carpenter for door repair",
  Painter: "Need painter for 2 BHK",
  Tutor: "Need maths tutor for class 10",
  Mechanic: "Need mechanic for bike repair",
  "Mobile Repair": "Need mobile screen replacement",
  "Computer Repair": "Need laptop servicing",
  Delivery: "Need parcel delivery within city",
  Tailor: "Need alterations for kurta",
  Beautician: "Need home salon visit",
  Photographer: "Need photographer for birthday",
  CCTV: "Need CCTV installation",
  "Internet / WiFi": "Need WiFi router setup",
  "RO Service": "Need RO water purifier repair",
  "Appliance Repair": "Need washing machine repair",
  Other: "Describe what you need",
};

const PRICE_TYPES = ["Fixed", "Hourly", "Negotiable"] as const;
type PriceType = typeof PRICE_TYPES[number];
type ComposerStep = 1 | 2;
type AttachmentKind = "image" | "video" | "audio";
type AttachmentPreview = { url: string; kind: AttachmentKind; name: string };

// 
// Helpers
// 

const uploadMedia = async (files: File[]) => {
  const uploaded: { name: string; url: string; type: string }[] = [];
  for (const file of files) {
    const formData = new FormData();
    formData.append("file", file);

    const payload = await fetchAuthedJson<{
      ok?: boolean;
      message?: string;
      media?: { name: string; url: string; type: string };
    }>(supabase, "/api/upload/post-media", {
      method: "POST",
      body: formData,
    });

    if (!payload.ok || !payload.media) {
      throw new Error(payload.message || `Media upload failed: ${file.name}`);
    }

    uploaded.push(payload.media);
  }
  return uploaded;
};

const getAttachmentKind = (file: File): AttachmentKind => {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "image";
};

// 
// Component
// 

export default function CreatePostModal({
  open,
  onClose,
  onPublished,
  allowedPostTypes = DEFAULT_ALLOWED_POST_TYPES,
}: Props) {
  const availableTypeOptions = useMemo(() => {
    const allowedSet = new Set(allowedPostTypes);
    const filtered = TYPE_OPTIONS.filter((option) => allowedSet.has(option.value));
    return filtered.length > 0 ? filtered : TYPE_OPTIONS.filter((option) => option.value === "need");
  }, [allowedPostTypes]);
  const defaultPostType = availableTypeOptions[0]?.value ?? "need";

  // form state
  const [step, setStep] = useState<ComposerStep>(1);
  const [postType, setPostType] = useState<PostType>(defaultPostType);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [category, setCategory] = useState("Plumber");
  const [price, setPrice] = useState("");
  const [priceType, setPriceType] = useState<PriceType>("Fixed");
  const [location, setLocation] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachmentPreviews, setAttachmentPreviews] = useState<AttachmentPreview[]>([]);

  // ui state
  const [posting, setPosting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [posted, setPosted] = useState(false);
  const [error, setError] = useState("");
  const [gpsNotice, setGpsNotice] = useState("");

  const mediaInputRef = useRef<HTMLInputElement>(null);
  const isNeedOnlyComposer = availableTypeOptions.length === 1 && availableTypeOptions[0]?.value === "need";

  useEffect(() => {
    if (availableTypeOptions.some((option) => option.value === postType)) return;
    setPostType(defaultPostType);
  }, [availableTypeOptions, defaultPostType, postType]);

  // pre-fill location from profile
  useEffect(() => {
    if (!open) return;
    let active = true;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("location,latitude,longitude")
        .eq("id", user.id)
        .maybeSingle<{ location?: string | null; latitude?: number | null; longitude?: number | null }>();
      if (!active) return;
      if (profile?.location) setLocation((cur) => cur || profile.location || "");
      if (profile?.latitude) setLat(profile.latitude);
      if (profile?.longitude) setLng(profile.longitude);
    })();
    return () => { active = false; };
  }, [open]);

  // reset when closed
  useEffect(() => {
    if (!open) {
      setStep(1);
      setPostType(defaultPostType);
      setTitle("");
      setDetails("");
      setCategory("Plumber");
      setPrice("");
      setPriceType("Fixed");
      setAttachments([]);
      setAttachmentPreviews([]);
      setPosting(false);
      setPosted(false);
      setError("");
      setGpsNotice("");
    }
  }, [defaultPostType, open]);

  useEffect(() => {
    const nextPreviews = attachments.map((file) => ({
      url: URL.createObjectURL(file),
      kind: getAttachmentKind(file),
      name: file.name,
    }));
    setAttachmentPreviews(nextPreviews);

    return () => {
      nextPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [attachments]);

  if (!open) return null;

  //  GPS 
  const handleGps = async () => {
    setLocating(true);
    setError("");
    setGpsNotice("");
    const result = await requestBrowserCoordinates({ timeoutMs: 4000 });
    if (result.ok) {
      setLat(result.coordinates.latitude);
      setLng(result.coordinates.longitude);
      setGpsNotice(
        location.trim()
          ? "Precise GPS saved. Your readable location label stays visible to people."
          : "Precise GPS saved. Add a readable area or neighbourhood so people know where to help."
      );
    } else {
      setError(result.message);
    }
    setLocating(false);
  };

  //  media 
  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    const valid = files.filter(
      (file) =>
        (file.type.startsWith("image/") || file.type.startsWith("video/") || file.type.startsWith("audio/")) &&
        file.size <= MAX_FILE_SIZE
    );

    if (valid.length !== files.length) {
      setError("Only image, video, or audio files up to 25 MB are allowed.");
    } else {
      setError("");
    }

    const next = [...attachments, ...valid].slice(0, MAX_ATTACHMENTS);
    setAttachments(next);
  };

  const removeAttachment = (index: number) => {
    const next = attachments.filter((_, i) => i !== index);
    setAttachments(next);
  };

  const validateStepOne = () => {
    if (!title.trim()) {
      setError("Please add a title.");
      return false;
    }

    return true;
  };

  const handleNextStep = () => {
    setError("");
    if (!validateStepOne()) return;
    setStep(2);
  };

  //  submit 
  const handlePost = async () => {
    if (!validateStepOne()) return;
    if (!location.trim()) { setError("Please add your location."); return; }
    if (!isUsableLocationLabel(location)) {
      setError("Enter a readable area or city name, not raw GPS coordinates.");
      return;
    }

    setPosting(true);
    setError("");
    setGpsNotice("");

    try {
      const media = await uploadMedia(attachments);
      const parsedPrice = price.trim() ? Math.abs(parseFloat(price.replace(/[^\d.]/g, ""))) : null;
      const budgetValue = Number.isFinite(parsedPrice) && parsedPrice! > 0 ? parsedPrice : null;
      const trimmedDetails = details.trim();
      const pricingNote =
        budgetValue && priceType !== "Fixed"
          ? `Pricing preference: ${priceType.toLowerCase()}.`
          : "";
      const composedDetails = [trimmedDetails, pricingNote].filter(Boolean).join(trimmedDetails && pricingNote ? "\n\n" : "");

      const base = {
        title: title.trim(),
        details: composedDetails,
        category: category === "Other" ? "Other" : category,
        budget: budgetValue,
        locationLabel: location.trim(),
        radiusKm: 8,
        mode: "urgent" as const,
        neededWithin: "Within 24 hours",
        scheduleDate: "",
        scheduleTime: "",
        flexibleTiming: true,
        media,
      };

      let result: PublishPostResult = { postType };

      if (postType === "need") {
        const fallbackGpsResult =
          typeof lat === "number" && typeof lng === "number"
            ? null
            : await requestBrowserCoordinates({ timeoutMs: 3200 });
        const coords =
          typeof lat === "number" && typeof lng === "number"
            ? { latitude: lat, longitude: lng }
            : fallbackGpsResult?.ok
            ? fallbackGpsResult.coordinates
            : null;
        const payload = await fetchAuthedJson<PublishNeedResponse>(
          supabase,
          "/api/needs/publish",
          {
            method: "POST",
            body: JSON.stringify({
              ...base,
              postType: "need",
              latitude: coords?.latitude ?? null,
              longitude: coords?.longitude ?? null,
            } satisfies PublishNeedRequest),
          }
        );
        if (!payload.ok) throw new Error(payload.message || "Failed to post.");
        result = { postType, helpRequestId: (payload as { helpRequestId?: string }).helpRequestId, matchedCount: Number((payload as { matchedCount?: number }).matchedCount || 0) };
      } else {
        const payload = await fetchAuthedJson<PublishPostResponse>(
          supabase,
          "/api/posts/publish",
          {
            method: "POST",
            body: JSON.stringify({ ...base, postType } satisfies PublishPostRequest),
          }
        );
        if (!payload.ok) throw new Error(payload.message || "Failed to post.");
      }

      setPosted(true);
      await onPublished?.(result);
      setTimeout(() => {
        setPosted(false);
        onClose();
      }, 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  //  render 

  const placeholder = PLACEHOLDERS[category] ?? "What do you need?";
  const detailPlaceholder =
    postType === "need"
      ? "Explain the job, size, urgency, address landmark, and anything the helper should know."
      : postType === "service"
        ? "Describe what you offer, your experience, what is included, and any delivery timeline."
        : "Describe the item, condition, brand, size, pickup or delivery details, and what is included.";
  const stepTitle =
    step === 1
      ? postType === "need"
        ? "Start with the request"
        : postType === "service"
          ? "Start with the service"
          : "Start with the product"
      : "Add price, location, and media";
  const stepDescription =
    step === 1
      ? isNeedOnlyComposer
        ? "Start with the need, and attach media right away if it helps people understand the job faster."
        : "Start with the headline and core details. You can attach media now, then add location and pricing next."
      : "This is where we make the post easier to trust and easier to find nearby.";
  const primaryActionLabel =
    step === 1
      ? "Continue"
      : postType === "need"
        ? "Post Request"
        : postType === "service"
          ? "Post Service"
          : "List Product";
  const locationHint =
    postType === "need"
      ? "Location is required so nearby helpers can see your request."
      : postType === "service"
        ? "Add the area you serve so nearby customers can find you."
        : "Add a pickup or delivery area so buyers know where the item is available.";
  const priceHint =
    postType === "need"
      ? "Add a budget if you have one, or leave it blank and discuss it in chat."
      : postType === "service"
        ? "Use price to set expectations. Switch to hourly or negotiable if fixed pricing is not right."
        : "Price helps product posts feel complete, even if you are open to negotiation.";
  const attachmentCountLabel = `${attachments.length}/${MAX_ATTACHMENTS} attached`;

  const renderAttachmentSection = (compact = false) => (
    <div
      className={`rounded-[1.75rem] border ${
        compact
          ? "border-slate-200 bg-[linear-gradient(145deg,#ffffff_0%,#f8fafc_62%,#eef2ff_100%)] p-4"
          : "border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(14,165,164,0.14),transparent_42%),linear-gradient(145deg,#ffffff_0%,#f8fafc_62%,#ecfeff_100%)] p-4"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-700)]">
            Media
          </p>
          <h3 className="mt-2 text-base font-semibold text-slate-900">
            {compact ? "Attach photos, video, or audio now" : "Show the request clearly"}
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {compact
              ? "You do not need to wait for step two. Add visuals or a quick voice note as soon as you have the details."
              : "Images, short video clips, and voice notes make the post easier to trust and much easier to respond to."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => mediaInputRef.current?.click()}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          {compact ? <Paperclip className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
          {attachments.length ? "Add more" : "Add media"}
        </button>
      </div>

      {attachmentPreviews.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {attachmentPreviews.map((preview, index) => (
            <div
              key={`${preview.url}-${index}`}
              className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-white ${
                compact ? "h-24" : "h-28"
              }`}
            >
              {preview.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.url} alt={preview.name} className="h-full w-full object-cover" />
              ) : preview.kind === "video" ? (
                <video src={preview.url} className="h-full w-full object-cover" muted playsInline />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 bg-slate-50 px-3 text-center">
                  <FileAudio className="h-6 w-6 text-[var(--brand-700)]" />
                  <p className="line-clamp-2 text-[11px] font-semibold text-slate-700">{preview.name}</p>
                </div>
              )}
              {preview.kind !== "audio" ? (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/75 to-transparent px-3 pb-2 pt-6 text-[10px] font-semibold text-white">
                  <span className="line-clamp-1 block">{preview.name}</span>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => removeAttachment(index)}
                className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-950/85 text-white shadow-md transition hover:bg-slate-900"
                aria-label={`Remove attachment ${index + 1}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-slate-700 shadow-sm">
                {preview.kind === "video" ? <Film className="h-3 w-3" /> : preview.kind === "audio" ? <FileAudio className="h-3 w-3" /> : <Camera className="h-3 w-3" />}
                {preview.kind}
              </div>
            </div>
          ))}
          {attachments.length < MAX_ATTACHMENTS ? (
            <button
              type="button"
              onClick={() => mediaInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white/70 text-slate-500 transition hover:border-slate-400 hover:bg-white ${
                compact ? "h-24" : "h-28"
              }`}
            >
              <Paperclip className="h-5 w-5" />
              <span className="text-[11px] font-semibold">Add more</span>
            </button>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 rounded-[1.5rem] border border-dashed border-slate-300 bg-white/70 p-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { label: "Images", icon: Camera },
              { label: "Videos", icon: Film },
              { label: "Voice notes", icon: FileAudio },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
                <item.icon className="h-4 w-4 text-[var(--brand-700)]" />
                <span className="font-semibold">{item.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Add real context now so nearby people can judge the request faster and trust what they are responding to.
          </p>
        </div>
      )}

      <input
        ref={mediaInputRef}
        type="file"
        accept="image/*,video/*,audio/*"
        multiple
        className="sr-only"
        onChange={handleAttachmentChange}
        aria-label="Upload media"
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <p>Support images, short videos, and voice notes up to 25 MB each.</p>
        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-600">
          {attachmentCountLabel}
        </span>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[var(--layer-modal)] flex flex-col bg-white">
      {/* header */}
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Step {step} of 2</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">{stepTitle}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={posting}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 max-w-lg text-sm text-slate-500">{stepDescription}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[1, 2].map((stepNumber) => {
            const isActive = step === stepNumber;
            const isComplete = step > stepNumber;

            return (
              <button
                key={stepNumber}
                type="button"
                onClick={() => {
                  if (stepNumber === 1 || step === 2) {
                    setStep(stepNumber as ComposerStep);
                    setError("");
                  }
                }}
                className={`rounded-2xl border px-3 py-2 text-left transition ${
                  isActive
                    ? "border-[var(--brand-500)] bg-[var(--brand-50)]"
                    : isComplete
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-slate-200 bg-slate-50"
                }`}
                aria-current={isActive ? "step" : undefined}
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className={isActive ? "text-[var(--brand-700)]" : isComplete ? "text-emerald-700" : "text-slate-500"}>
                    {stepNumber === 1 ? "Core Details" : "Discovery Details"}
                  </span>
                  {isComplete ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : null}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {stepNumber === 1 ? "Type, category, title, description, and media" : "Price, location, and discovery details"}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4">
        <div className="mx-auto max-w-lg space-y-5">
          {step === 1 ? (
            <>
              {availableTypeOptions.length > 1 ? (
                <div className="grid grid-cols-3 gap-2">
                  {availableTypeOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPostType(opt.value)}
                      className={`rounded-[1.35rem] border px-3 py-3 text-left transition ${
                        postType === opt.value
                          ? "border-[var(--brand-500)] bg-[linear-gradient(135deg,var(--brand-50)_0%,#ffffff_100%)] text-[var(--brand-700)] shadow-[0_16px_28px_-24px_rgba(15,118,110,0.65)]"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <span className="block text-sm font-semibold">{opt.label}</span>
                      <span className="mt-1 block text-[11px] leading-4 text-slate-500">
                        {opt.value === "need" ? "Ask nearby providers" : opt.value === "service" ? "Offer your work" : "Sell an item"}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-[1.5rem] border border-[var(--brand-500)]/20 bg-[linear-gradient(145deg,var(--brand-50)_0%,#ffffff_100%)] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-700)]">
                    Need Post
                  </p>
                  <h3 className="mt-2 text-base font-semibold text-slate-900">Create a local need post</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Services and products now belong in your Store and Control flows. This composer is only for help requests.
                  </p>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="post-category">
                  Category
                </label>
                <select
                  id="post-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-400)]/20"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 flex items-center justify-between text-sm font-semibold text-slate-700" htmlFor="post-title">
                  <span>Title</span>
                  <span className={`text-xs font-normal ${title.length > TITLE_MAX - 10 ? "text-rose-500" : "text-slate-400"}`}>
                    {title.length}/{TITLE_MAX}
                  </span>
                </label>
                <textarea
                  id="post-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
                  rows={2}
                  placeholder={placeholder}
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base leading-6 text-slate-900 outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-400)]/20 placeholder:text-slate-400"
                />
                <p className="mt-2 text-xs text-slate-500">Use the title as the headline people will scan first.</p>
              </div>

              <div>
                <label className="mb-1.5 flex items-center justify-between text-sm font-semibold text-slate-700" htmlFor="post-details">
                  <span>Details</span>
                  <span className={`text-xs font-normal ${details.length > DETAILS_MAX - 80 ? "text-rose-500" : "text-slate-400"}`}>
                    {details.length}/{DETAILS_MAX}
                  </span>
                </label>
                <textarea
                  id="post-details"
                  value={details}
                  onChange={(e) => setDetails(e.target.value.slice(0, DETAILS_MAX))}
                  rows={5}
                  placeholder={detailPlaceholder}
                  className="w-full resize-y rounded-[24px] border border-slate-200 bg-white px-4 py-3.5 text-base leading-6 text-slate-900 outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-400)]/20 placeholder:text-slate-400"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Clear details reduce back-and-forth and help the right people respond faster.
                </p>
              </div>

              {renderAttachmentSection(true)}
            </>
          ) : (
            <>
              <div className="rounded-[1.75rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(14,165,164,0.14),transparent_42%),linear-gradient(145deg,#ffffff_0%,#f8fafc_62%,#ecfeff_100%)] p-4">
                <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                  <span className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-slate-700">
                    {postType === "need" ? "Need Help" : postType === "service" ? "Service" : "Product"}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-slate-700">{category}</span>
                </div>
                <h3 className="mt-3 text-base font-semibold text-slate-900">{title.trim() || "Untitled post"}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {details.trim()
                    ? `${details.trim().slice(0, 140)}${details.trim().length > 140 ? "..." : ""}`
                    : "Add pricing, location, and media to make this post feel complete before publishing."}
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="post-price">
                  Price <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    id="post-price"
                    type="number"
                    inputMode="numeric"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Amount"
                    className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-400)]/20 placeholder:text-slate-400"
                  />
                  <div className="flex shrink-0 overflow-hidden rounded-2xl border border-slate-200">
                    {PRICE_TYPES.map((pt) => (
                      <button
                        key={pt}
                        type="button"
                        onClick={() => setPriceType(pt)}
                        className={`px-3 py-2 text-xs font-semibold transition ${
                          priceType === pt
                            ? "bg-[var(--brand-900)] text-white"
                            : "bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {pt}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500">{priceHint}</p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="post-location">
                  Location
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="post-location"
                    type="text"
                    value={location}
                    onChange={(e) => {
                      setLocation(e.target.value);
                      setGpsNotice("");
                    }}
                    placeholder="Area, neighbourhood, city"
                    className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-400)]/20 placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => void handleGps()}
                    disabled={locating}
                    className="inline-flex min-h-12 shrink-0 items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 sm:min-h-0"
                    aria-label="Detect GPS"
                  >
                    {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                    GPS
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-500">{locationHint}</p>
                {gpsNotice ? (
                  <p className="mt-2 text-xs font-medium text-[var(--brand-700)]">
                    {gpsNotice}
                  </p>
                ) : null}
                {typeof lat === "number" && typeof lng === "number" ? (
                  <p className="mt-2 text-xs font-medium text-emerald-700">
                    Precise coordinates saved:{" "}
                    {formatCoordinatePair({ latitude: lat, longitude: lng }, 4)}
                  </p>
                ) : null}
              </div>

              {renderAttachmentSection(false)}
            </>
          )}

          {/* error */}
          {error ? (
            <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</p>
          ) : null}
        </div>
      </div>

      {/* sticky post button */}
      <div className="border-t border-slate-200 bg-white px-4 pb-[env(safe-area-inset-bottom)] pt-3">
        <div className="mx-auto flex max-w-lg gap-3">
          {step === 2 ? (
            <button
              type="button"
              onClick={() => {
                setError("");
                setStep(1);
              }}
              disabled={posting}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-4 text-base font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void (step === 1 ? handleNextStep() : handlePost())}
            disabled={posting || posted}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand-900)] py-4 text-base font-bold text-white shadow-md transition hover:bg-[var(--brand-700)] disabled:opacity-60 active:scale-[0.98]"
          >
            {posting ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Posting...</>
            ) : posted ? (
              <><Check className="h-5 w-5" /> Posted!</>
            ) : (
              <>
                {primaryActionLabel}
                {step === 1 ? <ArrowRight className="h-4 w-4" /> : null}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
