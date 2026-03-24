import type { QuoteApiErrorCode, QuoteDraftInput, QuoteLineItemInput } from "@/lib/api/quotes";

type QuoteRouteErrorShape = {
  message: string;
  details?: string | null;
  forbidden?: boolean;
  invalid?: boolean;
  notFound?: boolean;
  config?: boolean;
  missingTable?: boolean;
};

const trim = (value: string | null | undefined) => value?.trim() ?? "";
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toFiniteNumber = (value: unknown) => {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeLineItem = (value: unknown): QuoteLineItemInput | null => {
  if (!isRecord(value)) return null;
  if (typeof value.label !== "string" || typeof value.description !== "string") return null;

  const quantity = toFiniteNumber(value.quantity);
  const unitPrice = toFiniteNumber(value.unitPrice);
  if (quantity === null || unitPrice === null) return null;

  return {
    label: value.label,
    description: value.description,
    quantity,
    unitPrice,
  };
};

export const parseQuoteDraftInput = (value: unknown): QuoteDraftInput | null => {
  if (!isRecord(value) || !Array.isArray(value.lineItems)) return null;

  const lineItems = value.lineItems
    .map((item) => normalizeLineItem(item))
    .filter((item): item is QuoteLineItemInput => !!item);

  if (lineItems.length !== value.lineItems.length) return null;

  if (
    !(
      typeof value.orderId === "string" ||
      value.orderId === null ||
      value.orderId === undefined
    ) ||
    !(
      typeof value.helpRequestId === "string" ||
      value.helpRequestId === null ||
      value.helpRequestId === undefined
    ) ||
    !(typeof value.summary === "string" || value.summary === null || value.summary === undefined) ||
    !(typeof value.notes === "string" || value.notes === null || value.notes === undefined) ||
    !(typeof value.expiresAt === "string" || value.expiresAt === null || value.expiresAt === undefined) ||
    !(
      typeof value.conversationId === "string" ||
      value.conversationId === null ||
      value.conversationId === undefined
    )
  ) {
    return null;
  }

  const taxAmount = toFiniteNumber(value.taxAmount ?? 0);
  if (taxAmount === null) return null;

  const orderId = trim(typeof value.orderId === "string" ? value.orderId : "");
  const helpRequestId = trim(typeof value.helpRequestId === "string" ? value.helpRequestId : "");
  const conversationId = trim(typeof value.conversationId === "string" ? value.conversationId : "");
  const expiresAt = trim(typeof value.expiresAt === "string" ? value.expiresAt : "");

  return {
    orderId: orderId || undefined,
    helpRequestId: helpRequestId || undefined,
    summary: typeof value.summary === "string" ? value.summary : "",
    notes: typeof value.notes === "string" ? value.notes : "",
    taxAmount,
    expiresAt: expiresAt || null,
    lineItems,
    conversationId: conversationId || undefined,
  };
};

export const mapQuoteRouteError = (
  error: QuoteRouteErrorShape
): {
  status: number;
  code: QuoteApiErrorCode;
  message: string;
  details?: string;
} => {
  if (error.invalid) {
    return {
      status: 400,
      code: "INVALID_PAYLOAD",
      message: error.message,
      details: error.details || undefined,
    };
  }

  if (error.forbidden) {
    return {
      status: 403,
      code: "FORBIDDEN",
      message: error.message,
      details: error.details || undefined,
    };
  }

  if (error.notFound) {
    return {
      status: 404,
      code: "NOT_FOUND",
      message: error.message,
      details: error.details || undefined,
    };
  }

  if (error.config) {
    return {
      status: 500,
      code: "CONFIG",
      message: error.message,
      details: error.details || undefined,
    };
  }

  if (error.missingTable) {
    return {
      status: 503,
      code: "DB",
      message: "Quote flow tables are not available yet. Run the latest Supabase migrations and retry.",
      details: error.details || error.message,
    };
  }

  return {
    status: 500,
    code: "DB",
    message: error.message,
    details: error.details || undefined,
  };
};
