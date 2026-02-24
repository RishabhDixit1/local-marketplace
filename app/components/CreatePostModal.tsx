"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Clock3,
  FileAudio2,
  FileImage,
  FileVideo2,
  MapPin,
  Paperclip,
  Tag,
  Wallet,
  X,
  Zap,
} from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  onPublished?: () => void | Promise<void>;
};

type PostType = "need" | "service" | "product";
type PostMode = "urgent" | "schedule";

type UploadedMedia = {
  name: string;
  url: string;
  type: string;
};

const defaultCategories = [
  "Electrician",
  "Plumber",
  "Cleaning",
  "Delivery",
  "Tutor",
  "Repair",
  "Grocery",
  "IT Support",
];

const urgencyWindows = [
  "Within 1 hour",
  "Today",
  "Within 24 hours",
  "This week",
  "Flexible",
];

const MAX_ATTACHMENTS = 6;
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const MEDIA_BUCKET = "post-media";

export default function CreatePostModal({
  open,
  onClose,
  onPublished,
}: Props) {
  const [type, setType] = useState<PostType>("need");
  const [mode, setMode] = useState<PostMode>("urgent");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [budget, setBudget] = useState("");
  const [category, setCategory] = useState(defaultCategories[0]);
  const [locationLabel, setLocationLabel] = useState("2.2 km | Auto-detected");
  const [neededWithin, setNeededWithin] = useState(urgencyWindows[0]);
  const [scheduleTime, setScheduleTime] = useState("10:30");
  const [scheduleDate, setScheduleDate] = useState("");
  const [flexibleTiming, setFlexibleTiming] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [publishing, setPublishing] = useState(false);

  const clearForm = () => {
    setType("need");
    setMode("urgent");
    setTitle("");
    setDetails("");
    setBudget("");
    setCategory(defaultCategories[0]);
    setLocationLabel("2.2 km | Auto-detected");
    setNeededWithin(urgencyWindows[0]);
    setScheduleDate("");
    setScheduleTime("10:30");
    setFlexibleTiming(false);
    setAttachments([]);
    setPublishing(false);
  };

  const closeModal = () => {
    clearForm();
    onClose();
  };

  const summary = useMemo(() => {
    const modeText = mode === "urgent" ? "Urgent" : "Scheduled";
    const whenText =
      mode === "urgent"
        ? neededWithin
        : scheduleDate
          ? `${scheduleDate} ${scheduleTime}`
          : "time not set";
    return `${modeText} • ${whenText} • ${locationLabel}`;
  }, [locationLabel, mode, neededWithin, scheduleDate, scheduleTime]);

  const publishLabel = useMemo(() => {
    if (type === "service") {
      return mode === "urgent"
        ? "Publish Service Offer"
        : "Schedule Service Offer";
    }
    if (type === "product") {
      return mode === "urgent"
        ? "Publish Product Listing"
        : "Schedule Product Listing";
    }
    return mode === "urgent"
      ? "Publish Urgent Request"
      : "Publish Scheduled Request";
  }, [mode, type]);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const pickAttachmentIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) {
      return <FileImage size={14} className="text-emerald-600" />;
    }
    if (mimeType.startsWith("video/")) {
      return <FileVideo2 size={14} className="text-violet-600" />;
    }
    if (mimeType.startsWith("audio/")) {
      return <FileAudio2 size={14} className="text-amber-600" />;
    }
    return <Paperclip size={14} className="text-slate-500" />;
  };

  const handleAttachmentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = "";
    if (selected.length === 0) return;

    const valid = selected.filter((file) => {
      const accepted =
        file.type.startsWith("image/") ||
        file.type.startsWith("video/") ||
        file.type.startsWith("audio/");
      if (!accepted) {
        alert(`${file.name}: only image, video, or audio files are supported.`);
        return false;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        alert(`${file.name}: file must be <= 25MB.`);
        return false;
      }
      return true;
    });

    setAttachments((current) => {
      const merged = [...current, ...valid];
      if (merged.length > MAX_ATTACHMENTS) {
        alert(`You can upload up to ${MAX_ATTACHMENTS} files per post.`);
      }
      return merged.slice(0, MAX_ATTACHMENTS);
    });
  };

  const removeAttachment = (index: number) => {
    setAttachments((current) => current.filter((_, i) => i !== index));
  };

  const uploadAttachments = async (userId: string): Promise<UploadedMedia[]> => {
    if (attachments.length === 0) return [];

    const uploaded: UploadedMedia[] = [];
    for (const file of attachments) {
      const extension = file.name.split(".").pop() || "bin";
      const fileName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const filePath = `posts/${userId}/${fileName}`;

      const { error } = await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(filePath, file, { contentType: file.type, upsert: false });

      if (error) {
        throw new Error(
          `Failed to upload "${file.name}". Ensure bucket "${MEDIA_BUCKET}" exists and policies are set.`
        );
      }

      const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(filePath);
      uploaded.push({ name: file.name, url: data.publicUrl, type: file.type });
    }
    return uploaded;
  };

  const publishPost = async () => {
    const trimmedTitle = title.trim();
    const trimmedDetails = details.trim();

    if (!trimmedTitle) {
      alert("Please add a title.");
      return;
    }

    if (!trimmedDetails) {
      alert("Please add details.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Login required");
      return;
    }

    setPublishing(true);

    let uploadedMedia: UploadedMedia[] = [];
    try {
      uploadedMedia = await uploadAttachments(user.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Media upload failed.";
      setPublishing(false);
      alert(message);
      return;
    }

    const composedText = [
      trimmedTitle,
      trimmedDetails,
      `Type: ${type}`,
      `Mode: ${mode}`,
      `Needed: ${
        mode === "urgent"
          ? neededWithin
          : scheduleDate
            ? `${scheduleDate} ${scheduleTime}`
            : "flexible"
      }`,
      budget.trim() ? `Budget: ₹${budget.trim()}` : "Budget: Not specified",
      `Category: ${category}`,
      `Location: ${locationLabel}`,
      flexibleTiming ? "Timing: Flexible" : "Timing: Fixed",
      uploadedMedia.length
        ? `Media: ${uploadedMedia
            .map((item) => `[${item.type}] ${item.url}`)
            .join(", ")}`
        : "Media: None",
    ].join(" | ");

    const payload: Record<string, string> = {
      user_id: user.id,
      created_by: user.id,
      provider_id: user.id,
      author_id: user.id,
      type,
      post_type: type,
      status: "open",
      text: composedText,
      content: composedText,
      description: composedText,
      title: trimmedTitle,
      name: trimmedTitle,
    };

    const getMissingColumn = (message: string) => {
      const match = message.match(/could not find the '([^']+)' column of 'posts'/i);
      return match?.[1] || null;
    };

    const getRequiredNullColumn = (message: string) => {
      const match = message.match(/null value in column \"([^\"]+)\"/i);
      return match?.[1] || null;
    };

    let publishError: { message: string } | null = null;

    for (let i = 0; i < 20; i += 1) {
      const result = await supabase.from("posts").insert(payload);
      if (!result.error) {
        publishError = null;
        break;
      }

      publishError = result.error;
      const missing = getMissingColumn(result.error.message);
      if (missing && payload[missing] !== undefined) {
        delete payload[missing];
        continue;
      }

      const required = getRequiredNullColumn(result.error.message);
      if (required) {
        if (["text", "content", "description", "body", "message"].includes(required)) {
          payload[required] = composedText;
          continue;
        }
        if (["title", "name", "subject"].includes(required)) {
          payload[required] = trimmedTitle;
          continue;
        }
        if (["user_id", "created_by", "provider_id", "author_id"].includes(required)) {
          payload[required] = user.id;
          continue;
        }
        if (["type", "post_type", "category"].includes(required)) {
          payload[required] = type;
          continue;
        }
        if (["status", "state"].includes(required)) {
          payload[required] = "open";
          continue;
        }
      }

      break;
    }

    setPublishing(false);

    if (publishError) {
      alert(`Failed to publish post: ${publishError.message}`);
      return;
    }

    await onPublished?.();
    alert("Post published successfully");
    closeModal();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[3000] bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl sm:rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-[0_22px_80px_rgba(15,23,42,0.28)]"
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-200">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Create Post</h2>
          <button
            onClick={closeModal}
            className="h-9 w-9 rounded-full border border-slate-300 text-slate-600 grid place-content-center hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-1 grid grid-cols-3 gap-1">
            {(["need", "service", "product"] as PostType[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setType(option)}
                className={`rounded-lg px-3 py-2.5 text-sm font-semibold capitalize transition ${
                  type === option
                    ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
                    : "text-slate-600 hover:bg-white"
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("urgent")}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 ${
                mode === "urgent"
                  ? "bg-amber-100 text-amber-700 border border-amber-300"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Zap size={16} /> Urgent
            </button>
            <button
              type="button"
              onClick={() => setMode("schedule")}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 ${
                mode === "schedule"
                  ? "bg-indigo-100 text-indigo-700 border border-indigo-300"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <CalendarDays size={16} /> Schedule for Later
            </button>
          </div>

          <p className="text-sm text-slate-600">
            {mode === "urgent"
              ? "Urgent posts are highlighted and pushed faster to nearby providers."
              : "Scheduled posts will go live at the selected date and time."}
          </p>

          <div>
            <label className="text-sm text-slate-700">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                type === "need"
                  ? "Looking for an Electrician"
                  : type === "service"
                    ? "I offer AC repair"
                    : "Selling cordless drill"
              }
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label className="text-sm text-slate-700">Details</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Describe what you need or offer..."
              rows={4}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label className="text-sm text-slate-700">Attachments (image/video/audio)</label>
            <label className="mt-1.5 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700 hover:border-indigo-400 hover:text-indigo-600 transition-colors">
              <Paperclip size={16} />
              Add files
              <input
                type="file"
                multiple
                accept="image/*,video/*,audio/*"
                onChange={handleAttachmentChange}
                className="hidden"
              />
            </label>
            {attachments.length > 0 && (
              <div className="mt-2 space-y-2">
                {attachments.map((file, index) => (
                  <div
                    key={`${file.name}-${file.size}-${index}`}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {pickAttachmentIcon(file.type)}
                      <span className="truncate text-slate-700">{file.name}</span>
                      <span className="text-xs text-slate-400">{formatBytes(file.size)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="rounded-md px-2 py-1 text-xs text-rose-600 hover:bg-rose-100"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-700">Needed Within</label>
              <div className="mt-1.5 relative">
                <Clock3 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={neededWithin}
                  onChange={(e) => setNeededWithin(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-9 pr-3 text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  {urgencyWindows.map((window) => (
                    <option key={window} value={window}>
                      {window}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm text-slate-700">Budget</label>
              <div className="mt-1.5 relative">
                <Wallet size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="Enter budget"
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-9 pr-3 text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>
          </div>

          {mode === "schedule" && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-slate-700">Date</label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div>
                <label className="text-sm text-slate-700">Time</label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-700">Category</label>
              <div className="mt-1.5 relative">
                <Tag size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-9 pr-3 text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  {defaultCategories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-700">Location</label>
              <div className="mt-1.5 relative">
                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={locationLabel}
                  onChange={(e) => setLocationLabel(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-9 pr-3 text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={flexibleTiming}
              onChange={() => setFlexibleTiming((value) => !value)}
            />
            Flexible timing
          </label>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {summary}
          </div>

          <button
            onClick={publishPost}
            disabled={publishing}
            className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-pink-600 py-3 font-semibold hover:brightness-110 disabled:opacity-60"
          >
            {publishing ? "Publishing..." : publishLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
