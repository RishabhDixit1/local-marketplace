import { getOrderFulfillmentOption, type OrderFulfillmentMethod } from "@/lib/orderFulfillment";

export type CheckoutPaymentMethod = "razorpay" | "cod";
export type PaymentStatusTone = "emerald" | "amber" | "blue" | "slate";

type CheckoutPaymentOption = {
  id: CheckoutPaymentMethod;
  label: string;
  shortLabel: string;
  description: string;
  primaryAction: string;
  rails: string[];
  collectionLabel: string;
};

type CheckoutPaymentJourney = {
  eyebrow: string;
  heading: string;
  detail: string;
  steps: string[];
  support: string;
};

type OrderPaymentSummary = {
  methodLabel: string;
  statusLabel: string;
  tone: PaymentStatusTone;
  heading: string;
  detail: string;
  support: string;
  rails: string[];
};

const CHECKOUT_PAYMENT_OPTIONS: Record<CheckoutPaymentMethod, CheckoutPaymentOption> = {
  razorpay: {
    id: "razorpay",
    label: "Pay Online",
    shortLabel: "Online",
    description: "UPI, Cards, NetBanking",
    primaryAction: "Pay",
    rails: ["Razorpay", "UPI", "Cards", "NetBanking"],
    collectionLabel: "Upfront",
  },
  cod: {
    id: "cod",
    label: "Pay on Delivery",
    shortLabel: "On delivery",
    description: "Cash or UPI on arrival",
    primaryAction: "Place order",
    rails: ["Cash", "UPI"],
    collectionLabel: "At handoff",
  },
};

const PAYMENT_RAIL_LABELS: Array<[pattern: RegExp, label: string]> = [
  [/^razorpay$/i, "Razorpay"],
  [/^upi$/i, "UPI"],
  [/^(cash|cod|cash on delivery)$/i, "Cash on Delivery"],
  [/^(card|cards|credit card|debit card)$/i, "Cards"],
  [/^(netbanking|net banking)$/i, "NetBanking"],
  [/^(bank|bank transfer|bank account)$/i, "Bank Transfer"],
  [/^(wallet|wallets)$/i, "Wallet"],
  [/^(cashfree)$/i, "Cashfree"],
];

const toTitleCase = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const normalizePaymentMethod = (value: unknown): CheckoutPaymentMethod | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "razorpay") return "razorpay";
  if (normalized === "cod" || normalized === "cash" || normalized === "cash_on_delivery") return "cod";
  return null;
};

const normalizePaymentStatus = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const resolveHandoffLabel = (fulfillmentMethod?: OrderFulfillmentMethod | null) => {
  const option = getOrderFulfillmentOption(fulfillmentMethod ?? undefined);

  if (fulfillmentMethod === "self") {
    return {
      location: "when you meet the provider",
      channel: "meeting point",
      support: "Bring the amount to the meetup and confirm the exchange once the handoff happens.",
      fulfillmentLabel: option.shortLabel,
    };
  }

  if (fulfillmentMethod === "courier") {
    return {
      location: "when the courier reaches you",
      channel: "courier handoff",
      support: "Keep the delivery amount ready for the courier or third-party runner at handoff.",
      fulfillmentLabel: option.shortLabel,
    };
  }

  if (fulfillmentMethod === "platform") {
    return {
      location: "when ServiQ coordinates the handoff",
      channel: "ServiQ-coordinated handoff",
      support: "ServiQ will keep the order status in sync while the final collection happens during the handoff.",
      fulfillmentLabel: option.shortLabel,
    };
  }

  return {
    location: "when the provider arrives",
    channel: "provider visit or delivery",
    support: "Keep the amount ready for the provider once the visit, delivery, or service starts.",
    fulfillmentLabel: option.shortLabel,
  };
};

export const PAYMENT_METHOD_OPTIONS: CheckoutPaymentOption[] = [
  CHECKOUT_PAYMENT_OPTIONS.razorpay,
  CHECKOUT_PAYMENT_OPTIONS.cod,
];

export const getCheckoutPaymentOption = (method: CheckoutPaymentMethod) => CHECKOUT_PAYMENT_OPTIONS[method];

export function formatPaymentRailLabel(value: unknown): string {
  if (typeof value !== "string") return "Payment";
  const normalized = value.trim();
  const comparable = normalized.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!comparable) return "Payment";

  for (const [pattern, label] of PAYMENT_RAIL_LABELS) {
    if (pattern.test(comparable)) return label;
  }

  return toTitleCase(comparable);
}

export function formatPaymentRailList(values: Array<string | null | undefined>) {
  const unique = new Set<string>();

  for (const value of values) {
    if (typeof value !== "string" || !value.trim()) continue;
    unique.add(formatPaymentRailLabel(value));
  }

  return Array.from(unique);
}

