import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DealRoomScope,
  DealRoomTimelineItem,
  GetDealRoomResponse,
  ProviderCatalogItem,
  QuoteApiErrorCode,
  QuoteAttachmentRecord,
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
      counterpartyAvatarUrl: counterpartyName?.data?.avatar_url ? String(counterpartyName.data.avatar_url) : null,
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
      const isProvider = acceptedProviderId && acceptedProviderId === authResult.auth.userId;

      if (!isConsumer && !isProvider) {
        return toErrorResponse(403, "FORBIDDEN", "You do not have access to this deal room.");
      }

      const actorRole: "provider" | "consumer" = isProvider ? "provider" : "consumer";
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

      const counterpartyId: string | null = actorRole === "provider" ? requesterId : acceptedProviderId;
      const counterparty = counterpartyId
        ? await db.from("profiles").select("id,name,avatar_url").eq("id", counterpartyId).maybeSingle()
        : null;

      dealRoomContext = {
        orderId: linkedOrder?.id ? String(linkedOrder.id) : null,
        helpRequestId,
        consumerId: requesterId,
        providerId: acceptedProviderId,
        currentUserId: authResult.auth.userId,
        actorRole,
        scope,
        status,
        counterpartyName: counterparty?.data?.name || "User",
        counterpartyAvatarUrl: counterparty?.data?.avatar_url ? String(counterparty.data.avatar_url) : null,
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
