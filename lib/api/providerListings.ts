import type {
  ProviderProductDraft,
  ProviderProductListing,
  ProviderServiceDraft,
  ProviderServiceListing,
  ProviderListingsStats,
} from "@/lib/provider/listings";

export type ProviderListingType = "service" | "product";
export type ProviderListingAction = "create" | "update" | "delete";

export type ProviderListingApiErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_PAYLOAD"
  | "CONFIG"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "DB"
  | "UNKNOWN";

export type ProviderListingApiError = {
  ok: false;
  code: ProviderListingApiErrorCode;
  message: string;
  details?: string;
};

export type ListProviderListingsSuccess = {
  ok: true;
  services: ProviderServiceListing[];
  products: ProviderProductListing[];
  stats: ProviderListingsStats;
  compatibilityMode: boolean;
  strippedColumns: string[];
};

export type ListProviderListingsResponse = ListProviderListingsSuccess | ProviderListingApiError;

export type CreateProviderListingRequest =
  | {
      listingType: "service";
      values: ProviderServiceDraft;
    }
  | {
      listingType: "product";
      values: ProviderProductDraft;
    };

export type UpdateProviderListingRequest =
  | {
      listingType: "service";
      listingId: string;
      values: ProviderServiceDraft;
    }
  | {
      listingType: "product";
      listingId: string;
      values: ProviderProductDraft;
    };

export type DeleteProviderListingRequest = {
  listingType: ProviderListingType;
  listingId: string;
};

export type ProviderListingMutationSuccess = {
  ok: true;
  action: ProviderListingAction;
  listingType: ProviderListingType;
  listingId: string;
  listing: ProviderServiceListing | ProviderProductListing | null;
  compatibilityMode: boolean;
  strippedColumns: string[];
};

export type ProviderListingMutationResponse = ProviderListingMutationSuccess | ProviderListingApiError;