export function getCheckoutPaymentJourney(
  method: CheckoutPaymentMethod,
  fulfillmentMethod?: OrderFulfillmentMethod | null
): CheckoutPaymentJourney {
  const handoff = resolveHandoffLabel(fulfillmentMethod);

  if (method === "cod") {
    return {
      eyebrow: "Pay later",
      heading: "Place the order first, then pay at the final handoff.",
      detail: `You can confirm the booking now and pay by cash or UPI ${handoff.location}.`,
      steps: [
        "Place the order without paying upfront.",
        `Pay offline by cash or UPI during the ${handoff.channel}.`,
        `ServiQ keeps acceptance, progress, and completion updates visible in the order timeline.`,
      ],
      support: handoff.support,
    };
  }

  return {
    eyebrow: "Pay now",
    heading: "Use Razorpay to confirm the order immediately.",
    detail: `Complete payment with UPI, cards, or net banking before ${handoff.fulfillmentLabel.toLowerCase()} begins.`,
    steps: [
      "Finish payment inside the Razorpay checkout window.",
      "ServiQ records the payment and links it to your order automatically.",
      `The provider then continues with ${handoff.fulfillmentLabel.toLowerCase()} and status updates stay visible in-app.`,
    ],
    support: "Your order page will show whether payment is processing or fully confirmed after checkout.",
  };
}

export function getOrderPaymentSummary(input: {
  paymentMethod?: unknown;
  paymentStatus?: unknown;
  fulfillmentMethod?: OrderFulfillmentMethod | null;
}): OrderPaymentSummary {
  const method = normalizePaymentMethod(input.paymentMethod);
  const paymentStatus = normalizePaymentStatus(input.paymentStatus);
  const handoff = resolveHandoffLabel(input.fulfillmentMethod);

  if (method === "cod") {
    if (paymentStatus === "paid") {
      return {
        methodLabel: CHECKOUT_PAYMENT_OPTIONS.cod.label,
        statusLabel: "Collected",
        tone: "emerald",
        heading: "Payment collected at handoff.",
        detail: "This order was booked as pay on delivery and the payment has now been marked as received.",
        support: "Keep the order timeline updated if the service or delivery still needs follow-through after payment.",
        rails: CHECKOUT_PAYMENT_OPTIONS.cod.rails,
      };
    }

    return {
      methodLabel: CHECKOUT_PAYMENT_OPTIONS.cod.label,
      statusLabel: "Pay at handoff",
      tone: "blue",
      heading: `Payment is due ${handoff.location}.`,
      detail: `This order is confirmed without upfront payment. Final collection happens during the ${handoff.channel}.`,
      support: handoff.support,
      rails: CHECKOUT_PAYMENT_OPTIONS.cod.rails,
    };
  }

  if (method === "razorpay" && paymentStatus === "paid") {
    return {
      methodLabel: CHECKOUT_PAYMENT_OPTIONS.razorpay.label,
      statusLabel: "Paid",
      tone: "emerald",
      heading: "Online payment confirmed.",
      detail: "Razorpay verified this payment and ServiQ linked it to the order successfully.",
      support: "The provider can now continue with the order while you track fulfillment here.",
      rails: CHECKOUT_PAYMENT_OPTIONS.razorpay.rails,
    };
  }

  if (method === "razorpay" && paymentStatus === "processing") {
    return {
      methodLabel: CHECKOUT_PAYMENT_OPTIONS.razorpay.label,
      statusLabel: "Processing",
      tone: "amber",
      heading: "Payment verification is still syncing.",
      detail: "The Razorpay payment was initiated and ServiQ is finishing the order confirmation flow.",
      support: "If this state lasts longer than expected, keep your payment reference handy before contacting support.",
      rails: CHECKOUT_PAYMENT_OPTIONS.razorpay.rails,
    };
  }

  if (method === "razorpay") {
    return {
      methodLabel: CHECKOUT_PAYMENT_OPTIONS.razorpay.label,
      statusLabel: "Awaiting payment",
      tone: "amber",
      heading: "Online payment is not confirmed yet.",
      detail: "Complete the Razorpay step to lock the order and show payment confirmation here.",
      support: "Once paid, ServiQ will sync the payment status to this order automatically.",
      rails: CHECKOUT_PAYMENT_OPTIONS.razorpay.rails,
    };
  }

  return {
    methodLabel: "Payment not set",
    statusLabel: "Pending",
    tone: "slate",
    heading: "Payment details are still being prepared.",
    detail: "You will see the chosen collection method and confirmation status once checkout is completed.",
    support: "ServiQ keeps payment status and fulfillment status separate so each step is easier to follow.",
    rails: [],
  };
}
