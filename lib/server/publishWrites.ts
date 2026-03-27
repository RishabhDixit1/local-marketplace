import type { SupabaseClient } from "@supabase/supabase-js";
import type { PublishPayloadBase, UploadedMediaPayload } from "@/lib/api/publish";
import { buildMarketplaceComposerMetadata } from "@/lib/marketplaceMetadata";

type WriteResult = {
  id?: string;
  errorMessage?: string;
  errorCode?: string | null;
  details?: string | null;
  missingTable?: boolean;
};

type ListingWriteResult = {
  id?: string;
  errorMessage?: string;
  errorCode?: string | null;
  details?: string | null;
  missingTable?: boolean;
};

const isMissingTableError = (message: string, table: string): boolean => {
  const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`relation .*${escaped}.* does not exist|could not find the table '.*${escaped}.*' in the schema cache`, "i").test(
    message
  );
};

const getMissingColumn = (message: string, table: string): string | null => {
  const dynamic = new RegExp(`could not find the '([^']+)' column of '${table}'`, "i");
  const match = message.match(dynamic);
  return match?.[1] || null;
};

const getRequiredNullColumn = (message: string): string | null => {
  const match = message.match(/null value in column \"([^\"]+)\"/i);
  return match?.[1] || null;
};

const getForeignKeyColumn = (message: string, details?: string | null): string | null => {
  const detailMatch = details?.match(/Key \(([^)]+)\)=\([^)]+\) is not present in table/i);
  if (detailMatch?.[1]) return detailMatch[1];

  const constraintName = message.match(/constraint\s+\"([^\"]+_fkey)\"/i)?.[1]?.toLowerCase() || "";
  if (!constraintName) return null;

  const knownForeignKeyColumns = ["author_id", "created_by", "provider_id", "requester_id", "owner_id", "user_id"];
  for (const columnName of knownForeignKeyColumns) {
    if (constraintName.includes(`_${columnName}_fkey`)) return columnName;
  }

  const genericMatch = constraintName.match(/^[a-z0-9]+_(.+)_fkey$/i);
  return genericMatch?.[1] || null;
};

const isMissingColumnError = (message: string) =>
  /column .* does not exist|could not find the '.*' column/i.test(message);

const toPostMediaLine = (media: UploadedMediaPayload[]): string => {
  if (!media.length) return "Media: None";
  return `Media: ${media.map((item) => `[${item.type}] ${item.url}`).join(", ")}`;
};

export const composeMarketplacePostText = (
  payload: PublishPayloadBase,
  postType: "need" | "service" | "product"
): string => {
  const budgetText = Number.isFinite(Number(payload.budget)) && Number(payload.budget) > 0
    ? `Budget: Rs ${Number(payload.budget)}`
    : "Budget: Not specified";

  return [
    payload.title,
    payload.details || "No additional details",
    `Type: ${postType}`,
    `Mode: ${payload.mode}`,
    `Needed: ${
      payload.mode === "urgent"
        ? payload.neededWithin
        : payload.scheduleDate
          ? `${payload.scheduleDate} ${payload.scheduleTime || "00:00"}`
          : "flexible"
    }`,
    budgetText,
    `Category: ${payload.category}`,
    `Location: ${payload.locationLabel}`,
    payload.flexibleTiming ? "Timing: Flexible" : "Timing: Fixed",
    toPostMediaLine(payload.media),
  ].join(" | ");
};

const ensureProfileReference = async (admin: SupabaseClient, userId: string, email: string): Promise<boolean> => {
  const { data: existing } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (existing?.id) return true;

  const fallbackName = (email || "local-user").split("@")[0] || "Local User";
  const payloads: Record<string, unknown>[] = [
    {
      id: userId,
      name: fallbackName,
      email: email || null,
      location: "Not set",
      role: "seeker",
      availability: "available",
    },
    { id: userId, name: fallbackName, email: email || null },
    { id: userId },
  ];

  for (const payload of payloads) {
    const { error } = await admin.from("profiles").upsert(payload, { onConflict: "id" });
    if (!error) return true;
  }

  return false;
};

