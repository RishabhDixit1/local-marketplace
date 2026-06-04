import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  QuoteContextRecord,
  QuoteDraftInput,
  QuoteDraftRecord,
  QuoteLineItemRecord,
  QuoteVersionRecord,
} from "@/lib/api/quotes";
import { normalizeOrderStatus } from "@/lib/orderWorkflow";
import { calculateQuoteTotals } from "@/lib/quotes/calculations";
import { getConversationContext } from "@/lib/server/chatGuards";
import { sendPushToUser } from "@/lib/server/pushNotifications";

type FlexibleRecord = Record<string, unknown>;

type QuoteVersionRow = {
  id: string;
  quote_id: string;
  version_number: number;
  status: string | null;
  summary: string | null;
  notes: string | null;
  subtotal: number | string | null;
  tax_amount: number | string | null;
  total: number | string | null;
  expires_at: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  rejected_reason: string | null;
  metadata: FlexibleRecord | null;
  created_at: string | null;
  updated_at: string | null;
};

type QuoteVersionLineItemRow = {
  id: string;
  quote_version_id: string;
  quote_id: string;
  label: string | null;
  description: string | null;
  quantity: number | string | null;
  unit_price: number | string | null;
  amount: number | string | null;
  sort_order: number | null;
  metadata: FlexibleRecord | null;
};

type OrderRow = {
  id: string;
  listing_type: string | null;
  help_request_id: string | null;
  consumer_id: string | null;
  provider_id: string | null;
  price: number | string | null;
  status: string | null;
  metadata: FlexibleRecord | null;
  created_at: string | null;
};

type HelpRequestRow = {
  id: string;
  requester_id: string | null;
  accepted_provider_id: string | null;
  title: string | null;
  details: string | null;
  category: string | null;
  budget_min: number | string | null;
  budget_max: number | string | null;
  location_label: string | null;
  status: string | null;
  created_at: string | null;
};

type ProfileNameRow = {
  id: string;
  name: string | null;
};

type QuoteDraftRow = {
  id: string;
  order_id: string | null;
  help_request_id: string | null;
  provider_id: string;
  consumer_id: string | null;
  status: string | null;
  summary: string | null;
  notes: string | null;
  subtotal: number | string | null;
  tax_amount: number | string | null;
  total: number | string | null;
  expires_at: string | null;
  sent_at: string | null;
  metadata: FlexibleRecord | null;
  created_at: string | null;
  updated_at: string | null;
};

type QuoteLineItemRow = {
  id: string;
  quote_id: string;
  label: string | null;
  description: string | null;
  quantity: number | string | null;
  unit_price: number | string | null;
  amount: number | string | null;
  sort_order: number | null;
  metadata: FlexibleRecord | null;
};

type QuoteMutationError = {
  ok: false;
  code?: string | null;
  details?: string | null;
  message: string;
  missingTable?: boolean;
  forbidden?: boolean;
  invalid?: boolean;
  notFound?: boolean;
  config?: boolean;
};

type QuoteContextSuccess = {
  ok: true;
  context: QuoteContextRecord;
  order: OrderRow | null;
  helpRequest: HelpRequestRow | null;
};

type QuoteLoadSuccess = {
  ok: true;
  context: QuoteContextRecord;
  draft: QuoteDraftRecord | null;
};

type QuoteSaveSuccess = {
  ok: true;
  context: QuoteContextRecord;
  draft: QuoteDraftRecord;
};

type QuoteSendSuccess = {
  ok: true;
  context: QuoteContextRecord;
  draft: QuoteDraftRecord;
  orderId: string;
  orderStatus: string;
  conversationId: string | null;
};

const missingQuoteTablePattern =
  /relation .*quote_(drafts|line_items).* does not exist|could not find the table '.*quote_(drafts|line_items).*' in the schema cache/i;

const trim = (value: string | null | undefined) => value?.trim() ?? "";
const isRecord = (value: unknown): value is FlexibleRecord => typeof value === "object" && value !== null && !Array.isArray(value);

const pickString = (value: unknown) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const toFiniteNumber = (value: unknown) => {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

const toMetadata = (value: unknown) => (isRecord(value) ? value : {});
const isMissingQuoteTableError = (message: string) => missingQuoteTablePattern.test(message);

const buildDefaultQuoteSummary = (taskTitle: string) => `Quote for ${trim(taskTitle) || "this request"}`;

const formatCurrency = (value: number | null) => {
  if (!Number.isFinite(Number(value))) return "Custom quote";
  return `INR ${Number(value).toLocaleString("en-IN")}`;
};

const formatExpiryDate = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const isExpired = (value: string | null) => {
  if (!value) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() < Date.now();
};

const normalizeExpiresAt = (value: string | null | undefined) => {
  const normalized = trim(value);
  if (!normalized) return null;

  const withTime = normalized.length <= 10 ? `${normalized}T23:59:59.000Z` : normalized;
  const parsed = new Date(withTime);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const toQuoteLineItemRecord = (row: QuoteLineItemRow): QuoteLineItemRecord => ({
  id: row.id,
  label: trim(row.label),
  description: trim(row.description),
  quantity: Math.max(1, toFiniteNumber(row.quantity) || 1),
  unitPrice: Math.max(0, toFiniteNumber(row.unit_price) || 0),
  amount: Math.max(0, toFiniteNumber(row.amount) || 0),
  sortOrder: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0,
});

const buildQuoteDraftRecord = (row: QuoteDraftRow, lineItems: QuoteLineItemRow[]): QuoteDraftRecord => {
  const storedStatus =
    row.status === "sent" || row.status === "accepted" || row.status === "expired" || row.status === "cancelled" || row.status === "rejected" || row.status === "countered"
      ? row.status
      : "draft";
  const status = storedStatus === "sent" && isExpired(row.expires_at) ? "expired" : storedStatus;

  return {
    id: row.id,
    orderId: row.order_id,
    helpRequestId: row.help_request_id,
    providerId: row.provider_id,
    consumerId: row.consumer_id,
    status,
    summary: trim(row.summary),
    notes: trim(row.notes),
    subtotal: Math.max(0, toFiniteNumber(row.subtotal) || 0),
    taxAmount: Math.max(0, toFiniteNumber(row.tax_amount) || 0),
    total: Math.max(0, toFiniteNumber(row.total) || 0),
    expiresAt: row.expires_at,
    sentAt: row.sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lineItems: lineItems
      .map(toQuoteLineItemRecord)
      .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id)),
    metadata: toMetadata(row.metadata),
  };
};

