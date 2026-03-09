"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import RouteObservability from "@/app/components/RouteObservability";
import { useRouter } from "next/navigation";
import {
  canTransitionOrderStatus,
  getAllowedTransitions,
  getTransitionActionLabel,
  toTaskWorkflowStatus,
  type CanonicalOrderStatus,
  type OrderActorRole,
} from "@/lib/orderWorkflow";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Loader2,
  MapPin,
  MessageCircle,
  Package,
  Search,
  TrendingUp,
  XCircle,
} from "lucide-react";

type TaskType = "posted" | "accepted";
type TaskStatus = "active" | "in-progress" | "completed" | "cancelled";

type OrderRow = {
  id: string;
  listing_id: string | null;
  listing_type: string | null;
  status: string | null;
  price: number | null;
  consumer_id: string | null;
  provider_id: string | null;
  created_at: string | null;
};

type ProfileRow = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  location: string | null;
};

type ServiceRow = {
  id: string;
  title: string | null;
  description: string | null;
  category: string | null;
};

type ProductRow = {
  id: string;
  title: string | null;
  description: string | null;
  category: string | null;
};

type PostRow = {
  id: string;
  title: string | null;
  text: string | null;
  content: string | null;
  description: string | null;
};

type Task = {
  id: string;
  orderId: string;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  rawStatus: string;
  budget?: string;
  timeline?: string;
  location: string;
  postedBy: {
    id: string;
    name: string;
    image: string;
  };
  assignedTo?: {
    id: string;
    name: string;
    image: string;
  };
  createdAt: string;
  tags: string[];
  listingType: string;
  counterpartyId: string | null;
  amount: number | null;
  createdAtRaw?: string | null;
};

const fallbackAvatar = "https://i.pravatar.cc/150";
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
    createdAt: "2h ago",
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
    createdAt: "5h ago",
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
    createdAt: "2d ago",
    tags: ["Electrical", "Completed"],
    listingType: "product",
    counterpartyId: "demo-provider-3",
    amount: 899,
    createdAtRaw: demoIsoFromMsAgo(2 * 24 * 60 * 60 * 1000),
  },
];

const normalizeTaskStatus = (status: string | null | undefined): TaskStatus => toTaskWorkflowStatus(status);

const timelineFromStatus = (status: string | null | undefined) => {
  const normalized = normalizeTaskStatus(status);
  if (normalized === "completed") return "Completed";
  if (normalized === "in-progress") return "In progress";
  if (normalized === "cancelled") return "Cancelled";
  return "Open";
};

const formatTaskStatus = (status: TaskStatus) => {
  if (status === "in-progress") return "IN PROGRESS";
  return status.toUpperCase();
};

const formatCurrency = (amount: number | null | undefined) => {
  if (!Number.isFinite(Number(amount))) return "Price on request";
  return `INR ${Number(amount).toLocaleString()}`;
};

const formatCompactCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(amount);

