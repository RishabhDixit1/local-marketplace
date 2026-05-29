import { Loader2, Wifi, WifiOff } from "lucide-react";
import type { TaskBoardStatusTabValue } from "@/app/dashboard/tasks/components/TaskBoardComponents";
import { createAvatarFallback } from "@/lib/avatarFallback";
import { resolveProfileAvatarUrl } from "@/lib/mediaUrl";
import { supabase } from "@/lib/supabase";
import {
  fallbackAvatar,
  getPreferredProfileName,
  normalizeTaskStatus,
  timelineFromStatus,
  type ProfileRow,
  type Task,
  type TaskEventTone,
} from "@/lib/taskOperations";
import {
  type CanonicalOrderStatus,
  normalizeOrderStatus,
} from "@/lib/orderWorkflow";
import {
  canCancelTrackedTaskAtStage,
  normalizeHelpRequestProgressStage,
  type HelpRequestProgressStage,
} from "@/lib/helpRequestProgress";

export type RealtimeState = "connecting" | "live" | "offline";
export type TaskSortOption = "updated" | "newest" | "oldest";
export type TaskViewTab = TaskBoardStatusTabValue;

export type InboxHelpRequest = {
  id: string;
  title: string | null;
  category: string | null;
  budget_min: number | null;
  budget_max: number | null;
  location_label: string | null;
  status: string | null;
  requester_id: string | null;
  created_at: string | null;
};

export type InboxMatchItem = {
  id: string;
  help_request_id: string;
  score: number | null;
  distance_km: number | null;
  reason: string | null;
  status: string;
  created_at: string | null;
  help_requests: InboxHelpRequest;
};

export type OperationalTask = Task & { source: "order" | "help_request"; helpRequestId: string | null };

export type HelpRequestRow = {
  id: string;
  requester_id: string | null;
  accepted_provider_id: string | null;
  title: string | null;
  details: string | null;
  category: string | null;
  budget_min: number | null;
  budget_max: number | null;
  location_label: string | null;
  status: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
};

