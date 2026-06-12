import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveProfileAvatarUrl } from "@/lib/mediaUrl";
import type {
  DealRoomScope,
  DealRoomTimelineItem,
  GetDealRoomResponse,
  ProviderCatalogItem,
  QuoteApiErrorCode,
  QuoteAttachmentRecord,
  QuoteAttachmentType,
  QuoteVersionRecord,
} from "@/lib/api/quotes";
import { loadQuoteDraft } from "@/lib/server/quoteWrites";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

const toErrorResponse = (status: number, code: QuoteApiErrorCode, message: string, details?: string) =>
  NextResponse.json({ ok: false, code, message, details }, { status });

const toFiniteNumber = (value: unknown) => {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

const loadOrderContext = async (
  db: SupabaseClient,
  orderId: string,
  userId: string
) => {
  const orderResult = await db
    .from("orders")
    .select("id,help_request_id,consumer_id,provider_id,status,price,metadata,created_at")
    .eq("id", orderId)
    .maybeSingle();

  if (orderResult.error || !orderResult.data) {
    return { ok: false as const, message: orderResult.error?.message || "Order not found." };
  }

  const order = orderResult.data as Record<string, unknown>;
  const consumerId = String(order.consumer_id ?? "");
  const providerId = order.provider_id ? String(order.provider_id) : null;
  const metadata = order.metadata && typeof order.metadata === "object" && !Array.isArray(order.metadata)
    ? (order.metadata as Record<string, unknown>)
    : {};

  const isConsumer = consumerId && consumerId === userId;
  const isProvider = providerId && providerId === userId;

  if (!isConsumer && !isProvider) {
    return { ok: false as const, message: "You do not have access to this deal room.", forbidden: true };
  }

  const actorRole: "provider" | "consumer" = isProvider ? "provider" : "consumer";
  const currentStatus = String(order.status ?? "new_lead");
  const normalizedStatus = ["new_lead", "quoted", "accepted", "in_progress", "completed", "cancelled"].includes(currentStatus.toLowerCase())
    ? currentStatus.toLowerCase()
    : "new_lead";

  const scope: DealRoomScope = {
    taskTitle: String(metadata.task_title as string ?? ""),
    taskDescription: String(metadata.task_description as string ?? ""),
    locationLabel: String(metadata.location_label as string ?? ""),
    category: metadata.category ? String(metadata.category) : null,
    budgetMin: toFiniteNumber(metadata.budget_min),
    budgetMax: toFiniteNumber(metadata.budget_max),
  };

  const counterpartyId: string | null = actorRole === "provider" ? consumerId : providerId;
  const counterpartyName = counterpartyId
    ? await db.from("profiles").select("id,name,avatar_url").eq("id", counterpartyId).maybeSingle()
    : null;

  return {
    ok: true as const,
    context: {
      orderId,
      helpRequestId: order.help_request_id ? String(order.help_request_id) : null,
      consumerId,
      providerId,
      currentUserId: userId,
      actorRole,
      scope,
      status: normalizedStatus,
      counterpartyName: counterpartyName?.data?.name || "User",
      counterpartyAvatarUrl: counterpartyName?.data?.avatar_url ? resolveProfileAvatarUrl(String(counterpartyName.data.avatar_url)) : null,
      canEditQuote: actorRole === "provider" && ["new_lead", "quoted"].includes(normalizedStatus),
      canAcceptQuote: actorRole === "consumer" && normalizedStatus === "quoted",
      canAddAttachment: true,
    },
    order,
  };
};

export async function GET(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) return toErrorResponse(authResult.status, "UNAUTHORIZED", authResult.message);

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId")?.trim() || undefined;
  const helpRequestId = searchParams.get("helpRequestId")?.trim() || undefined;

  if (!orderId && !helpRequestId) {
    return toErrorResponse(400, "INVALID_PAYLOAD", "orderId or helpRequestId is required.");
  }

  const admin = createSupabaseAdminClient();
  const userClient = createSupabaseUserServerClient(authResult.auth.accessToken);
  const db = admin || userClient;
  if (!db) {
    return toErrorResponse(500, "CONFIG", "Supabase server credentials are missing.");
  }

  try {
    let dealRoomContext;
    let quoteDraftResult = null;

    if (orderId) {
      const contextResult = await loadOrderContext(db, orderId, authResult.auth.userId);
      if (contextResult.ok) {
        dealRoomContext = contextResult.context;
      } else {
        return contextResult.forbidden
          ? toErrorResponse(403, "FORBIDDEN", contextResult.message)
          : toErrorResponse(404, "NOT_FOUND", contextResult.message);
      }

      quoteDraftResult = await loadQuoteDraft({
        db,
        userId: authResult.auth.userId,
        orderId,
      });
    } else if (helpRequestId) {
      const hrResult = await db
        .from("help_requests")
        .select("id,requester_id,accepted_provider_id,title,details,category,budget_min,budget_max,location_label,status")
        .eq("id", helpRequestId)
        .maybeSingle();

      if (hrResult.error || !hrResult.data) {
        return toErrorResponse(404, "NOT_FOUND", "Help request not found.");
      }

      const hr = hrResult.data as Record<string, unknown>;
      const requesterId = String(hr.requester_id ?? "");
      const acceptedProviderId = hr.accepted_provider_id ? String(hr.accepted_provider_id) : null;

      const isConsumer = requesterId === authResult.auth.userId;
      const isAcceptedProvider = acceptedProviderId && acceptedProviderId === authResult.auth.userId;

      let isMatchedProvider = false;
      if (!isConsumer && !isAcceptedProvider) {
        const { data: match } = await db
          .from("help_request_matches")
          .select("status")
          .eq("help_request_id", helpRequestId)
          .eq("provider_id", authResult.auth.userId)
          .in("status", ["interested", "accepted"])
          .maybeSingle();
        isMatchedProvider = match !== null;
      }

      if (!isConsumer && !isAcceptedProvider && !isMatchedProvider) {
        return toErrorResponse(403, "FORBIDDEN", "You do not have access to this deal room.");
      }

      const actorRole: "provider" | "consumer" = (isAcceptedProvider || isMatchedProvider) ? "provider" : "consumer";
      const providerId = actorRole === "provider" ? authResult.auth.userId : acceptedProviderId;
      const status = String(hr.status ?? "open");

      const linkedOrderResult = await db
        .from("orders")
        .select("id")
        .eq("help_request_id", helpRequestId)
        .order("created_at", { ascending: false })
        .limit(1);

      const linkedOrder = ((linkedOrderResult.data as Record<string, unknown>[] | null) ?? [])[0];

      const scope: DealRoomScope = {
        taskTitle: String(hr.title ?? "Request"),
        taskDescription: String(hr.details ?? ""),
        locationLabel: String(hr.location_label ?? ""),
        category: hr.category ? String(hr.category) : null,
        budgetMin: toFiniteNumber(hr.budget_min),
        budgetMax: toFiniteNumber(hr.budget_max),
      };

      const counterpartyId: string | null = actorRole === "provider" ? requesterId : providerId;
      const counterparty = counterpartyId
        ? await db.from("profiles").select("id,name,avatar_url").eq("id", counterpartyId).maybeSingle()
        : null;

      dealRoomContext = {
        orderId: linkedOrder?.id ? String(linkedOrder.id) : null,
        helpRequestId,
        consumerId: requesterId,
        providerId,
        currentUserId: authResult.auth.userId,
        actorRole,
        scope,
        status,
        counterpartyName: counterparty?.data?.name || "User",
        counterpartyAvatarUrl: counterparty?.data?.avatar_url ? resolveProfileAvatarUrl(String(counterparty.data.avatar_url)) : null,
        canEditQuote: actorRole === "provider",
        canAcceptQuote: false,
        canAddAttachment: true,
      };

      if (linkedOrder?.id) {
        quoteDraftResult = await loadQuoteDraft({
          db,
          userId: authResult.auth.userId,
          orderId: String(linkedOrder.id),
        });
      } else if (actorRole === "provider") {
        quoteDraftResult = await loadQuoteDraft({
          db,
          userId: authResult.auth.userId,
          helpRequestId,
        });
      }
    }

    if (!dealRoomContext) {
      return toErrorResponse(404, "NOT_FOUND", "Could not load deal room context.");
    }

     const providerId = dealRoomContext.providerId;
     let catalogItems: ProviderCatalogItem[] = [];

     if (providerId && dealRoomContext.actorRole === "provider") {
       const servicesResult = await db
         .from("service_listings")
         .select("id,title,description,category,price,metadata")
         .eq("provider_id", providerId)
         .limit(20);

       if (servicesResult.error) {
         console.warn("Failed to load service listings:", servicesResult.error.message);
       } else {
         catalogItems = ((servicesResult.data as Record<string, unknown>[] | null) ?? []).map((row) => ({
           id: String(row.id),
           title: String(row.title ?? ""),
           description: String(row.description ?? ""),
           category: String(row.category ?? "Service"),
           price: toFiniteNumber(row.price),
           source: row.metadata && typeof row.metadata === "object" ? String((row.metadata as Record<string, unknown>).source ?? null) : null,
         }));
       }
     }

     const versions: QuoteVersionRecord[] = [];
     const attachments: QuoteAttachmentRecord[] = [];
     const timeline: DealRoomTimelineItem[] = [];

     if (quoteDraftResult?.ok && quoteDraftResult.draft) {
       const quoteId = quoteDraftResult.draft.id;

       const [versionsResult, versionItemsResult, attachmentsResult] = await Promise.all([
         db
           .from("quote_versions")
           .select("id,quote_id,version_number,status,summary,notes,subtotal,tax_amount,total,expires_at,sent_at,accepted_at,rejected_at,rejected_reason,metadata,created_at,updated_at")
           .eq("quote_id", quoteId)
           .order("version_number", { ascending: false }),
         db
           .from("quote_version_line_items")
           .select("id,quote_version_id,quote_id,label,description,quantity,unit_price,amount,sort_order,metadata")
           .eq("quote_id", quoteId)
           .order("sort_order", { ascending: true }),
         db
           .from("quote_attachments")
           .select("id,quote_id,order_id,help_request_id,uploaded_by,kind,file_name,file_path,file_url,file_size_bytes,mime_type,title,description,metadata,created_at,updated_at")
           .eq("quote_id", quoteId)
           .order("created_at", { ascending: false }),
       ]);

       if (!versionsResult.error && versionsResult.data) {
         const versionRows = versionsResult.data as Record<string, unknown>[];
         const itemRows = (versionItemsResult.data as Record<string, unknown>[] | null) ?? [];

         for (const row of versionRows) {
           const versionId = String(row.id);
           const itemsForVersion = itemRows.filter((item) => item.quote_version_id === versionId);

           versions.push({
             id: versionId,
             quoteId: String(row.quote_id),
             versionNumber: Math.max(1, toFiniteNumber(row.version_number) || 1),
             status: (String(row.status ?? "draft") as QuoteVersionRecord["status"]) || "draft",
             summary: row.summary ? String(row.summary) : null,
             notes: row.notes ? String(row.notes) : null,
             subtotal: Math.max(0, toFiniteNumber(row.subtotal) || 0),
             taxAmount: Math.max(0, toFiniteNumber(row.tax_amount) || 0),
             total: Math.max(0, toFiniteNumber(row.total) || 0),
             expiresAt: row.expires_at ? String(row.expires_at) : null,
             sentAt: row.sent_at ? String(row.sent_at) : null,
             acceptedAt: row.accepted_at ? String(row.accepted_at) : null,
             rejectedAt: row.rejected_at ? String(row.rejected_at) : null,
             rejectedReason: row.rejected_reason ? String(row.rejected_reason) : null,
             createdAt: row.created_at ? String(row.created_at) : null,
             updatedAt: row.updated_at ? String(row.updated_at) : null,
             metadata: row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {},
             lineItems: itemsForVersion.map((item) => ({
               id: String(item.id),
               quoteVersionId: String(item.quote_version_id),
               quoteId: String(item.quote_id),
               label: String(item.label ?? ""),
               description: item.description ? String(item.description) : null,
               quantity: Math.max(1, toFiniteNumber(item.quantity) || 1),
               unitPrice: Math.max(0, toFiniteNumber(item.unit_price) || 0),
               amount: Math.max(0, toFiniteNumber(item.amount) || 0),
               sortOrder: Number.isFinite(Number(item.sort_order)) ? Number(item.sort_order) : 0,
               metadata: item.metadata && typeof item.metadata === "object" ? (item.metadata as Record<string, unknown>) : {},
             })),
           });
         }
       }

       if (!attachmentsResult.error && attachmentsResult.data) {
         for (const row of attachmentsResult.data as Record<string, unknown>[]) {
           attachments.push({
             id: String(row.id),
             quoteId: String(row.quote_id),
             orderId: row.order_id ? String(row.order_id) : null,
             helpRequestId: row.help_request_id ? String(row.help_request_id) : null,
             uploadedBy: String(row.uploaded_by),
             kind: (String(row.kind ?? "attachment") as QuoteAttachmentType) || "attachment",
             fileName: String(row.file_name ?? ""),
             filePath: String(row.file_path ?? ""),
             fileUrl: String(row.file_url ?? ""),
             fileSizeBytes: row.file_size_bytes != null ? Number(row.file_size_bytes) : null,
             mimeType: row.mime_type ? String(row.mime_type) : null,
             title: row.title ? String(row.title) : null,
             description: row.description ? String(row.description) : null,
             metadata: row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {},
             createdAt: row.created_at ? String(row.created_at) : null,
             updatedAt: row.updated_at ? String(row.updated_at) : null,
           });
         }
       }

       const timelineEvents: DealRoomTimelineItem[] = [];

       for (const v of versions) {
         if (v.sentAt) {
           timelineEvents.push({
             id: `v${v.versionNumber}-sent`,
             kind: "quote_sent",
             actorId: dealRoomContext.providerId,
             actorName: dealRoomContext.actorRole === "consumer" ? dealRoomContext.counterpartyName : "You",
             title: `Quote v${v.versionNumber} sent`,
             description: v.summary || `Quote for INR ${v.total.toLocaleString("en-IN")}`,
             timestamp: v.sentAt,
             metadata: { versionNumber: v.versionNumber, quoteId: v.quoteId },
           });
         }
         if (v.acceptedAt) {
           timelineEvents.push({
             id: `v${v.versionNumber}-accepted`,
             kind: "quote_accepted",
             actorId: dealRoomContext.consumerId,
             actorName: dealRoomContext.actorRole === "provider" ? dealRoomContext.counterpartyName : "You",
             title: `Quote v${v.versionNumber} accepted`,
             description: `Quote accepted for INR ${v.total.toLocaleString("en-IN")}`,
             timestamp: v.acceptedAt,
             metadata: { versionNumber: v.versionNumber, quoteId: v.quoteId },
           });
         }
         if (v.rejectedAt) {
           timelineEvents.push({
             id: `v${v.versionNumber}-rejected`,
             kind: "status_change",
             actorId: dealRoomContext.consumerId,
             actorName: dealRoomContext.actorRole === "provider" ? dealRoomContext.counterpartyName : "You",
             title: `Quote v${v.versionNumber} rejected`,
             description: v.rejectedReason || "Quote was rejected",
             timestamp: v.rejectedAt,
             metadata: { versionNumber: v.versionNumber, quoteId: v.quoteId, reason: v.rejectedReason },
           });
         }
       }

       for (const a of attachments) {
         const isUploaderMe = a.uploadedBy === dealRoomContext.currentUserId;
         timelineEvents.push({
           id: `att-${a.id}`,
           kind: "attachment",
           actorId: a.uploadedBy,
           actorName: isUploaderMe ? "You" : dealRoomContext.counterpartyName,
           title: `Attachment: ${a.fileName}`,
           description: a.description || (a.title ? a.title : null),
           timestamp: a.createdAt || new Date().toISOString(),
           metadata: { attachmentId: a.id, quoteId: a.quoteId, fileUrl: a.fileUrl, mimeType: a.mimeType },
         });
       }

       timelineEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
       timeline.push(...timelineEvents);
     }

    const result: Extract<GetDealRoomResponse, { ok: true }> = {
      ok: true,
      context: dealRoomContext,
      draft: quoteDraftResult?.ok ? quoteDraftResult.draft : null,
      versions,
      attachments,
      timeline,
      catalogItems,
    };

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Deal room load error:", error);
    return toErrorResponse(500, "UNKNOWN", error instanceof Error ? error.message : "Failed to load deal room.");
  }
}
