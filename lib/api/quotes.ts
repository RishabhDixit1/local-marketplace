export type QuoteApiErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_PAYLOAD"
  | "CONFIG"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "DB"
  | "UNKNOWN";

export type QuoteApiError = {
  ok: false;
  code: QuoteApiErrorCode;
  message: string;
  details?: string;
};

export type QuoteLineItemInput = {
  label: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

export type QuoteLineItemRecord = QuoteLineItemInput & {
  id: string;
  amount: number;
  sortOrder: number;
};

export type QuoteDraftStatus = "draft" | "sent" | "accepted" | "expired" | "cancelled";
export type QuoteTargetMode = "order" | "help_request";
export type QuoteActorRole = "provider" | "consumer";

export type QuoteContextRecord = {
  mode: QuoteTargetMode;
  orderId: string | null;
  helpRequestId: string | null;
  consumerId: string;
  providerId: string | null;
  actorRole: QuoteActorRole;
  canEdit: boolean;
  taskTitle: string;
  taskDescription: string;
  locationLabel: string;
  currentStatus: string;
  suggestedAmount: number | null;
  counterpartyName: string;
};

export type QuoteDraftRecord = {
  id: string;
  orderId: string | null;
  helpRequestId: string | null;
  providerId: string;
  consumerId: string | null;
  status: QuoteDraftStatus;
  summary: string;
  notes: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  expiresAt: string | null;
  sentAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  lineItems: QuoteLineItemRecord[];
  metadata: Record<string, unknown>;
};

export type QuoteDraftInput = {
  orderId?: string;
  helpRequestId?: string;
  summary: string;
  notes: string;
  taxAmount: number;
  expiresAt?: string | null;
  lineItems: QuoteLineItemInput[];
  conversationId?: string;
};

export type GetQuoteDraftResponse =
  | {
      ok: true;
      context: QuoteContextRecord;
      draft: QuoteDraftRecord | null;
    }
  | QuoteApiError;

export type SaveQuoteDraftResponse =
  | {
      ok: true;
      context: QuoteContextRecord;
      draft: QuoteDraftRecord;
    }
  | QuoteApiError;

export type SendQuoteDraftResponse =
  | {
      ok: true;
      context: QuoteContextRecord;
      draft: QuoteDraftRecord;
      orderId: string;
      orderStatus: string;
      conversationId: string | null;
    }
  | QuoteApiError;

export type AcceptQuoteResponse =
  | {
      ok: true;
      quoteId: string;
      orderId: string;
      orderStatus: string;
    }
  | QuoteApiError;
