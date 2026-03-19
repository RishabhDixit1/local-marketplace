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
  ListChecks,
  Loader2,
  MapPin,
  MessageCircle,
  Package,
  RefreshCw,
  Repeat2,
  Search,
  Share2,
  Sparkles,
  TrendingUp,
  Wifi,
  WifiOff,
} from "lucide-react";
import RouteObservability from "@/app/components/RouteObservability";
import { createAvatarFallback } from "@/lib/avatarFallback";
import { fetchAuthedJson } from "@/lib/clientApi";
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

type TaskTab = "all" | "posted" | "accepted";
type RealtimeState = "connecting" | "live" | "offline";
type TaskSortOption = "updated" | "newest" | "oldest";
type TaskStatusFilter =
  | "all"
  | "awaiting-action"
  | "active"
  | "in-progress"
  | "completed"
  | "cancelled"
  | "rejected"
  | "support";
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

const getCounterpartyLabel = (task: Task) =>
  task.type === "posted" ? task.assignedTo?.name || "Awaiting provider" : task.postedBy.name || "Requester";

const getCounterpartyAvatar = (task: Task) =>
  task.type === "posted" ? task.assignedTo?.image || fallbackAvatar : task.postedBy.image || fallbackAvatar;

const getCounterpartyMetaLabel = (task: Task) =>
  task.type === "posted" ? (task.assignedTo ? "Provider" : "Status") : "Requester";

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
const isRecursivePolicyError = (message: string) => /infinite recursion detected in policy/i.test(message);

const isSupportOpen = (status: string) => ["pending", "sent"].includes(status);

const formatTaskBudget = (min: number | null, max: number | null) => {
  const top = Number.isFinite(Number(max)) && Number(max) > 0 ? Number(max) : null;
  const base = Number.isFinite(Number(min)) && Number(min) > 0 ? Number(min) : null;
  const value = top ?? base;
  return value ? `INR ${value.toLocaleString("en-IN")}` : "Price on request";
};

const buildTaskAvatar = (profile: ProfileRow | null | undefined, fallbackLabel: string, seed: string) =>
  resolveProfileAvatarUrl(profile?.avatar_url) || createAvatarFallback({ label: profile?.name || fallbackLabel, seed });

