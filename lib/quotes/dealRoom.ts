"use client";

import type {
  AddQuoteAttachmentRequest,
  AddQuoteAttachmentResponse,
  DealRoomContext,
  GetDealRoomResponse,
  ProviderCatalogItem,
  QuoteAttachmentRecord,
  QuoteAttachmentType,
  QuoteDraftRecord,
  QuoteVersionRecord,
  RemoveQuoteAttachmentRequest,
  RemoveQuoteAttachmentResponse,
  RejectQuoteRequest,
  RejectQuoteResponse,
} from "@/lib/api/quotes";
import { fetchAuthedJson, getAccessToken } from "@/lib/clientApi";
import { supabase } from "@/lib/supabase";

const buildQuery = (params: { orderId?: string | null; helpRequestId?: string | null }) => {
  const query = new URLSearchParams();
  if (params.orderId) query.set("orderId", params.orderId);
  if (params.helpRequestId) query.set("helpRequestId", params.helpRequestId);
  const value = query.toString();
  return value ? `?${value}` : "";
};

export const loadDealRoom = (params: { orderId?: string | null; helpRequestId?: string | null }) =>
  fetchAuthedJson<GetDealRoomResponse>(supabase, `/api/quotes/deal-room${buildQuery(params)}`, {
    method: "GET",
  });

export const loadProviderCatalog = (providerId?: string | null) => {
  if (!providerId) return Promise.resolve({ ok: true as const, items: [] as ProviderCatalogItem[] });
  return fetchAuthedJson<{ ok: boolean; items: ProviderCatalogItem[]; message?: string }>(
    supabase,
    `/api/quotes/catalog?providerId=${encodeURIComponent(providerId)}`,
    { method: "GET" }
  );
};

export const rejectQuoteDraft = (quoteId: string, reason?: string, counterRequest?: boolean) =>
  fetchAuthedJson<RejectQuoteResponse>(supabase, `/api/quotes/reject`, {
    method: "POST",
    body: JSON.stringify({ quoteId, reason, counterRequest } satisfies RejectQuoteRequest),
  });

export type UploadQuoteMediaResult = {
  ok: true;
  name: string;
  url: string;
  path: string;
  type: string;
  size: number;
};

export const uploadQuoteMedia = async (file: File): Promise<UploadQuoteMediaResult> => {
  const token = await getAccessToken(supabase);
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/upload/quote-media", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  const payload = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    message?: string;
    path?: string;
    url?: string;
    media?: { name: string; url: string; type: string; size: number };
  };

  if (!payload.ok || !payload.media || !payload.url || !payload.path) {
    throw new Error(payload.message || `Upload failed: ${file.name}`);
  }

  return {
    ok: true,
    name: payload.media.name,
    url: payload.url,
    path: payload.path,
    type: payload.media.type,
    size: payload.media.size,
  };
};

export const addQuoteAttachment = (
  quoteId: string,
  options: {
    fileName: string;
    filePath: string;
    fileUrl: string;
    fileSizeBytes?: number;
    mimeType?: string;
    kind?: QuoteAttachmentType;
    title?: string;
    description?: string;
  }
) =>
  fetchAuthedJson<AddQuoteAttachmentResponse>(supabase, `/api/quotes/attachments`, {
    method: "POST",
    body: JSON.stringify({
      quoteId,
      ...options,
    } satisfies AddQuoteAttachmentRequest),
  });

export const removeQuoteAttachment = (attachmentId: string) =>
  fetchAuthedJson<RemoveQuoteAttachmentResponse>(supabase, `/api/quotes/attachments`, {
    method: "DELETE",
    body: JSON.stringify({ attachmentId } satisfies RemoveQuoteAttachmentRequest),
  });

export type {
  DealRoomContext,
  ProviderCatalogItem,
  QuoteAttachmentRecord,
  QuoteAttachmentType,
  QuoteVersionRecord,
};
