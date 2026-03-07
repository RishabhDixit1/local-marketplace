"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import {
  Clock3,
  Mic,
  FileAudio2,
  FileImage,
  FileVideo2,
  Paperclip,
  Square,
  Wallet,
  X,
} from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  onPublished?: (result?: PublishPostResult) => void | Promise<void>;
};

type PostType = "need" | "service" | "product";
type PostMode = "urgent" | "schedule";

export type PublishPostResult = {
  postType: PostType;
  helpRequestId?: string;
  matchedCount?: number;
};

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
const SCHEDULE_TIMING_VALUE = "__schedule__";

const MAX_ATTACHMENTS = 6;
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const MEDIA_BUCKET = "post-media";
const POST_DEDUP_STORAGE_KEY = "local-marketplace-last-post-signature-v1";
const POST_DEDUP_WINDOW_MS = 90 * 1000;

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

export default function CreatePostModal({
  open,
  onClose,
  onPublished,
}: Props) {
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceRecorderStreamRef = useRef<MediaStream | null>(null);
  const [type, setType] = useState<PostType>("need");
  const [mode, setMode] = useState<PostMode>("urgent");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [budget, setBudget] = useState("");
  const [category, setCategory] = useState(defaultCategories[0]);
  const [locationLabel, setLocationLabel] = useState("2.2 km | Auto-detected");
  const [radiusKm, setRadiusKm] = useState<number>(8);
  const [neededWithin, setNeededWithin] = useState(urgencyWindows[0]);
  const [scheduleTime, setScheduleTime] = useState("10:30");
  const [scheduleDate, setScheduleDate] = useState("");
  const [flexibleTiming, setFlexibleTiming] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const resetVoiceRecorder = () => {
    const recorder = voiceRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch {
        // No-op: recorder may already be stopping.
      }
    }

    const activeStream = voiceRecorderStreamRef.current;
    if (activeStream) {
      activeStream.getTracks().forEach((track) => track.stop());
    }

    voiceRecorderRef.current = null;
    voiceRecorderStreamRef.current = null;
    setRecordingVoice(false);
  };

  const clearForm = () => {
    resetVoiceRecorder();
    setType("need");
    setMode("urgent");
    setTitle("");
    setDetails("");
    setBudget("");
    setCategory(defaultCategories[0]);
    setLocationLabel("2.2 km | Auto-detected");
    setRadiusKm(8);
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

  const timingValue = mode === "schedule" ? SCHEDULE_TIMING_VALUE : neededWithin;

  const handleTimingChange = (value: string) => {
    if (value === SCHEDULE_TIMING_VALUE) {
      setMode("schedule");
      return;
    }

    setMode("urgent");
    setNeededWithin(value);
  };

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

  const appendAttachments = (selected: File[]) => {
    if (selected.length === 0) return;

    const valid = selected.filter((file) => {
      const accepted =
        file.type.startsWith("image/") ||
        file.type.startsWith("video/") ||
        file.type.startsWith("audio/");
      if (!accepted) {
        alert(`${file.name}: only media files are supported (image/video/audio/voice).`);
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

  const handleAttachmentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = "";
    appendAttachments(selected);
  };

  const startVoiceRecording = async () => {
    if (recordingVoice || publishing) return;
    if (attachments.length >= MAX_ATTACHMENTS) {
      alert(`You can upload up to ${MAX_ATTACHMENTS} files per post.`);
      return;
    }
    if (typeof window === "undefined" || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      alert("Voice recording is not supported in this browser.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      alert("Voice recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMimeTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
      const selectedMimeType = preferredMimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
      const recorder = selectedMimeType ? new MediaRecorder(stream, { mimeType: selectedMimeType }) : new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        const extension = recorder.mimeType.includes("mp4")
          ? "m4a"
          : recorder.mimeType.includes("ogg")
            ? "ogg"
            : "webm";
        if (blob.size > 0) {
          const voiceFile = new File([blob], `voice-note-${Date.now()}.${extension}`, {
            type: blob.type || "audio/webm",
          });
          appendAttachments([voiceFile]);
        }
        stream.getTracks().forEach((track) => track.stop());
        voiceRecorderRef.current = null;
        voiceRecorderStreamRef.current = null;
        setRecordingVoice(false);
      };

      recorder.onerror = () => {
        stream.getTracks().forEach((track) => track.stop());
        voiceRecorderRef.current = null;
        voiceRecorderStreamRef.current = null;
        setRecordingVoice(false);
        alert("Could not record voice note. Please try again.");
      };

      voiceRecorderRef.current = recorder;
      voiceRecorderStreamRef.current = stream;
      setRecordingVoice(true);
      recorder.start();
    } catch {
      alert("Microphone access denied. Enable mic permission to record a voice note.");
    }
  };

  const stopVoiceRecording = () => {
    const recorder = voiceRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    recorder.stop();
  };

  useEffect(() => {
    return () => {
      resetVoiceRecorder();
    };
  }, []);

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

  const mapUrgencyWindow = (value: string): "urgent" | "today" | "24h" | "week" | "flexible" => {
    if (value === "Within 1 hour") return "urgent";
    if (value === "Today") return "today";
    if (value === "Within 24 hours") return "24h";
    if (value === "This week") return "week";
    return "flexible";
  };

  const getStorageTypeVariants = (postType: PostType): string[] => {
    if (postType === "need") {
      return ["need", "demand"];
    }
    return [postType];
  };

  const resolveRequestCoordinates = async (
    userId: string
  ): Promise<{ latitude: number; longitude: number } | null> => {
    const browserCoordinates = await new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
      if (typeof window === "undefined" || !("geolocation" in navigator)) {
        resolve(null);
        return;
      }

      const timeout = window.setTimeout(() => resolve(null), 2800);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          window.clearTimeout(timeout);
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        () => {
          window.clearTimeout(timeout);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 2500, maximumAge: 60000 }
      );
    });

    if (browserCoordinates) return browserCoordinates;

    const { data: profile } = await supabase
      .from("profiles")
      .select("latitude,longitude")
      .eq("id", userId)
      .maybeSingle();

    const latitude =
      profile && typeof profile === "object" && Number.isFinite(Number((profile as Record<string, unknown>).latitude))
        ? Number((profile as Record<string, unknown>).latitude)
        : Number.NaN;
    const longitude =
      profile && typeof profile === "object" && Number.isFinite(Number((profile as Record<string, unknown>).longitude))
        ? Number((profile as Record<string, unknown>).longitude)
        : Number.NaN;

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }

    return null;
  };

  const publishPost = async () => {
    const trimmedTitle = title.trim();
    const trimmedDetails = details.trim();

    if (!trimmedTitle) {
      alert("Please add a title.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Login required");
      return;
    }

    const postSignature = buildPostSignature({
      userId: user.id,
      type,
      mode,
      title: trimmedTitle,
      details: trimmedDetails,
      category,
      budget,
      locationLabel,
      radiusKm,
      neededWithin,
      scheduleDate,
      scheduleTime,
    });

    if (typeof window !== "undefined") {
      try {
        const previous = window.localStorage.getItem(POST_DEDUP_STORAGE_KEY);
        if (previous) {
          const parsed = JSON.parse(previous) as { signature?: string; createdAt?: number };
          if (
            parsed.signature === postSignature &&
            Number.isFinite(parsed.createdAt) &&
            Date.now() - Number(parsed.createdAt) < POST_DEDUP_WINDOW_MS
          ) {
            alert("This looks like a duplicate post from just now. Wait a bit before posting the same request again.");
            return;
          }
        }
      } catch {
        window.localStorage.removeItem(POST_DEDUP_STORAGE_KEY);
      }
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
      trimmedDetails || "No additional details",
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

    const storageTypeVariants = getStorageTypeVariants(type);
    let activeStorageTypeIndex = 0;

    const payload: Record<string, string> = {
      user_id: user.id,
      created_by: user.id,
      requester_id: user.id,
      owner_id: user.id,
      type: storageTypeVariants[activeStorageTypeIndex],
      post_type: storageTypeVariants[activeStorageTypeIndex],
      status: "open",
      state: "open",
      category,
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

    const getForeignKeyColumn = (message: string, details?: string | null) => {
      const detailMatch = details?.match(/Key \(([^)]+)\)=\([^)]+\) is not present in table/i);
      if (detailMatch?.[1]) {
        return detailMatch[1];
      }
      const constraintName = message.match(/constraint\s+\"([^\"]+_fkey)\"/i)?.[1]?.toLowerCase() || "";
      if (!constraintName) return null;

      const knownForeignKeyColumns = [
        "author_id",
        "created_by",
        "provider_id",
        "requester_id",
        "owner_id",
        "user_id",
      ];

      for (const columnName of knownForeignKeyColumns) {
        if (constraintName.includes(`_${columnName}_fkey`)) {
          return columnName;
        }
      }

      const genericMatch = constraintName.match(/^[a-z0-9]+_(.+)_fkey$/i);
      return genericMatch?.[1] || null;
    };

    const getForeignKeyTargetTable = (details?: string | null) => {
      const match = details?.match(/is not present in table \"([^\"]+)\"/i);
      return match?.[1] || null;
    };

    const isRowLevelSecurityError = (error: { message: string; code?: string | null }) =>
      error.code === "42501" || /row-level security policy/i.test(error.message);

    const ensureAuthorReference = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.id) {
        return profile.id as string;
      }

      const fallbackName =
        (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()) ||
        (typeof user.user_metadata?.name === "string" && user.user_metadata.name.trim()) ||
        user.email?.split("@")[0] ||
        "Local User";

      const profilePayloads: Record<string, unknown>[] = [
        {
          id: user.id,
          name: fallbackName,
          location: "Not set",
          bio: "Joined local marketplace",
          role: "seeker",
          services: [],
          availability: "available",
          email: user.email || null,
        },
        {
          id: user.id,
          name: fallbackName,
          email: user.email || null,
        },
        { id: user.id },
      ];

      for (const profilePayload of profilePayloads) {
        const { error } = await supabase
          .from("profiles")
          .upsert(profilePayload, { onConflict: "id" });

        if (!error) {
          return user.id;
        }
      }

      return null;
    };

    let publishError: { message: string } | null = null;
    const blockedColumns = new Set<string>();

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
        blockedColumns.add(missing);
        continue;
      }

      const required = getRequiredNullColumn(result.error.message);
      if (required && !blockedColumns.has(required)) {
        if (["text", "content", "description", "body", "message"].includes(required)) {
          payload[required] = composedText;
          continue;
        }
        if (["title", "name", "subject"].includes(required)) {
          payload[required] = trimmedTitle;
          continue;
        }
        if (["user_id", "created_by", "provider_id", "author_id", "requester_id", "owner_id"].includes(required)) {
          payload[required] = user.id;
          continue;
        }
        if (["type", "post_type"].includes(required)) {
          payload[required] = storageTypeVariants[activeStorageTypeIndex];
          continue;
        }
        if (required === "category") {
          payload[required] = category;
          continue;
        }
        if (["status", "state"].includes(required)) {
          payload[required] = "open";
          continue;
        }
      }

      const foreignKeyColumn = getForeignKeyColumn(
        result.error.message,
        "details" in result.error ? result.error.details : null
      );
      if (foreignKeyColumn && payload[foreignKeyColumn] !== undefined) {
        const foreignKeyTargetTable = getForeignKeyTargetTable(
          "details" in result.error ? result.error.details : null
        );

        if (
          foreignKeyColumn === "author_id" &&
          (foreignKeyTargetTable === "profiles" || !foreignKeyTargetTable)
        ) {
          const ensuredAuthorId = await ensureAuthorReference();
          if (ensuredAuthorId) {
            payload[foreignKeyColumn] = ensuredAuthorId;
            continue;
          }
        }

        if (["author_id", "provider_id", "created_by", "requester_id", "owner_id"].includes(foreignKeyColumn)) {
          delete payload[foreignKeyColumn];
          blockedColumns.add(foreignKeyColumn);
          continue;
        }
      }

      if (isRowLevelSecurityError(result.error)) {
        if (activeStorageTypeIndex < storageTypeVariants.length - 1) {
          activeStorageTypeIndex += 1;
          const nextStorageType = storageTypeVariants[activeStorageTypeIndex];
          payload.type = nextStorageType;
          payload.post_type = nextStorageType;
          continue;
        }

        let ownershipChanged = false;
        for (const ownerColumn of ["user_id", "created_by", "author_id", "requester_id", "owner_id"]) {
          if (blockedColumns.has(ownerColumn)) continue;
          if (payload[ownerColumn] !== user.id) {
            payload[ownerColumn] = user.id;
            ownershipChanged = true;
          }
        }
        if (ownershipChanged) {
          continue;
        }
      }

      break;
    }

    const postCreated = !publishError;
    if (publishError && type !== "need") {
      setPublishing(false);
      const message = isRowLevelSecurityError(publishError)
        ? `${publishError.message}. Check posts INSERT policy to allow authenticated users with their own owner-id columns.`
        : publishError.message;
      alert(`Failed to publish post: ${message}`);
      return;
    }

    const postPublishWarning =
      publishError && type === "need"
        ? "Post table permissions blocked direct insert. Published via structured request fallback."
        : "";
    if (postPublishWarning) {
      console.warn(postPublishWarning, publishError?.message || "");
    }

    let helpRequestId: string | undefined;
    let matchedCount: number | undefined;
    let helpRequestCreated = false;
    let helpRequestPublishError: { message: string; code?: string | null } | null = null;

    if (type === "need") {
      const numericBudget = Number((budget || "").replace(/[^\d.]/g, ""));
      const requestCoordinates = await resolveRequestCoordinates(user.id);
      const scheduledDateTime =
        mode === "schedule" && scheduleDate
          ? new Date(`${scheduleDate}T${scheduleTime || "00:00"}`)
          : null;

      const { data: insertedHelpRequest, error: helpRequestError } = await supabase
        .from("help_requests")
        .insert({
          requester_id: user.id,
          title: trimmedTitle,
          details: trimmedDetails,
          category,
          urgency: mode === "urgent" ? mapUrgencyWindow(neededWithin) : "flexible",
          needed_by:
            scheduledDateTime && Number.isFinite(scheduledDateTime.getTime())
              ? scheduledDateTime.toISOString()
              : null,
          budget_min: Number.isFinite(numericBudget) && numericBudget > 0 ? numericBudget : null,
          budget_max: Number.isFinite(numericBudget) && numericBudget > 0 ? numericBudget : null,
          location_label: locationLabel,
          latitude: requestCoordinates?.latitude || null,
          longitude: requestCoordinates?.longitude || null,
          radius_km: radiusKm,
          metadata: {
            source: "create_post_modal",
            mode,
            needed_within: neededWithin,
            flexible_timing: flexibleTiming,
            attachment_count: uploadedMedia.length,
          },
        })
        .select("id,matched_count")
        .single();

      if (helpRequestError) {
        helpRequestPublishError = helpRequestError;
        const missingTable =
          /relation .*help_requests.* does not exist|could not find the 'help_requests' table/i.test(
            helpRequestError.message
          ) || /could not find the table 'public\.help_requests' in the schema cache/i.test(helpRequestError.message);
        if (missingTable) {
          alert(
            'Post published, but structured matching is disabled. Run "supabase/secure_realtime_rls.sql" to enable help requests.'
          );
        } else {
          console.warn("Could not create help request:", helpRequestError.message);
        }
      } else if (insertedHelpRequest?.id) {
        helpRequestId = insertedHelpRequest.id as string;
        matchedCount = Number(insertedHelpRequest.matched_count || 0);
        helpRequestCreated = true;

        const { data: matchResult, error: matchError } = await supabase.rpc("match_help_request", {
          target_help_request_id: helpRequestId,
        });

        if (!matchError) {
          if (typeof matchResult === "number") {
            matchedCount = Number(matchResult);
          } else if (Array.isArray(matchResult) && typeof matchResult[0] === "number") {
            matchedCount = Number(matchResult[0]);
          }
        }
      }
    }

    if (type === "need" && !postCreated && !helpRequestCreated) {
      setPublishing(false);
      const postFailureMessage = publishError?.message || "unknown post insert error";
      const helpRequestFailureMessage = helpRequestPublishError?.message || "unknown help request insert error";
      const blockedByRls =
        !!publishError &&
        !!helpRequestPublishError &&
        isRowLevelSecurityError(publishError) &&
        isRowLevelSecurityError(helpRequestPublishError);

      if (blockedByRls) {
        alert(
          `Failed to publish request due to database RLS policies. Run "supabase/fix_hosted_auth_and_posting.sql" in Supabase SQL Editor, then retry.\n\nposts: ${postFailureMessage}\nhelp_requests: ${helpRequestFailureMessage}`
        );
      } else {
        alert(
          `Failed to publish request.\n\nposts: ${postFailureMessage}\nhelp_requests: ${helpRequestFailureMessage}`
        );
      }
      return;
    }

    setPublishing(false);

    await onPublished?.({
      postType: type,
      helpRequestId,
      matchedCount,
    });

    if (type === "need" && helpRequestId) {
      const baseMessage =
        matchedCount && matchedCount > 0
          ? `Help request published. ${matchedCount} provider matches are ready.`
          : "Help request published. Matching is in progress.";
      alert(postPublishWarning ? `${baseMessage} (${postPublishWarning})` : baseMessage);
    } else {
      alert("Post published successfully");
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        POST_DEDUP_STORAGE_KEY,
        JSON.stringify({
          signature: postSignature,
          createdAt: Date.now(),
        })
      );
    }

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
          <p className="text-sm text-slate-600">
            Tell us what you need in one quick form. Nearby providers can respond fast.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm text-slate-700">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                {defaultCategories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-slate-700">When do you need this?</label>
              <div className="mt-1.5 relative">
                <Clock3 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={timingValue}
                  onChange={(e) => handleTimingChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-9 pr-3 text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  {urgencyWindows.map((window) => (
                    <option key={window} value={window}>
                      {window}
                    </option>
                  ))}
                  <option value={SCHEDULE_TIMING_VALUE}>Schedule for later</option>
                </select>
              </div>
            </div>
          </div>

          {mode === "schedule" && (
            <div className="grid gap-3 sm:grid-cols-2">
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

          <div>
            <label className="text-sm text-slate-700">What do you need?</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Looking for an Electrician"
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label className="text-sm text-slate-700">Details (optional)</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Add a short detail so providers can respond clearly."
              rows={4}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm text-slate-700">Budget (optional)</label>
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

            <div>
              <label className="text-sm text-slate-700">Media (optional)</label>
              <div className="mt-1.5 flex gap-2">
                <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition-colors hover:border-indigo-400 hover:text-indigo-600">
                  <Paperclip size={16} />
                  Add media
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*,audio/*"
                    onChange={handleAttachmentChange}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={recordingVoice ? stopVoiceRecording : startVoiceRecording}
                  disabled={publishing}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
                    recordingVoice
                      ? "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
                      : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-600"
                  }`}
                >
                  {recordingVoice ? <Square size={14} /> : <Mic size={14} />}
                  {recordingVoice ? "Stop" : "Voice"}
                </button>
              </div>
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
