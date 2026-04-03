"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, Loader2, MapPin, X } from "lucide-react";
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
};

export type PublishPostResult = {
  postType: PostType;
  helpRequestId?: string;
  matchedCount?: number;
};

// 
// Static data
// 

const MEDIA_BUCKET = "post-media";
const TITLE_MAX = 160;
const DETAILS_MAX = 1200;
const MAX_PHOTOS = 4;
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

// 
// Helpers
// 

const uploadPhotos = async (userId: string, photos: File[]) => {
  const uploaded: { name: string; url: string; type: string }[] = [];
  for (const file of photos) {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `posts/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw new Error(`Photo upload failed: ${file.name}`);
    const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
    uploaded.push({ name: file.name, url: data.publicUrl, type: file.type });
  }
  return uploaded;
};

const getGpsLocation = (): Promise<{ latitude: number; longitude: number } | null> =>
  new Promise((resolve) => {
    if (!navigator?.geolocation) return resolve(null);
    const t = window.setTimeout(() => resolve(null), 3000);
    navigator.geolocation.getCurrentPosition(
      (pos) => { clearTimeout(t); resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }); },
      () => { clearTimeout(t); resolve(null); },
      { enableHighAccuracy: false, timeout: 2800 }
    );
  });

// 
// Component
// 

export default function CreatePostModal({ open, onClose, onPublished }: Props) {
  // form state
  const [postType, setPostType] = useState<PostType>("need");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [category, setCategory] = useState("Plumber");
  const [price, setPrice] = useState("");
  const [priceType, setPriceType] = useState<PriceType>("Fixed");
  const [location, setLocation] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  // ui state
  const [posting, setPosting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [posted, setPosted] = useState(false);
  const [error, setError] = useState("");

  const photoInputRef = useRef<HTMLInputElement>(null);

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
      setTitle("");
      setDetails("");
      setCategory("Plumber");
      setPrice("");
      setPriceType("Fixed");
      setPhotos([]);
      setPhotoPreviews([]);
      setPosting(false);
      setPosted(false);
      setError("");
    }
  }, [open]);

  useEffect(() => {
    const nextPreviews = photos.map((file) => URL.createObjectURL(file));
    setPhotoPreviews(nextPreviews);

    return () => {
      nextPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photos]);

  if (!open) return null;

  //  GPS 
  const handleGps = async () => {
    setLocating(true);
    setError("");
    const coords = await getGpsLocation();
    if (coords) {
      setLat(coords.latitude);
      setLng(coords.longitude);
      setLocation(`${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
    } else {
      setError("Could not get GPS. Type your area manually.");
    }
    setLocating(false);
  };

  //  photos 
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    const valid = files.filter((f) => f.type.startsWith("image/") && f.size <= MAX_FILE_SIZE);
    const next = [...photos, ...valid].slice(0, MAX_PHOTOS);
    setPhotos(next);
  };

  const removePhoto = (index: number) => {
    const next = photos.filter((_, i) => i !== index);
    setPhotos(next);
  };

  //  submit 
  const handlePost = async () => {
    if (!title.trim()) { setError("Please add a title."); return; }
    if (!location.trim()) { setError("Please add your location."); return; }

    setPosting(true);
    setError("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      const token = session?.access_token;
      if (!user || !token) throw new Error("Please sign in again.");

      const media = await uploadPhotos(user.id, photos);
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
        const coords = lat && lng ? { latitude: lat, longitude: lng } : await getGpsLocation();
        const response = await fetch("/api/needs/publish", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            ...base,
            postType: "need",
            latitude: coords?.latitude ?? null,
            longitude: coords?.longitude ?? null,
          } satisfies PublishNeedRequest),
        });
        const payload = (await response.json().catch(() => null)) as PublishNeedResponse | null;
        if (!response.ok || !payload?.ok) throw new Error("message" in (payload ?? {}) ? (payload as { message: string }).message : "Failed to post.");
        result = { postType, helpRequestId: (payload as { helpRequestId?: string }).helpRequestId, matchedCount: Number((payload as { matchedCount?: number }).matchedCount || 0) };
      } else {
        const response = await fetch("/api/posts/publish", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ ...base, postType } satisfies PublishPostRequest),
        });
        const payload = (await response.json().catch(() => null)) as PublishPostResponse | null;
        if (!response.ok || !payload?.ok) throw new Error("message" in (payload ?? {}) ? (payload as { message: string }).message : "Failed to post.");
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

  return (
    <div className="fixed inset-0 z-[3000] flex flex-col bg-white">
      {/* header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-lg font-bold text-slate-900">Post</h2>
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

      {/* scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4">
        <div className="mx-auto max-w-lg space-y-5">

          {/* 1. Post type */}
          <div className="grid grid-cols-3 gap-2">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPostType(opt.value)}
                className={`flex flex-col items-center gap-1 rounded-2xl border py-3 text-sm font-semibold transition ${
                  postType === opt.value
                    ? "border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)]"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <span className="text-xl leading-none">{opt.emoji}</span>
                {opt.label}
              </button>
            ))}
          </div>

          {/* 2. Category */}
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

          {/* 3. Title */}
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
            <p className="mt-2 text-xs text-slate-500">Use the title for the headline. Add the full job or listing context below.</p>
          </div>

          {/* 4. Details */}
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
          </div>

          {/* 5. Price */}
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
                placeholder=" Amount"
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
          </div>

          {/* 6. Location */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="post-location">
              Location
            </label>
            <div className="flex gap-2">
              <input
                id="post-location"
                type="text"
                value={location}
                onChange={(e) => { setLocation(e.target.value); setLat(null); setLng(null); }}
                placeholder="Area, neighbourhood, city"
                className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-400)]/20 placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => void handleGps()}
                disabled={locating}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                aria-label="Detect GPS"
              >
                {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                GPS
              </button>
            </div>
          </div>

          {/* 7. Photos */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Photos <span className="font-normal text-slate-400">(optional, up to {MAX_PHOTOS})</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {photoPreviews.map((src, i) => (
                <div key={src} className="relative h-20 w-20 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Photo ${i + 1}`} className="h-20 w-20 rounded-2xl object-cover ring-1 ring-slate-200" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white shadow"
                    aria-label={`Remove photo ${i + 1}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 transition hover:border-slate-400 hover:bg-white"
                  aria-label="Add photo"
                >
                  <Camera className="h-5 w-5" />
                  <span className="text-[10px] font-semibold">Add</span>
                </button>
              )}
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={handlePhotoChange}
              aria-label="Upload photos"
            />
          </div>

          {/* error */}
          {error ? (
            <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</p>
          ) : null}
        </div>
      </div>

      {/* sticky post button */}
      <div className="border-t border-slate-200 bg-white px-4 pb-[env(safe-area-inset-bottom)] pt-3">
        <div className="mx-auto max-w-lg">
          <button
            type="button"
            onClick={() => void handlePost()}
            disabled={posting || posted}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand-900)] py-4 text-base font-bold text-white shadow-md transition hover:bg-[var(--brand-700)] disabled:opacity-60 active:scale-[0.98]"
          >
            {posting ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Posting...</>
            ) : posted ? (
              <><Check className="h-5 w-5" /> Posted!</>
            ) : (
              postType === "need" ? " Post Request" : postType === "service" ? " Post Service" : " List Product"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
