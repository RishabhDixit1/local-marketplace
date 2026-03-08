import { getOrderStatusLabel, normalizeOrderStatus, toTaskWorkflowStatus } from "./orderWorkflow";

export type TaskType = "posted" | "accepted";
export type TaskStatus = "active" | "in-progress" | "completed" | "cancelled";
export type TaskEventTone = "sky" | "amber" | "violet" | "emerald" | "rose" | "slate";

export type OrderRow = {
  id: string;
  listing_id?: string | null;
  listing_type?: string | null;
  service_id?: string | null;
  product_id?: string | null;
  post_id?: string | null;
  help_request_id?: string | null;
  status: string | null;
  price: number | null;
  consumer_id: string | null;
  provider_id: string | null;
  created_at: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ProfileRow = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  location: string | null;
};

export type ServiceRow = {
  id: string;
  title: string | null;
  description: string | null;
  category: string | null;
};

export type ProductRow = {
  id: string;
  title: string | null;
  description: string | null;
  category: string | null;
};

export type PostRow = {
  id: string;
  title: string | null;
  text: string | null;
  content: string | null;
  description: string | null;
};

export type Task = {
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
  tags: string[];
  listingType: string;
  counterpartyId: string | null;
  amount: number | null;
  createdAtRaw: string | null;
};

export type TaskEventRow = {
  id: string;
  order_id: string;
  consumer_id: string | null;
  provider_id: string | null;
  actor_id: string | null;
  event_type: string | null;
  title: string | null;
  description: string | null;
  previous_status: string | null;
  next_status: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
};

export type TaskEventFeedItem = {
  id: string;
  orderId: string;
  title: string;
  description: string;
  taskTitle: string;
  tone: TaskEventTone;
  statusLabel: string | null;
  eventType: string;
  createdAtRaw: string | null;
};

export const fallbackAvatar = "https://i.pravatar.cc/150";

export const normalizeTaskStatus = (status: string | null | undefined): TaskStatus => toTaskWorkflowStatus(status);

export const timelineFromStatus = (status: string | null | undefined) => {
  const normalized = normalizeTaskStatus(status);
  if (normalized === "completed") return "Completed";
  if (normalized === "in-progress") return "In progress";
  if (normalized === "cancelled") return "Cancelled";
  return "Open";
};

export const formatCurrency = (amount: number | null | undefined) => {
  if (!Number.isFinite(Number(amount))) return "Price on request";
  return `INR ${Number(amount).toLocaleString()}`;
};

export const formatCompactCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(amount);