const toListingPrice = (value: number | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const mergeRowMetadata = async (
  admin: SupabaseClient,
  tableName: string,
  rowId: string,
  metadataPatch: Record<string, unknown>
) => {
  const { data, error } = await admin.from(tableName).select("metadata").eq("id", rowId).maybeSingle();
  if (error) {
    if (isMissingTableError(error.message || "", tableName) || isMissingColumnError(error.message || "")) {
      return false;
    }
    return false;
  }

  const currentMetadata =
    data && typeof (data as { metadata?: unknown }).metadata === "object" && !Array.isArray((data as { metadata?: unknown }).metadata)
      ? ((data as { metadata?: Record<string, unknown> }).metadata as Record<string, unknown>)
      : {};
  const nextMetadata = { ...currentMetadata, ...metadataPatch };

  const { error: updateError } = await admin.from(tableName).update({ metadata: nextMetadata }).eq("id", rowId);
  if (!updateError) return true;
  if (isMissingTableError(updateError.message || "", tableName) || isMissingColumnError(updateError.message || "")) {
    return false;
  }

  return false;
};

export const linkNeedPublishRows = async (params: {
  admin: SupabaseClient;
  postId: string;
  helpRequestId: string;
}) => {
  const { admin, postId, helpRequestId } = params;
  await Promise.all([
    mergeRowMetadata(admin, "posts", postId, {
      linked_help_request_id: helpRequestId,
      publish_link_kind: "need",
    }),
    mergeRowMetadata(admin, "help_requests", helpRequestId, {
      linked_post_id: postId,
      publish_link_kind: "need",
    }),
  ]);
};

export const linkListingPublishRow = async (params: {
  admin: SupabaseClient;
  postId: string;
  listingId: string;
  postType: "service" | "product";
}) => {
  const { admin, postId, listingId, postType } = params;
  await mergeRowMetadata(admin, "posts", postId, {
    linked_listing_id: listingId,
    linked_listing_type: postType,
  });
};

const insertMirroredListing = async (params: {
  admin: SupabaseClient;
  userId: string;
  email: string;
  postId: string;
  postType: "service" | "product";
  payload: PublishPayloadBase;
  metadata: Record<string, unknown>;
}): Promise<ListingWriteResult> => {
  const { admin, userId, email, postId, postType, payload, metadata } = params;
  const tableName = postType === "service" ? "service_listings" : "product_catalog";
  const listingMetadata: Record<string, unknown> = {
    ...metadata,
    source: "composer_listing_sync",
    linked_post_id: postId,
  };
  const listingPrice = toListingPrice(payload.budget);

  const listingPayload: Record<string, unknown> =
    postType === "service"
      ? {
          provider_id: userId,
          title: payload.title,
          description: payload.details || payload.title,
          category: payload.category,
          price: listingPrice,
          availability: "available",
          pricing_type: "fixed",
          metadata: listingMetadata,
        }
      : {
          provider_id: userId,
          title: payload.title,
          description: payload.details || payload.title,
          category: payload.category,
          price: listingPrice,
          stock: 1,
          delivery_method: "pickup",
          image_url: payload.media.find((item) => item.type.startsWith("image/"))?.url || null,
          metadata: listingMetadata,
        };

  const blockedColumns = new Set<string>();

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const result = await admin.from(tableName).insert(listingPayload).select("id").single();
    if (!result.error) {
      return {
        id: (result.data as { id?: string } | null)?.id,
      };
    }

    const message = result.error.message || "Listing insert failed.";
    const details = result.error.details || null;

    if (isMissingTableError(message, tableName)) {
      return {
        missingTable: true,
        errorMessage: message,
        errorCode: result.error.code,
        details,
      };
    }

    const missingColumn = getMissingColumn(message, tableName);
    if (missingColumn && Object.prototype.hasOwnProperty.call(listingPayload, missingColumn)) {
      delete listingPayload[missingColumn];
      blockedColumns.add(missingColumn);
      continue;
    }

    const requiredColumn = getRequiredNullColumn(message);
    if (requiredColumn && !blockedColumns.has(requiredColumn)) {
      if (["provider_id", "user_id", "owner_id", "created_by", "author_id"].includes(requiredColumn)) {
        listingPayload[requiredColumn] = userId;
        continue;
      }
      if (["title", "name", "subject"].includes(requiredColumn)) {
        listingPayload[requiredColumn] = payload.title;
        continue;
      }
      if (["description", "details", "content", "text", "body"].includes(requiredColumn)) {
        listingPayload[requiredColumn] = payload.details || payload.title;
        continue;
      }
      if (requiredColumn === "category") {
        listingPayload[requiredColumn] = payload.category || (postType === "service" ? "Service" : "Product");
        continue;
      }
      if (["price", "amount", "rate"].includes(requiredColumn)) {
        listingPayload[requiredColumn] = listingPrice ?? 0;
        continue;
      }
      if (["availability", "status", "state"].includes(requiredColumn)) {
        listingPayload[requiredColumn] = "available";
        continue;
      }
      if (requiredColumn === "pricing_type") {
        listingPayload[requiredColumn] = "fixed";
        continue;
      }
      if (requiredColumn === "stock") {
        listingPayload[requiredColumn] = 1;
        continue;
      }
      if (requiredColumn === "delivery_method") {
        listingPayload[requiredColumn] = "pickup";
        continue;
      }
      if (requiredColumn === "metadata") {
        listingPayload[requiredColumn] = {};
        continue;
      }
    }

    const foreignKeyColumn = getForeignKeyColumn(message, details);
    if (foreignKeyColumn) {
      const ensured = await ensureProfileReference(admin, userId, email);
      if (ensured) {
        if (!Object.prototype.hasOwnProperty.call(listingPayload, foreignKeyColumn)) {
          listingPayload[foreignKeyColumn] = userId;
        }
        continue;
      }
    }

    if ((result.error.code || "") === "42501" || /row-level security policy/i.test(message)) {
      return {
        errorMessage:
          `Publishing "${postType}" is blocked by Supabase permissions on "${tableName}".` +
          " Update RLS policies or use SUPABASE_SERVICE_ROLE_KEY on the server.",
        errorCode: result.error.code,
        details,
      };
    }

    if (isMissingColumnError(message)) {
      continue;
    }

    return {
      errorMessage: message,
      errorCode: result.error.code,
      details,
    };
  }

  return {
    errorMessage: "Listing insert retries exhausted.",
    errorCode: "RETRY_EXHAUSTED",
  };
};