export type SupportRequestRow = {
  id: string;
  help_request_id: string | null;
  requester_id: string | null;
  channel: string | null;
  target: string | null;
  status: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

export type SupportRequest = {
  id: string;
  taskId: string | null;
  helpRequestId: string | null;
  status: string;
  target: string;
  createdAtRaw: string | null;
  updatedAtRaw: string | null;
};

export type TaskNotice = {
  kind: "success" | "info";
  message: string;
} | null;

export type TaskReviewDraft = {
  rating: number;
  comment: string;
  submitted: boolean;
};

export const stageOrder: TaskStatus[] = ["active", "in-progress", "completed", "cancelled"];

export const getStatusAccentClass = (status: TaskStatus) => {
  if (status === "active") return "from-sky-500 to-blue-600";
  if (status === "in-progress") return "from-violet-500 to-indigo-600";
  if (status === "completed") return "from-emerald-500 to-green-600";
  return "from-rose-500 to-red-600";
};

export const getToneClassNames = (tone: TaskEventTone) => {
  if (tone === "sky") {
    return { dot: "bg-sky-500", pill: "bg-sky-100 text-sky-700", card: "border-sky-200 bg-sky-50/70" };
  }
  if (tone === "amber") {
    return { dot: "bg-amber-500", pill: "bg-amber-100 text-amber-700", card: "border-amber-200 bg-amber-50/70" };
  }
  if (tone === "violet") {
    return { dot: "bg-violet-500", pill: "bg-violet-100 text-violet-700", card: "border-violet-200 bg-violet-50/70" };
  }
  if (tone === "emerald") {
    return { dot: "bg-emerald-500", pill: "bg-emerald-100 text-emerald-700", card: "border-emerald-200 bg-emerald-50/70" };
  }
  if (tone === "rose") {
    return { dot: "bg-rose-500", pill: "bg-rose-100 text-rose-700", card: "border-rose-200 bg-rose-50/70" };
  }
  return { dot: "bg-slate-500", pill: "bg-slate-100 text-slate-700", card: "border-slate-200 bg-slate-50/80" };
};

export const getTaskCreatorName = (task: Task) =>
  !isTaskPersonPlaceholder(task.postedBy.name) ? task.postedBy.name : "Local Member";

export const getTaskCreatorAvatar = (task: Task) => task.postedBy.image || fallbackAvatar;

export const getTaskCreatorSummary = (task: Task) =>
  task.type === "posted" ? "Created by you" : "Accepted by you";

export const isTaskPersonPlaceholder = (value: string | null | undefined) =>
  !value ||
  ["you", "provider", "requester", "customer", "user", "member", "serviq member", "local member"].includes(
    value.trim().toLowerCase(),
  );

export const realtimeStateMeta: Record<
  RealtimeState,
  { label: string; className: string; icon: typeof Loader2 | typeof Wifi | typeof WifiOff }
> = {
  connecting: {
    label: "Connecting",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    icon: Loader2,
  },
  live: {
    label: "Realtime Live",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: Wifi,
  },
  offline: {
    label: "Offline",
    className: "border-rose-200 bg-rose-50 text-rose-700",
    icon: WifiOff,
  },
};

export const isMissingSupabaseRelation = (message: string) =>
  /does not exist|schema cache|could not find the table/i.test(message);

export const isMissingColumnError = (message: string, column: string) =>
  new RegExp(`column\\s+[^\\s]+\\.${column}\\s+does not exist`, "i").test(message);

export const isSupportOpen = (status: string) => ["pending", "sent"].includes(status);

export const formatTaskBudget = (min: number | null, max: number | null) => {
  const top = Number.isFinite(Number(max)) && Number(max) > 0 ? Number(max) : null;
  const base = Number.isFinite(Number(min)) && Number(min) > 0 ? Number(min) : null;
  const value = top ?? base;
  return value ? `INR ${value.toLocaleString("en-IN")}` : "Price on request";
};

export const buildTaskAvatar = (
  profile: ProfileRow | null | undefined,
  fallbackLabel: string,
  seed: string,
) =>
  resolveProfileAvatarUrl(profile?.avatar_url) ||
  createAvatarFallback({ label: getPreferredProfileName(profile, fallbackLabel), seed });

export const mapHelpRequestToTask = (params: {
  request: HelpRequestRow;
  currentUserId: string;
  profileMap: Map<string, ProfileRow>;
}): OperationalTask => {
  const { request, currentUserId, profileMap } = params;
  const requesterProfile = request.requester_id ? profileMap.get(request.requester_id) : null;
  const providerProfile = request.accepted_provider_id ? profileMap.get(request.accepted_provider_id) : null;
  const currentUserProfile = profileMap.get(currentUserId);
  const currentUserName = getPreferredProfileName(currentUserProfile, "Local Member");
  const isPostedByMe = request.requester_id === currentUserId;
  const counterpartyId = isPostedByMe ? request.accepted_provider_id : request.requester_id;
  const metadata =
    request.metadata && typeof request.metadata === "object" && !Array.isArray(request.metadata)
      ? request.metadata
      : null;
  const progressStage = normalizeHelpRequestProgressStage(metadata?.progress_stage, request.status);

  return {
    id: request.id,
    orderId: request.id,
    source: "help_request",
    helpRequestId: request.id,
    title: request.title?.trim() || request.category?.trim() || "Service request",
    description: request.details?.trim() || "Live request posted on ServiQ.",
    type: isPostedByMe ? "posted" : "accepted",
    status:
      (request.status || "").toLowerCase() === "accepted"
        ? "in-progress"
        : normalizeTaskStatus(request.status),
    rawStatus: request.status || "open",
    budget: formatTaskBudget(request.budget_min, request.budget_max),
    timeline: timelineFromStatus(request.status),
    location:
      request.location_label?.trim() ||
      requesterProfile?.location ||
      providerProfile?.location ||
      "Nearby",
    postedBy: {
      id: request.requester_id || "unknown-requester",
      name: isPostedByMe ? currentUserName : getPreferredProfileName(requesterProfile, "Local Member"),
      image: isPostedByMe
        ? buildTaskAvatar(profileMap.get(currentUserId), "You", currentUserId)
        : buildTaskAvatar(requesterProfile, "Local Member", request.requester_id || request.id),
    },
    assignedTo: request.accepted_provider_id
      ? {
          id: request.accepted_provider_id,
          name: !isPostedByMe ? currentUserName : getPreferredProfileName(providerProfile, "Local Member"),
          image: !isPostedByMe
            ? buildTaskAvatar(profileMap.get(currentUserId), "You", currentUserId)
            : buildTaskAvatar(providerProfile, "Local Member", request.accepted_provider_id),
        }
      : undefined,
    tags: [
      request.category?.trim() || "Request",
      "Demand",
      request.accepted_provider_id ? "Accepted" : "Awaiting provider",
    ],
    listingType: "demand",
    counterpartyId,
    amount:
      Number.isFinite(Number(request.budget_max)) && Number(request.budget_max) > 0
        ? Number(request.budget_max)
        : Number.isFinite(Number(request.budget_min)) && Number(request.budget_min) > 0
          ? Number(request.budget_min)
          : null,
    createdAtRaw: request.created_at,
    progressStage,
  };
};

export const pickSupportTaskId = (row: SupportRequestRow) => {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : null;
  const orderId = typeof metadata?.order_id === "string" ? metadata.order_id.trim() : "";
  if (orderId) return orderId;
  return row.help_request_id?.trim() || null;
};

export const mapSupportRequest = (row: SupportRequestRow): SupportRequest => ({
  id: row.id,
  taskId: pickSupportTaskId(row),
  helpRequestId: row.help_request_id,
  status: (row.status || "pending").toLowerCase(),
  target: row.target || "serviq-support",
  createdAtRaw: row.created_at,
  updatedAtRaw: row.updated_at,
});

export const loadTaskProfiles = async (profileIds: string[]) => {
  if (!profileIds.length) {
    return { data: [] as ProfileRow[], error: null };
  }
  const nextSchemaResult = await supabase
    .from("profiles")
    .select("id,full_name,display_name,name,metadata,avatar_url,location")
    .in("id", profileIds);
  if (!nextSchemaResult.error || !isMissingColumnError(nextSchemaResult.error.message || "", "display_name")) {
    return nextSchemaResult;
  }
  return supabase
    .from("profiles")
    .select("id,full_name,name,metadata,avatar_url,location")
    .in("id", profileIds);
};

export const getCanonicalTaskStatus = (task: OperationalTask) => {
  if (task.source === "help_request" && (task.rawStatus || "").toLowerCase() === "open") {
    return "new_lead" as const;
  }
  if (task.source === "help_request" && (task.rawStatus || "").toLowerCase() === "accepted") {
    return "in_progress";
  }
  return normalizeOrderStatus(task.rawStatus);
};

export const getTaskProgressStage = (task: OperationalTask): HelpRequestProgressStage => {
  if (task.status === "completed" || getCanonicalTaskStatus(task) === "completed") return "completed";
  return normalizeHelpRequestProgressStage(task.progressStage, task.rawStatus) || "pending_acceptance";
};

export const canCancelOperationalTask = (task: OperationalTask) => {
  if (task.source === "help_request") {
    return canCancelTrackedTaskAtStage(getTaskProgressStage(task));
  }
  const normalized = normalizeOrderStatus(task.rawStatus);
  if (normalized === "accepted" || normalized === "in_progress") {
    return canCancelTrackedTaskAtStage(getTaskProgressStage(task));
  }
  return true;
};

export const getTaskReviewTargetId = (task: OperationalTask) => {
  const targetId = typeof task.counterpartyId === "string" ? task.counterpartyId.trim() : "";
  return targetId || null;
};

export const buildTaskReviewMetadata = (task: OperationalTask) => ({
  task_id: task.orderId,
  task_source: task.source,
  order_id: task.source === "order" ? task.orderId : null,
  help_request_id: task.source === "help_request" ? task.helpRequestId || task.orderId : task.helpRequestId,
});

export const getReviewTaskIdFromMetadata = (metadata: unknown) => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
  const m = metadata as Record<string, unknown>;
  const taskId = m.task_id;
  if (typeof taskId === "string" && taskId.trim()) return taskId.trim();
  const orderId = m.order_id;
  if (typeof orderId === "string" && orderId.trim()) return orderId.trim();
  const helpRequestId = m.help_request_id;
  if (typeof helpRequestId === "string" && helpRequestId.trim()) return helpRequestId.trim();
  return "";
};

export const isHistoryTask = (task: OperationalTask) => {
  const canonical = getCanonicalTaskStatus(task);
  return canonical === "completed" || canonical === "closed" || canonical === "cancelled" || canonical === "rejected";
};

export const resolveTaskViewForStatus = (status: CanonicalOrderStatus): TaskViewTab => {
  if (status === "completed" || status === "closed" || status === "cancelled" || status === "rejected") return "done";
  if (status === "in_progress") return "in-progress";
  if (status === "new_lead" || status === "quoted" || status === "accepted") return "active";
  return "active";
};
