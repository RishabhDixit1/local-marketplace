"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
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
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Filter,
  Loader2,
  MapPin,
  MessageCircle,
  Package,
  Sparkles,
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
};

const fallbackAvatar = "https://i.pravatar.cc/150";

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

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesTab = selectedTab === "all" || task.type === selectedTab;
      const matchesStatus = selectedStatus === "all" || task.status === selectedStatus;
      return matchesTab && matchesStatus;
    });
  }, [selectedStatus, selectedTab, tasks]);

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

  const stats = useMemo(
    () => [
      {
        label: "Total Tasks",
        value: tasks.length,
        icon: Package,
        color: "from-blue-500 to-indigo-600",
      },
      {
        label: "Active",
        value: tasks.filter((task) => task.status === "active").length,
        icon: Clock,
        color: "from-yellow-500 to-orange-500",
      },
      {
        label: "In Progress",
        value: tasks.filter((task) => task.status === "in-progress").length,
        icon: TrendingUp,
        color: "from-purple-500 to-pink-600",
      },
      {
        label: "Completed",
        value: tasks.filter((task) => task.status === "completed").length,
        icon: CheckCircle2,
        color: "from-green-500 to-emerald-600",
      },
    ],
    [tasks]
  );

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
          className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-2 text-sm disabled:opacity-70"
        >
          <MessageCircle className="w-4 h-4" />
          {chatBusy ? "Opening..." : "Chat"}
        </button>

        {transitions.map((nextStatus) => (
          <button
            key={`${task.orderId}-${nextStatus}`}
            disabled={busy}
            onClick={() => void updateOrderStatus(task, nextStatus)}
            className={`px-4 py-2 rounded-xl font-semibold transition-colors text-sm disabled:opacity-70 ${
              ["rejected", "cancelled"].includes(nextStatus)
                ? "bg-rose-100 hover:bg-rose-200 text-rose-700"
                : ["completed", "closed"].includes(nextStatus)
                ? "bg-emerald-100 hover:bg-emerald-200 text-emerald-700"
                : "bg-indigo-100 hover:bg-indigo-200 text-indigo-700"
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
      <div className="bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 rounded-2xl lg:rounded-3xl p-4 sm:p-6 lg:p-10 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,white,transparent_50%)] opacity-20"></div>

        <div className="relative z-10">
          <div className="flex items-start sm:items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">My Tasks</h1>
              <p className="text-white/90 text-sm mt-1 inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Realtime pipeline of your local orders
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 hover:bg-white/15 transition-all duration-300"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                    <stat.icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-semibold">{stat.label}</span>
                </div>
                <div className="text-3xl font-bold">{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {usingDemo && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Showing demo tasks for visualization. Live tasks appear automatically when orders are created.
        </div>
      )}

      {!!errorMessage && !usingDemo && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>
      )}

      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-2">
        <div className="flex flex-nowrap md:flex-wrap gap-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setSelectedTab(tab.value as "all" | "posted" | "accepted")}
              className={`shrink-0 md:flex-1 min-w-[170px] px-4 sm:px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                selectedTab === tab.value
                  ? "bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg scale-105"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-slate-600" />
          <h2 className="text-lg font-bold text-slate-900">Filter by Status</h2>
        </div>

        <div className="flex flex-nowrap md:flex-wrap gap-2 sm:gap-3 overflow-x-auto">
          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setSelectedStatus(filter.value)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-all duration-200 ${
                selectedStatus === filter.value
                  ? "bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg scale-105"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <filter.icon className="w-4 h-4" />
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-slate-900">
            {filteredTasks.length} {filteredTasks.length === 1 ? "Task" : "Tasks"}
          </h2>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading task pipeline...
          </div>
        ) : (
          filteredTasks.map((task) => {
            const StatusIcon = getStatusIcon(task.status);
            return (
              <div
                key={task.id}
                className="bg-white rounded-2xl shadow-lg hover:shadow-xl border border-slate-200 p-4 sm:p-6 transition-all duration-300"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                      <h3 className="text-lg sm:text-xl font-bold text-slate-900">{task.title}</h3>
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(task.status)}`}
                      >
                        <StatusIcon className="w-3.5 h-3.5" />
                        {formatTaskStatus(task.status)}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          task.type === "posted" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {task.type === "posted" ? "Posted by You" : "Accepted by You"}
                      </span>
                    </div>
                    <p className="text-slate-600">{task.description}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {task.tags.map((tag, index) => (
                    <span key={`${task.id}-${index}`} className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-4 p-3 sm:p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-slate-500" />
                    <div>
                      <div className="text-xs text-slate-500">Budget</div>
                      <div className="font-semibold text-slate-900">{task.budget || "Price on request"}</div>
                    </div>
                  </div>

                  {task.timeline && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-500" />
                      <div>
                        <div className="text-xs text-slate-500">Timeline</div>
                        <div className="font-semibold text-slate-900">{task.timeline}</div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-500" />
                    <div>
                      <div className="text-xs text-slate-500">Location</div>
                      <div className="font-semibold text-slate-900">{task.location}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <div>
                      <div className="text-xs text-slate-500">Created</div>
                      <div className="font-semibold text-slate-900">{task.createdAt}</div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 pt-4 border-t border-slate-200">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Image
                        src={task.postedBy.image || fallbackAvatar}
                        alt={task.postedBy.name}
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded-xl object-cover border-2 border-slate-200"
                      />
                      <div>
                        <div className="text-xs text-slate-500">Posted by</div>
                        <div className="font-semibold text-slate-900">{task.postedBy.name}</div>
                      </div>
                    </div>

                    {task.assignedTo && (
                      <>
                        <div className="text-slate-400">→</div>
                        <div className="flex items-center gap-2">
                          <Image
                            src={task.assignedTo.image || fallbackAvatar}
                            alt={task.assignedTo.name}
                            width={40}
                            height={40}
                            className="w-10 h-10 rounded-xl object-cover border-2 border-slate-200"
                          />
                          <div>
                            <div className="text-xs text-slate-500">Assigned to</div>
                            <div className="font-semibold text-slate-900">{task.assignedTo.name}</div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {renderActions(task)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {!loading && filteredTasks.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl shadow-xl border border-slate-200">
          <Package className="w-16 h-16 mx-auto mb-4 text-slate-400" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">No tasks found</h3>
          <p className="text-slate-600 mb-6">Try changing filters or creating a new booking from marketplace feed.</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white rounded-xl font-bold transition-all duration-200 shadow-lg hover:shadow-xl inline-flex items-center gap-2"
          >
            <Sparkles className="h-4 w-4" />
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