const getNextVersionNumber = async (db: SupabaseClient, quoteId: string): Promise<number> => {
  const result = await db
    .from("quote_versions")
    .select("version_number")
    .eq("quote_id", quoteId)
    .order("version_number", { ascending: false })
    .limit(1);

  if (result.error || !result.data || result.data.length === 0) {
    return 1;
  }
  const latestVersion = toFiniteNumber((result.data[0] as Record<string, unknown>).version_number);
  return (latestVersion || 0) + 1;
};

const buildQuoteVersionRecord = (
  row: QuoteVersionRow,
  lineItems: QuoteVersionLineItemRow[]
): QuoteVersionRecord => {
  const storedStatus =
    row.status === "sent" || row.status === "accepted" || row.status === "expired" || row.status === "cancelled" || row.status === "rejected" || row.status === "countered"
      ? row.status
      : "draft";

  return {
    id: row.id,
    quoteId: row.quote_id,
    versionNumber: Math.max(1, toFiniteNumber(row.version_number) || 1),
    status: storedStatus as QuoteVersionRecord["status"],
    summary: trim(row.summary),
    notes: trim(row.notes),
    subtotal: Math.max(0, toFiniteNumber(row.subtotal) || 0),
    taxAmount: Math.max(0, toFiniteNumber(row.tax_amount) || 0),
    total: Math.max(0, toFiniteNumber(row.total) || 0),
    expiresAt: row.expires_at,
    sentAt: row.sent_at,
    acceptedAt: row.accepted_at,
    rejectedAt: row.rejected_at,
    rejectedReason: trim(row.rejected_reason),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lineItems: lineItems
      .map((row) => ({
        id: row.id,
        quoteVersionId: row.quote_version_id,
        quoteId: row.quote_id,
        label: trim(row.label),
        description: trim(row.description),
        quantity: Math.max(1, toFiniteNumber(row.quantity) || 1),
        unitPrice: Math.max(0, toFiniteNumber(row.unit_price) || 0),
        amount: Math.max(0, toFiniteNumber(row.amount) || 0),
        sortOrder: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0,
        metadata: toMetadata(row.metadata),
      }))
      .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id)),
    metadata: toMetadata(row.metadata),
  };
};