const mapHelpRequestToTask = (params: {
  request: HelpRequestRow;
  currentUserId: string;
  profileMap: Map<string, ProfileRow>;
}): OperationalTask => {
  const { request, currentUserId, profileMap } = params;
  const requesterProfile = request.requester_id ? profileMap.get(request.requester_id) : null;
  const providerProfile = request.accepted_provider_id ? profileMap.get(request.accepted_provider_id) : null;
  const isPostedByMe = request.requester_id === currentUserId;
  const counterpartyId = isPostedByMe ? request.accepted_provider_id : request.requester_id;

  return {
    id: request.id,
    orderId: request.id,
    source: "help_request",
    helpRequestId: request.id,
    title: request.title?.trim() || request.category?.trim() || "Service request",
    description: request.details?.trim() || "Live request posted on ServiQ.",
    type: isPostedByMe ? "posted" : "accepted",
    status: normalizeTaskStatus(request.status),
    rawStatus: request.status || "open",
    budget: formatTaskBudget(request.budget_min, request.budget_max),
    timeline: timelineFromStatus(request.status),
    location: request.location_label?.trim() || requesterProfile?.location || providerProfile?.location || "Nearby",
    postedBy: {
      id: request.requester_id || "unknown-requester",
      name: isPostedByMe ? "You" : requesterProfile?.name || "Requester",
      image: isPostedByMe
        ? buildTaskAvatar(profileMap.get(currentUserId), "You", currentUserId)
        : buildTaskAvatar(requesterProfile, "Requester", request.requester_id || request.id),
    },
    assignedTo: request.accepted_provider_id
      ? {
          id: request.accepted_provider_id,
          name: !isPostedByMe ? "You" : providerProfile?.name || "Provider",
          image: !isPostedByMe
            ? buildTaskAvatar(profileMap.get(currentUserId), "You", currentUserId)
            : buildTaskAvatar(providerProfile, "Provider", request.accepted_provider_id),
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

const getCanonicalTaskStatus = (task: OperationalTask) => {
  if (task.source === "help_request" && (task.rawStatus || "").toLowerCase() === "open") {
    return "open";
  }

  return normalizeOrderStatus(task.rawStatus);
};

const isHistoryTask = (task: OperationalTask) => {
  const canonical = getCanonicalTaskStatus(task);
  return canonical === "completed" || canonical === "closed" || canonical === "cancelled" || canonical === "rejected";
};

export default function TasksPage() {
  const router = useRouter();
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveOrdersSectionRef = useRef<HTMLDivElement | null>(null);
  const historySectionRef = useRef<HTMLElement | null>(null);
  const taskCardRefs = useRef(new Map<string, HTMLElement | null>());
  const [selectedTab, setSelectedTab] = useState<TaskTab>("all");
  const [selectedStatus, setSelectedStatus] = useState<TaskStatusFilter>("all");
  const [sortBy, setSortBy] = useState<TaskSortOption>("updated");
  const [tasks, setTasks] = useState<OperationalTask[]>([]);
  const [taskEvents, setTaskEvents] = useState<TaskEventFeedItem[]>([]);
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [chatLoadingOrderId, setChatLoadingOrderId] = useState<string | null>(null);
  const [sharingTaskId, setSharingTaskId] = useState<string | null>(null);
  const [supportBusyTaskId, setSupportBusyTaskId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("focus");
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState<TaskNotice>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [realtimeState, setRealtimeState] = useState<RealtimeState>("connecting");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [liveUpdateCount, setLiveUpdateCount] = useState(0);
  const [clockMs, setClockMs] = useState(demoNow);
  const [supportBackendReady, setSupportBackendReady] = useState<boolean | null>(null);
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

      const [ordersRes, helpRequestsRes] = await Promise.all([
        supabase
          .from("orders")
          .select("*")
          .or(`consumer_id.eq.${user.id},provider_id.eq.${user.id}`)
          .order("created_at", { ascending: false })
          .limit(120),
        supabase
          .from("help_requests")
          .select("id,requester_id,accepted_provider_id,title,details,category,budget_min,budget_max,location_label,status,created_at")
          .or(`requester_id.eq.${user.id},accepted_provider_id.eq.${user.id}`)
          .order("created_at", { ascending: false })
          .limit(120),
      ]);

      if (ordersRes.error) {
        setTasks([]);
        setTaskEvents([]);
        setRealtimeState("offline");
        setLoading(false);
        setErrorMessage(`Could not load live tasks: ${ordersRes.error.message}`);
        return;
      }

      const helpRequestError =
        helpRequestsRes.error && !isMissingSupabaseRelation(helpRequestsRes.error.message || "") ? helpRequestsRes.error : null;
      const liveOrders = (ordersRes.data as OrderRow[] | null) || [];
      let liveHelpRequests = helpRequestError ? [] : ((helpRequestsRes.data as HelpRequestRow[] | null) || []);

      if (helpRequestError && isRecursivePolicyError(helpRequestsRes.error?.message || "")) {
        const payload = await fetchAuthedJson<
          { ok: true; requests: HelpRequestRow[] } | { ok: false; message?: string }
        >(supabase, "/api/tasks/help-requests", {
          method: "GET",
        });

        if (!payload.ok) {
          throw new Error(payload.message || "Help request activity unavailable.");
        }

        liveHelpRequests = payload.requests || [];
      }
      const effectiveHelpRequestError =
        helpRequestError && !isRecursivePolicyError(helpRequestError.message || "") ? helpRequestError : null;

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
        profileIds.length
          ? supabase.from("profiles").select("id,name,avatar_url,location").in("id", profileIds)
          : Promise.resolve({ data: [] as ProfileRow[], error: null }),
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

      const profileMap = new Map<string, ProfileRow>(((profilesRes.data as ProfileRow[] | null) || []).map((row) => [row.id, row]));
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
      } else if (effectiveHelpRequestError) {
        setErrorMessage(`Help request activity unavailable: ${effectiveHelpRequestError.message}`);
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

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClockMs(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const queueRealtimeRefresh = useEffectEvent(() => {
    setLiveUpdateCount((current) => current + 1);

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

  const actionRequiredCount = statusCounts.awaitingAction + statusCounts.active + statusCounts.inProgress;

  const filteredTasks = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();

    return tasks
      .filter((task) => {
        const canonical = getCanonicalTaskStatus(task);
        const hasSupport = supportRequestsByTaskId.has(task.orderId);
        const matchesTab = selectedTab === "all" || task.type === selectedTab;
        const matchesStatus =
          selectedStatus === "all" ||
          (selectedStatus === "awaiting-action" &&
            (canonical === "open" || canonical === "new_lead" || canonical === "quoted")) ||
          (selectedStatus === "active" && canonical === "accepted") ||
          (selectedStatus === "in-progress" && canonical === "in_progress") ||
          (selectedStatus === "completed" && (canonical === "completed" || canonical === "closed")) ||
          (selectedStatus === "cancelled" && canonical === "cancelled") ||
          (selectedStatus === "rejected" && canonical === "rejected") ||
          (selectedStatus === "support" && (hasSupport || canonical === "cancelled" || canonical === "rejected"));

        if (!matchesTab || !matchesStatus) return false;
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
  }, [deferredSearchQuery, latestEventByOrderId, selectedStatus, selectedTab, sortBy, supportRequestsByTaskId, tasks]);

  const filteredLiveTasks = useMemo(
    () => filteredTasks.filter((task) => !isHistoryTask(task)),
    [filteredTasks]
  );

  const filteredHistoryTasks = useMemo(
    () => filteredTasks.filter((task) => isHistoryTask(task)),
    [filteredTasks]
  );

  const tabs = useMemo(
    () => [
      { value: "all", label: "All Tasks", count: tasks.length },
      { value: "posted", label: "Posted by Me", count: tasks.filter((task) => task.type === "posted").length },
      { value: "accepted", label: "Accepted by Me", count: tasks.filter((task) => task.type === "accepted").length },
    ],
    [tasks]
  );

  const statusFilters = [
    { value: "all", label: "All tasks", icon: Package },
    { value: "awaiting-action", label: "Awaiting action", icon: Clock },
    { value: "active", label: "Active", icon: Activity },
    { value: "in-progress", label: "In progress", icon: TrendingUp },
    { value: "completed", label: "Completed", icon: CheckCircle2 },
    { value: "cancelled", label: "Cancelled", icon: AlertCircle },
    { value: "rejected", label: "Rejected", icon: AlertCircle },
    { value: "support", label: "Support / issues", icon: AlertCircle },
  ] satisfies Array<{ value: TaskStatusFilter; label: string; icon: typeof Package }>;

  const recentActivity = useMemo(() => taskEvents.slice(0, 4), [taskEvents]);

  const getTaskStatusLabel = (task: OperationalTask) => {
    if (task.source === "help_request" && (!task.rawStatus || task.rawStatus === "open")) return "Open";
    return getOrderStatusLabel(task.rawStatus);
  };

  const getTaskTransitions = (task: OperationalTask): CanonicalOrderStatus[] => {
    if (task.source === "help_request") {
      const normalized = (task.rawStatus || "").toLowerCase();
      if (task.type === "accepted") {
        if (normalized === "accepted") return ["in_progress", "completed"];
        if (normalized === "in_progress") return ["completed"];
        return [];
      }
      if (normalized === "completed" || normalized === "cancelled") return [];
      if (normalized === "accepted" || normalized === "in_progress") return ["completed", "cancelled"];
      return ["cancelled"];
    }

    const actor: OrderActorRole = task.type === "posted" ? "consumer" : "provider";
    return getAllowedTransitions(task.rawStatus, actor).filter((status) => status !== "closed");
  };

  const getTaskTransitionLabel = (task: OperationalTask, nextStatus: CanonicalOrderStatus) => {
    if (task.source === "help_request") {
      if (nextStatus === "in_progress") return "Start work";
      if (nextStatus === "completed") return task.type === "posted" ? "Confirm completion" : "Mark complete";
      if (nextStatus === "cancelled") return task.type === "posted" ? "Cancel request" : "Cancel";
    }

    const actor: OrderActorRole = task.type === "posted" ? "consumer" : "provider";
    return getTransitionActionLabel({ actor, nextStatus });
  };

  const startChat = async (task: OperationalTask) => {
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
      router.push(`/dashboard/chat?open=${targetConversationId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start chat.";
      setErrorMessage(`Unable to start chat. ${message}`);
    } finally {
      setChatLoadingOrderId(null);
    }
  };

  const updateOrderStatus = async (task: OperationalTask, nextStatus: CanonicalOrderStatus) => {
    setErrorMessage("");
    setUpdatingOrderId(task.orderId);

    try {
      if (task.source === "help_request") {
        if (!task.helpRequestId) {
          setErrorMessage("This request is missing its live task reference.");
          return false;
        }

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

  const clearAllFilters = useCallback(() => {
    setSelectedTab("all");
    setSelectedStatus("all");
    setSortBy("updated");
    setSearchQuery("");
  }, []);

  const revealTask = useCallback(
    (taskId: string) => {
      setSelectedTab("all");
      setSelectedStatus("all");
      setExpandedTaskId(taskId);
      scrollToSection(liveOrdersSectionRef);
    },
    [scrollToSection]
  );

  const confirmAndRefreshTaskStatus = async (task: OperationalTask, nextStatus: CanonicalOrderStatus) => {
    let confirmationMessage = "";

    if (nextStatus === "completed") {
      confirmationMessage = "Mark this task as completed? This will update the live task status for both sides.";
    } else if (nextStatus === "cancelled") {
      confirmationMessage = "Cancel this task? Use this only when the work is no longer going ahead.";
    } else if (nextStatus === "rejected") {
      confirmationMessage = "Reject this task? This will keep the task in history and may need follow-up.";
    }

    if (confirmationMessage && typeof window !== "undefined" && !window.confirm(confirmationMessage)) {
      return;
    }

    const didUpdate = await updateOrderStatus(task, nextStatus);
    if (!didUpdate) return;

    setNotice({
      kind: "success",
      message: `${task.title} updated to ${getOrderStatusLabel(nextStatus).toLowerCase()}.`,
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
      setSelectedStatus("support");
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
      setSelectedStatus("support");
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

  const getTransitionIcon = (status: CanonicalOrderStatus) => {
    if (status === "completed") return CheckCircle2;
    if (status === "cancelled" || status === "rejected") return AlertCircle;
    if (status === "in_progress" || status === "accepted" || status === "quoted") return TrendingUp;
    return ArrowUpRight;
  };

  const actionButtonClassName =
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";
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
    const supportAvailability = getSupportAvailability(task);
    const supportEntries = supportRequestsByTaskId.get(task.orderId) || [];
    const openSupport = supportEntries.find((request) => isSupportOpen(request.status));
    const isExpanded = expandedTaskId === task.orderId;

    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setExpandedTaskId((current) => (current === task.orderId ? null : task.orderId))}
          className={subtleActionClassName}
        >
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {isExpanded ? "Hide details" : isHistoryTask(task) ? "View details" : "Track"}
        </button>

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

  const activeFilterCount =
    Number(Boolean(searchQuery.trim())) +
    Number(selectedTab !== "all") +
    Number(selectedStatus !== "all") +
    Number(sortBy !== "updated");

  const hasTaskHistory = tasks.some((task) => isHistoryTask(task));
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

    if (selectedStatus === "support") {
      return {
        title: supportBackendReady === false ? "Support queue not configured" : "No issues raised",
        copy:
          supportBackendReady === false
            ? "The current environment is missing notification_escalations, so support issues cannot be persisted yet."
            : "You do not have any open support issues for the current filters.",
        actionLabel: "Show all tasks",
        onAction: clearAllFilters,
      };
    }

    if (selectedStatus === "completed") {
      return {
        title: "No completed tasks yet",
        copy: "Completed work will move here automatically once it closes out.",
        actionLabel: "Show all tasks",
        onAction: clearAllFilters,
      };
    }

    if (selectedStatus === "active" || selectedStatus === "in-progress" || selectedStatus === "awaiting-action") {
      return {
        title: "No live work in this view",
        copy: "Your filters are valid, but nothing currently matches this operational slice.",
        actionLabel: "Reset filters",
        onAction: clearAllFilters,
      };
    }

    return {
      title: "No tasks found",
      copy: "Try a different filter combination or reset the workspace to show everything again.",
      actionLabel: "Reset filters",
      onAction: clearAllFilters,
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
    const counterpartyLabel = getCounterpartyLabel(task);
    const counterpartyAvatar = getCounterpartyAvatar(task);
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

    return (
      <article
        key={task.id}
        ref={(node) => {
          taskCardRefs.current.set(task.orderId, node);
        }}
        className={`group relative overflow-hidden rounded-[1.9rem] border p-5 transition hover:-translate-y-0.5 hover:shadow-[0_28px_70px_-46px_rgba(15,23,42,0.35)] sm:p-6 ${cardToneClassName}`}
      >
        <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${getStatusAccentClass(task.status)}`} />

        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
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

              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold tracking-tight text-slate-950 sm:text-[1.35rem]">{task.title}</h3>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{task.description}</p>
                </div>

                <div className="w-full rounded-[1.3rem] border border-slate-200 bg-slate-50/80 px-4 py-3 xl:max-w-[320px]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Next best action</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{nextAction.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{nextAction.helper}</p>
                </div>
              </div>
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

          <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  <DollarSign className="h-3.5 w-3.5 text-slate-500" />
                  {task.budget || "Price on request"}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  <MapPin className="h-3.5 w-3.5 text-slate-500" />
                  {task.location}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  <Clock className="h-3.5 w-3.5 text-slate-500" />
                  {task.timeline || "Open"}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  <Calendar className="h-3.5 w-3.5 text-slate-500" />
                  {formatAgo(latestEvent?.createdAtRaw || task.createdAtRaw, clockMs)}
                </span>
              </div>

              {latestEvent ? (
                <div className={`rounded-[1.35rem] border px-4 py-3 ${getToneClassNames(latestEvent.tone).card}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${getToneClassNames(latestEvent.tone).dot}`} />
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Latest update</p>
                        {latestEvent.statusLabel ? (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${getToneClassNames(latestEvent.tone).pill}`}>
                            {latestEvent.statusLabel}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{latestEvent.title}</p>
                      <p className="mt-1.5 line-clamp-2 text-sm text-slate-700">{latestEvent.description}</p>
                    </div>
                    <span className="shrink-0 text-[11px] font-semibold text-slate-500">
                      {formatAgo(latestEvent.createdAtRaw, clockMs)}
                    </span>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-1.5">
                {flowLabels.map((label) => (
                  <span
                    key={`${task.orderId}-${label}`}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-[1.45rem] border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex items-center gap-3">
                  <Image
                    src={counterpartyAvatar}
                    alt={counterpartyLabel}
                    width={48}
                    height={48}
                    unoptimized
                    className="h-12 w-12 rounded-2xl border border-slate-200 object-cover"
                  />
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {getCounterpartyMetaLabel(task)}
                    </div>
                    <div className="truncate text-sm font-semibold text-slate-900">{counterpartyLabel}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{task.type === "posted" ? "Posted by you" : "Accepted by you"}</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 2xl:grid-cols-2">
                  <div className="rounded-xl bg-white px-3 py-2.5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Progress</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">{progress}%</div>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2.5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Updated</div>
                    <div className={`mt-1 text-sm font-semibold ${getStatusTextClass(task.status)}`}>
                      {formatAgo(latestEvent?.createdAtRaw || task.createdAtRaw, clockMs)}
                    </div>
                  </div>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                  <div className={`h-full rounded-full bg-gradient-to-r ${getStatusAccentClass(task.status)}`} style={{ width: `${progress}%` }} />
                </div>
              </div>

              <div className={`rounded-[1.35rem] border px-4 py-3 ${supportSummaryClassName}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">Support</p>
                    <p className="mt-1 text-sm font-semibold">
                      {openSupport
                        ? formatSupportRequestStatus(openSupport.status)
                        : supportEntries.length > 0
                          ? `${supportEntries.length} support item${supportEntries.length === 1 ? "" : "s"}`
                          : supportAvailability.allowed
                            ? "No issues raised"
                            : "Support unavailable"}
                    </p>
                    <p className="mt-1 text-xs leading-5">
                      {openSupport
                        ? `Opened ${formatAgo(openSupport.updatedAtRaw || openSupport.createdAtRaw, clockMs)}`
                        : supportEntries.length > 0
                          ? "This task has support history linked to it."
                          : supportAvailability.allowed
                            ? "Raise an issue if the workflow breaks or needs intervention."
                            : supportAvailability.reason}
                    </p>
                  </div>
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3">{renderPremiumTaskActions(task)}</div>

          {isExpanded ? (
            <div className="rounded-[1.55rem] border border-slate-200 bg-slate-50/90 p-4 sm:p-5">
              <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-4">
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

                <div className="space-y-3">
                  <div className="rounded-[1.3rem] border border-slate-200 bg-white p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Details</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 2xl:grid-cols-1">
                      <div>
                        <p className="text-xs font-medium text-slate-500">Task ID</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">#{task.orderId.slice(0, 8)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500">Category</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{task.tags[0] || "Task"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500">Ownership</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{task.type === "posted" ? "Posted by you" : "Accepted by you"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500">Location</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{task.location}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.3rem] border border-slate-200 bg-white p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Support queue</p>
                    {supportEntries.length > 0 ? (
                      <div className="mt-3 space-y-2.5">
                        {supportEntries.slice(0, 3).map((request) => (
                          <div key={request.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-slate-900">{formatSupportRequestStatus(request.status)}</p>
                              <span className="text-[11px] font-semibold text-slate-500">
                                {formatAgo(request.updatedAtRaw || request.createdAtRaw, clockMs)}
                              </span>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-slate-500">Target: {request.target}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                        {supportAvailability.allowed ? "No support issues have been raised for this task." : supportAvailability.reason}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
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
        className="market-hero-surface relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/88 p-4 shadow-[0_30px_90px_-56px_rgba(15,23,42,0.48)] backdrop-blur sm:p-5"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,164,0.14),transparent_32%),radial-gradient(circle_at_top_right,rgba(17,70,106,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.76),rgba(255,255,255,0.96))]" />

        <div className="relative grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] xl:items-start">
          <div className="space-y-4">
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
              <h1 className="brand-display text-[2rem] font-semibold leading-tight text-slate-950 sm:text-[2.4rem]">Tasks Workspace</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-[15px]">
                Track posted requests, accepted work, support follow-up, and completed history from one calm operational surface.
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
              <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700">
                {supportBackendReady === false ? "Support backend missing" : "Support queue available"}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void loadTasks(true)} disabled={loading} className={darkActionClassName}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedTab("all");
                  setSelectedStatus("awaiting-action");
                  scrollToSection(liveOrdersSectionRef);
                }}
                className={subtleActionClassName}
              >
                <TrendingUp className="h-4 w-4" />
                Focus attention
              </button>
              <button type="button" onClick={() => scrollToSection(historySectionRef)} disabled={!hasTaskHistory} className={subtleActionClassName}>
                <ArrowUpRight className="h-4 w-4" />
                Review history
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {compactStats.map((stat) => (
              <div key={stat.label} className="rounded-[1.45rem] border border-slate-200 bg-white/88 p-4 shadow-[0_20px_50px_-42px_rgba(15,23,42,0.35)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{stat.label}</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">{stat.value}</p>
                  </div>
                  <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${stat.tone}`}>
                    <stat.icon className="h-4.5 w-4.5" />
                  </span>
                </div>
                <p className="mt-2 text-sm leading-5 text-slate-500">{stat.helper}</p>
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

      <section className="overflow-hidden rounded-[1.9rem] border border-white/70 bg-white/90 p-4 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.44)] backdrop-blur sm:p-5">
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-700)]">Task filters</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950 sm:text-xl">Search and sort real work in progress</h2>
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

          <div className="flex flex-wrap items-center gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setSelectedTab(tab.value as TaskTab)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  selectedTab === tab.value
                    ? "bg-[var(--brand-900)] text-white shadow-[0_18px_35px_-26px_rgba(15,23,42,0.8)]"
                    : "border border-slate-200 bg-white text-slate-700 hover:border-[var(--brand-500)]/35 hover:text-[var(--brand-700)]"
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {statusFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setSelectedStatus(filter.value)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  selectedStatus === filter.value
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:border-[var(--brand-500)]/35 hover:text-[var(--brand-700)]"
                }`}
              >
                <filter.icon className="h-4 w-4" />
                {filter.label}
              </button>
            ))}

            {activeFilterCount > 0 ? (
              <button type="button" onClick={clearAllFilters} className="ml-auto inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900">
                <RefreshCw className="h-4 w-4" />
                Clear filters
              </button>
            ) : (
              <span className="ml-auto text-sm text-slate-500">{activeFilterCount} active filters</span>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <section ref={liveOrdersSectionRef} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-2xl font-semibold text-slate-950">Live tasks</h2>
                <p className="mt-1 text-sm text-slate-500">Posted requests and accepted work that still need follow-through.</p>
              </div>
              <p className="text-sm text-slate-500">
                {filteredLiveTasks.length} live of {filteredTasks.length} visible
              </p>
            </div>

            {loading ? (
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
            ) : filteredLiveTasks.length > 0 ? (
              <div className="space-y-4">{filteredLiveTasks.map((task) => renderTaskCardPremium(task))}</div>
            ) : filteredHistoryTasks.length > 0 ? (
              <div className="rounded-[1.7rem] border border-slate-200 bg-white px-5 py-6 text-sm text-slate-500 shadow-sm">
                No live tasks match the current view. Task history is still available below.
              </div>
            ) : null}
          </section>

          {!loading && filteredHistoryTasks.length > 0 ? (
            <section ref={historySectionRef} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-950">History</h2>
                  <p className="mt-1 text-sm text-slate-500">Completed, cancelled, rejected, and closed work stays here for follow-up.</p>
                </div>
                <p className="text-sm text-slate-500">{filteredHistoryTasks.length} historical tasks</p>
              </div>

              <div className="space-y-4">{filteredHistoryTasks.map((task) => renderTaskCardPremium(task, { history: true }))}</div>
            </section>
          ) : null}

          {!loading && filteredTasks.length === 0 ? (
            <div className="rounded-[1.9rem] border border-slate-200 bg-white px-6 py-16 text-center shadow-[0_24px_70px_-46px_rgba(15,23,42,0.36)]">
              <Package className="mx-auto h-14 w-14 text-slate-400" />
              <h3 className="mt-5 text-xl font-semibold text-slate-950">{emptyState.title}</h3>
              <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">{emptyState.copy}</p>
              <button type="button" onClick={emptyState.onAction} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[var(--brand-900)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]">
                <Sparkles className="h-4 w-4" />
                {emptyState.actionLabel}
              </button>
            </div>
          ) : null}
        </div>

        <aside className="space-y-4">
          <section className="rounded-[1.8rem] border border-slate-200 bg-white p-4 shadow-[0_22px_55px_-44px_rgba(15,23,42,0.34)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Board health</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">Realtime status</h2>
              </div>
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${realtimeMeta.className}`}>
                <RealtimeIcon className={`h-3.5 w-3.5 ${realtimeState === "connecting" ? "animate-spin" : ""}`} />
                {realtimeMeta.label}
              </span>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Feed</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{taskEvents.length}</p>
                <p className="text-xs text-slate-500">Recent task events</p>
              </div>
              <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Live hits</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{liveUpdateCount}</p>
                <p className="text-xs text-slate-500">Realtime refreshes</p>
              </div>
              <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Support</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{statusCounts.support}</p>
                <p className="text-xs text-slate-500">{supportBackendReady === false ? "Backend missing" : "Support-linked tasks"}</p>
              </div>
            </div>
          </section>

          <section className="rounded-[1.8rem] border border-slate-200 bg-white p-4 shadow-[0_22px_55px_-44px_rgba(15,23,42,0.34)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Recent activity</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">Latest task updates</h2>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">{recentActivity.length}</span>
            </div>

            <div className="mt-4 space-y-3">
              {recentActivity.length > 0 ? (
                recentActivity.map((event) => {
                  const toneClasses = getToneClassNames(event.tone);

                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => revealTask(event.orderId)}
                      className={`w-full rounded-[1.3rem] border px-4 py-3 text-left transition hover:-translate-y-0.5 ${toneClasses.card}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${toneClasses.dot}`} />
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${toneClasses.pill}`}>
                              {event.statusLabel || event.eventType.replace(/_/g, " ")}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-slate-900">{event.title}</p>
                          <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-700">{event.description}</p>
                        </div>
                        <span className="shrink-0 text-[11px] font-semibold text-slate-500">{formatAgo(event.createdAtRaw, clockMs)}</span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-[1.3rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  Activity will appear here once orders or task updates begin to flow in.
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>

      {!loading && tasks.length > 0 ? (
        <div className="rounded-[1.2rem] border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Live sync is active. Orders, accepted requests, support state, and task history are still connected to the existing Supabase workflow.</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
