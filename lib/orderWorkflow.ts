export type OrderActorRole = "consumer" | "provider";

export type CanonicalOrderStatus =
  | "new_lead"
  | "quoted"
  | "accepted"
  | "in_progress"
  | "completed"
  | "closed"
  | "cancelled"
  | "rejected";

export type TaskWorkflowStatus = "active" | "in-progress" | "completed" | "cancelled";

const FINAL_STATUSES = new Set<CanonicalOrderStatus>([
  "completed",
  "closed",
  "cancelled",
  "rejected",
]);

const STATUS_LABELS: Record<CanonicalOrderStatus, string> = {
  new_lead: "New Lead",
  quoted: "Quoted",
  accepted: "Accepted",
  in_progress: "In Progress",
  completed: "Completed",
  closed: "Closed",
  cancelled: "Cancelled",
  rejected: "Rejected",
};

const STATUS_DESCRIPTIONS: Record<CanonicalOrderStatus, string> = {
  new_lead: "New lead received",
  quoted: "Provider sent quote",
  accepted: "Quote accepted",
  in_progress: "Work in progress",
  completed: "Completed",
  closed: "Closed",
  cancelled: "Cancelled",
  rejected: "Rejected",
};

const STATUS_PILL_CLASSES: Record<CanonicalOrderStatus, string> = {
  new_lead: "bg-amber-100 text-amber-700",
  quoted: "bg-blue-100 text-blue-700",
  accepted: "bg-indigo-100 text-indigo-700",
  in_progress: "bg-purple-100 text-purple-700",
  completed: "bg-emerald-100 text-emerald-700",
  closed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-100 text-rose-700",
  rejected: "bg-rose-100 text-rose-700",
};

const transitionMap: Record<CanonicalOrderStatus, Record<OrderActorRole, CanonicalOrderStatus[]>> = {
  new_lead: {
    provider: ["quoted", "accepted", "rejected"],
    consumer: ["cancelled"],
  },
  quoted: {
    provider: ["accepted", "rejected"],
    consumer: ["accepted", "cancelled"],
  },
  accepted: {
    provider: ["in_progress", "completed"],
    consumer: ["completed", "cancelled"],
  },
  in_progress: {
    provider: ["completed"],
    consumer: ["completed", "cancelled"],
  },
  completed: {
    provider: ["closed"],
    consumer: ["closed"],
  },
  closed: {
    provider: [],
    consumer: [],
  },
  cancelled: {
    provider: [],
    consumer: [],
  },
  rejected: {
    provider: [],
    consumer: [],
  },
};

export const normalizeOrderStatus = (status: string | null | undefined): CanonicalOrderStatus => {
  const normalized = (status || "").toLowerCase();

  if (["new_lead", "lead", "pending", "active", "open"].includes(normalized)) return "new_lead";
  if (["quoted", "quote_sent"].includes(normalized)) return "quoted";
  if (["accepted", "booked"].includes(normalized)) return "accepted";
  if (["in_progress", "in-progress", "active_work"].includes(normalized)) return "in_progress";
  if (["completed", "done"].includes(normalized)) return "completed";
  if (["closed"].includes(normalized)) return "closed";
  if (["cancelled", "canceled"].includes(normalized)) return "cancelled";
  if (["rejected", "declined"].includes(normalized)) return "rejected";

  return "new_lead";
};

export const isFinalOrderStatus = (status: string | null | undefined) => {
  return FINAL_STATUSES.has(normalizeOrderStatus(status));
};

export const getAllowedTransitions = (
  status: string | null | undefined,
  actor: OrderActorRole
): CanonicalOrderStatus[] => {
  return transitionMap[normalizeOrderStatus(status)][actor];
};

export const canTransitionOrderStatus = (params: {
  from: string | null | undefined;
  to: string | null | undefined;
  actor: OrderActorRole;
}) => {
  const fromStatus = normalizeOrderStatus(params.from);
  const toStatus = normalizeOrderStatus(params.to);
  if (fromStatus === toStatus) return true;
  return transitionMap[fromStatus][params.actor].includes(toStatus);
};

export const getOrderStatusLabel = (status: string | null | undefined) => {
  return STATUS_LABELS[normalizeOrderStatus(status)];
};

export const getOrderStatusDescription = (status: string | null | undefined) => {
  return STATUS_DESCRIPTIONS[normalizeOrderStatus(status)];
};

export const getOrderStatusPillClass = (status: string | null | undefined) => {
  return STATUS_PILL_CLASSES[normalizeOrderStatus(status)];
};

export const toTaskWorkflowStatus = (status: string | null | undefined): TaskWorkflowStatus => {
  const normalized = normalizeOrderStatus(status);
  if (["completed", "closed"].includes(normalized)) return "completed";
  if (["cancelled", "rejected"].includes(normalized)) return "cancelled";
  if (["accepted", "in_progress"].includes(normalized)) return "in-progress";
  return "active";
};

export const getTransitionActionLabel = (params: {
  actor: OrderActorRole;
  nextStatus: CanonicalOrderStatus;
}) => {
  const { actor, nextStatus } = params;

  if (actor === "provider") {
    if (nextStatus === "quoted") return "Send Quote";
    if (nextStatus === "accepted") return "Mark Accepted";
    if (nextStatus === "in_progress") return "Start Work";
    if (nextStatus === "completed") return "Mark Completed";
    if (nextStatus === "rejected") return "Reject";
    if (nextStatus === "closed") return "Close Order";
  }

  if (actor === "consumer") {
    if (nextStatus === "accepted") return "Accept Quote";
    if (nextStatus === "completed") return "Confirm Completion";
    if (nextStatus === "cancelled") return "Cancel Request";
    if (nextStatus === "closed") return "Close Order";
  }

  return STATUS_LABELS[nextStatus];
};

export const stageOrder: CanonicalOrderStatus[] = [
  "new_lead",
  "quoted",
  "accepted",
  "in_progress",
  "completed",
  "closed",
];
