"use client";

import type {
  AcceptQuoteResponse,
  GetQuoteDraftResponse,
  QuoteDraftInput,
  SaveQuoteDraftResponse,
  SendQuoteDraftResponse,
} from "@/lib/api/quotes";
import { fetchAuthedJson } from "@/lib/clientApi";
import { supabase } from "@/lib/supabase";

const buildQuery = (params: { orderId?: string | null; helpRequestId?: string | null }) => {
  const query = new URLSearchParams();
  if (params.orderId) query.set("orderId", params.orderId);
  if (params.helpRequestId) query.set("helpRequestId", params.helpRequestId);
  const value = query.toString();
  return value ? `?${value}` : "";
};

export const loadQuoteDraft = (params: { orderId?: string | null; helpRequestId?: string | null }) =>
  fetchAuthedJson<GetQuoteDraftResponse>(supabase, `/api/quotes/draft${buildQuery(params)}`, {
    method: "GET",
  });

export const saveQuoteDraft = (input: QuoteDraftInput) =>
  fetchAuthedJson<SaveQuoteDraftResponse>(supabase, "/api/quotes/draft", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const sendQuoteDraft = (input: QuoteDraftInput) =>
  fetchAuthedJson<SendQuoteDraftResponse>(supabase, "/api/quotes/send", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const acceptQuoteDraft = (quoteId: string) =>
  fetchAuthedJson<AcceptQuoteResponse>(supabase, `/api/quotes/${encodeURIComponent(quoteId)}/accept`, {
    method: "POST",
  });
