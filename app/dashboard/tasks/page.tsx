"use client";

import Image from "next/image";
import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  Inbox,
  ListChecks,
  Loader2,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  RefreshCw,
  Repeat2,
  Search,
  Share2,
  Sparkles,
  Star,
  TrendingUp,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import type { DashboardPromptConfig } from "@/app/components/prompt/DashboardPromptContext";
import { useDashboardPrompt } from "@/app/components/prompt/DashboardPromptContext";
import QuoteDraftEditor from "@/app/components/quotes/QuoteDraftEditor";
import RouteObservability from "@/app/components/RouteObservability";
import { createAvatarFallback } from "@/lib/avatarFallback";
import { fetchAuthedJson } from "@/lib/clientApi";
import {
  buildCancelledTrackerSteps,
  canCancelTrackedTaskAtStage,
  describeCancelledTrackerStage,
  normalizeHelpRequestProgressStage,
  type HelpRequestProgressStage,
} from "@/lib/helpRequestProgress";
import { supabase } from "@/lib/supabase";
import { getOrCreateDirectConversationId } from "@/lib/directMessages";
import {
  canTransitionOrderStatus,
  getAllowedTransitions,
  getOrderStatusLabel,
  getOrderStatusPillClass,
  getTransitionActionLabel,
  type CanonicalOrderStatus,
  type OrderActorRole,
  normalizeOrderStatus,
} from "@/lib/orderWorkflow";
import {
  buildFallbackTaskEventFeed,
  fallbackAvatar,
  formatAgo,
  formatCompactCurrency,
  getPreferredProfileName,
  getListingTypeLabel,
  mapOrderToTask,
  mapTaskEventToFeedItem,
  normalizeTaskStatus,
  resolveOrderListing,
  timelineFromStatus,
  type OrderRow,
  type PostRow,
  type ProductRow,
  type ProfileRow,
  type ServiceRow,
  type Task,
  type TaskEventFeedItem,
  type TaskEventRow,
  type TaskEventTone,
  type TaskStatus,
} from "@/lib/taskOperations";
import { resolveProfileAvatarUrl } from "@/lib/mediaUrl";
import { buildPublicProfilePath, inferProfileNameFromUser } from "@/lib/profile/utils";