const formatAgo = (iso: string | null | undefined) => {
  if (!iso) return "Recently";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Recently";

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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

const getListingTypeLabel = (listingType: string) => {
  if (listingType === "service") return "Service";
  if (listingType === "product") return "Product";
  return "Demand";
};

const normalizeListingType = (type: string | null | undefined) => {
  const lower = (type || "").toLowerCase();
  if (["service", "services"].includes(lower)) return "service";
  if (["product", "products"].includes(lower)) return "product";
  return "demand";
};

const buildTitleFromListingType = (listingType: string) => {
  if (listingType === "service") return "Service booking";
  if (listingType === "product") return "Product order";
  return "Demand response";
};

export default function TasksPage() {
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState<"all" | "posted" | "accepted">("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [tasks, setTasks] = useState<Task[]>(demoTasks);
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [chatLoadingOrderId, setChatLoadingOrderId] = useState<string | null>(null);
  const [usingDemo, setUsingDemo] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  const loadTasks = useCallback(
    async (soft = false) => {
      if (!soft) setLoading(true);
      setErrorMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setTasks(demoTasks);
        setUsingDemo(true);
        setLoading(false);
        if (userError) {
          setErrorMessage(`Auth error: ${userError.message}`);
        }
        return;
      }

      setCurrentUserId(user.id);

      const { data: orderRows, error: orderError } = await supabase
        .from("orders")
        .select("id,listing_id,listing_type,status,price,consumer_id,provider_id,created_at")
        .or(`consumer_id.eq.${user.id},provider_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(120);

      if (orderError) {
        setTasks(demoTasks);
        setUsingDemo(true);
        setLoading(false);
        setErrorMessage(`Could not load live tasks: ${orderError.message}`);
        return;
      }

      const liveOrders = (orderRows as OrderRow[] | null) || [];

      if (liveOrders.length === 0) {
        setTasks(demoTasks);
        setUsingDemo(true);
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
            .filter((order) => normalizeListingType(order.listing_type) === "service")
            .map((order) => order.listing_id)
            .filter((id): id is string => Boolean(id))
        )
      );

      const productIds = Array.from(
        new Set(
          liveOrders
            .filter((order) => normalizeListingType(order.listing_type) === "product")
            .map((order) => order.listing_id)
            .filter((id): id is string => Boolean(id))
        )
      );

      const demandIds = Array.from(
        new Set(
          liveOrders
            .filter((order) => normalizeListingType(order.listing_type) === "demand")
            .map((order) => order.listing_id)
            .filter((id): id is string => Boolean(id))
        )
      );

      const [profilesRes, servicesRes, productsRes, postsRes] = await Promise.all([
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
      ]);

      const profileMap = new Map<string, ProfileRow>(((profilesRes.data as ProfileRow[] | null) || []).map((row) => [row.id, row]));
      const serviceMap = new Map<string, ServiceRow>(((servicesRes.data as ServiceRow[] | null) || []).map((row) => [row.id, row]));
      const productMap = new Map<string, ProductRow>(((productsRes.data as ProductRow[] | null) || []).map((row) => [row.id, row]));
      const postMap = new Map<string, PostRow>(((postsRes.data as PostRow[] | null) || []).map((row) => [row.id, row]));

      const mappedTasks = liveOrders.map((order) => {
        const listingType = normalizeListingType(order.listing_type);
        const isPostedByMe = order.consumer_id === user.id;
        const type: TaskType = isPostedByMe ? "posted" : "accepted";
        const counterpartyId = isPostedByMe ? order.provider_id : order.consumer_id;
        const counterpartyProfile = counterpartyId ? profileMap.get(counterpartyId) : null;
        const consumerProfile = order.consumer_id ? profileMap.get(order.consumer_id) : null;
        const providerProfile = order.provider_id ? profileMap.get(order.provider_id) : null;

        let listingTitle = buildTitleFromListingType(listingType);
        let listingDescription = "Track order activity and coordinate next steps.";
        let listingCategory = listingType;

        if (listingType === "service" && order.listing_id) {
          const service = serviceMap.get(order.listing_id);
          listingTitle = service?.title || listingTitle;
          listingDescription = service?.description || listingDescription;
          listingCategory = service?.category || listingCategory;
        } else if (listingType === "product" && order.listing_id) {
          const product = productMap.get(order.listing_id);
          listingTitle = product?.title || listingTitle;
          listingDescription = product?.description || listingDescription;
          listingCategory = product?.category || listingCategory;
        } else if (order.listing_id) {
          const post = postMap.get(order.listing_id);
          listingTitle = post?.title || post?.text || post?.content || listingTitle;
          listingDescription = post?.description || post?.text || post?.content || listingDescription;
          listingCategory = "Demand";
        }

        const normalizedStatus = normalizeTaskStatus(order.status);

        return {
          id: order.id,
          orderId: order.id,
          title: listingTitle,
          description: listingDescription,
          type,
          status: normalizedStatus,
          rawStatus: order.status || "new_lead",
          budget: formatCurrency(order.price),
          timeline: timelineFromStatus(order.status),
          location: counterpartyProfile?.location || providerProfile?.location || consumerProfile?.location || "Nearby",
          postedBy: {
            id: order.consumer_id || "unknown-consumer",
            name: isPostedByMe ? "You" : consumerProfile?.name || "Customer",
            image: (isPostedByMe ? profileMap.get(user.id)?.avatar_url : consumerProfile?.avatar_url) || fallbackAvatar,
          },
          assignedTo: {
            id: order.provider_id || "unknown-provider",
            name: !isPostedByMe ? "You" : providerProfile?.name || "Provider",
            image: (!isPostedByMe ? profileMap.get(user.id)?.avatar_url : providerProfile?.avatar_url) || fallbackAvatar,
          },
          createdAt: formatAgo(order.created_at),
          tags: [
            listingCategory,
            listingType === "demand" ? "Demand" : listingType === "service" ? "Service" : "Product",
            normalizedStatus === "active"
              ? "Open"
              : normalizedStatus === "in-progress"
              ? "In Progress"
              : normalizedStatus === "completed"
              ? "Completed"
              : "Cancelled",
          ],
          listingType,
          counterpartyId,
          amount: Number.isFinite(Number(order.price)) ? Number(order.price) : null,
          createdAtRaw: order.created_at,
        } satisfies Task;
      });

      setTasks(mappedTasks);
      setUsingDemo(false);
      setLoading(false);
    },
    []
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`tasks-live-${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          const nextRow = payload.new as { consumer_id?: string; provider_id?: string };
          const previousRow = payload.old as { consumer_id?: string; provider_id?: string };
          const touchedCurrentUser =
            nextRow?.consumer_id === currentUserId ||
            nextRow?.provider_id === currentUserId ||
            previousRow?.consumer_id === currentUserId ||
            previousRow?.provider_id === currentUserId;

          if (touchedCurrentUser) {
            void loadTasks(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, loadTasks]);

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

  const actionRequiredCount = statusCounts.active + statusCounts.inProgress;

  const filteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return tasks
      .filter((task) => {
        const matchesTab = selectedTab === "all" || task.type === selectedTab;
        const matchesStatus = selectedStatus === "all" || task.status === selectedStatus;
        if (!matchesTab || !matchesStatus) return false;

        if (!query) return true;
        const haystack = [
          task.title,
          task.description,
          task.location,
          task.postedBy.name,
          task.assignedTo?.name || "",
          task.tags.join(" "),
          task.listingType,
          task.orderId,
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
  }, [searchQuery, selectedStatus, selectedTab, tasks]);

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

      const { error: participantError } = await supabase.from("conversation_participants").upsert([
        { conversation_id: targetConversationId, user_id: currentUserId },
        { conversation_id: targetConversationId, user_id: task.counterpartyId },
      ], {
        onConflict: "conversation_id,user_id",
        ignoreDuplicates: true,
      });

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
          <MessageCircle className="w-4 h-4" />
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

  return (
    <div className="w-full max-w-[2200px] mx-auto space-y-5 sm:space-y-6 lg:space-y-8">
      <RouteObservability route="tasks" />
      <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tasks</h1>
            <p className="mt-1 text-sm text-slate-600">
              Track each order through a clear pipeline and resolve high-priority work first.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700">
                <Activity className="h-3.5 w-3.5" />
                {actionRequiredCount} need action
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {completionRate}% completion
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700">
                <DollarSign className="h-3.5 w-3.5" />
                INR {formatCompactCurrency(totalPipelineValue || 0)} pipeline
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadTasks(true)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              Refresh
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              Open marketplace
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {usingDemo && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Showing demo tasks for visualization. Live tasks appear automatically when orders are created.
        </div>
      )}

      {!!errorMessage && !usingDemo && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>
      )}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by title, location, tags, person, or order id"
              className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadTasks(true)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setSelectedTab(tab.value as "all" | "posted" | "accepted")}
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
          <h2 className="text-2xl font-bold text-slate-900">Operations Queue</h2>
          <p className="text-sm text-slate-500">
            {filteredTasks.length} visible of {tasks.length} total
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
          filteredTasks.map((task) => {
            const StatusIcon = getStatusIcon(task.status);
            const progress = statusProgressMap[task.status];
            const priorityLabel =
              task.status === "active" ? "High Priority" : task.status === "in-progress" ? "Medium Priority" : "Low Priority";
            const priorityClassName =
              task.status === "active"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : task.status === "in-progress"
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700";

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
                        <StatusIcon className="w-3.5 h-3.5" />
                        {formatTaskStatus(task.status)}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          task.type === "posted" ? "bg-blue-100 text-blue-700" : "bg-violet-100 text-violet-700"
                        }`}
                      >
                        {task.type === "posted" ? "Posted by You" : "Accepted by You"}
                      </span>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${priorityClassName}`}>
                        {priorityLabel}
                      </span>
                    </div>
                  </div>

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
                        <div className="font-semibold text-slate-900">{task.createdAt}</div>
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

      {!loading && filteredTasks.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <Package className="mx-auto mb-4 h-14 w-14 text-slate-400" />
          <h3 className="mb-2 text-xl font-semibold text-slate-900">No tasks found</h3>
          <p className="mb-6 text-slate-600">
            Try a different status/tab filter or clear your search query to reveal hidden tasks.
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            Open Marketplace
          </button>
        </div>
      )}

      {!loading && !usingDemo && tasks.length > 0 && (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 inline-flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Live sync active. Task cards update automatically when order status changes.
        </div>
      )}

      {!loading && usingDemo && (
        <div className="rounded-xl border border-indigo-400/30 bg-indigo-50 px-4 py-3 text-sm text-indigo-700 inline-flex items-center gap-2">
          <XCircle className="h-4 w-4" />
          Demo mode is active for visuals. Real data takes over as soon as orders exist.
        </div>
      )}
    </div>
  );
}
