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
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CheckCheck,
  CheckCircle2,
  Clock,
  DollarSign,
  Loader2,
  MapPin,
  MessageCircle,
  Package,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";
import RouteObservability from "@/app/components/RouteObservability";
import { supabase } from "@/lib/supabase";
import {
  canTransitionOrderStatus,
  getAllowedTransitions,
  getOrderStatusLabel,
  getOrderStatusPillClass,
  getTransitionActionLabel,
  type CanonicalOrderStatus,
  type OrderActorRole,
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

type TaskTab = "all" | "posted" | "accepted";
type RealtimeState = "connecting" | "live" | "offline";

const stageOrder: TaskStatus[] = ["active", "in-progress", "completed", "cancelled"];
const statusProgressMap: Record<TaskStatus, number> = {
  active: 25,
  "in-progress": 65,
  completed: 100,
  cancelled: 100,
};

const demoNow = Date.now();
const demoIsoFromMsAgo = (msAgo: number) => new Date(demoNow - msAgo).toISOString();

const demoTasks: Task[] = [
  {
    id: "demo-task-1",
    orderId: "demo-order-1",
    title: "Emergency Plumber Visit",
    description: "Kitchen sink leakage fix requested by a nearby customer.",
    type: "accepted",
    status: "in-progress",
    rawStatus: "accepted",
    budget: "INR 799",
    timeline: "Today",
    location: "HSR Layout",
    postedBy: {
      id: "demo-consumer-1",
      name: "Ritika S",
      image: "https://i.pravatar.cc/150?img=27",
    },
    assignedTo: {
      id: "demo-provider-1",
      name: "You",
      image: "https://i.pravatar.cc/150?img=12",
    },
    tags: ["Plumber", "Urgent", "Lead Pipeline"],
    listingType: "service",
    counterpartyId: "demo-consumer-1",
    amount: 799,
    createdAtRaw: demoIsoFromMsAgo(2 * 60 * 60 * 1000),
  },
  {
    id: "demo-task-2",
    orderId: "demo-order-2",
    title: "2BHK Deep Cleaning",
    description: "Weekend deep-clean booking from your neighborhood.",
    type: "posted",
    status: "active",
    rawStatus: "new_lead",
    budget: "INR 1499",
    timeline: "This week",
    location: "Indiranagar",
    postedBy: {
      id: "demo-consumer-2",
      name: "You",
      image: "https://i.pravatar.cc/150?img=8",
    },
    assignedTo: {
      id: "demo-provider-2",
      name: "Meera Clean Team",
      image: "https://i.pravatar.cc/150?img=47",
    },
    tags: ["Cleaning", "Customer Request", "Open"],
    listingType: "service",
    counterpartyId: "demo-provider-2",
    amount: 1499,
    createdAtRaw: demoIsoFromMsAgo(5 * 60 * 60 * 1000),
  },
  {
    id: "demo-task-3",
    orderId: "demo-order-3",
    title: "Switchboard Safety Kit",
    description: "Product order delivered and closed successfully.",
    type: "posted",
    status: "completed",
    rawStatus: "completed",
    budget: "INR 899",
    timeline: "Delivered",
    location: "Koramangala",
    postedBy: {
      id: "demo-consumer-3",
      name: "You",
      image: "https://i.pravatar.cc/150?img=8",
    },
    assignedTo: {
      id: "demo-provider-3",
      name: "Aditi Electricals",
      image: "https://i.pravatar.cc/150?img=12",
    },
    tags: ["Electrical", "Completed"],
    listingType: "product",
    counterpartyId: "demo-provider-3",
    amount: 899,
    createdAtRaw: demoIsoFromMsAgo(2 * 24 * 60 * 60 * 1000),
  },
];

const demoTaskEvents: TaskEventFeedItem[] = [
  {
    id: "demo-event-1",
    orderId: "demo-order-1",
    title: "Work started",
    description: "Provider moved the task into the active execution lane.",
    taskTitle: "Emergency Plumber Visit",
    tone: "violet",
    statusLabel: "Accepted",
    eventType: "status_changed",
    createdAtRaw: demoIsoFromMsAgo(80 * 60 * 1000),
  },
  {
    id: "demo-event-2",
    orderId: "demo-order-2",
    title: "Task created",
    description: "Weekend cleaning booking entered the live operations queue.",
    taskTitle: "2BHK Deep Cleaning",
    tone: "sky",
    statusLabel: "New Lead",
    eventType: "created",
    createdAtRaw: demoIsoFromMsAgo(5 * 60 * 60 * 1000),
  },
  {
    id: "demo-event-3",
    orderId: "demo-order-3",
    title: "Task completed",
    description: "Delivery was confirmed and the order was closed successfully.",
    taskTitle: "Switchboard Safety Kit",
    tone: "emerald",
    statusLabel: "Completed",
    eventType: "status_changed",
    createdAtRaw: demoIsoFromMsAgo(2 * 24 * 60 * 60 * 1000),
  },
];

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

const getStatusIcon = (status: TaskStatus) => {
  if (status === "active") return Clock;
  if (status === "in-progress") return TrendingUp;
  if (status === "completed") return CheckCircle2;
  return AlertCircle;
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

export default function TasksPage() {
  const router = useRouter();
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedTab, setSelectedTab] = useState<TaskTab>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [tasks, setTasks] = useState<Task[]>(demoTasks);
  const [taskEvents, setTaskEvents] = useState<TaskEventFeedItem[]>(demoTaskEvents);
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [chatLoadingOrderId, setChatLoadingOrderId] = useState<string | null>(null);
  const [usingDemo, setUsingDemo] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [realtimeState, setRealtimeState] = useState<RealtimeState>("connecting");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [liveUpdateCount, setLiveUpdateCount] = useState(0);
  const [clockMs, setClockMs] = useState(demoNow);
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
        setTasks(demoTasks);
        setTaskEvents(demoTaskEvents);
        setUsingDemo(true);
        setRealtimeState("offline");
        setLastSyncAt(null);
        setLoading(false);

        if (userError) {
          setErrorMessage(`Auth error: ${userError.message}`);
        }
        return;
      }

      setCurrentUserId(user.id);

      const { data: orderRows, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .or(`consumer_id.eq.${user.id},provider_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(120);

      if (orderError) {
        setTasks([]);
        setTaskEvents([]);
        setUsingDemo(false);
        setRealtimeState("offline");
        setLoading(false);
        setErrorMessage(`Could not load live tasks: ${orderError.message}`);
        return;
      }

      const liveOrders = (orderRows as OrderRow[] | null) || [];

      if (liveOrders.length === 0) {
        setTasks([]);
        setTaskEvents([]);
        setUsingDemo(false);
        setLastSyncAt(new Date().toISOString());
        setLoading(false);
        return;
      }

      const profileIds = Array.from(
        new Set(
          liveOrders
            .flatMap((order) => [order.consumer_id, order.provider_id])
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

      const [profilesRes, servicesRes, productsRes, postsRes, eventsRes] = await Promise.all([
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
          ? supabase.from("posts").select("id,title,text,content,description").in("id", demandIds)
          : Promise.resolve({ data: [] as PostRow[], error: null }),
        supabase
          .from("task_events")
          .select(
            "id,order_id,consumer_id,provider_id,actor_id,event_type,title,description,previous_status,next_status,metadata,created_at"
          )
          .or(`consumer_id.eq.${user.id},provider_id.eq.${user.id}`)
          .order("created_at", { ascending: false })
          .limit(18),
      ]);

      const profileMap = new Map<string, ProfileRow>(((profilesRes.data as ProfileRow[] | null) || []).map((row) => [row.id, row]));
      const serviceMap = new Map<string, ServiceRow>(((servicesRes.data as ServiceRow[] | null) || []).map((row) => [row.id, row]));
      const productMap = new Map<string, ProductRow>(((productsRes.data as ProductRow[] | null) || []).map((row) => [row.id, row]));
      const postMap = new Map<string, PostRow>(((postsRes.data as PostRow[] | null) || []).map((row) => [row.id, row]));

      const mappedTasks = liveOrders.map((order) =>
        mapOrderToTask({
          order,
          currentUserId: user.id,
          profileMap,
          serviceMap,
          productMap,
          postMap,
        })
      );

      const taskTitleByOrderId = new Map<string, string>(mappedTasks.map((task) => [task.orderId, task.title]));
      const mappedTaskEvents = (((eventsRes.data as TaskEventRow[] | null) || []).map((event) =>
        mapTaskEventToFeedItem({
          event,
          taskTitleByOrderId,
        })
      ));
      const safeTaskEvents = mappedTaskEvents.length ? mappedTaskEvents : buildFallbackTaskEventFeed(mappedTasks);

      startTransition(() => {
        setTasks(mappedTasks);
        setTaskEvents(safeTaskEvents);
        setUsingDemo(false);
        setLastSyncAt(new Date().toISOString());
      });

      if (eventsRes.error && !isMissingSupabaseRelation(eventsRes.error.message || "")) {
        setErrorMessage(`Task activity feed unavailable: ${eventsRes.error.message}`);
      }

      setLoading(false);
    } catch (error) {
      setCurrentUserId(null);
      setTasks(demoTasks);
      setTaskEvents(demoTaskEvents);
      setUsingDemo(true);
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
    if (!currentUserId || usingDemo) return;

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
  }, [currentUserId, usingDemo]);

  const statusCounts = useMemo(
    () => ({
      active: tasks.filter((task) => task.status === "active").length,
      inProgress: tasks.filter((task) => task.status === "in-progress").length,
      completed: tasks.filter((task) => task.status === "completed").length,
      cancelled: tasks.filter((task) => task.status === "cancelled").length,
    }),
    [tasks]
  );

  const totalPipelineValue = useMemo(
    () =>
      tasks.reduce((sum, task) => {
        if (!Number.isFinite(Number(task.amount))) return sum;
        return sum + Number(task.amount);
      }, 0),
    [tasks]
  );

  const completionRate = useMemo(() => {
    if (!tasks.length) return 0;
    return Math.round((statusCounts.completed / tasks.length) * 100);
  }, [statusCounts.completed, tasks.length]);

  const knownTicketCount = useMemo(
    () => tasks.filter((task) => Number.isFinite(Number(task.amount))).length,
    [tasks]
  );

  const averageTicket = useMemo(() => {
    if (!knownTicketCount) return 0;
    return Math.round(totalPipelineValue / knownTicketCount);
  }, [knownTicketCount, totalPipelineValue]);

  const actionRequiredCount = statusCounts.active + statusCounts.inProgress;

  const latestEventByOrderId = useMemo(() => {
    const eventMap = new Map<string, TaskEventFeedItem>();

    taskEvents.forEach((event) => {
      if (!eventMap.has(event.orderId)) {
        eventMap.set(event.orderId, event);
      }
    });

    return eventMap;
  }, [taskEvents]);

  const filteredTasks = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();

    return tasks
      .filter((task) => {
        const matchesTab = selectedTab === "all" || task.type === selectedTab;
        const matchesStatus = selectedStatus === "all" || task.status === selectedStatus;

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
          latestEvent?.title || "",
          latestEvent?.description || "",
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      })
      .sort((a, b) => {
        const stageDelta = stageOrder.indexOf(a.status) - stageOrder.indexOf(b.status);
        if (stageDelta !== 0) return stageDelta;

        const aTime = a.createdAtRaw ? new Date(a.createdAtRaw).getTime() : 0;
        const bTime = b.createdAtRaw ? new Date(b.createdAtRaw).getTime() : 0;
        return bTime - aTime;
      });
  }, [deferredSearchQuery, latestEventByOrderId, selectedStatus, selectedTab, tasks]);

  const filteredLiveTasks = useMemo(
    () => filteredTasks.filter((task) => !["completed", "cancelled"].includes(task.status)),
    [filteredTasks]
  );

  const filteredHistoryTasks = useMemo(
    () => filteredTasks.filter((task) => ["completed", "cancelled"].includes(task.status)),
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
    { value: "all", label: "All Status", icon: Package },
    { value: "active", label: "Active", icon: Clock },
    { value: "in-progress", label: "In Progress", icon: TrendingUp },
    { value: "completed", label: "Completed", icon: CheckCircle2 },
    { value: "cancelled", label: "Cancelled", icon: AlertCircle },
  ];

  const headlineStats = useMemo(
    () => [
      {
        label: "Open Pipeline",
        value: actionRequiredCount,
        subtitle: "Need action",
        icon: Activity,
        color: "from-sky-500 to-blue-600",
      },
      {
        label: "Completion Rate",
        value: `${completionRate}%`,
        subtitle: `${statusCounts.completed} completed`,
        icon: CheckCheck,
        color: "from-emerald-500 to-green-600",
      },
      {
        label: "Pipeline Value",
        value: `INR ${formatCompactCurrency(totalPipelineValue || 0)}`,
        subtitle: `${tasks.length} total tasks`,
        icon: BarChart3,
        color: "from-violet-500 to-indigo-600",
      },
      {
        label: "Avg Ticket",
        value: knownTicketCount ? `INR ${formatCompactCurrency(averageTicket)}` : "--",
        subtitle: knownTicketCount ? "Across priced tasks" : "No prices yet",
        icon: DollarSign,
        color: "from-amber-500 to-orange-500",
      },
    ],
    [actionRequiredCount, averageTicket, completionRate, knownTicketCount, statusCounts.completed, tasks.length, totalPipelineValue]
  );

  const pipelineLanes = [
    {
      key: "active",
      label: "Active",
      count: statusCounts.active,
      status: "active" as TaskStatus,
      description: "Awaiting response or confirmation",
    },
    {
      key: "in-progress",
      label: "In Progress",
      count: statusCounts.inProgress,
      status: "in-progress" as TaskStatus,
      description: "Jobs currently running",
    },
    {
      key: "completed",
      label: "Completed",
      count: statusCounts.completed,
      status: "completed" as TaskStatus,
      description: "Successfully closed deliveries",
    },
    {
      key: "cancelled",
      label: "Cancelled",
      count: statusCounts.cancelled,
      status: "cancelled" as TaskStatus,
      description: "Dropped or rejected workflows",
    },
  ];

  const startChat = async (task: Task) => {
    if (!currentUserId || !task.counterpartyId || task.counterpartyId.startsWith("demo-")) {
      router.push("/dashboard/people");
      return;
    }

    setChatLoadingOrderId(task.orderId);

    const { data: myRows } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", currentUserId);

    const myConversationIds = myRows?.map((row) => row.conversation_id) || [];
    let targetConversationId: string | null = null;

    if (myConversationIds.length > 0) {
      const { data: existing } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .in("conversation_id", myConversationIds)
        .eq("user_id", task.counterpartyId)
        .limit(1)
        .maybeSingle();

      targetConversationId = existing?.conversation_id || null;
    }

    if (!targetConversationId) {
      const { data: conversation, error } = await supabase
        .from("conversations")
        .insert({ created_by: currentUserId })
        .select("id")
        .single();

      if (error || !conversation) {
        setChatLoadingOrderId(null);
        alert(`Unable to start chat. ${error?.message || ""}`.trim());
        return;
      }

      targetConversationId = conversation.id;

      const { error: participantError } = await supabase.from("conversation_participants").upsert(
        [
          { conversation_id: targetConversationId, user_id: currentUserId },
          { conversation_id: targetConversationId, user_id: task.counterpartyId },
        ],
        {
          onConflict: "conversation_id,user_id",
          ignoreDuplicates: true,
        }
      );

      if (participantError) {
        setChatLoadingOrderId(null);
        alert(`Unable to start chat. ${participantError.message}`);
        return;
      }
    }

    setChatLoadingOrderId(null);
    router.push(`/dashboard/chat?open=${targetConversationId}`);
  };

  const updateOrderStatus = async (task: Task, nextStatus: CanonicalOrderStatus) => {
    const actor: OrderActorRole = task.type === "posted" ? "consumer" : "provider";

    const canTransition = canTransitionOrderStatus({
      from: task.rawStatus,
      to: nextStatus,
      actor,
    });

    if (!canTransition) {
      alert("Invalid task status transition for this role.");
      return;
    }

    if (usingDemo || task.orderId.startsWith("demo-order")) {
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
      return;
    }

    setUpdatingOrderId(task.orderId);

    const { error } = await supabase.from("orders").update({ status: nextStatus }).eq("id", task.orderId);

    if (error) {
      alert(`Failed to update task status: ${error.message}`);
      setUpdatingOrderId(null);
      return;
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

    setUpdatingOrderId(null);
  };

  const renderActions = (task: Task) => {
    const busy = updatingOrderId === task.orderId;
    const chatBusy = chatLoadingOrderId === task.orderId;
    const actor: OrderActorRole = task.type === "posted" ? "consumer" : "provider";
    const transitions = getAllowedTransitions(task.rawStatus, actor).filter((status) => status !== "closed");

    return (
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => void startChat(task)}
          disabled={chatBusy}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-70"
        >
          <MessageCircle className="h-4 w-4" />
          {chatBusy ? "Opening..." : "Chat"}
        </button>

        {transitions.map((nextStatus) => (
          <button
            key={`${task.orderId}-${nextStatus}`}
            disabled={busy}
            onClick={() => void updateOrderStatus(task, nextStatus)}
            className={`rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors disabled:opacity-70 ${
              ["rejected", "cancelled"].includes(nextStatus)
                ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                : ["completed", "closed"].includes(nextStatus)
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
            }`}
          >
            {busy ? "Updating..." : getTransitionActionLabel({ actor, nextStatus })}
          </button>
        ))}
      </div>
    );
  };

  const realtimeMeta = realtimeStateMeta[realtimeState];
  const RealtimeIcon = realtimeMeta.icon;

  return (
    <div className="mx-auto w-full max-w-[2200px] space-y-5 sm:space-y-6 lg:space-y-8">
      <RouteObservability route="tasks" />

      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-indigo-900 to-blue-900 p-5 text-white shadow-2xl sm:p-7 lg:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(148,163,184,0.28),transparent_44%),radial-gradient(circle_at_bottom_left,rgba(129,140,248,0.24),transparent_50%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:36px_36px]" />

        <div className="relative z-10 space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
                <Activity className="h-3.5 w-3.5" />
                {loading ? "Syncing task pipeline..." : usingDemo ? "Task operations preview" : "Supabase realtime task operations"}
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl lg:text-[34px]">Task Operations</h1>
                <p className="mt-1.5 max-w-2xl text-sm text-white/80 sm:text-base">
                  Production-grade control center for incoming leads, active jobs, completed orders, and live status
                  shifts.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 text-xs text-white/80">
                <Sparkles className="h-4 w-4" />
                {actionRequiredCount} tasks currently require action
              </div>
            </div>

            <button
              onClick={() => router.push("/dashboard")}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Open Marketplace
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {headlineStats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-sm sm:p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white/75">{stat.label}</span>
                  <div className={`grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br ${stat.color}`}>
                    <stat.icon className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">{stat.value}</div>
                <div className="mt-1 text-xs text-white/70">{stat.subtitle}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {usingDemo && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Showing the local preview set. Supabase data takes over automatically as soon as a signed-in account has live
          orders or seeded task activity.
        </div>
      )}

      {!!errorMessage && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            usingDemo
              ? "border border-amber-400/40 bg-amber-50 text-amber-700"
              : "border border-rose-300 bg-rose-50 text-rose-700"
          }`}
        >
          {errorMessage}
        </div>
      )}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(360px,0.9fr)]">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {pipelineLanes.map((lane) => {
            const LaneIcon = getStatusIcon(lane.status);
            const lanePercent = tasks.length ? Math.round((lane.count / tasks.length) * 100) : 0;

            return (
              <div key={lane.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{lane.label}</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">{lane.count}</p>
                  </div>
                  <div
                    className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br text-white ${getStatusAccentClass(lane.status)}`}
                  >
                    <LaneIcon className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500">{lane.description}</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${getStatusAccentClass(lane.status)}`}
                    style={{ width: lane.count > 0 ? `${Math.max(8, lanePercent)}%` : "0%" }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Live Activity</p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">Realtime operations feed</h2>
              <p className="mt-1 text-sm text-slate-500">
                Order inserts, status changes, and quote updates stream here directly from Supabase.
              </p>
            </div>

            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${realtimeMeta.className}`}>
              <RealtimeIcon className={`h-3.5 w-3.5 ${realtimeState === "connecting" ? "animate-spin" : ""}`} />
              {realtimeMeta.label}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Feed</div>
              <div className="mt-1 text-lg font-bold text-slate-900">{taskEvents.length}</div>
              <div className="text-[11px] text-slate-500">Recent events</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Live hits</div>
              <div className="mt-1 text-lg font-bold text-slate-900">{liveUpdateCount}</div>
              <div className="text-[11px] text-slate-500">Realtime refreshes</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Last sync</div>
              <div className="mt-1 text-lg font-bold text-slate-900">
                {lastSyncAt ? formatAgo(lastSyncAt, clockMs) : usingDemo ? "Demo" : "--"}
              </div>
              <div className="text-[11px] text-slate-500">Board snapshot</div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {taskEvents.slice(0, 6).map((event) => {
              const toneClasses = getToneClassNames(event.tone);

              return (
                <div key={event.id} className={`rounded-xl border p-3 ${toneClasses.card}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <span className={`mt-1 h-2.5 w-2.5 flex-none rounded-full ${toneClasses.dot}`} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                          {event.statusLabel && (
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${toneClasses.pill}`}>
                              {event.statusLabel}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{event.description}</p>
                        <p className="mt-1 text-xs font-medium text-slate-500">{event.taskTitle}</p>
                      </div>
                    </div>
                    <span className="flex-none text-[11px] font-semibold text-slate-500">
                      {formatAgo(event.createdAtRaw, clockMs)}
                    </span>
                  </div>
                </div>
              );
            })}

            {taskEvents.length === 0 && !loading && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                No activity yet. New orders and status changes will appear here automatically.
              </div>
            )}
          </div>
        </aside>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by title, location, tags, person, event, or order id"
              className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>

          <button
            type="button"
            onClick={() => void loadTasks(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setSelectedTab(tab.value as TaskTab)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                selectedTab === tab.value
                  ? "bg-slate-900 text-white shadow-md"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setSelectedStatus(filter.value)}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                selectedStatus === filter.value
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <filter.icon className="h-3.5 w-3.5" />
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-bold text-slate-900">Live Orders</h2>
          <p className="text-sm text-slate-500">
            {filteredLiveTasks.length} live of {filteredTasks.length} visible
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
                <div className="mt-3 h-3 w-3/4 animate-pulse rounded bg-slate-100" />
                <div className="mt-4 h-2 w-full animate-pulse rounded bg-slate-100" />
              </div>
            ))}
            <div className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading task pipeline...
            </div>
          </div>
        ) : (
          filteredLiveTasks.map((task) => {
            const StatusIcon = getStatusIcon(task.status);
            const progress = statusProgressMap[task.status];
            const latestEvent = latestEventByOrderId.get(task.orderId);

            return (
              <div
                key={task.id}
                className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg sm:p-6"
              >
                <div className={`absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${getStatusAccentClass(task.status)}`} />

                <div className="space-y-4 pl-2">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                          {getListingTypeLabel(task.listingType)}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getOrderStatusPillClass(task.rawStatus)}`}>
                          {getOrderStatusLabel(task.rawStatus)}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                          Order #{task.orderId.slice(0, 8)}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 sm:text-xl">{task.title}</h3>
                      <p className="text-sm text-slate-600">{task.description}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(task.status)}`}
                      >
                        <StatusIcon className="h-3.5 w-3.5" />
                        {formatTaskStatus(task.status)}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          task.type === "posted" ? "bg-blue-100 text-blue-700" : "bg-violet-100 text-violet-700"
                        }`}
                      >
                        {task.type === "posted" ? "Posted by You" : "Accepted by You"}
                      </span>
                    </div>
                  </div>

                  {latestEvent && (
                    <div className={`rounded-xl border px-3 py-3 ${getToneClassNames(latestEvent.tone).card}`}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Latest activity</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{latestEvent.title}</p>
                          <p className="mt-1 text-sm text-slate-600">{latestEvent.description}</p>
                        </div>
                        <div className="text-xs font-semibold text-slate-500">
                          {formatAgo(latestEvent.createdAtRaw, clockMs)}
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className={`font-semibold ${getStatusTextClass(task.status)}`}>
                        {task.timeline || "Open"}
                      </span>
                      <span className="font-semibold text-slate-500">{progress}% flow progress</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${getStatusAccentClass(task.status)}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-slate-500" />
                      <div>
                        <div className="text-xs text-slate-500">Budget</div>
                        <div className="font-semibold text-slate-900">{task.budget || "Price on request"}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-slate-500" />
                      <div>
                        <div className="text-xs text-slate-500">Timeline</div>
                        <div className="font-semibold text-slate-900">{task.timeline || "Open"}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-slate-500" />
                      <div>
                        <div className="text-xs text-slate-500">Location</div>
                        <div className="font-semibold text-slate-900">{task.location}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-slate-500" />
                      <div>
                        <div className="text-xs text-slate-500">Created</div>
                        <div className="font-semibold text-slate-900">{formatAgo(task.createdAtRaw, clockMs)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <Image
                        src={task.postedBy.image || fallbackAvatar}
                        alt={task.postedBy.name}
                        width={36}
                        height={36}
                        className="h-9 w-9 rounded-xl border border-slate-200 object-cover"
                      />
                      <div>
                        <div className="text-xs text-slate-500">Posted by</div>
                        <div className="text-sm font-semibold text-slate-900">{task.postedBy.name}</div>
                      </div>
                    </div>

                    {task.assignedTo && (
                      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <Image
                          src={task.assignedTo.image || fallbackAvatar}
                          alt={task.assignedTo.name}
                          width={36}
                          height={36}
                          className="h-9 w-9 rounded-xl border border-slate-200 object-cover"
                        />
                        <div>
                          <div className="text-xs text-slate-500">Assigned to</div>
                          <div className="text-sm font-semibold text-slate-900">{task.assignedTo.name}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-2">
                      {task.tags.slice(0, 4).map((tag, index) => (
                        <span
                          key={`${task.id}-${index}`}
                          className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    {renderActions(task)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {!loading && filteredLiveTasks.length === 0 && filteredHistoryTasks.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-500">
          No live orders match the current filters. Order history is still available below.
        </div>
      )}

      {!loading && filteredHistoryTasks.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-2xl font-bold text-slate-900">Order History</h2>
            <p className="text-sm text-slate-500">
              {filteredHistoryTasks.length} historical orders
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {filteredHistoryTasks.map((task, index) => {
              const latestEvent = latestEventByOrderId.get(task.orderId);
              const StatusIcon = getStatusIcon(task.status);

              return (
                <div
                  key={task.id}
                  className={`flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${
                    index === 0 ? "" : "border-t border-slate-200"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                        {getListingTypeLabel(task.listingType)}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(task.status)}`}
                      >
                        <StatusIcon className="h-3.5 w-3.5" />
                        {formatTaskStatus(task.status)}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                        Order #{task.orderId.slice(0, 8)}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-col gap-1">
                      <h3 className="truncate text-base font-bold text-slate-900">{task.title}</h3>
                      <p className="text-sm text-slate-600">
                        {latestEvent?.description || task.description}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:min-w-[360px] sm:grid-cols-3">
                    <div>
                      <div className="text-xs text-slate-500">Counterparty</div>
                      <div className="text-sm font-semibold text-slate-900">
                        {task.type === "posted" ? task.assignedTo?.name || "Provider" : task.postedBy.name}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Amount</div>
                      <div className="text-sm font-semibold text-slate-900">{task.budget || "Price on request"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Logged</div>
                      <div className="text-sm font-semibold text-slate-900">
                        {formatAgo(latestEvent?.createdAtRaw || task.createdAtRaw, clockMs)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {!loading && filteredTasks.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center shadow-xl">
          <Package className="mx-auto mb-4 h-16 w-16 text-slate-400" />
          <h3 className="mb-2 text-xl font-bold text-slate-900">
            {tasks.length === 0 && !usingDemo ? "No live tasks yet" : "No tasks found"}
          </h3>
          <p className="mx-auto mb-6 max-w-xl text-slate-600">
            {tasks.length === 0 && !usingDemo
              ? "Create an order from the marketplace or run the realtime seed to populate this task board with Supabase-backed activity."
              : "Try a different status or tab filter, or clear your search query to reveal hidden tasks."}
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 px-6 py-3 font-bold text-white shadow-lg transition-all duration-200 hover:from-indigo-600 hover:to-blue-700 hover:shadow-xl"
          >
            <Sparkles className="h-4 w-4" />
            Open Marketplace
          </button>
        </div>
      )}

      {!loading && !usingDemo && tasks.length > 0 && (
        <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          Live sync active. Current orders and order history stream from Supabase in real time.
        </div>
      )}

      {!loading && usingDemo && (
        <div className="inline-flex items-center gap-2 rounded-xl border border-indigo-400/30 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
          <XCircle className="h-4 w-4" />
          Preview mode is active. Sign in or seed the realtime dataset to switch this board fully to live operations.
        </div>
      )}
    </div>
  );
}