const createQuoteVersionSnapshot = async (params: {
  db: SupabaseClient;
  quoteId: string;
  status?: string;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
  rejectedReason?: string | null;
}): Promise<{ ok: true; version: QuoteVersionRecord } | QuoteMutationError> => {
  try {
    const quoteResult = await params.db
      .from("quote_drafts")
      .select(
        "id,order_id,help_request_id,provider_id,consumer_id,status,summary,notes,subtotal,tax_amount,total,expires_at,sent_at,metadata,created_at,updated_at"
      )
      .eq("id", params.quoteId)
      .maybeSingle();

    if (quoteResult.error || !quoteResult.data) {
      return createMutationError(quoteResult.error?.message || "Quote not found for versioning.", {
        code: quoteResult.error?.code || null,
        notFound: !quoteResult.data,
      });
    }

    const lineItemsResult = await params.db
      .from("quote_line_items")
      .select("id,quote_id,label,description,quantity,unit_price,amount,sort_order,metadata")
      .eq("quote_id", params.quoteId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (lineItemsResult.error) {
      return createMutationError(lineItemsResult.error.message || "Failed to load line items for versioning.", {
        code: lineItemsResult.error.code,
      });
    }

    const quoteRow = quoteResult.data as QuoteDraftRow;
    const lineItemRows = (lineItemsResult.data as QuoteLineItemRow[] | null) || [];

    const versionNumber = await getNextVersionNumber(params.db, params.quoteId);
    const status = params.status || quoteRow.status || "draft";
    const now = new Date().toISOString();

    const versionPayload = {
      quote_id: params.quoteId,
      version_number: versionNumber,
      status: status,
      summary: quoteRow.summary,
      notes: quoteRow.notes,
      subtotal: quoteRow.subtotal,
      tax_amount: quoteRow.tax_amount,
      total: quoteRow.total,
      expires_at: quoteRow.expires_at,
      sent_at: quoteRow.sent_at,
      accepted_at: params.acceptedAt || null,
      rejected_at: params.rejectedAt || null,
      rejected_reason: params.rejectedReason || null,
      metadata: {
        ...toMetadata(quoteRow.metadata),
        version_created_at: now,
        snapshot_status: status,
      },
      created_at: now,
      updated_at: now,
    };

    const insertVersionResult = await params.db
      .from("quote_versions")
      .insert(versionPayload)
      .select("*")
      .single();

    if (insertVersionResult.error || !insertVersionResult.data) {
      return createMutationError(
        insertVersionResult.error?.message || "Failed to create quote version snapshot.",
        {
          code: insertVersionResult.error?.code || null,
        }
      );
    }

    const versionId = (insertVersionResult.data as QuoteVersionRow).id;

    if (lineItemRows.length > 0) {
      const versionLineItems = lineItemRows.map((row, index) => ({
        quote_version_id: versionId,
        quote_id: params.quoteId,
        label: row.label,
        description: row.description,
        quantity: row.quantity,
        unit_price: row.unit_price,
        amount: row.amount,
        sort_order: row.sort_order ?? index,
        metadata: toMetadata(row.metadata),
        created_at: now,
        updated_at: now,
      }));

      const insertItemsResult = await params.db
        .from("quote_version_line_items")
        .insert(versionLineItems);

      if (insertItemsResult.error) {
        console.warn("Failed to insert quote version line items:", insertItemsResult.error.message);
      }
    }

    const loadedVersionResult = await params.db
      .from("quote_versions")
      .select("*")
      .eq("id", versionId)
      .single();

    const loadedItemsResult = await params.db
      .from("quote_version_line_items")
      .select("*")
      .eq("quote_version_id", versionId)
      .order("sort_order", { ascending: true });

    return {
      ok: true,
      version: buildQuoteVersionRecord(
        (loadedVersionResult.data ?? insertVersionResult.data) as QuoteVersionRow,
        (loadedItemsResult.data ?? []) as QuoteVersionLineItemRow[]
      ),
    };
  } catch (error) {
    return createMutationError(
      error instanceof Error ? error.message : "Unexpected error during quote versioning.",
      {
        code: "VERSIONING_ERROR",
      }
    );
  }
};

const createMutationError = (
  message: string,
  extra?: Partial<Omit<QuoteMutationError, "ok" | "message">>
): QuoteMutationError => ({
  ok: false,
  message,
  ...extra,
});

const getCounterpartyName = async (db: SupabaseClient, ids: string[]) => {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) return new Map<string, string>();

  const result = await db.from("profiles").select("id,name").in("id", uniqueIds);
  if (result.error) {
    return new Map<string, string>();
  }

  return new Map(
    (((result.data as ProfileNameRow[] | null) || []).map((row) => [row.id, trim(row.name)])).filter((entry): entry is [string, string] => Boolean(entry[0]))
  );
};

const buildOrderContext = async (db: SupabaseClient, order: OrderRow, userId: string): Promise<QuoteContextSuccess | QuoteMutationError> => {
  const consumerId = pickString(order.consumer_id);
  const providerId = pickString(order.provider_id);

  if (!consumerId) {
    return createMutationError("This order is missing the customer record.", {
      invalid: true,
    });
  }

  if (userId !== consumerId && (!providerId || userId !== providerId)) {
    return createMutationError("You do not have access to this quote workspace.", {
      forbidden: true,
    });
  }

  const actorRole = providerId && userId === providerId ? "provider" : "consumer";
  const metadata = toMetadata(order.metadata);
  const names = await getCounterpartyName(db, [consumerId, providerId || ""]);
  const listingType = pickString(order.listing_type) || pickString(metadata.listing_type) || "order";
  const taskTitle = pickString(metadata.task_title) || (listingType === "demand" ? "Demand response" : "Quote request");
  const taskDescription =
    pickString(metadata.task_description) || "Review scope, confirm the price, and send the quote when ready.";
  const locationLabel = pickString(metadata.location_label) || "Nearby";
  const counterpartyName =
    actorRole === "provider"
      ? names.get(consumerId) || "Customer"
      : providerId
        ? names.get(providerId) || "Provider"
        : "Provider";
  const normalizedStatus = normalizeOrderStatus(order.status);

  return {
    ok: true,
    order,
    helpRequest: null,
    context: {
      mode: "order",
      orderId: order.id,
      helpRequestId: pickString(order.help_request_id),
      consumerId,
      providerId,
      actorRole,
      canEdit: actorRole === "provider" && Boolean(providerId) && ["new_lead", "quoted"].includes(normalizedStatus),
      taskTitle,
      taskDescription,
      locationLabel,
      currentStatus: order.status || "new_lead",
      suggestedAmount: toFiniteNumber(order.price),
      counterpartyName,
    },
  };
};

const buildHelpRequestContext = async (
  db: SupabaseClient,
  helpRequest: HelpRequestRow,
  userId: string
): Promise<QuoteContextSuccess | QuoteMutationError> => {
  const consumerId = pickString(helpRequest.requester_id);
  const providerId = pickString(helpRequest.accepted_provider_id);

  if (!consumerId) {
    return createMutationError("This request is missing the customer record.", {
      invalid: true,
    });
  }

  if (userId !== consumerId && (!providerId || userId !== providerId)) {
    return createMutationError("You do not have access to this quote workspace.", {
      forbidden: true,
    });
  }

  const actorRole = providerId && userId === providerId ? "provider" : "consumer";
  const names = await getCounterpartyName(db, [consumerId, providerId || ""]);
  const counterpartyName =
    actorRole === "provider"
      ? names.get(consumerId) || "Customer"
      : providerId
        ? names.get(providerId) || "Provider"
        : "Provider";

  return {
    ok: true,
    order: null,
    helpRequest,
    context: {
      mode: "help_request",
      orderId: null,
      helpRequestId: helpRequest.id,
      consumerId,
      providerId,
      actorRole,
      canEdit: actorRole === "provider" && Boolean(providerId) && normalizeOrderStatus(helpRequest.status) === "accepted",
      taskTitle: trim(helpRequest.title) || "Accepted request",
      taskDescription: trim(helpRequest.details) || "Review the request details and prepare a quote.",
      locationLabel: trim(helpRequest.location_label) || "Nearby",
      currentStatus: helpRequest.status || "accepted",
      suggestedAmount: toFiniteNumber(helpRequest.budget_max) ?? toFiniteNumber(helpRequest.budget_min),
      counterpartyName,
    },
  };
};