export const insertPostRow = async (params: {
  admin: SupabaseClient;
  userId: string;
  email: string;
  postType: "need" | "service" | "product";
  payload: PublishPayloadBase;
}): Promise<WriteResult> => {
  const { admin, userId, email, postType, payload } = params;
  const storageTypeVariants = postType === "need" ? ["need", "demand"] : [postType];
  let activeStorageTypeIndex = 0;

  const composedText = composeMarketplacePostText(payload, postType);
  const metadata = buildMarketplaceComposerMetadata(payload, postType);

  const postPayload: Record<string, unknown> = {
    user_id: userId,
    created_by: userId,
    requester_id: userId,
    owner_id: userId,
    author_id: userId,
    type: storageTypeVariants[activeStorageTypeIndex],
    post_type: storageTypeVariants[activeStorageTypeIndex],
    visibility: "public",
    status: "open",
    state: "open",
    category: payload.category,
    text: composedText,
    content: composedText,
    description: composedText,
    title: payload.title,
    name: payload.title,
    metadata,
  };

  const blockedColumns = new Set<string>();

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const result = await admin.from("posts").insert(postPayload).select("id").single();
    if (!result.error) {
      const postId = (result.data as { id?: string } | null)?.id;
      if (!postId) {
        return {
          errorMessage: "Post insert succeeded but returned no id.",
          errorCode: "MISSING_POST_ID",
        };
      }

      if (postType === "service" || postType === "product") {
        const listingWrite = await insertMirroredListing({
          admin,
          userId,
          email,
          postId,
          postType,
          payload,
          metadata,
        });

        if (!listingWrite.id) {
          await admin.from("posts").delete().eq("id", postId);
          return {
            errorMessage:
              listingWrite.errorMessage ||
              `Post publish was rolled back because the "${postType}" inventory entry could not be created.`,
            errorCode: listingWrite.errorCode,
            details: listingWrite.details,
            missingTable: listingWrite.missingTable,
          };
        }

        await linkListingPublishRow({
          admin,
          postId,
          listingId: listingWrite.id,
          postType,
        });
      }

      return {
        id: postId,
      };
    }

    const message = result.error.message || "Post insert failed.";
    const details = result.error.details || null;

    if (isMissingTableError(message, "posts")) {
      return {
        errorMessage: message,
        errorCode: result.error.code,
        details,
        missingTable: true,
      };
    }

    const missingColumn = getMissingColumn(message, "posts");
    if (missingColumn && Object.prototype.hasOwnProperty.call(postPayload, missingColumn)) {
      delete postPayload[missingColumn];
      blockedColumns.add(missingColumn);
      continue;
    }

    const requiredColumn = getRequiredNullColumn(message);
    if (requiredColumn && !blockedColumns.has(requiredColumn)) {
      if (["text", "content", "description", "body", "message"].includes(requiredColumn)) {
        postPayload[requiredColumn] = composedText;
        continue;
      }
      if (["title", "name", "subject"].includes(requiredColumn)) {
        postPayload[requiredColumn] = payload.title;
        continue;
      }
      if (["type", "post_type"].includes(requiredColumn)) {
        postPayload[requiredColumn] = storageTypeVariants[activeStorageTypeIndex];
        continue;
      }
      if (["status", "state"].includes(requiredColumn)) {
        postPayload[requiredColumn] = "open";
        continue;
      }
      if (["user_id", "created_by", "author_id", "requester_id", "owner_id", "provider_id"].includes(requiredColumn)) {
        postPayload[requiredColumn] = userId;
        continue;
      }
      if (requiredColumn === "category") {
        postPayload[requiredColumn] = payload.category;
        continue;
      }
    }

    const foreignKeyColumn = getForeignKeyColumn(message, details);
    if (foreignKeyColumn && Object.prototype.hasOwnProperty.call(postPayload, foreignKeyColumn)) {
      if (foreignKeyColumn === "author_id") {
        const ensured = await ensureProfileReference(admin, userId, email);
        if (ensured) {
          postPayload[foreignKeyColumn] = userId;
          continue;
        }
      }

      if (["author_id", "created_by", "provider_id", "requester_id", "owner_id"].includes(foreignKeyColumn)) {
        delete postPayload[foreignKeyColumn];
        blockedColumns.add(foreignKeyColumn);
        continue;
      }
    }

    if ((result.error.code || "") === "42501" || /row-level security policy/i.test(message)) {
      if (activeStorageTypeIndex < storageTypeVariants.length - 1) {
        activeStorageTypeIndex += 1;
        const nextType = storageTypeVariants[activeStorageTypeIndex];
        postPayload.type = nextType;
        postPayload.post_type = nextType;
        continue;
      }
    }

    return {
      errorMessage: message,
      errorCode: result.error.code,
      details,
    };
  }

  return {
    errorMessage: "Post insert retries exhausted.",
    errorCode: "RETRY_EXHAUSTED",
  };
};