export const formatAgo = (iso: string | null | undefined, nowMs = Date.now()) => {
  if (!iso) return "Recently";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Recently";

  const diffMs = Math.max(0, nowMs - date.getTime());
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

export const getListingTypeLabel = (listingType: string) => {
  if (listingType === "service") return "Service";
  if (listingType === "product") return "Product";
  if (listingType === "demand") return "Demand";
  if (listingType === "order") return "Order";
  return "Order";
};

export const normalizeListingType = (type: string | null | undefined) => {
  const lower = (type || "").toLowerCase();
  if (["service", "services"].includes(lower)) return "service";
  if (["product", "products"].includes(lower)) return "product";
  if (["demand", "need", "needs", "post", "request"].includes(lower)) return "demand";
  return "order";
};

export const buildTitleFromListingType = (listingType: string) => {
  if (listingType === "service") return "Service booking";
  if (listingType === "product") return "Product order";
  if (listingType === "demand") return "Demand response";
  if (listingType === "order") return "Live order";
  return "Live order";
};

const pickString = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

export const resolveOrderListing = (order: OrderRow) => {
  const metadata = order.metadata && typeof order.metadata === "object" ? order.metadata : null;
  const metadataListingType = pickString(metadata?.listing_type);
  const metadataListingId = pickString(metadata?.listing_id);

  const directListingId = pickString(order.listing_id) || metadataListingId;
  const directListingType = normalizeListingType(pickString(order.listing_type) || metadataListingType);

  if (directListingId) {
    return {
      listingId: directListingId,
      listingType: directListingType,
    };
  }

  const serviceId = pickString(order.service_id);
  if (serviceId) {
    return { listingId: serviceId, listingType: "service" };
  }

  const productId = pickString(order.product_id);
  if (productId) {
    return { listingId: productId, listingType: "product" };
  }

  const demandId = pickString(order.post_id) || pickString(order.help_request_id);
  if (demandId) {
    return { listingId: demandId, listingType: "demand" };
  }

  return {
    listingId: null,
    listingType: directListingType,
  };
};

export const mapOrderToTask = (params: {
  order: OrderRow;
  currentUserId: string;
  profileMap: Map<string, ProfileRow>;
  serviceMap: Map<string, ServiceRow>;
  productMap: Map<string, ProductRow>;
  postMap: Map<string, PostRow>;
}) => {
  const { order, currentUserId, profileMap, serviceMap, productMap, postMap } = params;

  const { listingId, listingType } = resolveOrderListing(order);
  const isPostedByMe = order.consumer_id === currentUserId;
  const type: TaskType = isPostedByMe ? "posted" : "accepted";
  const counterpartyId = isPostedByMe ? order.provider_id : order.consumer_id;
  const counterpartyProfile = counterpartyId ? profileMap.get(counterpartyId) : null;
  const consumerProfile = order.consumer_id ? profileMap.get(order.consumer_id) : null;
  const providerProfile = order.provider_id ? profileMap.get(order.provider_id) : null;

  let listingTitle = buildTitleFromListingType(listingType);
  let listingDescription = "Track order activity and coordinate next steps.";
  let listingCategory = listingType;

  if (listingType === "service" && listingId) {
    const service = serviceMap.get(listingId);
    listingTitle = service?.title || listingTitle;
    listingDescription = service?.description || listingDescription;
    listingCategory = service?.category || listingCategory;
  } else if (listingType === "product" && listingId) {
    const product = productMap.get(listingId);
    listingTitle = product?.title || listingTitle;
    listingDescription = product?.description || listingDescription;
    listingCategory = product?.category || listingCategory;
  } else if (listingType === "demand" && listingId) {
    const post = postMap.get(listingId);
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
      image: (isPostedByMe ? profileMap.get(currentUserId)?.avatar_url : consumerProfile?.avatar_url) || fallbackAvatar,
    },
    assignedTo: {
      id: order.provider_id || "unknown-provider",
      name: !isPostedByMe ? "You" : providerProfile?.name || "Provider",
      image: (!isPostedByMe ? profileMap.get(currentUserId)?.avatar_url : providerProfile?.avatar_url) || fallbackAvatar,
    },
    tags: [
      listingCategory,
      listingType === "demand" ? "Demand" : listingType === "service" ? "Service" : listingType === "product" ? "Product" : "Order",
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
};

export const buildFallbackTaskEventFeed = (tasks: Task[]) =>
  tasks.slice(0, 12).map((task) => ({
    id: `fallback-${task.orderId}`,
    orderId: task.orderId,
    title:
      task.status === "completed"
        ? "Order completed"
        : task.status === "cancelled"
          ? "Order closed"
          : task.status === "in-progress"
            ? "Live order in progress"
            : "New live order",
    description: `${task.title} is currently ${getOrderStatusLabel(task.rawStatus).toLowerCase()}.`,
    taskTitle: task.title,
    tone: getTaskEventTone({
      event_type: "status_changed",
      next_status: task.rawStatus,
      previous_status: null,
    }),
    statusLabel: getOrderStatusLabel(task.rawStatus),
    eventType: "fallback_history",
    createdAtRaw: task.createdAtRaw,
  })) satisfies TaskEventFeedItem[];

export const getTaskEventTone = (event: Pick<TaskEventRow, "event_type" | "next_status" | "previous_status">): TaskEventTone => {
  const normalizedNext = normalizeOrderStatus(event.next_status);
  const normalizedPrevious = normalizeOrderStatus(event.previous_status);
  const eventType = (event.event_type || "").toLowerCase();

  if (["cancelled", "rejected"].includes(normalizedNext) || ["cancelled", "rejected"].includes(normalizedPrevious)) {
    return "rose";
  }

  if (["completed", "closed"].includes(normalizedNext)) return "emerald";
  if (["accepted", "in_progress"].includes(normalizedNext)) return "violet";
  if (normalizedNext === "quoted" || eventType === "price_updated") return "amber";
  if (eventType === "created") return "sky";
  return "slate";
};

export const mapTaskEventToFeedItem = (params: {
  event: TaskEventRow;
  taskTitleByOrderId: Map<string, string>;
}) => {
  const { event, taskTitleByOrderId } = params;
  const statusSource = event.next_status || event.previous_status;

  return {
    id: event.id,
    orderId: event.order_id,
    title: event.title || "Task activity",
    description: event.description || "A new task update landed in the operations queue.",
    taskTitle: taskTitleByOrderId.get(event.order_id) || `Order #${event.order_id.slice(0, 8)}`,
    tone: getTaskEventTone(event),
    statusLabel: statusSource ? getOrderStatusLabel(statusSource) : null,
    eventType: (event.event_type || "activity").toLowerCase(),
    createdAtRaw: event.created_at,
  } satisfies TaskEventFeedItem;
};
