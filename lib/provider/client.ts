"use client";

import type {
  CreateProviderListingRequest,
  DeleteProviderListingRequest,
  ListProviderListingsResponse,
  ProviderListingMutationResponse,
  UpdateProviderListingRequest,
} from "@/lib/api/providerListings";
import { fetchAuthedJson } from "@/lib/clientApi";
import { supabase } from "@/lib/supabase";

const assertMutationOk = (payload: ProviderListingMutationResponse) => {
  if (!payload.ok) {
    throw new Error(payload.message || "Listing request failed.");
  }
  return payload;
};

export const fetchProviderListings = async () => {
  const payload = await fetchAuthedJson<ListProviderListingsResponse>(supabase, "/api/provider/listings");
  if (!payload.ok) {
    throw new Error(payload.message || "Unable to load your listings.");
  }
  return payload;
};

export const createProviderListing = async (request: CreateProviderListingRequest) => {
  const payload = await fetchAuthedJson<ProviderListingMutationResponse>(supabase, "/api/provider/listings", {
    method: "POST",
    body: JSON.stringify(request),
  });
  return assertMutationOk(payload);
};

export const updateProviderListing = async (request: UpdateProviderListingRequest) => {
  const payload = await fetchAuthedJson<ProviderListingMutationResponse>(supabase, "/api/provider/listings", {
    method: "PATCH",
    body: JSON.stringify(request),
  });
  return assertMutationOk(payload);
};

export const deleteProviderListing = async (request: DeleteProviderListingRequest) => {
  const payload = await fetchAuthedJson<ProviderListingMutationResponse>(supabase, "/api/provider/listings", {
    method: "DELETE",
    body: JSON.stringify(request),
  });
  return assertMutationOk(payload);
};