export const insertHelpRequestRow = async (params: {
  admin: SupabaseClient;
  userId: string;
  payload: PublishPayloadBase;
  latitude: number | null;
  longitude: number | null;
}): Promise<WriteResult> => {
  const { admin, userId, payload, latitude, longitude } = params;
  const metadata = buildMarketplaceComposerMetadata(payload, "need");

  const numericBudget = Number(payload.budget || 0);
  const budgetValue = Number.isFinite(numericBudget) && numericBudget > 0 ? numericBudget : null;

  const scheduleDateTime =
    payload.mode === "schedule" && payload.scheduleDate
      ? new Date(`${payload.scheduleDate}T${payload.scheduleTime || "00:00"}`)
      : null;

  const helpPayload: Record<string, unknown> = {
    requester_id: userId,
    title: payload.title,
    details: payload.details,
    category: payload.category,
    urgency: payload.mode === "urgent" ? payload.neededWithin : "flexible",
    needed_by:
      scheduleDateTime && Number.isFinite(scheduleDateTime.getTime())
        ? scheduleDateTime.toISOString()
        : null,
    budget_min: budgetValue,
    budget_max: budgetValue,
    location_label: payload.locationLabel,
    latitude,
    longitude,
    radius_km: payload.radiusKm,
    status: "open",
    metadata: {
      ...metadata,
      source: "api_needs_publish",
      mode: payload.mode,
      needed_within: payload.neededWithin,
      flexible_timing: payload.flexibleTiming,
      attachment_count: payload.media.length,
    },
  };

  const blockedColumns = new Set<string>();

  for (let attempt = 0; attempt < 14; attempt += 1) {
    const result = await admin.from("help_requests").insert(helpPayload).select("id,matched_count").single();
    if (!result.error) {
      return {
        id: (result.data as { id?: string } | null)?.id,
      };
    }

    const message = result.error.message || "Help request insert failed.";
    if (isMissingTableError(message, "help_requests")) {
      return {
        missingTable: true,
        errorMessage: message,
        errorCode: result.error.code,
        details: result.error.details,
      };
    }

    const missingColumn = getMissingColumn(message, "help_requests");
    if (missingColumn && Object.prototype.hasOwnProperty.call(helpPayload, missingColumn)) {
      delete helpPayload[missingColumn];
      blockedColumns.add(missingColumn);
      continue;
    }

    const requiredColumn = getRequiredNullColumn(message);
    if (requiredColumn && !blockedColumns.has(requiredColumn)) {
      if (requiredColumn === "requester_id") {
        helpPayload.requester_id = userId;
        continue;
      }
      if (requiredColumn === "title") {
        helpPayload.title = payload.title;
        continue;
      }
      if (["status", "state"].includes(requiredColumn)) {
        helpPayload[requiredColumn] = "open";
        continue;
      }
    }

    return {
      errorMessage: message,
      errorCode: result.error.code,
      details: result.error.details,
    };
  }

  return {
    errorMessage: "Help request insert retries exhausted.",
    errorCode: "RETRY_EXHAUSTED",
  };
};