type RealtimeState = "connecting" | "live" | "offline";
type TaskSortOption = "updated" | "newest" | "oldest";
type TaskViewTab = "inbox" | "saved" | "in-progress" | "completed" | "cancelled";
type InboxHelpRequest = {
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
type InboxMatchItem = {
  id: string;
  help_request_id: string;
  score: number | null;
  distance_km: number | null;
  reason: string | null;
  status: string;
  created_at: string | null;
  help_requests: InboxHelpRequest;
};
type OperationalTask = Task & { source: "order" | "help_request"; helpRequestId: string | null };
type HelpRequestRow = {
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
type SupportRequestRow = {
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
type SupportRequest = {
  id: string;
  taskId: string | null;
  helpRequestId: string | null;
  status: string;
  target: string;
  createdAtRaw: string | null;
  updatedAtRaw: string | null;
};
type TaskNotice = {
  kind: "success" | "info";
  message: string;
} | null;
type TaskReviewDraft = {
  rating: number;
  comment: string;
  submitted: boolean;
};

const stageOrder: TaskStatus[] = ["active", "in-progress", "completed", "cancelled"];
const statusProgressMap: Record<TaskStatus, number> = {
  active: 25,
  "in-progress": 65,
  completed: 100,
  cancelled: 100,
};

const demoNow = Date.now();
const formatTaskStatus = (status: TaskStatus) => {
  if (status === "in-progress") return "IN PROGRESS";
  return status.toUpperCase();
};

const getStatusColor = (status: TaskStatus) => {
  if (status === "active") return "bg-blue-100 text-blue-700";
  if (status === "in-progress") return "bg-yellow-100 text-yellow-700";
  if (status === "completed") return "bg-green-100 text-green-700";
  return "bg-red-100 text-red-700";
};

const getStatusTextClass = (status: TaskStatus) => {
  if (status === "active") return "text-sky-700";
  if (status === "in-progress") return "text-violet-700";
  if (status === "completed") return "text-emerald-700";
  return "text-rose-700";
};

const getStatusAccentClass = (status: TaskStatus) => {
  if (status === "active") return "from-sky-500 to-blue-600";
  if (status === "in-progress") return "from-violet-500 to-indigo-600";
  if (status === "completed") return "from-emerald-500 to-green-600";
  return "from-rose-500 to-red-600";
};

const getToneClassNames = (tone: TaskEventTone) => {
  if (tone === "sky") {
    return {
      dot: "bg-sky-500",
      pill: "bg-sky-100 text-sky-700",
      card: "border-sky-200 bg-sky-50/70",
    };
  }

  if (tone === "amber") {
    return {
      dot: "bg-amber-500",
      pill: "bg-amber-100 text-amber-700",
      card: "border-amber-200 bg-amber-50/70",
    };
  }

  if (tone === "violet") {
    return {
      dot: "bg-violet-500",
      pill: "bg-violet-100 text-violet-700",
      card: "border-violet-200 bg-violet-50/70",
    };
  }

  if (tone === "emerald") {
    return {
      dot: "bg-emerald-500",
      pill: "bg-emerald-100 text-emerald-700",
      card: "border-emerald-200 bg-emerald-50/70",
    };
  }

  if (tone === "rose") {
    return {
      dot: "bg-rose-500",
      pill: "bg-rose-100 text-rose-700",
      card: "border-rose-200 bg-rose-50/70",
    };
  }

  return {
    dot: "bg-slate-500",
    pill: "bg-slate-100 text-slate-700",
    card: "border-slate-200 bg-slate-50/80",
  };
};

const getTaskCreatorName = (task: Task) =>
  !isTaskPersonPlaceholder(task.postedBy.name) ? task.postedBy.name : "Local Member";
const getTaskCreatorAvatar = (task: Task) => task.postedBy.image || fallbackAvatar;
const getTaskCreatorSummary = (task: Task) => (task.type === "posted" ? "Created by you" : "Accepted by you");
const isTaskPersonPlaceholder = (value: string | null | undefined) =>
  !value ||
  ["you", "provider", "requester", "customer", "user", "member", "serviq member", "local member"].includes(
    value.trim().toLowerCase()
  );
const getTaskParticipantCopy = (task: Task) =>
  task.type === "posted"
    ? task.assignedTo?.name && !isTaskPersonPlaceholder(task.assignedTo.name)
      ? `Assigned provider: ${task.assignedTo.name}`
      : "Assigned provider pending"
    : `Assigned to you`;

const realtimeStateMeta: Record<
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

const isMissingSupabaseRelation = (message: string) =>
  /does not exist|schema cache|could not find the table/i.test(message);
const isMissingColumnError = (message: string, column: string) =>
  new RegExp(`column\\s+[^\\s]+\\.${column}\\s+does not exist`, "i").test(message);

const isSupportOpen = (status: string) => ["pending", "sent"].includes(status);

const formatTaskBudget = (min: number | null, max: number | null) => {
  const top = Number.isFinite(Number(max)) && Number(max) > 0 ? Number(max) : null;
  const base = Number.isFinite(Number(min)) && Number(min) > 0 ? Number(min) : null;
  const value = top ?? base;
  return value ? `INR ${value.toLocaleString("en-IN")}` : "Price on request";
};

const buildTaskAvatar = (profile: ProfileRow | null | undefined, fallbackLabel: string, seed: string) =>
  resolveProfileAvatarUrl(profile?.avatar_url) ||
  createAvatarFallback({ label: getPreferredProfileName(profile, fallbackLabel), seed });

const mapHelpRequestToTask = (params: {
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
  const metadata = request.metadata && typeof request.metadata === "object" && !Array.isArray(request.metadata) ? request.metadata : null;
  const progressStage = normalizeHelpRequestProgressStage(metadata?.progress_stage, request.status);

  return {
    id: request.id,
    orderId: request.id,
    source: "help_request",
    helpRequestId: request.id,
    title: request.title?.trim() || request.category?.trim() || "Service request",
    description: request.details?.trim() || "Live request posted on ServiQ.",
    type: isPostedByMe ? "posted" : "accepted",
    status: (request.status || "").toLowerCase() === "accepted" ? "in-progress" : normalizeTaskStatus(request.status),
    rawStatus: request.status || "open",
    budget: formatTaskBudget(request.budget_min, request.budget_max),
    timeline: timelineFromStatus(request.status),
    location: request.location_label?.trim() || requesterProfile?.location || providerProfile?.location || "Nearby",
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

const pickSupportTaskId = (row: SupportRequestRow) => {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : null;
  const orderId = typeof metadata?.order_id === "string" ? metadata.order_id.trim() : "";
  if (orderId) return orderId;
  return row.help_request_id?.trim() || null;
};

const mapSupportRequest = (row: SupportRequestRow): SupportRequest => ({
  id: row.id,
  taskId: pickSupportTaskId(row),
  helpRequestId: row.help_request_id,
  status: (row.status || "pending").toLowerCase(),
  target: row.target || "serviq-support",
  createdAtRaw: row.created_at,
  updatedAtRaw: row.updated_at,
});

const loadTaskProfiles = async (profileIds: string[]) => {
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

const getCanonicalTaskStatus = (task: OperationalTask) => {
  if (task.source === "help_request" && (task.rawStatus || "").toLowerCase() === "open") {
    return "open";
  }

  if (task.source === "help_request" && (task.rawStatus || "").toLowerCase() === "accepted") {
    return "in_progress";
  }

  return normalizeOrderStatus(task.rawStatus);
};

const getTaskProgressStage = (task: OperationalTask): HelpRequestProgressStage => {
  if (task.status === "completed" || getCanonicalTaskStatus(task) === "completed") return "completed";
  return normalizeHelpRequestProgressStage(task.progressStage, task.rawStatus) || "pending_acceptance";
};

const canCancelOperationalTask = (task: OperationalTask) => {
  if (task.source === "help_request") {
    return canCancelTrackedTaskAtStage(getTaskProgressStage(task));
  }

  const normalized = normalizeOrderStatus(task.rawStatus);
  if (normalized === "accepted" || normalized === "in_progress") {
    return canCancelTrackedTaskAtStage(getTaskProgressStage(task));
  }

  return true;
};

const getTaskReviewTargetId = (task: OperationalTask) => {
  const targetId = typeof task.counterpartyId === "string" ? task.counterpartyId.trim() : "";
  return targetId || null;
};

const buildTaskReviewMetadata = (task: OperationalTask) => ({
  task_id: task.orderId,
  task_source: task.source,
  order_id: task.source === "order" ? task.orderId : null,
  help_request_id: task.source === "help_request" ? task.helpRequestId || task.orderId : task.helpRequestId,
});

const getReviewTaskIdFromMetadata = (metadata: unknown) => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";

  const m = metadata as Record<string, unknown>;

  const taskId = m.task_id;
  if (typeof taskId === "string" && taskId.trim()) {
    return taskId.trim();
  }

  const orderId = m.order_id;
  if (typeof orderId === "string" && orderId.trim()) {
    return orderId.trim();
  }

  const helpRequestId = m.help_request_id;
  if (typeof helpRequestId === "string" && helpRequestId.trim()) {
    return helpRequestId.trim();
  }

  return "";
};

const isHistoryTask = (task: OperationalTask) => {
  const canonical = getCanonicalTaskStatus(task);
  return canonical === "completed" || canonical === "closed" || canonical === "cancelled" || canonical === "rejected";
};

const resolveTaskViewForStatus = (status: CanonicalOrderStatus): TaskViewTab => {
  if (status === "completed" || status === "closed") return "completed";
  if (status === "cancelled" || status === "rejected") return "cancelled";
  if (status === "accepted" || status === "in_progress") return "in-progress";
  return "saved";
};

export default function TasksPage() {
  const router = useRouter();
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveOrdersSectionRef = useRef<HTMLDivElement | null>(null);
  const taskCardRefs = useRef(new Map<string, HTMLElement | null>());
  const [sortBy, setSortBy] = useState<TaskSortOption>("updated");
  const [tasks, setTasks] = useState<OperationalTask[]>([]);
  const [taskEvents, setTaskEvents] = useState<TaskEventFeedItem[]>([]);
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [chatLoadingOrderId, setChatLoadingOrderId] = useState<string | null>(null);
  const [quoteEditorTaskId, setQuoteEditorTaskId] = useState<string | null>(null);
  const [sharingTaskId, setSharingTaskId] = useState<string | null>(null);
  const [supportBusyTaskId, setSupportBusyTaskId] = useState<string | null>(null);
  const [selectedTaskView, setSelectedTaskView] = useState<TaskViewTab>(() => {
    if (typeof window === "undefined") return "in-progress";
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "inbox") return "inbox";
    return "in-progress";
  });
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    // When landing on inbox tab via deep-link, focus is the match ID, not a task orderId
    if (params.get("tab") === "inbox") return null;
    return params.get("focus");
  });
  const [focusedMatchId, setFocusedMatchId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") !== "inbox") return null;
    return params.get("focus");
  });
  const [inboxMatches, setInboxMatches] = useState<InboxMatchItem[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [acceptingMatchId, setAcceptingMatchId] = useState<string | null>(null);
  const inboxCardRefs = useRef(new Map<string, HTMLElement | null>());
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState<TaskNotice>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [realtimeState, setRealtimeState] = useState<RealtimeState>("connecting");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [clockMs, setClockMs] = useState(demoNow);
  const [supportBackendReady, setSupportBackendReady] = useState<boolean | null>(null);
  const [taskReviews, setTaskReviews] = useState<Record<string, TaskReviewDraft>>({});
  const [reviewBusyTaskId, setReviewBusyTaskId] = useState<string | null>(null);
  const [commentComposerTaskId, setCommentComposerTaskId] = useState<string | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const loadTasks = useCallback(async (soft = false) => {
    if (!soft) setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setCurrentUserId(null);
        setTasks([]);
        setTaskEvents([]);
        setRealtimeState("offline");
        setLastSyncAt(null);
        setLoading(false);

        if (userError) {
          setErrorMessage(`Auth error: ${userError.message}`);
        }
        return;
      }

      setCurrentUserId(user.id);

      const [ordersRes, helpRequestsPayload] = await Promise.all([
        supabase
          .from("orders")
          .select("*")
          .or(`consumer_id.eq.${user.id},provider_id.eq.${user.id}`)
          .order("created_at", { ascending: false })
          .limit(120),
        fetchAuthedJson<{ ok: true; requests: HelpRequestRow[] } | { ok: false; message?: string }>(
          supabase,
          "/api/tasks/help-requests",
          {
            method: "GET",
          }
        ),
      ]);

      if (ordersRes.error) {
        setTasks([]);
        setTaskEvents([]);
        setRealtimeState("offline");
        setLoading(false);
        setErrorMessage(`Could not load live tasks: ${ordersRes.error.message}`);
        return;
      }

      const liveOrders = (ordersRes.data as OrderRow[] | null) || [];
      const helpRequestErrorMessage = helpRequestsPayload.ok ? null : helpRequestsPayload.message || "Help request activity unavailable.";
      let liveHelpRequests = helpRequestsPayload.ok ? helpRequestsPayload.requests || [] : [];

      const helpRequestIdsWithOrders = new Set(
        liveOrders.map((order) => order.help_request_id).filter((id): id is string => Boolean(id))
      );
      if (helpRequestIdsWithOrders.size > 0) {
        liveHelpRequests = liveHelpRequests.filter((request) => !helpRequestIdsWithOrders.has(request.id));
      }

      if (liveOrders.length === 0 && liveHelpRequests.length === 0) {
        setTasks([]);
        setTaskEvents([]);
        setRealtimeState("live");
        setLastSyncAt(new Date().toISOString());
        setLoading(false);
        return;
      }

      const profileIds = Array.from(
        new Set(
          [
            ...liveOrders.flatMap((order) => [order.consumer_id, order.provider_id]),
            ...liveHelpRequests.flatMap((request) => [request.requester_id, request.accepted_provider_id]),
          ]
            .filter((id): id is string => Boolean(id))
        )
      );

      const serviceIds = Array.from(
        new Set(
          liveOrders
            .map((order) => resolveOrderListing(order))
            .filter((order) => order.listingType === "service")
            .map((order) => order.listingId)
            .filter((id): id is string => Boolean(id))
        )
      );

      const productIds = Array.from(
        new Set(
          liveOrders
            .map((order) => resolveOrderListing(order))
            .filter((order) => order.listingType === "product")
            .map((order) => order.listingId)
            .filter((id): id is string => Boolean(id))
        )
      );

      const demandIds = Array.from(
        new Set(
          liveOrders
            .map((order) => resolveOrderListing(order))
            .filter((order) => order.listingType === "demand")
            .map((order) => order.listingId)
            .filter((id): id is string => Boolean(id))
        )
      );

      const [profilesRes, servicesRes, productsRes, postsRes, eventsRes, supportRes] = await Promise.all([
        loadTaskProfiles(profileIds),
        serviceIds.length
          ? supabase.from("service_listings").select("id,title,description,category").in("id", serviceIds)
          : Promise.resolve({ data: [] as ServiceRow[], error: null }),
        productIds.length
          ? supabase.from("product_catalog").select("id,title,description,category").in("id", productIds)
          : Promise.resolve({ data: [] as ProductRow[], error: null }),
        demandIds.length
          ? supabase.from("posts").select("id,title,text,content,description,category,metadata").in("id", demandIds)
          : Promise.resolve({ data: [] as PostRow[], error: null }),
        supabase
          .from("task_events")
          .select(
            "id,order_id,consumer_id,provider_id,actor_id,event_type,title,description,previous_status,next_status,metadata,created_at"
          )
          .or(`consumer_id.eq.${user.id},provider_id.eq.${user.id}`)
          .order("created_at", { ascending: false })
          .limit(40),
        supabase
          .from("notification_escalations")
          .select("id,help_request_id,requester_id,channel,target,status,metadata,created_at,updated_at")
          .eq("requester_id", user.id)
          .order("created_at", { ascending: false })
          .limit(80),
      ]);

      if (profilesRes.error) {
        setTasks([]);
        setTaskEvents([]);
        setRealtimeState("offline");
        setLoading(false);
        setErrorMessage(`Could not load task profiles: ${profilesRes.error.message}`);
        return;
      }

      const profileMap = new Map<string, ProfileRow>(((profilesRes.data as ProfileRow[] | null) || []).map((row) => [row.id, row]));
      const currentProfile = profileMap.get(user.id);
      const inferredCurrentUserName = inferProfileNameFromUser(user);
      const resolvedCurrentUserName = getPreferredProfileName(currentProfile, "");

      if (inferredCurrentUserName && !resolvedCurrentUserName) {
        profileMap.set(user.id, {
          id: user.id,
          full_name: inferredCurrentUserName,
          display_name: inferredCurrentUserName,
          name: inferredCurrentUserName,
          metadata: currentProfile?.metadata || null,
          avatar_url: currentProfile?.avatar_url || null,
          location: currentProfile?.location || null,
        });
      }

      const serviceMap = new Map<string, ServiceRow>(((servicesRes.data as ServiceRow[] | null) || []).map((row) => [row.id, row]));
      const productMap = new Map<string, ProductRow>(((productsRes.data as ProductRow[] | null) || []).map((row) => [row.id, row]));
      const postMap = new Map<string, PostRow>(((postsRes.data as PostRow[] | null) || []).map((row) => [row.id, row]));

      const mappedTasks: OperationalTask[] = [
        ...liveOrders.map((order) => ({
          ...mapOrderToTask({
            order,
            currentUserId: user.id,
            profileMap,
            serviceMap,
            productMap,
            postMap,
          }),
          source: "order" as const,
          helpRequestId: order.help_request_id || null,
        })),
        ...liveHelpRequests.map((request) =>
          mapHelpRequestToTask({
            request,
            currentUserId: user.id,
            profileMap,
          })
        ),
      ].sort(
        (left, right) => new Date(right.createdAtRaw || 0).getTime() - new Date(left.createdAtRaw || 0).getTime()
      );

      const taskTitleByOrderId = new Map<string, string>(mappedTasks.map((task) => [task.orderId, task.title]));
      const mappedTaskEvents = (((eventsRes.data as TaskEventRow[] | null) || []).map((event) =>
        mapTaskEventToFeedItem({
          event,
          taskTitleByOrderId,
        })
      ));
      const safeTaskEvents = mappedTaskEvents.length ? mappedTaskEvents : buildFallbackTaskEventFeed(mappedTasks);
      const supportError =
        supportRes.error && !isMissingSupabaseRelation(supportRes.error.message || "") ? supportRes.error : null;
      const safeSupportRequests = supportRes.error && isMissingSupabaseRelation(supportRes.error.message || "")
        ? []
        : (((supportRes.data as SupportRequestRow[] | null) || []).map(mapSupportRequest));

      startTransition(() => {
        setTasks(mappedTasks);
        setTaskEvents(safeTaskEvents);
        setSupportRequests(safeSupportRequests);
        setLastSyncAt(new Date().toISOString());
      });

      if (supportRes.error && isMissingSupabaseRelation(supportRes.error.message || "")) {
        setSupportBackendReady(false);
      } else if (!supportError) {
        setSupportBackendReady(true);
      }

      if (eventsRes.error && !isMissingSupabaseRelation(eventsRes.error.message || "")) {
        setErrorMessage(`Task activity feed unavailable: ${eventsRes.error.message}`);
      } else if (helpRequestErrorMessage) {
        setErrorMessage(`Help request activity unavailable: ${helpRequestErrorMessage}`);
      } else if (supportError) {
        setErrorMessage(`Support queue unavailable: ${supportError.message}`);
      }

      setLoading(false);
    } catch (error) {
      setCurrentUserId(null);
      setTasks([]);
      setTaskEvents([]);
      setRealtimeState("offline");
      setLastSyncAt(null);
      setLoading(false);
      setErrorMessage(error instanceof Error ? error.message : "Unexpected task sync error.");
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadTasks();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadTasks]);

  const loadInboxMatches = useCallback(async () => {
    if (!currentUserId) return;
    setInboxLoading(true);

    const { data, error } = await supabase
      .from("help_request_matches")
      .select(
        "id, help_request_id, score, distance_km, reason, status, created_at, help_requests!inner(id, title, category, budget_min, budget_max, location_label, status, requester_id, created_at)"
      )
      .eq("provider_id", currentUserId)
      .eq("status", "open")
      .order("score", { ascending: false })
      .limit(30);

    setInboxLoading(false);

    if (error) {
      console.warn("Failed to load inbox matches:", error.message);
      return;
    }

    setInboxMatches((data as unknown as InboxMatchItem[] | null) || []);
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    void loadInboxMatches();
  }, [currentUserId, loadInboxMatches]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClockMs(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!currentUserId || tasks.length === 0) return;

    const completedTasks = tasks.filter(
      (task) => task.status === "completed" && typeof getTaskReviewTargetId(task) === "string"
    );
    const providerIds = Array.from(new Set(completedTasks.map((task) => getTaskReviewTargetId(task)).filter(Boolean)));
    if (providerIds.length === 0) return;

    let active = true;

    const loadSubmittedReviews = async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("provider_id,rating,comment,metadata")
        .eq("reviewer_id", currentUserId)
        .in("provider_id", providerIds);

      if (error || !active) return;

      const reviewByTaskId = new Map(
        (((data as Array<{
          provider_id: string | null;
          rating: number | null;
          comment: string | null;
          metadata: Record<string, unknown> | null;
        }> | null) || [])
          .map((row) => {
            const taskId = getReviewTaskIdFromMetadata(row.metadata);
            if (!taskId) return null;

            return [
              taskId,
              {
                rating: Math.max(1, Math.min(5, Math.round(Number(row.rating || 0) || 0))),
                comment: row.comment?.trim() || "",
                submitted: true as boolean,
              },
            ] as [string, TaskReviewDraft];
          })
          .filter((entry): entry is [string, TaskReviewDraft] => Boolean(entry))) as Array<[string, TaskReviewDraft]>
      );

      setTaskReviews((current) => {
        const next = { ...current };

        completedTasks.forEach((task) => {
          const existingReview = reviewByTaskId.get(task.orderId);
          if (existingReview) {
            next[task.orderId] = existingReview;
          } else if (next[task.orderId]?.submitted) {
            delete next[task.orderId];
          }
        });

        return next;
      });
    };

    void loadSubmittedReviews();

    return () => {
      active = false;
    };
  }, [currentUserId, tasks]);

  const queueRealtimeRefresh = useEffectEvent(() => {
    if (refreshTimerRef.current) return;

    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      startTransition(() => {
        void loadTasks(true);
      });
    }, 180);
  });

  const handleSubscriptionState = useEffectEvent((status: string) => {
    if (status === "SUBSCRIBED") {
      setRealtimeState("live");
      return;
    }

    if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
      setRealtimeState("offline");
      return;
    }

    setRealtimeState("connecting");
  });

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`tasks-operations-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `consumer_id=eq.${currentUserId}`,
        },
        () => {
          queueRealtimeRefresh();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `provider_id=eq.${currentUserId}`,
        },
        () => {
          queueRealtimeRefresh();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_events",
          filter: `consumer_id=eq.${currentUserId}`,
        },
        () => {
          queueRealtimeRefresh();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_events",
          filter: `provider_id=eq.${currentUserId}`,
        },
        () => {
          queueRealtimeRefresh();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "help_requests",
          filter: `requester_id=eq.${currentUserId}`,
        },
        () => {
          queueRealtimeRefresh();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "help_requests",
          filter: `accepted_provider_id=eq.${currentUserId}`,
        },
        () => {
          queueRealtimeRefresh();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notification_escalations",
          filter: `requester_id=eq.${currentUserId}`,
        },
        () => {
          queueRealtimeRefresh();
        }
      )
      .subscribe((status) => {
        handleSubscriptionState(status);
      });

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }

      setRealtimeState("connecting");
      void supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;

    const inboxChannel = supabase
      .channel(`tasks-inbox-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "help_request_matches",
          filter: `provider_id=eq.${currentUserId}`,
        },
        () => {
          void loadInboxMatches();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(inboxChannel);
    };
  }, [currentUserId, loadInboxMatches]);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`tasks-notifications-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${currentUserId}`,
        },
        (payload) => {
          const row = payload.new as {
            title?: string | null;
            message?: string | null;
            entity_type?: string | null;
            kind?: string | null;
          } | null;

          const entityType = (row?.entity_type || "").toLowerCase();
          const isTaskRelated =
            ["order", "task", "order_update", "help_request", "need", "request"].includes(entityType) ||
            row?.kind === "order";

          if (!isTaskRelated) return;

          setNotice({
            kind: "info",
            message: `${row?.title || "Task update"}${row?.message ? `: ${row.message}` : ""}`,
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const latestEventByOrderId = useMemo(() => {
    const eventMap = new Map<string, TaskEventFeedItem>();

    taskEvents.forEach((event) => {
      if (!eventMap.has(event.orderId)) {
        eventMap.set(event.orderId, event);
      }
    });

    return eventMap;
  }, [taskEvents]);

  const eventsByOrderId = useMemo(() => {
    const eventMap = new Map<string, TaskEventFeedItem[]>();

    taskEvents.forEach((event) => {
      const current = eventMap.get(event.orderId) || [];
      current.push(event);
      eventMap.set(event.orderId, current);
    });

    return eventMap;
  }, [taskEvents]);

  const supportRequestsByTaskId = useMemo(() => {
    const map = new Map<string, SupportRequest[]>();

    supportRequests.forEach((request) => {
      if (!request.taskId) return;
      const current = map.get(request.taskId) || [];
      current.push(request);
      map.set(request.taskId, current);
    });

    return map;
  }, [supportRequests]);

  const statusCounts = useMemo(
    () => ({
      awaitingAction: tasks.filter((task) => {
        const canonical = getCanonicalTaskStatus(task);
        return canonical === "open" || canonical === "new_lead" || canonical === "quoted";
      }).length,
      active: tasks.filter((task) => getCanonicalTaskStatus(task) === "accepted").length,
      inProgress: tasks.filter((task) => getCanonicalTaskStatus(task) === "in_progress").length,
      completed: tasks.filter((task) => {
        const canonical = getCanonicalTaskStatus(task);
        return canonical === "completed" || canonical === "closed";
      }).length,
      cancelled: tasks.filter((task) => getCanonicalTaskStatus(task) === "cancelled").length,
      rejected: tasks.filter((task) => getCanonicalTaskStatus(task) === "rejected").length,
      support: tasks.filter((task) => {
        const canonical = getCanonicalTaskStatus(task);
        return supportRequestsByTaskId.has(task.orderId) || canonical === "cancelled" || canonical === "rejected";
      }).length,
    }),
    [supportRequestsByTaskId, tasks]
  );

  const totalPipelineValue = useMemo(
    () =>
      tasks.reduce((sum, task) => {
        if (!Number.isFinite(Number(task.amount))) return sum;
        return sum + Number(task.amount);
      }, 0),
    [tasks]
  );

  const knownTicketCount = useMemo(
    () => tasks.filter((task) => Number.isFinite(Number(task.amount))).length,
    [tasks]
  );

  const averageTicket = useMemo(() => {
    if (!knownTicketCount) return 0;
    return Math.round(totalPipelineValue / knownTicketCount);
  }, [knownTicketCount, totalPipelineValue]);

  const completionRate = useMemo(() => {
    if (!tasks.length) return 0;
    return Math.round((statusCounts.completed / tasks.length) * 100);
  }, [statusCounts.completed, tasks.length]);

  const pendingReviewCount = useMemo(() => {
    return tasks.filter((task) => {
      const canonical = getCanonicalTaskStatus(task);
      if (canonical !== "completed" && canonical !== "closed") return false;
      if (!getTaskReviewTargetId(task)) return false;
      const draft = taskReviews[task.orderId];
      return !draft?.submitted;
    }).length;
  }, [taskReviews, tasks]);

  const actionRequiredCount = statusCounts.awaitingAction + statusCounts.active + statusCounts.inProgress;

  const filteredTasks = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();

    return tasks
      .filter((task) => {
        if (!query) return true;

        const latestEvent = latestEventByOrderId.get(task.orderId);
        const haystack = [
          task.title,
          task.description,
          task.location,
          task.postedBy.name,
          task.assignedTo?.name || "",
          task.tags.join(" "),
          task.listingType,
          task.orderId,
          getTaskStatusLabel(task),
          latestEvent?.title || "",
          latestEvent?.description || "",
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      })
      .sort((a, b) => {
        const aLatestEventAt = latestEventByOrderId.get(a.orderId)?.createdAtRaw || a.createdAtRaw;
        const bLatestEventAt = latestEventByOrderId.get(b.orderId)?.createdAtRaw || b.createdAtRaw;
        const aTime = aLatestEventAt ? new Date(aLatestEventAt).getTime() : 0;
        const bTime = bLatestEventAt ? new Date(bLatestEventAt).getTime() : 0;
        const aCreated = a.createdAtRaw ? new Date(a.createdAtRaw).getTime() : 0;
        const bCreated = b.createdAtRaw ? new Date(b.createdAtRaw).getTime() : 0;

        if (sortBy === "oldest") return aCreated - bCreated;
        if (sortBy === "newest") return bCreated - aCreated;

        if (isHistoryTask(a) !== isHistoryTask(b)) {
          return isHistoryTask(a) ? 1 : -1;
        }

        const stageDelta = stageOrder.indexOf(a.status) - stageOrder.indexOf(b.status);
        if (stageDelta !== 0) return stageDelta;
        return bTime - aTime;
      });
  }, [deferredSearchQuery, latestEventByOrderId, sortBy, tasks]);

  const taskTabs = useMemo(
    () => [
      {
        value: "inbox" as const,
        label: "Inbox",
        count: inboxMatches.length,
      },
      {
        value: "saved" as const,
        label: "Saved",
        count: filteredTasks.filter((task) => {
          const canonical = getCanonicalTaskStatus(task);
          return canonical === "open" || canonical === "new_lead" || canonical === "quoted";
        }).length,
      },
      {
        value: "in-progress" as const,
        label: "In Progress",
        count: filteredTasks.filter((task) => {
          const canonical = getCanonicalTaskStatus(task);
          return canonical === "accepted" || canonical === "in_progress";
        }).length,
      },
      {
        value: "completed" as const,
        label: "Completed",
        count: filteredTasks.filter((task) => {
          const canonical = getCanonicalTaskStatus(task);
          return canonical === "completed" || canonical === "closed";
        }).length,
      },
      {
        value: "cancelled" as const,
        label: "Cancelled",
        count: filteredTasks.filter((task) => {
          const canonical = getCanonicalTaskStatus(task);
          return canonical === "cancelled" || canonical === "rejected";
        }).length,
      },
    ],
    [filteredTasks, inboxMatches.length]
  );

  const visibleTasks = useMemo(() => {
    if (selectedTaskView === "inbox") {
      // Inbox uses the separate inboxMatches state, not filteredTasks
      return [] as OperationalTask[];
    }

    if (selectedTaskView === "saved") {
      return filteredTasks.filter((task) => {
        const canonical = getCanonicalTaskStatus(task);
        return canonical === "open" || canonical === "new_lead" || canonical === "quoted";
      });
    }

    if (selectedTaskView === "completed") {
      return filteredTasks.filter((task) => {
        const canonical = getCanonicalTaskStatus(task);
        return canonical === "completed" || canonical === "closed";
      });
    }

    if (selectedTaskView === "cancelled") {
      return filteredTasks.filter((task) => {
        const canonical = getCanonicalTaskStatus(task);
        return canonical === "cancelled" || canonical === "rejected";
      });
    }

    return filteredTasks.filter((task) => {
      const canonical = getCanonicalTaskStatus(task);
      return canonical === "accepted" || canonical === "in_progress";
    });
  }, [filteredTasks, selectedTaskView]);

  const handleTaskPromptSubmit = useCallback(() => {
    const firstMatch = filteredTasks[0];

    if (firstMatch) {
      setExpandedTaskId(firstMatch.orderId);
      return;
    }

    if (searchQuery.trim()) {
      setNotice({
        kind: "info",
        message: `No tasks matched "${searchQuery.trim()}". Try a different title, status, or person.`,
      });
    }
  }, [filteredTasks, searchQuery]);

  const taskPromptConfig = useMemo<DashboardPromptConfig>(
    () => ({
      placeholder: "Search tasks by title, status, category, or owner",
      value: searchQuery,
      onValueChange: setSearchQuery,
      onSubmit: handleTaskPromptSubmit,
      actions: [
        {
          id: "refresh-tasks",
          label: loading ? "Refreshing..." : "Refresh",
          icon: Loader2,
          onClick: () => {
            void loadTasks(true);
          },
          variant: "secondary",
          disabled: loading,
          busy: loading,
        },
      ],
    }),
    [handleTaskPromptSubmit, loadTasks, loading, searchQuery]
  );

  useDashboardPrompt(taskPromptConfig);

  const getTaskStatusLabel = (task: OperationalTask) => {
    if (task.source === "help_request" && (task.rawStatus || "").toLowerCase() === "accepted") return "In Progress";
    if (task.source === "help_request" && (!task.rawStatus || task.rawStatus === "open")) return "Open";
    return getOrderStatusLabel(task.rawStatus);
  };

  const canManageQuote = (task: OperationalTask) => {
    if (task.type !== "accepted") return false;

    if (task.source === "help_request") {
      const normalized = normalizeOrderStatus(task.rawStatus);
      return normalized === "accepted" || normalized === "in_progress";
    }

    const canonical = normalizeOrderStatus(task.rawStatus);
    return canonical === "new_lead" || canonical === "quoted";
  };

  const canViewQuote = (task: OperationalTask) => {
    if (task.type !== "posted") return false;
    const canonical = normalizeOrderStatus(task.rawStatus);
    return canonical === "quoted";
  };

  const getQuoteActionLabel = (task: OperationalTask) => {
    const canonical = normalizeOrderStatus(task.rawStatus);
    if (canonical === "quoted") return "Review quote";
    return task.source === "help_request" ? "Create quote" : "Draft quote";
  };

  const getTaskTransitions = (task: OperationalTask): CanonicalOrderStatus[] => {
    if (task.source === "help_request") {
      const normalized = (task.rawStatus || "").toLowerCase();
      const canCancel = canCancelOperationalTask(task);
      if (normalized === "completed" || normalized === "cancelled") return [];
      if (normalized === "accepted" || normalized === "in_progress") {
        return canCancel ? ["completed", "cancelled"] : ["completed"];
      }
      return ["cancelled"];
    }

    const actor: OrderActorRole = task.type === "posted" ? "consumer" : "provider";
    return getAllowedTransitions(task.rawStatus, actor)
      .filter((status) => status !== "closed" && (status !== "quoted" || !canManageQuote(task)))
      .filter((status) => status !== "cancelled" || canCancelOperationalTask(task));
  };

  const getTaskTransitionLabel = (task: OperationalTask, nextStatus: CanonicalOrderStatus) => {
    if (task.source === "help_request") {
      if (nextStatus === "completed") return task.type === "posted" ? "Confirm completion" : "Mark complete";
      if (nextStatus === "cancelled") return "Decline";
    }

    const actor: OrderActorRole = task.type === "posted" ? "consumer" : "provider";
    return getTransitionActionLabel({ actor, nextStatus });
  };

  const startChat = async (task: OperationalTask, options?: { quote?: boolean }) => {
    if (!currentUserId || !task.counterpartyId) {
      setErrorMessage("Chat becomes available once another member is attached to this task.");
      return;
    }

    setErrorMessage("");
    setChatLoadingOrderId(task.orderId);

    try {
      const targetConversationId = await getOrCreateDirectConversationId(
        supabase,
        currentUserId,
        task.counterpartyId
      );
      const params = new URLSearchParams({
        open: targetConversationId,
      });

      if (options?.quote) {
        params.set("quote", "1");
        if (task.source === "order") {
          params.set("order", task.orderId);
        } else if (task.helpRequestId) {
          params.set("helpRequest", task.helpRequestId);
        }
      }

      router.push(`/dashboard/chat?${params.toString()}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start chat.";
      setErrorMessage(`Unable to start chat. ${message}`);
    } finally {
      setChatLoadingOrderId(null);
    }
  };

  const submitTaskReview = useCallback(
    async (task: OperationalTask, draft: TaskReviewDraft) => {
      if (!currentUserId) {
        setErrorMessage("Please sign in again before submitting a review.");
        return false;
      }

      const providerId = getTaskReviewTargetId(task);
      if (!providerId) {
        setErrorMessage("This task does not have a review target yet.");
        return false;
      }

      const existingDraft = taskReviews[task.orderId];
      if (existingDraft?.submitted) {
        setNotice({
          kind: "info",
          message: `Review already submitted for ${task.title}.`,
        });
        return false;
      }

      const rating = Math.max(1, Math.min(5, Math.round(draft.rating || 0)));
      const comment = draft.comment.trim();
      const reviewMetadata = buildTaskReviewMetadata(task);

      setReviewBusyTaskId(task.orderId);
      setErrorMessage("");

      try {
        const { data: existingReview, error: existingReviewError } = await supabase
          .from("reviews")
          .select("id")
          .eq("provider_id", providerId)
          .eq("reviewer_id", currentUserId)
          .contains("metadata", { task_id: task.orderId })
          .maybeSingle<{ id: string }>();

        if (existingReviewError) {
          throw existingReviewError;
        }

        if (existingReview?.id) {
          const { error: updateError } = await supabase
            .from("reviews")
            .update({
              rating,
              comment: comment || null,
              metadata: reviewMetadata,
            })
            .eq("id", existingReview.id);

          if (updateError) {
            throw updateError;
          }
        } else {
          const { error: insertError } = await supabase.from("reviews").insert({
            provider_id: providerId,
            reviewer_id: currentUserId,
            rating,
            comment: comment || null,
            metadata: reviewMetadata,
          });

          if (insertError) {
            throw insertError;
          }
        }

        setTaskReviews((current) => ({
          ...current,
          [task.orderId]: { rating, comment, submitted: true },
        }));
        setNotice({
          kind: "success",
          message: `Review submitted for ${task.title}. It will now appear in that user's Reviews tab.`,
        });
        setCommentComposerTaskId(null);
        return true;
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to submit the review right now.");
        return false;
      } finally {
        setReviewBusyTaskId(null);
      }
    },
    [currentUserId, taskReviews]
  );

  const updateOrderStatus = async (task: OperationalTask, nextStatus: CanonicalOrderStatus) => {
    setErrorMessage("");
    setUpdatingOrderId(task.orderId);

    try {
      if (task.source === "help_request") {
        if (!task.helpRequestId) {
          setErrorMessage("This request is missing its live task reference.");
          return false;
        }

        if (nextStatus === "cancelled" && task.type === "accepted") {
          const payload = await fetchAuthedJson<{ ok: true; helpRequestId: string; status: "cancelled" }>(
            supabase,
            "/api/needs/reopen",
            {
              method: "POST",
              body: JSON.stringify({ helpRequestId: task.helpRequestId }),
            }
          );

          if (!payload.ok) {
            setErrorMessage("Failed to decline request.");
            return false;
          }
        } else {
          if (!["accepted", "in_progress", "completed", "cancelled"].includes(nextStatus)) {
            setErrorMessage("This action is not available for the current request.");
            return false;
          }

          const { data, error } = await supabase.rpc("transition_help_request_status", {
            target_help_request_id: task.helpRequestId,
            next_status: nextStatus,
          });

          if (error) {
            setErrorMessage(error.message || "Failed to update request status.");
            return false;
          }

          if (!data) {
            setErrorMessage("Failed to update request status.");
            return false;
          }
        }
      } else {
        const actor: OrderActorRole = task.type === "posted" ? "consumer" : "provider";
        const canTransition = canTransitionOrderStatus({
          from: task.rawStatus,
          to: nextStatus,
          actor,
        });

        if (!canTransition) {
          setErrorMessage("Invalid task status transition for this role.");
          return false;
        }

        const { error } = await supabase.from("orders").update({ status: nextStatus }).eq("id", task.orderId);

        if (error) {
          setErrorMessage(`Failed to update task status: ${error.message}`);
          return false;
        }
      }

      setTasks((current) =>
        current.map((item) =>
          item.orderId === task.orderId
            ? {
                ...item,
                rawStatus: nextStatus,
                status: normalizeTaskStatus(nextStatus),
                timeline: timelineFromStatus(nextStatus),
                progressStage: nextStatus === "completed" ? "completed" : item.progressStage,
              }
            : item
        )
      );

      return true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update this task right now.");
      return false;
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const updateTaskProgressStage = async (
    task: OperationalTask,
    stage: "pending_acceptance" | "accepted" | "travel_started" | "work_started"
  ) => {
    setErrorMessage("");
    setUpdatingOrderId(task.orderId);

    try {
      await fetchAuthedJson<{
        ok: true;
        taskId: string;
        source: "order" | "help_request";
        stage: "pending_acceptance" | "accepted" | "travel_started" | "work_started";
      }>(
        supabase,
        "/api/tasks/progress",
        {
        method: "POST",
        body: JSON.stringify({
          taskId: task.orderId,
          source: task.source,
          stage,
        }),
      });

      setTasks((current) =>
        current.map((item) =>
          item.orderId === task.orderId
            ? {
                ...item,
                progressStage: stage,
                rawStatus:
                  stage === "work_started"
                    ? "in_progress"
                    : stage === "pending_acceptance" || stage === "accepted" || stage === "travel_started"
                      ? "accepted"
                      : item.rawStatus,
                status:
                  stage === "work_started"
                    ? normalizeTaskStatus("in_progress")
                    : normalizeTaskStatus("accepted"),
                timeline:
                  stage === "work_started"
                    ? timelineFromStatus("in_progress")
                    : timelineFromStatus("accepted"),
              }
            : item
        )
      );

      setNotice({
        kind: "success",
        message:
          stage === "accepted"
            ? "Task accepted. The tracker is ready for travel updates."
            : stage === "travel_started"
              ? "Travel started. The seeker can now see this in the task tracker."
              : stage === "work_started"
                ? "Work started. Both sides are now synced."
                : "Task tracker reset back to the accepted state.",
      });

      startTransition(() => {
        void loadTasks(true);
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update task progress right now.");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  useEffect(() => {
    if (!notice) return;
    const timeoutId = window.setTimeout(() => {
      setNotice(null);
    }, 4200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [notice]);

  useEffect(() => {
    if (!quoteEditorTaskId) return;
    if (tasks.some((task) => task.orderId === quoteEditorTaskId)) return;
    setQuoteEditorTaskId(null);
  }, [quoteEditorTaskId, tasks]);

  useEffect(() => {
    if (!focusedMatchId || selectedTaskView !== "inbox") return;
    const frameId = window.requestAnimationFrame(() => {
      inboxCardRefs.current.get(focusedMatchId)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [focusedMatchId, selectedTaskView, inboxMatches]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (expandedTaskId) params.set("focus", expandedTaskId);
    else params.delete("focus");

    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname;
    window.history.replaceState(window.history.state, "", nextUrl);

    if (!expandedTaskId) return;

    const frameId = window.requestAnimationFrame(() => {
      taskCardRefs.current.get(expandedTaskId)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [expandedTaskId]);

  const resolveTaskHelpRequestId = (task: OperationalTask) =>
    task.helpRequestId || (task.source === "help_request" ? task.orderId : null);

  const getSupportAvailability = (task: OperationalTask) => {
    if (supportBackendReady === false) {
      return {
        allowed: false,
        reason: "Support escalation is not configured in this environment yet.",
      };
    }

    if (!currentUserId) {
      return {
        allowed: false,
        reason: "Please sign in again before opening support.",
      };
    }

    if (!resolveTaskHelpRequestId(task)) {
      return {
        allowed: false,
        reason: "This task does not have a linked help request, so the current support backend cannot attach an issue yet.",
      };
    }

    if (task.type !== "posted") {
      return {
        allowed: false,
        reason: "Support escalation is currently wired for requester-owned tasks. Provider-side issue records need backend support.",
      };
    }

    return { allowed: true, reason: "" };
  };

  const formatSupportRequestStatus = (status: string) => {
    if (status === "pending") return "Pending review";
    if (status === "sent") return "Sent to support";
    if (status === "failed") return "Delivery failed";
    if (status === "cancelled") return "Cancelled";
    return "Support";
  };

  const getPremiumTaskNextAction = (task: OperationalTask) => {
    const canonical = getCanonicalTaskStatus(task);
    const hasSupport = supportRequestsByTaskId.has(task.orderId);

    if (hasSupport) {
      return {
        title: "Review support follow-up",
        helper: "An issue is already open for this task. Keep updates in one place and track the response.",
      };
    }

    if (canonical === "open" || canonical === "new_lead") {
      return task.type === "posted"
        ? { title: "Keep the request visible", helper: "Wait for the right provider or cancel if the need has changed." }
        : { title: "Review the request", helper: "Use chat and the workflow actions to move this work forward." };
    }

    if (canonical === "quoted") {
      return task.type === "posted"
        ? { title: "Review the quote", helper: "Accept or cancel once the scope and price are clear." }
        : { title: "Follow up on the quote", helper: "Stay available for customer confirmation and questions." };
    }

    if (canonical === "accepted") {
      return task.type === "posted"
        ? { title: "Track booked work", helper: "Chat with the provider and confirm completion when everything is done." }
        : { title: "Start the work", helper: "Move the task into progress once you begin on-site or remotely." };
    }

    if (canonical === "in_progress") {
      return task.type === "posted"
        ? { title: "Stay on the live update", helper: "Track progress, chat when needed, and confirm completion at the end." }
        : { title: "Finish and mark complete", helper: "Keep the customer updated, then close the task out cleanly." };
    }

    if (canonical === "completed" || canonical === "closed") {
      return { title: "Repeat when needed", helper: "Completed work stays in history so you can rebook or revisit the details later." };
    }

    if (canonical === "cancelled") {
      return { title: "Review what changed", helper: "Cancelled tasks stay in history and can be repeated or raised with support later." };
    }

    if (canonical === "rejected") {
      return { title: "Decide the follow-up", helper: "Rejected work stays visible for support follow-up or a fresh attempt." };
    }

    return { title: "Open task details", helper: "Review the current lifecycle and the latest updates before taking action." };
  };

  const getPremiumTaskActivity = (task: OperationalTask) => {
    const events = eventsByOrderId.get(task.orderId) || [];
    if (events.length > 0) return events.slice(0, 4);

    const fallbackTone: TaskEventTone =
      task.status === "completed"
        ? "emerald"
        : task.status === "cancelled"
          ? "rose"
          : task.status === "in-progress"
            ? "violet"
            : "amber";

    return [
      {
        id: `status-${task.orderId}`,
        orderId: task.orderId,
        title: getTaskStatusLabel(task),
        description: `${task.title} is currently ${getTaskStatusLabel(task).toLowerCase()}.`,
        taskTitle: task.title,
        tone: fallbackTone,
        statusLabel: getTaskStatusLabel(task),
        eventType: "status",
        createdAtRaw: task.createdAtRaw,
      } satisfies TaskEventFeedItem,
    ];
  };

  const getPremiumTaskFlowLabels = (task: OperationalTask) => {
    const labels = getPremiumTaskActivity(task)
      .slice()
      .reverse()
      .map((event) => event.statusLabel || event.title)
      .filter((label): label is string => Boolean(label));

    if (task.source === "help_request" && labels.length === 1) {
      labels.unshift(task.type === "posted" ? "Requested" : "Accepted");
    }

    if (supportRequestsByTaskId.has(task.orderId)) {
      labels.push("Support");
    }

    return Array.from(new Set(labels)).slice(-5);
  };

  const scrollToSection = useCallback((ref: { current: HTMLElement | null }) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const clearSearch = useCallback(() => {
    setSortBy("updated");
    setSearchQuery("");
  }, []);

  const focusTaskInWorkspace = useCallback(
    (task: OperationalTask, nextStatus: CanonicalOrderStatus) => {
      const nextView = resolveTaskViewForStatus(nextStatus);
      setSelectedTaskView(nextView);
      setExpandedTaskId(task.orderId);

      if (nextView === "completed" && getTaskReviewTargetId(task)) {
        setCommentComposerTaskId(task.orderId);
        return;
      }

      setCommentComposerTaskId(null);
    },
    []
  );

  const confirmAndRefreshTaskStatus = async (task: OperationalTask, nextStatus: CanonicalOrderStatus) => {
    if (nextStatus === "cancelled" && !canCancelOperationalTask(task)) {
      setErrorMessage("This task can no longer be cancelled after work has started.");
      return;
    }

    let confirmationMessage = "";

    if (nextStatus === "completed") {
      confirmationMessage = "Mark this task as completed? This will update the live task status for both sides.";
    } else if (nextStatus === "cancelled") {
      confirmationMessage = "Decline this task? This will stop the accepted request for both sides.";
    } else if (nextStatus === "rejected") {
      confirmationMessage = "Reject this task? This will keep the task in history and may need follow-up.";
    }

    if (confirmationMessage && typeof window !== "undefined" && !window.confirm(confirmationMessage)) {
      return;
    }

    const didUpdate = await updateOrderStatus(task, nextStatus);
    if (!didUpdate) return;

    focusTaskInWorkspace(task, nextStatus);

    setNotice({
      kind: "success",
      message:
        nextStatus === "completed" && getTaskReviewTargetId(task)
          ? `${task.title} marked completed. You can add a review now.`
          : 
        nextStatus === "cancelled" && task.type === "accepted" && task.source === "help_request"
          ? `${task.title} was declined and returned to the feed.`
          : nextStatus === "cancelled"
          ? `${task.title} was declined.`
          : `${task.title} updated to ${getOrderStatusLabel(nextStatus).toLowerCase()}.`,
    });
    startTransition(() => {
      void loadTasks(true);
    });
  };

  const persistTaskShare = async (task: OperationalTask, channel: "native" | "clipboard") => {
    if (!currentUserId) return;

    try {
      const { error } = await supabase.from("feed_card_shares").insert({
        user_id: currentUserId,
        card_id: `tasks:${task.orderId}`,
        focus_id: task.orderId,
        card_type: "task",
        title: task.title,
        channel,
        metadata: {
          source: "tasks-tab",
          listing_type: task.listingType,
          task_status: task.rawStatus,
          task_source: task.source,
        },
      });

      if (error && !isMissingSupabaseRelation(error.message || "")) {
        console.warn("Task share could not be persisted:", error.message);
      }
    } catch {}
  };

  const shareTaskLink = async (task: OperationalTask) => {
    if (typeof window === "undefined") return;

    setErrorMessage("");
    setSharingTaskId(task.orderId);
    const shareUrl = `${window.location.origin}/dashboard/tasks?focus=${encodeURIComponent(task.orderId)}`;

    try {
      let shareChannel: "native" | "clipboard" = "clipboard";

      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        try {
          await navigator.share({
            title: task.title,
            text: `Track ${task.title} on ServiQ`,
            url: shareUrl,
          });
          shareChannel = "native";
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }

          if (!navigator.clipboard?.writeText) {
            throw error;
          }

          await navigator.clipboard.writeText(shareUrl);
        }
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        throw new Error("Sharing is not supported in this browser.");
      }

      await persistTaskShare(task, shareChannel);
      setNotice({
        kind: "success",
        message: shareChannel === "native" ? "Share sheet opened for this task." : "Task link copied to your clipboard.",
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to share this task right now.");
    } finally {
      setSharingTaskId(null);
    }
  };

  const raiseTaskSupport = async (task: OperationalTask) => {
    const availability = getSupportAvailability(task);
    const existingSupport = supportRequestsByTaskId.get(task.orderId) || [];
    const openSupport = existingSupport.find((request) => isSupportOpen(request.status));

    if (openSupport) {
      setExpandedTaskId(task.orderId);
      setNotice({
        kind: "info",
        message: `Support is already open for this task: ${formatSupportRequestStatus(openSupport.status)}.`,
      });
      return;
    }

    if (!availability.allowed) {
      setNotice({
        kind: "info",
        message: availability.reason,
      });
      return;
    }

    const helpRequestId = resolveTaskHelpRequestId(task);
    if (!helpRequestId || !currentUserId) return;

    setErrorMessage("");
    setSupportBusyTaskId(task.orderId);

    try {
      const { data, error } = await supabase
        .from("notification_escalations")
        .insert({
          help_request_id: helpRequestId,
          requester_id: currentUserId,
          channel: "push",
          target: "serviq-support",
          metadata: {
            source: "tasks-tab",
            order_id: task.orderId,
            task_source: task.source,
            task_status: task.rawStatus,
            listing_type: task.listingType,
            counterparty_id: task.counterpartyId,
          },
        })
        .select("id,help_request_id,requester_id,channel,target,status,metadata,created_at,updated_at")
        .single<SupportRequestRow>();

      if (error) {
        if (isMissingSupabaseRelation(error.message || "")) {
          setSupportBackendReady(false);
          setNotice({
            kind: "info",
            message: "Support escalation backend is missing in this environment. The UI is ready once notification_escalations is available.",
          });
          return;
        }

        setErrorMessage(`Unable to raise support: ${error.message}`);
        return;
      }

      if (data) {
        setSupportRequests((current) => [mapSupportRequest(data), ...current]);
      }
      setSupportBackendReady(true);
      setExpandedTaskId(task.orderId);
      setNotice({
        kind: "success",
        message: "Support issue raised. We will keep this task visible in the support queue.",
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to raise support right now.");
    } finally {
      setSupportBusyTaskId(null);
    }
  };

  const repeatTaskFromHistory = (task: OperationalTask) => {
    router.push(`/dashboard?q=${encodeURIComponent(task.title)}`);
  };

  const acceptInboxMatch = async (matchItem: InboxMatchItem) => {
    setAcceptingMatchId(matchItem.id);
    setErrorMessage("");

    try {
      const payload = await fetchAuthedJson<{ ok: boolean; message?: string }>(
        supabase,
        "/api/needs/accept",
        {
          method: "POST",
          body: JSON.stringify({ helpRequestId: matchItem.help_request_id }),
        }
      );

      if (!payload.ok) {
        throw new Error((payload as { message?: string }).message || "Failed to accept request.");
      }

      setInboxMatches((current) => current.filter((item) => item.id !== matchItem.id));
      setNotice({
        kind: "success",
        message: `You accepted "${matchItem.help_requests?.title || "the request"}". It's now in your In Progress tab.`,
      });
      setSelectedTaskView("in-progress");
      startTransition(() => {
        void loadTasks(true);
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to accept this request right now.");
    } finally {
      setAcceptingMatchId(null);
    }
  };

  const getTransitionIcon = (status: CanonicalOrderStatus) => {
    if (status === "completed") return CheckCircle2;
    if (status === "cancelled" || status === "rejected") return AlertCircle;
    if (status === "in_progress" || status === "accepted" || status === "quoted") return TrendingUp;
    return ArrowUpRight;
  };

  const actionButtonClassName =
    "inline-flex min-h-9 items-center justify-center gap-2 rounded-full px-3 py-2 text-center text-[12px] leading-5 font-semibold transition sm:text-[13px] disabled:cursor-not-allowed disabled:opacity-60";
  const subtleActionClassName = `${actionButtonClassName} border border-slate-200 bg-white text-slate-700 hover:border-[var(--brand-500)]/35 hover:text-[var(--brand-700)]`;
  const darkActionClassName = `${actionButtonClassName} bg-slate-900 text-white hover:bg-slate-800`;
  const successActionClassName = `${actionButtonClassName} border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`;
  const destructiveActionClassName = `${actionButtonClassName} border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100`;
  const progressActionClassName = `${actionButtonClassName} border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100`;
  const supportActionClassName = `${actionButtonClassName} border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100`;

  const renderPremiumTaskActions = (task: OperationalTask) => {
    const busy = updatingOrderId === task.orderId;
    const chatBusy = chatLoadingOrderId === task.orderId;
    const shareBusy = sharingTaskId === task.orderId;
    const supportBusy = supportBusyTaskId === task.orderId;
    const transitions = getTaskTransitions(task);
    const canQuote = canManageQuote(task);
    const canView = canViewQuote(task);
    const supportAvailability = getSupportAvailability(task);
    const supportEntries = supportRequestsByTaskId.get(task.orderId) || [];
    const openSupport = supportEntries.find((request) => isSupportOpen(request.status));
    const isExpanded = expandedTaskId === task.orderId;
    const quoteOpen = quoteEditorTaskId === task.orderId;

    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setExpandedTaskId((current) => {
              const nextValue = current === task.orderId ? null : task.orderId;
              if (!nextValue && quoteEditorTaskId === task.orderId) {
                setQuoteEditorTaskId(null);
              }
              return nextValue;
            });
          }}
          className={subtleActionClassName}
        >
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {isExpanded ? "Hide details" : isHistoryTask(task) ? "View details" : "Track"}
        </button>

        {canQuote ? (
          <button
            type="button"
            onClick={() => {
              setExpandedTaskId(task.orderId);
              setQuoteEditorTaskId((current) => (current === task.orderId ? null : task.orderId));
            }}
            className={progressActionClassName}
          >
            <DollarSign className="h-4 w-4" />
            {quoteOpen ? "Hide quote" : getQuoteActionLabel(task)}
          </button>
        ) : null}

        {canView ? (
          <button
            type="button"
            onClick={() => {
              setExpandedTaskId(task.orderId);
              setQuoteEditorTaskId((current) => (current === task.orderId ? null : task.orderId));
            }}
            className={progressActionClassName}
          >
            <DollarSign className="h-4 w-4" />
            {quoteOpen ? "Hide quote" : "View Quote"}
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => void startChat(task)}
          disabled={chatBusy || !task.counterpartyId}
          className={darkActionClassName}
        >
          <MessageCircle className="h-4 w-4" />
          {chatBusy ? "Opening..." : task.counterpartyId ? "Chat" : "Chat unavailable"}
        </button>

        <button
          type="button"
          onClick={() => void shareTaskLink(task)}
          disabled={shareBusy}
          className={subtleActionClassName}
        >
          <Share2 className="h-4 w-4" />
          {shareBusy ? "Sharing..." : "Share"}
        </button>

        <button
          type="button"
          onClick={() => void raiseTaskSupport(task)}
          disabled={supportBusy || (!supportAvailability.allowed && !openSupport)}
          title={!supportAvailability.allowed && !openSupport ? supportAvailability.reason : undefined}
          className={supportActionClassName}
        >
          <AlertCircle className="h-4 w-4" />
          {supportBusy
            ? "Opening issue..."
            : openSupport
              ? "Issue raised"
              : supportAvailability.allowed
                ? "Raise support"
                : "Support unavailable"}
        </button>

        {isHistoryTask(task) ? (
          <button type="button" onClick={() => repeatTaskFromHistory(task)} className={subtleActionClassName}>
            <Repeat2 className="h-4 w-4" />
            Repeat
          </button>
        ) : null}

        {transitions.map((nextStatus) => {
          const TransitionIcon = getTransitionIcon(nextStatus);
          const transitionClassName =
            nextStatus === "completed"
              ? successActionClassName
              : nextStatus === "cancelled" || nextStatus === "rejected"
                ? destructiveActionClassName
                : progressActionClassName;

          return (
            <button
              key={`${task.orderId}-${nextStatus}`}
              type="button"
              disabled={busy}
              onClick={() => void confirmAndRefreshTaskStatus(task, nextStatus)}
              className={transitionClassName}
            >
              <TransitionIcon className="h-4 w-4" />
              {busy ? "Updating..." : getTaskTransitionLabel(task, nextStatus)}
            </button>
          );
        })}
      </div>
    );
  };

  const compactStats = [
    {
      label: "Tracked",
      value: `${tasks.length}`,
      helper: "Total task records",
      icon: ListChecks,
      tone: "bg-[var(--brand-50)] text-[var(--brand-700)]",
    },
    {
      label: "Needs attention",
      value: `${actionRequiredCount}`,
      helper: "Active and pending work",
      icon: TrendingUp,
      tone: "bg-amber-50 text-amber-700",
    },
    {
      label: "Completion rate",
      value: `${completionRate}%`,
      helper: "Closed successfully",
      icon: CheckCheck,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Pipeline value",
      value: totalPipelineValue > 0 ? `INR ${formatCompactCurrency(totalPipelineValue)}` : "No pricing yet",
      helper: averageTicket > 0 ? `Avg ticket INR ${averageTicket.toLocaleString("en-IN")}` : "Waiting for priced tasks",
      icon: BarChart3,
      tone: "bg-sky-50 text-sky-700",
    },
  ] as const;

  const emptyState = (() => {
    if (selectedTaskView === "inbox") {
      return {
        title: "No nearby requests yet",
        copy: "When someone posts a request that matches your profile and location, it will appear here so you can accept it.",
        actionLabel: "Open marketplace",
        onAction: () => router.push("/dashboard"),
      };
    }

    if (tasks.length === 0) {
      return {
        title: "No live tasks yet",
        copy: "Posted requests and accepted work will appear here automatically once they exist in ServiQ.",
        actionLabel: "Open marketplace",
        onAction: () => router.push("/dashboard"),
      };
    }

    if (searchQuery.trim()) {
      return {
        title: "No results for this search",
        copy: "Try a different title, task ID, person, category, location, or status.",
        actionLabel: "Clear search",
        onAction: () => setSearchQuery(""),
      };
    }

    return {
      title: "No tasks found",
      copy: "Try a different search or reopen the marketplace to create or accept more work.",
      actionLabel: "Clear search",
      onAction: clearSearch,
    };
  })();

  const renderTaskCardPremium = (task: OperationalTask, options?: { history?: boolean }) => {
    const latestEvent = latestEventByOrderId.get(task.orderId);
    const taskActivity = getPremiumTaskActivity(task);
    const flowLabels = getPremiumTaskFlowLabels(task);
    const supportEntries = supportRequestsByTaskId.get(task.orderId) || [];
    const openSupport = supportEntries.find((request) => isSupportOpen(request.status));
    const progress = statusProgressMap[task.status];
    const nextAction = getPremiumTaskNextAction(task);
    const isExpanded = expandedTaskId === task.orderId;
    const supportAvailability = getSupportAvailability(task);
    const supportSummaryClassName = openSupport
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : supportEntries.length > 0
        ? "border-slate-200 bg-slate-50 text-slate-700"
        : supportAvailability.allowed
          ? "border-slate-200 bg-white text-slate-700"
          : "border-slate-200 bg-slate-50 text-slate-500";
    const cardToneClassName = options?.history
      ? "border-slate-200/90 bg-white"
      : "border-slate-200 bg-white shadow-[0_22px_60px_-42px_rgba(15,23,42,0.3)]";
    const creatorName = getTaskCreatorName(task);
    const creatorAvatar = getTaskCreatorAvatar(task);
    const creatorSummary = getTaskCreatorSummary(task);
    const participantCopy = getTaskParticipantCopy(task);
    const latestUpdateAt = formatAgo(latestEvent?.createdAtRaw || task.createdAtRaw, clockMs);
    const supportHeadline = openSupport
      ? formatSupportRequestStatus(openSupport.status)
      : supportEntries.length > 0
        ? `${supportEntries.length} support item${supportEntries.length === 1 ? "" : "s"}`
        : supportAvailability.allowed
          ? "No issues raised"
          : "Support unavailable";
    const supportCopy = openSupport
      ? `Opened ${formatAgo(openSupport.updatedAtRaw || openSupport.createdAtRaw, clockMs)}`
      : supportEntries.length > 0
        ? "Support history is linked to this task."
        : supportAvailability.allowed
          ? "Raise an issue if this workflow needs intervention."
          : supportAvailability.reason;
    const nextActionTone = getToneClassNames(
      openSupport
        ? "amber"
        : task.status === "in-progress"
          ? "violet"
          : task.status === "completed"
            ? "emerald"
            : task.status === "cancelled"
              ? "rose"
              : "sky"
    );
    const summaryItems = [
      { icon: DollarSign, value: task.budget || "Price on request" },
      { icon: MapPin, value: task.location },
      { icon: Clock, value: task.timeline || "Open" },
      { icon: Calendar, value: latestUpdateAt },
    ] as const;
    const visibleFlowLabels = flowLabels.slice(0, 2);

    return (
      <article
        key={task.id}
        ref={(node) => {
          taskCardRefs.current.set(task.orderId, node);
        }}
        className={`group relative flex h-full min-w-0 flex-col overflow-hidden rounded-[1.25rem] border p-3 transition hover:border-slate-300 hover:shadow-[0_20px_45px_-38px_rgba(15,23,42,0.28)] sm:p-4 ${cardToneClassName}`}
      >
        <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${getStatusAccentClass(task.status)}`} />

        <div className="flex h-full flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                {getListingTypeLabel(task.listingType)}
              </span>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getOrderStatusPillClass(task.rawStatus)}`}>
                {getTaskStatusLabel(task)}
              </span>
              {openSupport ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                  Support open
                </span>
              ) : null}
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                #{task.orderId.slice(0, 8)}
              </span>
            </div>

            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${getStatusColor(task.status)}`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  getToneClassNames(task.status === "completed" ? "emerald" : task.status === "cancelled" ? "rose" : task.status === "in-progress" ? "violet" : "sky").dot
                }`}
              />
              {formatTaskStatus(task.status)}
            </span>
          </div>

          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
            <div className="min-w-0 space-y-3">
              <div className="flex min-w-0 items-start gap-3">
                <Image
                  src={creatorAvatar}
                  alt={creatorName}
                  width={52}
                  height={52}
                  unoptimized
                  className="h-12 w-12 shrink-0 rounded-2xl border border-slate-200 object-cover sm:h-14 sm:w-14"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="font-semibold uppercase tracking-[0.16em] text-slate-500">Creator</span>
                    <span>{creatorSummary}</span>
                  </div>
                  <p className="mt-1 truncate text-base font-semibold text-slate-900">{creatorName}</p>
                  <p className="mt-1 truncate text-sm text-slate-500">{participantCopy}</p>
                  <h3 className="mt-1 break-words text-[1.05rem] font-semibold leading-tight text-slate-950 sm:text-[1.14rem]">
                    {task.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 break-words text-sm leading-6 text-slate-600">{task.description}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {summaryItems.map((item, index) => (
                  <span
                    key={`${task.orderId}-${index}`}
                    className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                  >
                    <item.icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{item.value}</span>
                  </span>
                ))}
                <span className={`inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${nextActionTone.card}`}>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{nextAction.title}</span>
                </span>
              </div>

              {latestEvent ? (
                <div className={`rounded-[1rem] border px-3 py-2.5 ${getToneClassNames(latestEvent.tone).card}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${getToneClassNames(latestEvent.tone).dot}`} />
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Latest update</p>
                      {latestEvent.statusLabel ? (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${getToneClassNames(latestEvent.tone).pill}`}>
                          {latestEvent.statusLabel}
                        </span>
                      ) : null}
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500">{formatAgo(latestEvent.createdAtRaw, clockMs)}</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{latestEvent.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-slate-700">{latestEvent.description}</p>
                </div>
              ) : null}

              {visibleFlowLabels.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {visibleFlowLabels.map((label) => (
                    <span
                      key={`${task.orderId}-${label}`}
                      className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-[1rem] border border-slate-200 bg-slate-50 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    <Activity className="h-3.5 w-3.5 shrink-0" />
                    Progress
                  </span>
                  <span className={`text-xs font-semibold ${getStatusTextClass(task.status)}`}>{progress}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                  <div className={`h-full rounded-full bg-gradient-to-r ${getStatusAccentClass(task.status)}`} style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-2 text-xs text-slate-500">Updated {latestUpdateAt}</p>
              </div>

              <div className={`rounded-[1rem] border px-3 py-2.5 ${supportSummaryClassName}`}>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em]">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Support
                </div>
                <p className="mt-1 text-sm font-semibold">{supportHeadline}</p>
                <p className="mt-0.5 line-clamp-2 text-xs leading-5">{supportCopy}</p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3">{renderPremiumTaskActions(task)}</div>

          {isExpanded ? (
            <div className="rounded-[1.55rem] border border-slate-200 bg-slate-50/90 p-4 sm:p-5">
              <div className="space-y-4">
                {(canManageQuote(task) || canViewQuote(task)) && quoteEditorTaskId === task.orderId ? (
                  <QuoteDraftEditor
                    orderId={task.source === "order" ? task.orderId : null}
                    helpRequestId={task.source === "help_request" ? task.helpRequestId : null}
                    onSent={(result) => {
                      setQuoteEditorTaskId(result.orderId);
                      setExpandedTaskId(result.orderId);
                      setNotice({
                        kind: "success",
                        message: `${task.title} quoted successfully. The live order is now synced for both sides.`,
                      });
                      startTransition(() => {
                        void loadTasks(true);
                      });
                    }}
                    onSaved={() => {
                      setNotice({
                        kind: "info",
                        message: `Quote draft saved for ${task.title}.`,
                      });
                    }}
                    onOpenChat={() => {
                      void startChat(task, { quote: true });
                    }}
                  />
                ) : null}

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Task tracking</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {flowLabels.map((label) => (
                      <span
                        key={`${task.orderId}-detail-${label}`}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  {taskActivity.map((event) => {
                    const toneClasses = getToneClassNames(event.tone);

                    return (
                      <div key={event.id} className={`rounded-[1.3rem] border px-4 py-3 ${toneClasses.card}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`h-2.5 w-2.5 rounded-full ${toneClasses.dot}`} />
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                {event.statusLabel || event.eventType.replace(/_/g, " ")}
                              </p>
                            </div>
                            <p className="mt-2 text-sm font-semibold text-slate-900">{event.title}</p>
                            <p className="mt-1.5 text-sm leading-6 text-slate-700">{event.description}</p>
                          </div>
                          <span className="shrink-0 text-[11px] font-semibold text-slate-500">{formatAgo(event.createdAtRaw, clockMs)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </article>
    );
  };

  const renderTrackedHelpRequestRow = (task: OperationalTask, options?: { cancelledHistory?: boolean }) => {
    const isCancelledHistory = options?.cancelledHistory ?? false;
    const creatorName = getTaskCreatorName(task);
    const creatorAvatar = getTaskCreatorAvatar(task);
    const creatorProfileId = task.postedBy.id || null;
    const chatBusy = chatLoadingOrderId === task.orderId;
    const busy = updatingOrderId === task.orderId;
    const transitions = getTaskTransitions(task);
    const latestEvent = latestEventByOrderId.get(task.orderId);
    const latestUpdateAt = formatAgo(latestEvent?.createdAtRaw || task.createdAtRaw, clockMs);
    const canonical = getCanonicalTaskStatus(task);
    const isExpanded = expandedTaskId === task.orderId;
    const progressStage = getTaskProgressStage(task);
    const providerCanDriveStages = task.type === "accepted" && (task.source === "order" || task.source === "help_request");
    const progressSteps = isCancelledHistory
      ? buildCancelledTrackerSteps(progressStage)
      : ([
          {
            key: "accepted",
            label: "Task accepted",
            state:
              progressStage === "pending_acceptance"
                ? "active"
                : progressStage === "accepted" ||
                    progressStage === "travel_started" ||
                    progressStage === "work_started" ||
                    progressStage === "completed"
                  ? "done"
                  : "upcoming",
          },
          {
            key: "travel_started",
            label: "Travel started",
            state:
              progressStage === "accepted"
                ? "active"
                : progressStage === "travel_started"
                  ? "done"
                  : progressStage === "work_started" || progressStage === "completed"
                    ? "done"
                    : "upcoming",
          },
          {
            key: "work_started",
            label: "Work started",
            state:
              progressStage === "travel_started"
                ? "active"
                : progressStage === "work_started"
                  ? "done"
                  : progressStage === "completed"
                    ? "done"
                    : "upcoming",
          },
          {
            key: "completed",
            label: "Work completed",
            state: progressStage === "work_started" ? "active" : progressStage === "completed" ? "done" : "upcoming",
          },
        ] as const);
    const primaryTransitions = transitions.filter((status) => status !== "cancelled" && status !== "rejected");
    const getStepAction = (stepKey: (typeof progressSteps)[number]["key"]) => {
      if (busy || isCancelledHistory) return null;

      if (stepKey === "accepted" && providerCanDriveStages && progressStage === "pending_acceptance") {
        return {
          label: "Accept task",
          onClick: () => void updateTaskProgressStage(task, "accepted"),
        };
      }

      if (stepKey === "travel_started" && providerCanDriveStages && progressStage === "accepted") {
        return {
          label: "Start travel",
          onClick: () => void updateTaskProgressStage(task, "travel_started"),
        };
      }

      if (stepKey === "work_started" && providerCanDriveStages && progressStage === "travel_started") {
        return {
          label: "Start work",
          onClick: () => void updateTaskProgressStage(task, "work_started"),
        };
      }

      if (stepKey === "completed" && progressStage === "work_started" && primaryTransitions.includes("completed")) {
        return {
          label: "Complete task",
          onClick: () => void confirmAndRefreshTaskStatus(task, "completed"),
        };
      }

      return null;
    };

    return (
      <article
        key={task.id}
        ref={(node) => {
          taskCardRefs.current.set(task.orderId, node);
        }}
        className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-[0_14px_40px_-32px_rgba(15,23,42,0.28)] transition hover:border-slate-300"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            {creatorProfileId ? (
              <button
                type="button"
                onClick={() => router.push(buildPublicProfilePath({ id: creatorProfileId, name: creatorName }))}
                aria-label={`Open ${creatorName} profile`}
                className="shrink-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-400)] focus-visible:ring-offset-2"
              >
                <Image
                  src={creatorAvatar}
                  alt={creatorName}
                  width={56}
                  height={56}
                  unoptimized
                  className="h-14 w-14 rounded-2xl border border-slate-200 object-cover"
                />
              </button>
            ) : (
              <Image
                src={creatorAvatar}
                alt={creatorName}
                width={56}
                height={56}
                unoptimized
                className="h-14 w-14 shrink-0 rounded-2xl border border-slate-200 object-cover"
              />
            )}

            <div className="min-w-0">
              {creatorProfileId ? (
                <button
                  type="button"
                  onClick={() => router.push(buildPublicProfilePath({ id: creatorProfileId, name: creatorName }))}
                  aria-label={`Open ${creatorName} profile`}
                  className="truncate text-left text-sm font-semibold text-slate-900 transition hover:text-[var(--brand-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-400)] focus-visible:ring-offset-2"
                >
                  {creatorName}
                </button>
              ) : (
                <p className="text-sm font-semibold text-slate-900">{creatorName}</p>
              )}
              <h3 className="mt-1 break-words text-lg font-semibold leading-tight text-slate-950">{task.title}</h3>
              <p className="mt-1 line-clamp-2 break-words text-sm leading-6 text-slate-600">
                {task.description || "No additional details"}
              </p>
            </div>
          </div>

          <div className="flex items-end justify-between gap-3 lg:min-w-[8.5rem] lg:flex-col lg:self-stretch">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void startChat(task)}
                disabled={chatBusy || !task.counterpartyId}
                title={task.counterpartyId ? "Chat" : "Chat unavailable"}
                aria-label={task.counterpartyId ? "Chat" : "Chat unavailable"}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <MessageCircle className="h-4 w-4" />
              </button>

              <button
                type="button"
                disabled
                title="Phone number is not available for this task yet."
                aria-label="Call unavailable"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Phone className="h-4 w-4" />
              </button>

              {!isCancelledHistory ? (
                <button
                  type="button"
                  onClick={() => void confirmAndRefreshTaskStatus(task, "cancelled")}
                  disabled={busy || !transitions.includes("cancelled")}
                  title={busy ? "Updating..." : "Decline task"}
                  aria-label={busy ? "Updating task" : "Decline task"}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => setExpandedTaskId((current) => (current === task.orderId ? null : task.orderId))}
              aria-label={isExpanded ? "Collapse task status" : "Expand task status"}
              title={isExpanded ? "Hide tracking" : "Show tracking"}
              className="inline-flex items-center justify-center p-0 text-slate-500 transition hover:text-[var(--brand-700)]"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {isExpanded ? (
          <div className="mt-4 border-t border-slate-200 pt-4">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {latestEvent?.title ||
                      (isCancelledHistory
                        ? "Task cancelled"
                        : canonical === "in_progress"
                          ? "Work is in progress"
                          : "Task accepted")}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {latestEvent?.description ||
                      (isCancelledHistory
                        ? describeCancelledTrackerStage(progressStage)
                        : "Open this tracker to follow updates and move the task to the next stage.")}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-slate-500">{latestUpdateAt}</span>
              </div>

              <div className="mt-5 space-y-4">
                {progressSteps.map((step, index) => {
                  const isDone = step.state === "done";
                  const isActiveStep = step.state === "active";
                  const isCancelledStep = step.state === "cancelled";
                  const stepAction = getStepAction(step.key);

                  return (
                    <div key={`${task.orderId}-${step.key}`} className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex flex-col items-center">
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold transition ${
                              isCancelledStep
                                ? "border-rose-200 bg-rose-100 text-rose-700"
                                : isDone
                                  ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                                  : isActiveStep
                                    ? "border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)]"
                                    : "border-slate-200 bg-white text-slate-400"
                            }`}
                          >
                            {isCancelledStep ? <X className="h-3.5 w-3.5" /> : isDone ? "✓" : ""}
                          </span>
                          {index < progressSteps.length - 1 ? (
                            <span
                              className={`mt-1 h-8 w-px ${
                                isCancelledStep ? "bg-rose-200" : isDone || isActiveStep ? "bg-emerald-200" : "bg-slate-200"
                              }`}
                            />
                          ) : null}
                        </div>

                        <div className="min-w-0 pt-0.5">
                          <p
                            className={`text-sm font-semibold ${
                              isCancelledStep ? "text-rose-700" : isActiveStep ? "text-slate-950" : "text-slate-700"
                            }`}
                          >
                            {step.label}
                          </p>
                        </div>
                      </div>

                      {stepAction ? (
                        <button
                          type="button"
                          onClick={stepAction.onClick}
                          className="shrink-0 rounded-full bg-[linear-gradient(135deg,#2d7a63,#6ac48f)] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-95"
                        >
                          {stepAction.label}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </article>
    );
  };

  const renderCompletedTaskRow = (task: OperationalTask) => {
    const creatorName = getTaskCreatorName(task);
    const creatorAvatar = getTaskCreatorAvatar(task);
    const creatorProfileId = task.postedBy.id || null;
    const latestEvent = latestEventByOrderId.get(task.orderId);
    const latestUpdateAt = formatAgo(latestEvent?.createdAtRaw || task.createdAtRaw, clockMs);
    const reviewDraft = taskReviews[task.orderId] || { rating: 0, comment: "", submitted: false };
    const rating = reviewDraft.rating;
    const reviewSubmitted = reviewDraft.submitted;
    const canReviewTask = Boolean(getTaskReviewTargetId(task));
    const isReviewExpanded = commentComposerTaskId === task.orderId;
    const commentDraft = reviewDraft.comment;
    const reviewBusy = reviewBusyTaskId === task.orderId;

    return (
      <article
        key={task.id}
        ref={(node) => {
          taskCardRefs.current.set(task.orderId, node);
        }}
        className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-[0_14px_40px_-32px_rgba(15,23,42,0.28)] transition hover:border-slate-300"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            {creatorProfileId ? (
              <button
                type="button"
                onClick={() => router.push(buildPublicProfilePath({ id: creatorProfileId, name: creatorName }))}
                aria-label={`Open ${creatorName} profile`}
                className="shrink-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-400)] focus-visible:ring-offset-2"
              >
                <Image
                  src={creatorAvatar}
                  alt={creatorName}
                  width={56}
                  height={56}
                  unoptimized
                  className="h-14 w-14 rounded-2xl border border-slate-200 object-cover"
                />
              </button>
            ) : (
              <Image
                src={creatorAvatar}
                alt={creatorName}
                width={56}
                height={56}
                unoptimized
                className="h-14 w-14 shrink-0 rounded-2xl border border-slate-200 object-cover"
              />
            )}

            <div className="min-w-0">
              {creatorProfileId ? (
                <button
                  type="button"
                  onClick={() => router.push(buildPublicProfilePath({ id: creatorProfileId, name: creatorName }))}
                  aria-label={`Open ${creatorName} profile`}
                  className="truncate text-left text-sm font-semibold text-slate-900 transition hover:text-[var(--brand-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-400)] focus-visible:ring-offset-2"
                >
                  {creatorName}
                </button>
              ) : (
                <p className="text-sm font-semibold text-slate-900">{creatorName}</p>
              )}
              <p className="mt-0.5 truncate text-[11px] text-slate-400">{task.location}</p>
              <h3 className="mt-1 break-words text-lg font-semibold leading-tight text-slate-950">{task.title}</h3>
              <p className="mt-1 line-clamp-2 break-words text-sm leading-6 text-slate-600">
                {task.description || "No additional details"}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>{latestUpdateAt}</span>
              </div>
            </div>
          </div>

          <div className="shrink-0 flex items-start justify-between gap-3 lg:min-w-[12rem] lg:self-start lg:justify-end">
            {reviewSubmitted ? (
              <div className="flex items-center gap-1">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }, (_, index) => {
                    const starValue = index + 1;
                    const active = starValue <= rating;

                    return (
                      <span
                        key={`${task.orderId}-submitted-rating-${starValue}`}
                        className={active ? "text-amber-400" : "text-slate-300"}
                      >
                        <Star className={`h-5 w-5 ${active ? "fill-current" : ""}`} />
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : canReviewTask ? (
              <button
                type="button"
                onClick={() => setCommentComposerTaskId((current) => (current === task.orderId ? null : task.orderId))}
                className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-[var(--brand-700)] transition hover:border-[var(--brand-500)]/35 hover:text-[var(--brand-800)]"
              >
                {isReviewExpanded ? "Hide review" : "Add review"}
              </button>
            ) : (
              <span className="text-xs font-medium text-slate-400">Review unavailable</span>
            )}
          </div>
        </div>

        {isReviewExpanded && canReviewTask && !reviewSubmitted ? (
          <div className="mt-4 rounded-[1.15rem] border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }, (_, index) => {
                const starValue = index + 1;
                const active = starValue <= rating;

                return (
                  <button
                    key={`${task.orderId}-draft-rating-${starValue}`}
                    type="button"
                    onClick={() =>
                      setTaskReviews((current) => ({
                        ...current,
                        [task.orderId]: {
                          rating: starValue,
                          comment: commentDraft,
                          submitted: false,
                        },
                      }))
                    }
                    aria-label={`Choose ${starValue} star${starValue === 1 ? "" : "s"} for ${task.title}`}
                    title={`${starValue} star${starValue === 1 ? "" : "s"}`}
                    className={`transition ${active ? "text-amber-400" : "text-slate-300 hover:text-amber-300"}`}
                  >
                    <Star className={`h-6 w-6 ${active ? "fill-current" : ""}`} />
                  </button>
                );
              })}
            </div>
            <textarea
              value={commentDraft}
              onChange={(event) =>
                setTaskReviews((current) => ({
                  ...current,
                  [task.orderId]: {
                    rating,
                    comment: event.target.value,
                    submitted: false,
                  },
                }))
              }
              rows={3}
              placeholder="Write a quick comment about the completed task"
              className="mt-3 w-full resize-none rounded-[1rem] border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[var(--brand-500)]/45"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCommentComposerTaskId(null)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  void submitTaskReview(task, {
                    rating: Math.max(1, rating || 5),
                    comment: commentDraft,
                    submitted: false,
                  })
                }
                disabled={reviewBusy}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {reviewBusy ? "Saving..." : "Submit review"}
              </button>
            </div>
          </div>
        ) : null}
      </article>
    );
  };

  const realtimeMeta = realtimeStateMeta[realtimeState];
  const RealtimeIcon = realtimeMeta.icon;

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-5 px-3 sm:space-y-6 sm:px-5 lg:space-y-7 lg:px-6">
      <RouteObservability route="tasks" />

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="market-hero-surface relative overflow-hidden rounded-[1.6rem] border border-white/70 bg-white/88 p-4 shadow-[0_24px_70px_-54px_rgba(15,23,42,0.38)] backdrop-blur"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,164,0.14),transparent_32%),radial-gradient(circle_at_top_right,rgba(17,70,106,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.76),rgba(255,255,255,0.96))]" />

        <div className="relative space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[var(--brand-500)]/20 bg-[var(--brand-50)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-700)]">
                  ServiQ Operations
                </span>
                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${realtimeMeta.className}`}>
                  <RealtimeIcon className={`h-3.5 w-3.5 ${loading || realtimeState === "connecting" ? "animate-spin" : ""}`} />
                  {loading ? "Syncing tasks..." : realtimeMeta.label}
                </span>
              </div>

              <div>
                <h1 className="brand-display text-[1.55rem] font-semibold leading-tight text-slate-950 sm:text-[1.8rem]">Tasks Workspace</h1>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                  Order-history style tracking for posted requests, accepted work, support follow-up, and completed history.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700">{tasks.length} tracked</span>
                <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  {actionRequiredCount} need attention
                </span>
                <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  Last sync {lastSyncAt ? formatAgo(lastSyncAt, clockMs) : "waiting"}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void loadTasks(true)} disabled={loading} className={darkActionClassName}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => {
                  scrollToSection(liveOrdersSectionRef);
                }}
                className={subtleActionClassName}
              >
                <TrendingUp className="h-4 w-4" />
                Focus attention
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
            {compactStats.map((stat) => (
              <div key={stat.label} className="rounded-[1rem] border border-slate-200 bg-white/92 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">{stat.label}</p>
                    <p className="mt-0.5 text-base font-bold text-slate-950 leading-tight">{stat.value}</p>
                  </div>
                  <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${stat.tone}`}>
                    <stat.icon className="h-3.5 w-3.5" />
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 leading-tight">{stat.helper}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {errorMessage ? (
        <div className="rounded-[1.2rem] border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>
      ) : null}

      {notice ? (
        <div
          className={`rounded-[1.2rem] border px-4 py-3 text-sm ${
            notice.kind === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
              : "border-sky-300 bg-sky-50 text-sky-700"
          }`}
        >
          {notice.message}
        </div>
      ) : null}

      <div className="space-y-5">
          <section
            ref={liveOrdersSectionRef}
            className="space-y-5 rounded-[1.9rem] border border-white/70 bg-white/90 p-4 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.44)] backdrop-blur sm:p-5"
          >
            <div className="space-y-4 border-b border-slate-200 pb-4">
              <div className="-mx-4 flex items-end gap-6 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:gap-8 sm:px-0 sm:[scrollbar-width:auto]">
                {taskTabs.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setSelectedTaskView(tab.value)}
                    className={`inline-flex shrink-0 border-b-[3px] pb-4 text-base font-semibold transition ${
                      selectedTaskView === tab.value
                        ? "border-[#0a66c2] text-[#0a66c2]"
                        : "border-transparent text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-700)]">Task workspace</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950 sm:text-xl">Search and sort your live work</h2>
                </div>

                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  <BarChart3 className="h-3.5 w-3.5" />
                  {filteredTasks.length} visible
                </span>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                <label className="flex items-center gap-3 rounded-[1.35rem] border border-slate-200 bg-white px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition focus-within:border-[var(--brand-500)]/45 focus-within:shadow-[0_0_0_4px_var(--brand-ring)]">
                  <Search className="h-4.5 w-4.5 text-slate-400" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search by title, order ID, status, person, category, location, or tags"
                    className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                  />
                </label>

                <label className="flex items-center gap-2 rounded-[1.2rem] border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
                  <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Sort</span>
                  <select value={sortBy} onChange={(event) => setSortBy(event.target.value as TaskSortOption)} className="w-full bg-transparent text-sm font-medium outline-none">
                    <option value="updated">Recently updated</option>
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-2xl font-semibold text-slate-950">
                  {selectedTaskView === "inbox"
                    ? "Nearby Requests"
                    : selectedTaskView === "saved"
                    ? "Saved requests"
                    : selectedTaskView === "cancelled"
                      ? "Cancelled requests"
                    : selectedTaskView === "completed"
                      ? "Completed requests"
                      : "In progress"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedTaskView === "inbox"
                    ? "Help requests matched to your profile. Accept one to get started."
                    : selectedTaskView === "saved"
                    ? "Open requests that are still waiting for action."
                    : selectedTaskView === "cancelled"
                      ? "Requests that were cancelled or declined and are no longer active."
                    : selectedTaskView === "completed"
                      ? "Completed work that has already been closed out."
                      : "Accepted work that is currently active and needs follow-through."}
                </p>
              </div>
              <p className="text-sm text-slate-500">
                {selectedTaskView === "inbox" ? inboxMatches.length : visibleTasks.length} visible
              </p>
            </div>

            {selectedTaskView === "inbox" ? (
              inboxLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
                      <div className="mt-3 h-3 w-3/4 animate-pulse rounded bg-slate-100" />
                      <div className="mt-4 h-10 animate-pulse rounded-[1.2rem] bg-slate-100" />
                    </div>
                  ))}
                </div>
              ) : inboxMatches.length > 0 ? (
                <div className="space-y-3">
                  {inboxMatches.map((matchItem) => {
                    const req = matchItem.help_requests;
                    const isFocused = focusedMatchId === matchItem.id;
                    const isAccepting = acceptingMatchId === matchItem.id;
                    const budget = formatTaskBudget(req?.budget_min ?? null, req?.budget_max ?? null);
                    const timeAgo = formatAgo(matchItem.created_at, clockMs);
                    const distanceLabel =
                      matchItem.distance_km != null
                        ? matchItem.distance_km < 1
                          ? `${Math.round(matchItem.distance_km * 1000)} m away`
                          : `${matchItem.distance_km.toFixed(1)} km away`
                        : null;

                    return (
                      <article
                        key={matchItem.id}
                        ref={(node) => {
                          inboxCardRefs.current.set(matchItem.id, node);
                        }}
                        className={`relative overflow-hidden rounded-[1.25rem] border p-4 transition ${
                          isFocused
                            ? "border-[var(--brand-500)] bg-[var(--brand-50)] shadow-[0_0_0_3px_var(--brand-ring)]"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-[0_8px_32px_-20px_rgba(15,23,42,0.2)]"
                        }`}
                      >
                        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--brand-500)] to-[var(--brand-700)]" />

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              {req?.category ? (
                                <span className="inline-flex items-center rounded-full bg-[var(--brand-50)] px-2.5 py-1 text-[11px] font-semibold text-[var(--brand-700)]">
                                  {req.category}
                                </span>
                              ) : null}
                              {distanceLabel ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                  <MapPin className="h-3 w-3" />
                                  {distanceLabel}
                                </span>
                              ) : null}
                              {matchItem.score != null ? (
                                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                                  {Math.round(matchItem.score * 100)}% match
                                </span>
                              ) : null}
                            </div>

                            <h3 className="break-words text-base font-semibold leading-snug text-slate-950">
                              {req?.title || req?.category || "Service request"}
                            </h3>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                              {req?.location_label ? (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3 shrink-0" />
                                  {req.location_label}
                                </span>
                              ) : null}
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3 shrink-0" />
                                {timeAgo}
                              </span>
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3 shrink-0" />
                                {budget}
                              </span>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                            <button
                              type="button"
                              onClick={() => void acceptInboxMatch(matchItem)}
                              disabled={isAccepting || Boolean(acceptingMatchId)}
                              className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-[var(--brand-900)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isAccepting ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Accepting...
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="h-4 w-4" />
                                  Accept
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : null
            ) : loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
                    <div className="mt-3 h-3 w-3/4 animate-pulse rounded bg-slate-100" />
                    <div className="mt-4 h-10 animate-pulse rounded-[1.2rem] bg-slate-100" />
                  </div>
                ))}
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading task workspace...
                </div>
              </div>
            ) : visibleTasks.length > 0 ? (
              <div className="space-y-3">
                {selectedTaskView === "completed" && pendingReviewCount > 0 ? (
                  <div className="flex items-start gap-3 rounded-[1.3rem] border border-amber-200 bg-amber-50/70 px-4 py-3">
                    <Star className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-amber-900">
                        {pendingReviewCount === 1
                          ? "1 completed task awaiting your review"
                          : `${pendingReviewCount} completed tasks awaiting your reviews`}
                      </p>
                      <p className="mt-0.5 text-xs text-amber-700">
                        Reviews help providers build trust and improve the community. Tap &quot;Add review&quot; on any task below.
                      </p>
                    </div>
                  </div>
                ) : null}
                {visibleTasks.map((task) =>
                  selectedTaskView === "in-progress"
                    ? renderTrackedHelpRequestRow(task)
                    : selectedTaskView === "completed"
                      ? renderCompletedTaskRow(task)
                    : selectedTaskView === "cancelled" && task.source === "help_request"
                      ? renderTrackedHelpRequestRow(task, { cancelledHistory: true })
                    : renderTaskCardPremium(task, {
                        history: selectedTaskView === "cancelled",
                      })
                )}
              </div>
            ) : null}
          </section>

          {!loading && (selectedTaskView === "inbox" ? inboxMatches.length === 0 && !inboxLoading : visibleTasks.length === 0) ? (
            <div className="rounded-[1.9rem] border border-slate-200 bg-white px-6 py-16 text-center shadow-[0_24px_70px_-46px_rgba(15,23,42,0.36)]">
              {selectedTaskView === "inbox" ? (
                <Inbox className="mx-auto h-14 w-14 text-slate-400" />
              ) : (
                <Package className="mx-auto h-14 w-14 text-slate-400" />
              )}
              <h3 className="mt-5 text-xl font-semibold text-slate-950">{emptyState.title}</h3>
              <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">{emptyState.copy}</p>
              <button type="button" onClick={emptyState.onAction} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[var(--brand-900)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]">
                <Sparkles className="h-4 w-4" />
                {emptyState.actionLabel}
              </button>
            </div>
          ) : null}
      </div>
    </div>
  );
}
