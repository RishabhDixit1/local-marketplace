export const ORDER_FULFILLMENT_METHODS = ["self", "provider", "platform", "courier"] as const;

export type OrderFulfillmentMethod = (typeof ORDER_FULFILLMENT_METHODS)[number];

export type OrderFulfillmentOption = {
  id: OrderFulfillmentMethod;
  label: string;
  shortLabel: string;
  description: string;
  addressLabel: string;
  addressPlaceholder: string;
  helperText: string;
};

export const ORDER_FULFILLMENT_OPTIONS: Record<OrderFulfillmentMethod, OrderFulfillmentOption> = {
  self: {
    id: "self",
    label: "Self pickup or meetup",
    shortLabel: "Self",
    description: "You will pick up the order or meet the provider directly.",
    addressLabel: "Pickup or meeting point",
    addressPlaceholder: "Enter the pickup spot or where both sides should meet.",
    helperText: "Best when you want to handle the handoff yourself.",
  },
  provider: {
    id: "provider",
    label: "Provider handles delivery",
    shortLabel: "Provider",
    description: "The provider will come to you, deliver the order, or handle the visit.",
    addressLabel: "Delivery or service address",
    addressPlaceholder: "Enter the full address where delivery or service should happen.",
    helperText: "Best when the provider will travel to you.",
  },
  platform: {
    id: "platform",
    label: "ServiQ coordinates it",
    shortLabel: "Platform",
    description: "ServiQ will coordinate a local runner or fulfillment handoff.",
    addressLabel: "Delivery or service address",
    addressPlaceholder: "Enter the address where ServiQ coordination should happen.",
    helperText: "Best when you want platform-led delivery coordination.",
  },
  courier: {
    id: "courier",
    label: "Courier or third-party handoff",
    shortLabel: "Courier",
    description: "A courier or external partner will handle the final movement.",
    addressLabel: "Courier destination",
    addressPlaceholder: "Enter the address where the courier should deliver.",
    helperText: "Best when a courier or partner will complete the handoff.",
  },
};

export const isOrderFulfillmentMethod = (value: unknown): value is OrderFulfillmentMethod =>
  typeof value === "string" && (ORDER_FULFILLMENT_METHODS as readonly string[]).includes(value);

export const normalizeOrderFulfillmentMethod = (value: unknown): OrderFulfillmentMethod =>
  isOrderFulfillmentMethod(value) ? value : "provider";

export const getOrderFulfillmentOption = (value: unknown) =>
  ORDER_FULFILLMENT_OPTIONS[normalizeOrderFulfillmentMethod(value)];

export const getFulfillmentMinimumLength = (value: unknown) =>
  normalizeOrderFulfillmentMethod(value) === "self" ? 5 : 10;

export const recommendOrderFulfillmentMethod = (
  items: Array<{ itemType: "service" | "product"; deliveryMethod?: "pickup" | "delivery" | "both" | null }>
): OrderFulfillmentMethod => {
  if (items.length === 0) return "provider";

  const hasService = items.some((item) => item.itemType === "service");
  if (hasService) return "provider";

  const productMethods = items.map((item) => item.deliveryMethod).filter(Boolean);
  if (productMethods.length > 0 && productMethods.every((method) => method === "pickup")) {
    return "self";
  }
  if (productMethods.length > 0 && productMethods.every((method) => method === "delivery")) {
    return "provider";
  }

  return "provider";
};