export const runImmediateMatching = async (
  admin: SupabaseClient,
  helpRequestId: string
): Promise<{ matchedCount: number; notifiedProviders: number; firstNotificationLatencyMs: number }> => {
  const startedAt = Date.now();
  const { data: existingRequestRow } = await admin
    .from("help_requests")
    .select("matched_count")
    .eq("id", helpRequestId)
    .maybeSingle();

  const existingMatchedCount = Number((existingRequestRow as { matched_count?: number } | null)?.matched_count || 0);
  if (existingMatchedCount > 0) {
    return {
      matchedCount: existingMatchedCount,
      notifiedProviders: existingMatchedCount,
      firstNotificationLatencyMs: Date.now() - startedAt,
    };
  }

  let matchedCount = 0;

  const { data: rpcResult, error: rpcError } = await admin.rpc("match_help_request", {
    target_help_request_id: helpRequestId,
  });

  if (!rpcError) {
    if (typeof rpcResult === "number") {
      matchedCount = Number(rpcResult);
    } else if (Array.isArray(rpcResult) && typeof rpcResult[0] === "number") {
      matchedCount = Number(rpcResult[0]);
    }
  }

  if (!matchedCount) {
    const { data: requestRow } = await admin
      .from("help_requests")
      .select("matched_count")
      .eq("id", helpRequestId)
      .maybeSingle();

    matchedCount = Number((requestRow as { matched_count?: number } | null)?.matched_count || 0);
  }

  let notifiedProviders = matchedCount;

  if (!matchedCount) {
    const { data: matchRows } = await admin
      .from("help_request_matches")
      .select("provider_id")
      .eq("help_request_id", helpRequestId)
      .limit(200);

    notifiedProviders = ((matchRows as { provider_id?: string }[] | null) || []).filter((row) => !!row.provider_id).length;
    matchedCount = notifiedProviders;
  }

  return {
    matchedCount,
    notifiedProviders,
    firstNotificationLatencyMs: Math.max(0, Date.now() - startedAt),
  };
};
