export type DeliveryStatus =
  | "pending"
  | "assigned"
  | "picked_up"
  | "in_transit"
  | "delivered"
  | "failed";

export type DeliveryUpdateEvent = {
  status: DeliveryStatus;
  timestamp: string;
  note?: string;
};

export type DeliveryInfo = {
  status: DeliveryStatus;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  trackingNumber?: string;
  carrier?: string;
  estimatedAt?: string;
  deliveredAt?: string;
  address?: string;
  notes?: string;
  photoUrls?: string[];
  updates: DeliveryUpdateEvent[];
};

const FINAL_STATUSES = new Set<DeliveryStatus>(["delivered", "failed"]);

const STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending: "Delivery pending",
  assigned: "Driver assigned",
  picked_up: "Picked up",
  in_transit: "Out for delivery",
  delivered: "Delivered",
  failed: "Delivery failed",
};

const STATUS_DESCRIPTIONS: Record<DeliveryStatus, string> = {
  pending: "Awaiting driver assignment",
  assigned: "A driver has been assigned",
  picked_up: "Order has been picked up",
  in_transit: "On the way to your location",
  delivered: "Order delivered successfully",
  failed: "Delivery was unsuccessful",
};

const STATUS_PILL_CLASSES: Record<DeliveryStatus, string> = {
  pending: "bg-slate-100 text-slate-700",
  assigned: "bg-blue-100 text-blue-700",
  picked_up: "bg-indigo-100 text-indigo-700",
  in_transit: "bg-purple-100 text-purple-700",
  delivered: "bg-emerald-100 text-emerald-700",
  failed: "bg-rose-100 text-rose-700",
};

const STATUS_ICONS: Record<DeliveryStatus, string> = {
  pending: "package",
  assigned: "user-check",
  picked_up: "package-check",
  in_transit: "truck",
  delivered: "check-circle",
  failed: "alert-circle",
};

const deliveryFlow: Record<DeliveryStatus, DeliveryStatus[]> = {
  pending: ["assigned", "failed"],
  assigned: ["picked_up", "failed"],
  picked_up: ["in_transit", "failed"],
  in_transit: ["delivered", "failed"],
  delivered: [],
  failed: [],
};

export const isFinalDeliveryStatus = (status: string | null | undefined): boolean => {
  return FINAL_STATUSES.has(normalizeDeliveryStatus(status));
};

export const normalizeDeliveryStatus = (status: string | null | undefined): DeliveryStatus => {
  const normalized = (status || "").toLowerCase().replace(/-/g, "_");

  if (["pending"].includes(normalized)) return "pending";
  if (["assigned", "driver_assigned"].includes(normalized)) return "assigned";
  if (["picked_up", "pickedup"].includes(normalized)) return "picked_up";
  if (["in_transit", "out_for_delivery", "shipped"].includes(normalized)) return "in_transit";
  if (["delivered"].includes(normalized)) return "delivered";
  if (["failed", "delivery_failed"].includes(normalized)) return "failed";

  return "pending";
};

export const canTransitionDeliveryStatus = (
  from: string | null | undefined,
  to: string | null | undefined,
): boolean => {
  const fromStatus = normalizeDeliveryStatus(from);
  const toStatus = normalizeDeliveryStatus(to);
  if (fromStatus === toStatus) return true;
  return deliveryFlow[fromStatus].includes(toStatus);
};

export const getAllowedDeliveryTransitions = (
  status: string | null | undefined,
): DeliveryStatus[] => {
  return deliveryFlow[normalizeDeliveryStatus(status)];
};

export const getDeliveryStatusLabel = (status: string | null | undefined): string => {
  return STATUS_LABELS[normalizeDeliveryStatus(status)];
};

export const getDeliveryStatusDescription = (status: string | null | undefined): string => {
  return STATUS_DESCRIPTIONS[normalizeDeliveryStatus(status)];
};

export const getDeliveryStatusPillClass = (status: string | null | undefined): string => {
  return STATUS_PILL_CLASSES[normalizeDeliveryStatus(status)];
};

export const getDeliveryStatusIcon = (status: string | null | undefined): string => {
  return STATUS_ICONS[normalizeDeliveryStatus(status)];
};

export const createDeliveryMetadata = (overrides?: Partial<DeliveryInfo>): DeliveryInfo => ({
  status: "pending",
  updates: [{ status: "pending", timestamp: new Date().toISOString(), note: "Delivery created" }],
  ...overrides,
});

export const buildDeliveryUpdate = (
  current: DeliveryInfo,
  newStatus: DeliveryStatus,
  overrides?: Partial<DeliveryInfo>,
): DeliveryInfo => {
  const timestamp = new Date().toISOString();
  return {
    ...current,
    status: newStatus,
    ...(newStatus === "delivered" ? { deliveredAt: timestamp } : {}),
    updates: [
      ...current.updates,
      { status: newStatus, timestamp, note: STATUS_LABELS[newStatus] },
    ],
    ...overrides,
  };
};

export const deliveryTimelineSteps: DeliveryStatus[] = [
  "pending",
  "assigned",
  "picked_up",
  "in_transit",
  "delivered",
];

export const needsDeliveryTracking = (fulfillmentMethod: string | null | undefined): boolean => {
  const method = (fulfillmentMethod || "").toLowerCase();
  return method === "provider" || method === "platform" || method === "courier";
};