const loadOrderContextById = async (
  db: SupabaseClient,
  orderId: string,
  userId: string
): Promise<QuoteContextSuccess | QuoteMutationError> => {
  const result = await db
    .from("orders")
    .select("id,listing_type,help_request_id,consumer_id,provider_id,price,status,metadata,created_at")
    .eq("id", orderId)
    .maybeSingle();

  if (result.error) {
    return createMutationError(result.error.message || "Unable to load order context.", {
      code: result.error.code,
      details: result.error.details || null,
      missingTable: isMissingQuoteTableError(result.error.message || ""),
    });
  }

  if (!result.data) {
    return createMutationError("Quote target order was not found.", {
      notFound: true,
    });
  }

  return buildOrderContext(db, result.data as OrderRow, userId);
};

const loadLatestOrderContextByHelpRequest = async (
  db: SupabaseClient,
  helpRequestId: string,
  userId: string
): Promise<QuoteContextSuccess | null | QuoteMutationError> => {
  const result = await db
    .from("orders")
    .select("id,listing_type,help_request_id,consumer_id,provider_id,price,status,metadata,created_at")
    .eq("help_request_id", helpRequestId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (result.error) {
    return createMutationError(result.error.message || "Unable to load linked order context.", {
      code: result.error.code,
      details: result.error.details || null,
      missingTable: isMissingQuoteTableError(result.error.message || ""),
    });
  }

  const order = ((result.data as OrderRow[] | null) || [])[0] || null;
  if (!order) return null;
  return buildOrderContext(db, order, userId);
};

const resolveQuoteContext = async (params: {
  db: SupabaseClient;
  userId: string;
  orderId?: string | null;
  helpRequestId?: string | null;
}): Promise<QuoteContextSuccess | QuoteMutationError> => {
  const orderId = trim(params.orderId);
  const helpRequestId = trim(params.helpRequestId);

  if (!orderId && !helpRequestId) {
    return createMutationError("orderId or helpRequestId is required.", {
      invalid: true,
    });
  }

  if (orderId) {
    return loadOrderContextById(params.db, orderId, params.userId);
  }

  const linkedOrder = await loadLatestOrderContextByHelpRequest(params.db, helpRequestId, params.userId);
  if (linkedOrder && linkedOrder.ok) {
    return linkedOrder;
  }
  if (linkedOrder && !linkedOrder.ok) {
    return linkedOrder;
  }

  const result = await params.db
    .from("help_requests")
    .select("id,requester_id,accepted_provider_id,title,details,category,budget_min,budget_max,location_label,status,created_at")
    .eq("id", helpRequestId)
    .maybeSingle();

  if (result.error) {
    return createMutationError(result.error.message || "Unable to load request context.", {
      code: result.error.code,
      details: result.error.details || null,
    });
  }

  if (!result.data) {
    return createMutationError("Quote target request was not found.", {
      notFound: true,
    });
  }

  return buildHelpRequestContext(params.db, result.data as HelpRequestRow, params.userId);
};

const loadQuoteLineItems = async (db: SupabaseClient, quoteId: string) => {
  const result = await db
    .from("quote_line_items")
    .select("id,quote_id,label,description,quantity,unit_price,amount,sort_order")
    .eq("quote_id", quoteId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (result.error) {
    return createMutationError(result.error.message || "Unable to load quote line items.", {
      code: result.error.code,
      details: result.error.details || null,
      missingTable: isMissingQuoteTableError(result.error.message || ""),
    });
  }

  return {
    ok: true as const,
    rows: (result.data as QuoteLineItemRow[] | null) || [],
  };
};

const loadQuoteDraftByContext = async (
  db: SupabaseClient,
  context: QuoteContextRecord
): Promise<{ ok: true; draft: QuoteDraftRecord | null } | QuoteMutationError> => {
  const query = db
    .from("quote_drafts")
    .select("id,order_id,help_request_id,provider_id,consumer_id,status,summary,notes,subtotal,tax_amount,total,expires_at,sent_at,metadata,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(1);

  const result =
    context.mode === "order"
      ? await query.eq("order_id", context.orderId)
      : await query.eq("help_request_id", context.helpRequestId);

  if (result.error) {
    return createMutationError(result.error.message || "Unable to load quote draft.", {
      code: result.error.code,
      details: result.error.details || null,
      missingTable: isMissingQuoteTableError(result.error.message || ""),
    });
  }

  const row = ((result.data as QuoteDraftRow[] | null) || [])[0] || null;
  if (!row) {
    return {
      ok: true,
      draft: null,
    };
  }

  const lineItemsResult = await loadQuoteLineItems(db, row.id);
  if (!lineItemsResult.ok) return lineItemsResult;

  return {
    ok: true,
    draft: buildQuoteDraftRecord(row, lineItemsResult.rows),
  };
};

const replaceQuoteLineItems = async (params: {
  db: SupabaseClient;
  quoteId: string;
  lineItems: QuoteLineItemRecord[];
}) => {
  const deleteResult = await params.db.from("quote_line_items").delete().eq("quote_id", params.quoteId);
  if (deleteResult.error) {
    return createMutationError(deleteResult.error.message || "Unable to replace quote line items.", {
      code: deleteResult.error.code,
      details: deleteResult.error.details || null,
      missingTable: isMissingQuoteTableError(deleteResult.error.message || ""),
    });
  }

  const payload = params.lineItems.map((lineItem) => ({
    quote_id: params.quoteId,
    label: lineItem.label,
    description: lineItem.description,
    quantity: lineItem.quantity,
    unit_price: lineItem.unitPrice,
    amount: lineItem.amount,
    sort_order: lineItem.sortOrder,
  }));

  const insertResult = await params.db.from("quote_line_items").insert(payload);
  if (insertResult.error) {
    return createMutationError(insertResult.error.message || "Unable to store quote line items.", {
      code: insertResult.error.code,
      details: insertResult.error.details || null,
      missingTable: isMissingQuoteTableError(insertResult.error.message || ""),
    });
  }

  return { ok: true as const };
};

const loadQuoteDraftById = async (
  db: SupabaseClient,
  quoteId: string
): Promise<{ ok: true; draft: QuoteDraftRecord } | QuoteMutationError> => {
  const result = await db
    .from("quote_drafts")
    .select("id,order_id,help_request_id,provider_id,consumer_id,status,summary,notes,subtotal,tax_amount,total,expires_at,sent_at,metadata,created_at,updated_at")
    .eq("id", quoteId)
    .maybeSingle();

  if (result.error || !result.data) {
    return createMutationError(result.error?.message || "Unable to load quote draft.", {
      code: result.error?.code || null,
      details: result.error?.details || null,
      missingTable: isMissingQuoteTableError(result.error?.message || ""),
    });
  }

  const lineItemsResult = await loadQuoteLineItems(db, quoteId);
  if (!lineItemsResult.ok) return lineItemsResult;

  return {
    ok: true,
    draft: buildQuoteDraftRecord(result.data as QuoteDraftRow, lineItemsResult.rows),
  };
};

const validateDraftEditAccess = (context: QuoteContextRecord) => {
  if (context.actorRole !== "provider" || !context.canEdit || !context.providerId) {
    return createMutationError("Only the assigned provider can draft and send quotes for this task.", {
      forbidden: true,
    });
  }

  return { ok: true as const };
};

const validateMutableDraftState = (draft: QuoteDraftRecord | null) => {
  if (!draft) return { ok: true as const };
  if (draft.status === "accepted") {
    return createMutationError("Accepted quotes cannot be edited.", { invalid: true });
  }
  if (draft.status === "cancelled") {
    return createMutationError("Cancelled quotes cannot be edited.", { invalid: true });
  }
  if (draft.status === "expired") {
    return createMutationError("Expired quotes cannot be edited. Create a fresh quote window first.", { invalid: true });
  }
  return { ok: true as const };
};

const prepareDraftPayload = (params: {
  context: QuoteContextRecord;
  input: QuoteDraftInput;
  status: "draft" | "sent";
  sentAt?: string | null;
  metadata?: FlexibleRecord;
}) => {
  const totals = calculateQuoteTotals({
    lineItems: Array.isArray(params.input.lineItems) ? params.input.lineItems : [],
    taxAmount: params.input.taxAmount,
  });

  if (totals.lineItems.length === 0) {
    return createMutationError("Add at least one line item before saving this quote.", {
      invalid: true,
    });
  }

  const summary = trim(params.input.summary) || buildDefaultQuoteSummary(params.context.taskTitle);
  const notes = trim(params.input.notes);
  const expiresAt = normalizeExpiresAt(params.input.expiresAt);

  if (params.status === "sent" && expiresAt && isExpired(expiresAt)) {
    return createMutationError("Choose a future expiry before sending this quote.", {
      invalid: true,
    });
  }

  return {
    ok: true as const,
    payload: {
      order_id: params.context.mode === "order" ? params.context.orderId : null,
      help_request_id: params.context.mode === "help_request" ? params.context.helpRequestId : null,
      provider_id: params.context.providerId,
      consumer_id: params.context.consumerId,
      status: params.status,
      summary,
      notes,
      subtotal: totals.subtotal,
      tax_amount: totals.taxAmount,
      total: totals.total,
      expires_at: expiresAt,
      sent_at: params.sentAt || null,
      metadata: {
        source: "quote_flow",
        conversation_id: trim(params.input.conversationId) || null,
        task_title: params.context.taskTitle,
        task_description: params.context.taskDescription,
        location_label: params.context.locationLabel,
        ...params.metadata,
      },
      lineItems: totals.lineItems,
    },
  };
};

const upsertQuoteDraft = async (params: {
  db: SupabaseClient;
  existingDraft: QuoteDraftRecord | null;
  context: QuoteContextRecord;
  input: QuoteDraftInput;
  status: "draft" | "sent";
  sentAt?: string | null;
  metadata?: FlexibleRecord;
}): Promise<{ ok: true; draft: QuoteDraftRecord } | QuoteMutationError> => {
  const prepared = prepareDraftPayload({
    context: params.context,
    input: params.input,
    status: params.status,
    sentAt: params.sentAt,
    metadata: params.metadata,
  });

  if (!prepared.ok) return prepared;

  const quotePayload = {
    order_id: prepared.payload.order_id,
    help_request_id: prepared.payload.help_request_id,
    provider_id: prepared.payload.provider_id,
    consumer_id: prepared.payload.consumer_id,
    status: prepared.payload.status,
    summary: prepared.payload.summary,
    notes: prepared.payload.notes,
    subtotal: prepared.payload.subtotal,
    tax_amount: prepared.payload.tax_amount,
    total: prepared.payload.total,
    expires_at: prepared.payload.expires_at,
    sent_at: prepared.payload.sent_at,
    metadata: prepared.payload.metadata,
  };

  const quoteResult = params.existingDraft?.id
    ? await params.db.from("quote_drafts").update(quotePayload).eq("id", params.existingDraft.id).select("id").single()
    : await params.db.from("quote_drafts").insert(quotePayload).select("id").single();

  if (quoteResult.error || !quoteResult.data?.id) {
    return createMutationError(quoteResult.error?.message || "Unable to save quote draft.", {
      code: quoteResult.error?.code || null,
      details: quoteResult.error?.details || null,
      missingTable: isMissingQuoteTableError(quoteResult.error?.message || ""),
    });
  }

  const lineItemsResult = await replaceQuoteLineItems({
    db: params.db,
    quoteId: quoteResult.data.id as string,
    lineItems: prepared.payload.lineItems,
  });
  if (!lineItemsResult.ok) return lineItemsResult;

  const draftResult = await loadQuoteDraftById(params.db, quoteResult.data.id as string);

  if (draftResult.ok) {
    (async () => {
      try {
        await createQuoteVersionSnapshot({
          db: params.db,
          quoteId: draftResult.draft.id,
          status: draftResult.draft.status,
        });
      } catch (error) {
        console.warn("Failed to create quote version snapshot:", error instanceof Error ? error.message : error);
      }
    })();
  }

  return draftResult;
};

const createOrderMetadataFromContext = (params: {
  context: QuoteContextRecord;
  helpRequest: HelpRequestRow;
  draft: QuoteDraftRecord;
}) => ({
  source: "quote_flow",
  listing_type: "demand",
  task_title: params.context.taskTitle,
  task_description: params.context.taskDescription,
  location_label: params.context.locationLabel,
  request_category: trim(params.helpRequest.category) || "Demand",
  quote_draft_id: params.draft.id,
  quote_summary: params.draft.summary,
  quote_expires_at: params.draft.expiresAt,
  line_item_count: params.draft.lineItems.length,
});

const insertQuoteMessage = async (params: {
  userDb: SupabaseClient | null;
  userId: string;
  conversationId: string | null;
  draft: QuoteDraftRecord;
  orderId: string;
  taskTitle: string;
}) => {
  const conversationId = trim(params.conversationId);
  if (!params.userDb || !conversationId) return null;

  const message = [
    `Quote sent for ${trim(params.taskTitle) || "your request"}.`,
    `Summary: ${params.draft.summary}`,
    `Total: ${formatCurrency(params.draft.total)}`,
    params.draft.expiresAt ? `Valid until ${formatExpiryDate(params.draft.expiresAt)}` : null,
    "Please review it in ServiQ and confirm the next step.",
  ]
    .filter(Boolean)
    .join("\n");

  const insertResult = await params.userDb.from("messages").insert({
    conversation_id: conversationId,
    sender_id: params.userId,
    content: message,
    metadata: {
      source: "quote_flow",
      quote_id: params.draft.id,
      order_id: params.orderId,
      total: params.draft.total,
    },
  });

  if (insertResult.error) {
    console.warn("Quote message could not be persisted:", insertResult.error.message);
  }

  return conversationId;
};

const ensureConversationAccess = async (params: {
  db: SupabaseClient;
  userId: string;
  conversationId: string | null;
}) => {
  const conversationId = trim(params.conversationId);
  if (!conversationId) return { ok: true as const };

  try {
    await getConversationContext(params.db, conversationId, params.userId);
    return { ok: true as const };
  } catch (error) {
    return createMutationError(error instanceof Error ? error.message : "Conversation access is invalid.", {
      forbidden: true,
    });
  }
};

export const loadQuoteDraft = async (params: {
  db: SupabaseClient;
  userId: string;
  orderId?: string | null;
  helpRequestId?: string | null;
}): Promise<QuoteLoadSuccess | QuoteMutationError> => {
  const contextResult = await resolveQuoteContext(params);
  if (!contextResult.ok) return contextResult;

  const draftResult = await loadQuoteDraftByContext(params.db, contextResult.context);
  if (!draftResult.ok) return draftResult;

  return {
    ok: true,
    context: contextResult.context,
    draft: draftResult.draft,
  };
};

export const saveQuoteDraft = async (params: {
  db: SupabaseClient;
  userId: string;
  input: QuoteDraftInput;
}): Promise<QuoteSaveSuccess | QuoteMutationError> => {
  const contextResult = await resolveQuoteContext({
    db: params.db,
    userId: params.userId,
    orderId: params.input.orderId,
    helpRequestId: params.input.helpRequestId,
  });
  if (!contextResult.ok) return contextResult;

  const accessResult = validateDraftEditAccess(contextResult.context);
  if (!accessResult.ok) return accessResult;

  const existingDraftResult = await loadQuoteDraftByContext(params.db, contextResult.context);
  if (!existingDraftResult.ok) return existingDraftResult;
  const draftStateResult = validateMutableDraftState(existingDraftResult.draft);
  if (!draftStateResult.ok) return draftStateResult;

  const draftResult = await upsertQuoteDraft({
    db: params.db,
    existingDraft: existingDraftResult.draft,
    context: contextResult.context,
    input: params.input,
    status: "draft",
  });

  if (!draftResult.ok) return draftResult;

  return {
    ok: true,
    context: contextResult.context,
    draft: draftResult.draft,
  };
};

export const sendQuoteDraft = async (params: {
  db: SupabaseClient;
  userDb: SupabaseClient | null;
  userId: string;
  input: QuoteDraftInput;
}): Promise<QuoteSendSuccess | QuoteMutationError> => {
  const contextResult = await resolveQuoteContext({
    db: params.db,
    userId: params.userId,
    orderId: params.input.orderId,
    helpRequestId: params.input.helpRequestId,
  });
  if (!contextResult.ok) return contextResult;

  const accessResult = validateDraftEditAccess(contextResult.context);
  if (!accessResult.ok) return accessResult;

  const conversationAccess = await ensureConversationAccess({
    db: params.db,
    userId: params.userId,
    conversationId: params.input.conversationId || null,
  });
  if (!conversationAccess.ok) return conversationAccess;

  const existingDraftResult = await loadQuoteDraftByContext(params.db, contextResult.context);
  if (!existingDraftResult.ok) return existingDraftResult;
  const draftStateResult = validateMutableDraftState(existingDraftResult.draft);
  if (!draftStateResult.ok) return draftStateResult;

  const draftResult = await upsertQuoteDraft({
    db: params.db,
    existingDraft: existingDraftResult.draft,
    context: contextResult.context,
    input: params.input,
    status: "sent",
    sentAt: new Date().toISOString(),
  });
  if (!draftResult.ok) return draftResult;

  let orderId = contextResult.context.orderId || "";
  const orderStatus = "quoted";

  if (contextResult.context.mode === "order" && contextResult.order) {
    const metadata = {
      ...toMetadata(contextResult.order.metadata),
      source: "quote_flow",
      quote_draft_id: draftResult.draft.id,
      quote_summary: draftResult.draft.summary,
      quote_expires_at: draftResult.draft.expiresAt,
      task_title: contextResult.context.taskTitle,
      task_description: contextResult.context.taskDescription,
      location_label: contextResult.context.locationLabel,
      line_item_count: draftResult.draft.lineItems.length,
    };

    const updateResult = await params.db
      .from("orders")
      .update({
        status: orderStatus,
        price: draftResult.draft.total,
        metadata,
      })
      .eq("id", contextResult.order.id);

    if (updateResult.error) {
      return createMutationError(updateResult.error.message || "Unable to sync order status.", {
        code: updateResult.error.code,
        details: updateResult.error.details || null,
      });
    }

    orderId = contextResult.order.id;
  } else {
    if (!contextResult.helpRequest) {
      return createMutationError("This quote is missing its linked request.", {
        invalid: true,
      });
    }

    if (!params.db) {
      return createMutationError("Quote flow needs Supabase server access to create orders from requests.", {
        config: true,
      });
    }

    const insertResult = await params.db
      .from("orders")
      .insert({
        listing_type: "demand",
        help_request_id: contextResult.helpRequest.id,
        consumer_id: contextResult.context.consumerId,
        provider_id: contextResult.context.providerId,
        price: draftResult.draft.total,
        status: orderStatus,
        metadata: createOrderMetadataFromContext({
          context: contextResult.context,
          helpRequest: contextResult.helpRequest,
          draft: draftResult.draft,
        }),
      })
      .select("id")
      .single();

    if (insertResult.error || !insertResult.data?.id) {
      return createMutationError(insertResult.error?.message || "Unable to create an order for this quote.", {
        code: insertResult.error?.code || null,
        details: insertResult.error?.details || null,
      });
    }

    orderId = insertResult.data.id as string;

    const rebindResult = await params.db
      .from("quote_drafts")
      .update({
        order_id: orderId,
        help_request_id: null,
        metadata: {
          ...draftResult.draft.metadata,
          source_help_request_id: contextResult.helpRequest.id,
        },
      })
      .eq("id", draftResult.draft.id);

    if (rebindResult.error) {
      return createMutationError(rebindResult.error.message || "Unable to attach the quote to its order.", {
        code: rebindResult.error.code,
        details: rebindResult.error.details || null,
      });
    }
  }

  const refreshedDraftResult = await loadQuoteDraftById(params.db, draftResult.draft.id);
  if (!refreshedDraftResult.ok) return refreshedDraftResult;

  const conversationId = await insertQuoteMessage({
    userDb: params.userDb,
    userId: params.userId,
    conversationId: params.input.conversationId || null,
    draft: refreshedDraftResult.draft,
    orderId,
    taskTitle: contextResult.context.taskTitle,
  });

  // Notify the seeker that a quote has arrived
  const consumerId = contextResult.context.consumerId;
  if (consumerId && consumerId !== params.userId) {
    const taskTitle = contextResult.context.taskTitle || "your request";
    const totalFormatted =
      refreshedDraftResult.draft.total > 0
        ? ` · INR ${refreshedDraftResult.draft.total.toLocaleString("en-IN")}`
        : "";
    const message = `A provider sent you a quote for ${taskTitle}${totalFormatted}. Open Tasks to review and accept.`;
    try {
      await params.db.from("notifications").insert({
        user_id: consumerId,
        kind: "order",
        title: "Quote received",
        message,
        entity_type: "quote",
        entity_id: orderId,
        metadata: {
          order_id: orderId,
          quote_draft_id: refreshedDraftResult.draft.id,
          task_title: taskTitle,
          total: refreshedDraftResult.draft.total,
          source: "quote_flow",
        },
      });
      await sendPushToUser(params.db, consumerId, {
        title: "Quote received",
        body: message,
        data: {
          kind: "order",
          entity_type: "quote",
          entity_id: refreshedDraftResult.draft.id,
          order_id: orderId,
          quote_draft_id: refreshedDraftResult.draft.id,
          task_title: taskTitle,
          total: refreshedDraftResult.draft.total,
          source: "quote_flow",
        },
      });
    } catch (error) {
      console.warn("Quote notification could not be delivered:", error instanceof Error ? error.message : error);
    }
  }

  return {
    ok: true,
    context:
      contextResult.context.mode === "order"
        ? contextResult.context
        : {
            ...contextResult.context,
            mode: "order",
            orderId,
            helpRequestId: contextResult.helpRequest?.id || contextResult.context.helpRequestId,
            currentStatus: orderStatus,
          },
    draft: refreshedDraftResult.draft,
    orderId,
    orderStatus,
    conversationId,
  };
};

type QuoteAcceptSuccess = {
  ok: true;
  quoteId: string;
  orderId: string;
  orderStatus: string;
};

export const acceptQuoteDraft = async (params: {
  db: SupabaseClient;
  userId: string;
  quoteId: string;
}): Promise<QuoteAcceptSuccess | QuoteMutationError> => {
  // Load the draft
  const draftResult = await loadQuoteDraftById(params.db, params.quoteId);
  if (!draftResult.ok) return draftResult;

  const draft = draftResult.draft;

  // Only the consumer can accept
  if (!draft.consumerId || draft.consumerId !== params.userId) {
    return createMutationError("Only the customer on this quote can accept it.", { forbidden: true });
  }

  // Must be in sent status
  if (draft.status !== "sent") {
    return createMutationError(
      draft.status === "accepted"
        ? "This quote has already been accepted."
        : draft.status === "expired"
          ? "This quote has expired. Ask the provider to send an updated quote."
          : "This quote cannot be accepted in its current state.",
      { invalid: true }
    );
  }

  // Update quote status to accepted
  const quoteUpdateResult = await params.db
    .from("quote_drafts")
    .update({ status: "accepted" })
    .eq("id", params.quoteId);

  if (quoteUpdateResult.error) {
    return createMutationError(quoteUpdateResult.error.message || "Unable to accept quote.", {
      code: quoteUpdateResult.error.code,
      details: quoteUpdateResult.error.details || null,
    });
  }

  // Sync the linked order to "accepted", or create one if the quote has no order
  let orderId = draft.orderId || "";
  if (orderId) {
    const orderMetadataResult = await params.db.from("orders").select("metadata").eq("id", orderId).maybeSingle();
    const orderMetadata = toMetadata((orderMetadataResult.data as { metadata?: FlexibleRecord | null } | null)?.metadata);
    await params.db
      .from("orders")
      .update({
        status: "accepted",
        metadata: {
          ...orderMetadata,
          quote_draft_id: params.quoteId,
          quote_accepted_at: new Date().toISOString(),
          fulfillment_status: "confirmed",
          fulfillment_status_label: "Confirmed by accepted quote",
        },
      })
      .eq("id", orderId);
  } else if (draft.consumerId && draft.providerId) {
    const title =
      trim((draft.metadata as FlexibleRecord)?.task_title as string) ||
      draft.summary ||
      "Service order";
    const orderMetadata: FlexibleRecord = {
      ...(draft.metadata as FlexibleRecord),
      title,
      quote_draft_id: params.quoteId,
      quote_accepted_at: new Date().toISOString(),
      fulfillment_status: "pending",
      fulfillment_status_label: "Awaiting fulfillment setup",
      payment_status: "pending",
    };
    const { data: newOrder } = await params.db
      .from("orders")
      .insert({
        consumer_id: draft.consumerId,
        provider_id: draft.providerId,
        price: draft.total,
        status: "accepted",
        listing_type: "service",
        metadata: orderMetadata,
      })
      .select("id")
      .single();
    if (newOrder) {
      orderId = newOrder.id;
      await params.db
        .from("quote_drafts")
        .update({ order_id: orderId })
        .eq("id", params.quoteId);
    }
  }

  // Notify the provider
  const providerId = draft.providerId;
  if (providerId && providerId !== params.userId) {
    const taskTitle = trim((draft.metadata as Record<string, unknown>)?.task_title as string) || "your quote";
    const totalFormatted =
      draft.total > 0 ? ` · INR ${draft.total.toLocaleString("en-IN")}` : "";
    const message = `The customer accepted your quote for ${taskTitle}${totalFormatted}. Head to Tasks to start the job.`;
    try {
      await params.db.from("notifications").insert({
        user_id: providerId,
        kind: "order",
        title: "Quote accepted",
        message,
        entity_type: "quote",
        entity_id: orderId || null,
        metadata: {
          order_id: orderId || null,
          quote_draft_id: params.quoteId,
          task_title: taskTitle,
          total: draft.total,
          source: "quote_flow",
        },
      });
      await sendPushToUser(params.db, providerId, {
        title: "Quote accepted",
        body: message,
        data: {
          kind: "order",
          entity_type: "quote",
          entity_id: params.quoteId,
          order_id: orderId || "",
          quote_draft_id: params.quoteId,
          task_title: taskTitle,
          total: draft.total,
          source: "quote_flow",
        },
      });
    } catch (error) {
      console.warn("Quote accepted notification could not be delivered:", error instanceof Error ? error.message : error);
    }
  }

  try {
    await createQuoteVersionSnapshot({
      db: params.db,
      quoteId: params.quoteId,
      status: "accepted",
      acceptedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn("Failed to create quote version on accept:", error instanceof Error ? error.message : error);
  }

  return {
    ok: true,
    quoteId: params.quoteId,
    orderId,
    orderStatus: "accepted",
  };
};
