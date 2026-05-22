export type QuoteApiErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_PAYLOAD"
  | "CONFIG"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID_STATE"
  | "UNKNOWN"
  | "VERSIONING_ERROR"
  | "DB";

export type QuoteVersionRecord = {
  id: string;
  quoteId: string;
  versionNumber: number;
  status: "draft" | "sent" | "accepted" | "expired" | "cancelled" | "rejected" | "countered";
  summary: string | null;
  notes: string | null;
  subtotal: number;
  taxAmount: number;
  total: number;
  expiresAt: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  rejectedReason: string | null;
  lineItems: Array<{
    id: string;
    quoteVersionId: string;
    quoteId: string;
    label: string;
    description: string | null;
    quantity: number;
    unitPrice: number;
    amount: number;
    sortOrder: number;
    metadata: Record<string, unknown>;
  }>;
  createdAt: string | null;
  updatedAt: string | null;
  metadata: Record<string, unknown>;
};

export type QuoteAttachmentType = "attachment" | "proof_of_work" | "receipt" | "contract" | "other";

export type QuoteAttachmentRecord = {
  id: string;
  quoteId: string;
  orderId: string | null;
  helpRequestId: string | null;
  uploadedBy: string;
  kind: QuoteAttachmentType;
  fileName: string;
  filePath: string;
  fileUrl: string;
  fileSizeBytes: number | null;
  mimeType: string | null;
  title: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  createdAt: string | null;
  updatedAt: string | null;
};

export type DealRoomScope = {
  taskTitle: string;
  taskDescription: string;
  locationLabel: string;
  category?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
};

export type DealRoomTimelineItem = {
  id: string;
  kind: "status_change" | "quote_sent" | "quote_accepted" | "message" | "attachment" | "note";
  actorId: string | null;
  actorName?: string | null;
  actorAvatarUrl?: string | null;
  title: string;
  description?: string | null;
  timestamp: string;
  metadata?: Record<string, unknown>;
};

export type DealRoomContext = {
  orderId: string | null;
  helpRequestId: string | null;
  consumerId: string;
  providerId: string | null;
  currentUserId: string;
  actorRole: "provider" | "consumer";
  scope: DealRoomScope;
  status: string;
  counterpartyName: string;
  counterpartyAvatarUrl?: string | null;
  conversationId?: string | null;
  canEditQuote: boolean;
  canAcceptQuote: boolean;
  canAddAttachment: boolean;
};

export type ProviderCatalogItem = {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number | null;
  source?: string | null;
};

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

export type QuoteDraftStatus = "draft" | "sent" | "accepted" | "expired" | "cancelled" | "rejected" | "countered";
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

export type GetDealRoomResponse =
  | {
      ok: true;
      context: DealRoomContext;
      draft: QuoteDraftRecord | null;
      versions: QuoteVersionRecord[];
      attachments: QuoteAttachmentRecord[];
      timeline: DealRoomTimelineItem[];
      catalogItems: ProviderCatalogItem[];
    }
  | QuoteApiError;

export type RejectQuoteRequest = {
  quoteId: string;
  reason?: string;
  counterRequest?: boolean;
};

export type RejectQuoteResponse =
  | {
      ok: true;
      quoteId: string;
      status: string;
    }
  | QuoteApiError;

export type AddQuoteAttachmentRequest = {
  quoteId: string;
  fileName: string;
  filePath: string;
  fileUrl: string;
  fileSizeBytes?: number;
  mimeType?: string;
  kind?: QuoteAttachmentType;
  title?: string;
  description?: string;
};

export type AddQuoteAttachmentResponse =
  | {
      ok: true;
      attachment: QuoteAttachmentRecord;
    }
  | QuoteApiError;

export type RemoveQuoteAttachmentRequest = {
  attachmentId: string;
};

export type RemoveQuoteAttachmentResponse =
  | {
      ok: true;
      attachmentId: string;
    }
  | QuoteApiError;
