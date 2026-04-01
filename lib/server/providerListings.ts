import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateProviderListingRequest,
  DeleteProviderListingRequest,
  UpdateProviderListingRequest,
} from "@/lib/api/providerListings";
import {
  buildProductWritePayload,
  buildServiceWritePayload,
  calculateProviderListingsStats,
  normalizeProductDraft,
  normalizeProductListingRow,
  normalizeServiceDraft,
  normalizeServiceListingRow,
  validateProductDraft,
  validateServiceDraft,
} from "@/lib/provider/listings";

type ProviderListingWriteError = {
  ok: false;
  message: string;
  code?: string | null;
  details?: string | null;
  compatibilityMode: boolean;
  strippedColumns: string[];
  notFound?: boolean;
};

type ProviderListingWriteSuccess<T> = {
  ok: true;
  row: T;
  compatibilityMode: boolean;
  strippedColumns: string[];
};

type ProviderListingsLoadSuccess = {
  ok: true;
  services: NonNullable<ReturnType<typeof normalizeServiceListingRow>>[];
  products: NonNullable<ReturnType<typeof normalizeProductListingRow>>[];
  compatibilityMode: boolean;
  strippedColumns: string[];
};

type ProviderListingsLoadError = {
  ok: false;
  message: string;
  code?: string | null;
  details?: string | null;
};

type RowRecord = Record<string, unknown>;

const policyPattern = /row-level security|permission denied|new row violates row-level security/i;
const missingTablePattern =
  /relation .* does not exist|could not find the table '.*' in the schema cache|table .* does not exist/i;

const getMissingColumn = (message: string): string | null => {
  const schemaCacheMatch = message.match(/could not find the '([^']+)' column/i);
  if (schemaCacheMatch?.[1]) return schemaCacheMatch[1];

  const postgresMatch = message.match(/column \"([^\"]+)\" of relation/i);
  if (postgresMatch?.[1]) return postgresMatch[1];

  return null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const extractListingImagePath = (value: unknown) => {
  if (typeof value !== "string") return "";
  const raw = value.trim();
  if (!raw) return "";

  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      const marker = "/storage/v1/object/public/listing-images/";
      const markerIndex = parsed.pathname.indexOf(marker);
      if (markerIndex >= 0) {
        return parsed.pathname.slice(markerIndex + marker.length).replace(/^\/+/, "");
      }
    } catch {
      return "";
    }
  }

  const cleaned = raw.replace(/^\/+/, "");
  if (cleaned.startsWith("listing-images/")) {
    return cleaned.slice("listing-images/".length);
  }

  return cleaned;
};

const firstValidationError = (errors: Record<string, string | undefined>) =>
  Object.values(errors).find((message) => typeof message === "string" && message.length > 0) || null;

const toWriteError = (params: {
  message: string;
  code?: string | null;
  details?: string | null;
  compatibilityMode?: boolean;
  strippedColumns?: string[];
  notFound?: boolean;
}): ProviderListingWriteError => ({
  ok: false,
  message: params.message,
  code: params.code || null,
  details: params.details || null,
  compatibilityMode: Boolean(params.compatibilityMode),
  strippedColumns: params.strippedColumns || [],
  notFound: params.notFound,
});

const normalizeInsertOrUpdateError = (params: {
  message: string;
  code?: string | null;
  details?: string | null;
  strippedColumns: string[];
}) => {
  if (policyPattern.test(params.message)) {
    return toWriteError({
      message: "Listing write is blocked by Supabase permissions.",
      code: params.code,
      details: params.details,
      strippedColumns: params.strippedColumns,
      compatibilityMode: params.strippedColumns.length > 0,
    });
  }

  if (missingTablePattern.test(params.message)) {
    return toWriteError({
      message: "Listing tables are missing in Supabase. Apply the canonical migrations first.",
      code: params.code,
      details: params.details,
      strippedColumns: params.strippedColumns,
      compatibilityMode: params.strippedColumns.length > 0,
    });
  }

  return toWriteError({
    message: params.message,
    code: params.code,
    details: params.details,
    strippedColumns: params.strippedColumns,
    compatibilityMode: params.strippedColumns.length > 0,
  });
};

const insertRowWithCompatibility = async (params: {
  db: SupabaseClient;
  table: "service_listings" | "product_catalog";
  payload: Record<string, unknown>;
}): Promise<ProviderListingWriteSuccess<RowRecord> | ProviderListingWriteError> => {
  const workingPayload = { ...params.payload };
  const strippedColumns: string[] = [];

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const result = await params.db.from(params.table).insert(workingPayload).select("*").single();

    if (!result.error && result.data && isRecord(result.data)) {
      return {
        ok: true,
        row: result.data,
        compatibilityMode: strippedColumns.length > 0,
        strippedColumns,
      };
    }

    const message = result.error?.message || "Unable to save listing.";
    const missingColumn = getMissingColumn(message);

    if (missingColumn && Object.prototype.hasOwnProperty.call(workingPayload, missingColumn)) {
      delete workingPayload[missingColumn];
      strippedColumns.push(missingColumn);
      continue;
    }

    return normalizeInsertOrUpdateError({
      message,
      code: result.error?.code || null,
      details: result.error?.details || null,
      strippedColumns,
    });
  }

  return toWriteError({
    message: "Listing write retries were exhausted.",
    code: "RETRY_EXHAUSTED",
    strippedColumns,
    compatibilityMode: strippedColumns.length > 0,
  });
};

const updateRowWithCompatibility = async (params: {
  db: SupabaseClient;
  table: "service_listings" | "product_catalog";
  listingId: string;
  userId: string;
  payload: Record<string, unknown>;
}): Promise<ProviderListingWriteSuccess<RowRecord> | ProviderListingWriteError> => {
  const workingPayload = { ...params.payload };
  const strippedColumns: string[] = [];

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const result = await params.db
      .from(params.table)
      .update(workingPayload)
      .eq("id", params.listingId)
      .eq("provider_id", params.userId)
      .select("*")
      .maybeSingle();

    if (!result.error) {
      if (!result.data || !isRecord(result.data)) {
        return toWriteError({
          message: "Listing not found or you do not have permission to edit it.",
          notFound: true,
          strippedColumns,
          compatibilityMode: strippedColumns.length > 0,
        });
      }

      return {
        ok: true,
        row: result.data,
        compatibilityMode: strippedColumns.length > 0,
        strippedColumns,
      };
    }

    const message = result.error.message || "Unable to update listing.";
    const missingColumn = getMissingColumn(message);

    if (missingColumn && Object.prototype.hasOwnProperty.call(workingPayload, missingColumn)) {
      delete workingPayload[missingColumn];
      strippedColumns.push(missingColumn);
      continue;
    }

    return normalizeInsertOrUpdateError({
      message,
      code: result.error.code || null,
      details: result.error.details || null,
      strippedColumns,
    });
  }

  return toWriteError({
    message: "Listing update retries were exhausted.",
    code: "RETRY_EXHAUSTED",
    strippedColumns,
    compatibilityMode: strippedColumns.length > 0,
  });
};

export const isCreateProviderListingRequest = (payload: unknown): payload is CreateProviderListingRequest => {
  if (!isRecord(payload)) return false;
  if (payload.listingType !== "service" && payload.listingType !== "product") return false;
  return isRecord(payload.values);
};

export const isUpdateProviderListingRequest = (payload: unknown): payload is UpdateProviderListingRequest => {
  if (!isRecord(payload)) return false;
  if (payload.listingType !== "service" && payload.listingType !== "product") return false;
  if (typeof payload.listingId !== "string" || !payload.listingId.trim()) return false;
  return isRecord(payload.values);
};

export const isDeleteProviderListingRequest = (payload: unknown): payload is DeleteProviderListingRequest => {
  if (!isRecord(payload)) return false;
  if (payload.listingType !== "service" && payload.listingType !== "product") return false;
  return typeof payload.listingId === "string" && payload.listingId.trim().length > 0;
};

export const listProviderListings = async (params: {
  db: SupabaseClient;
  userId: string;
}): Promise<ProviderListingsLoadSuccess | ProviderListingsLoadError> => {
  const [servicesResult, productsResult] = await Promise.all([
    params.db
      .from("service_listings")
      .select("*")
      .eq("provider_id", params.userId)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false }),
    params.db
      .from("product_catalog")
      .select("*")
      .eq("provider_id", params.userId)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  if (servicesResult.error) {
    return {
      ok: false,
      message: servicesResult.error.message || "Unable to load service listings.",
      code: servicesResult.error.code || null,
      details: servicesResult.error.details || null,
    };
  }

  if (productsResult.error) {
    return {
      ok: false,
      message: productsResult.error.message || "Unable to load product listings.",
      code: productsResult.error.code || null,
      details: productsResult.error.details || null,
    };
  }

  const services = ((servicesResult.data as RowRecord[] | null) || [])
    .map((row) => normalizeServiceListingRow(row))
    .filter((row): row is NonNullable<ReturnType<typeof normalizeServiceListingRow>> => !!row);
  const products = ((productsResult.data as RowRecord[] | null) || [])
    .map((row) => normalizeProductListingRow(row))
    .filter((row): row is NonNullable<ReturnType<typeof normalizeProductListingRow>> => !!row);

  return {
    ok: true,
    services,
    products,
    compatibilityMode: false,
    strippedColumns: [],
  };
};

export const createProviderListing = async (params: {
  db: SupabaseClient;
  userId: string;
  request: CreateProviderListingRequest;
}): Promise<
  | ProviderListingWriteSuccess<
      NonNullable<ReturnType<typeof normalizeServiceListingRow>> | NonNullable<ReturnType<typeof normalizeProductListingRow>>
    >
  | ProviderListingWriteError
> => {
  if (params.request.listingType === "service") {
    const draft = normalizeServiceDraft(params.request.values);
    const validationError = firstValidationError(validateServiceDraft(draft));
    if (validationError) {
      return toWriteError({ message: validationError });
    }

    const payload = buildServiceWritePayload(params.userId, draft);
    const writeResult = await insertRowWithCompatibility({
      db: params.db,
      table: "service_listings",
      payload,
    });

    if (!writeResult.ok) return writeResult;

    const listing = normalizeServiceListingRow(writeResult.row);
    if (!listing) {
      return toWriteError({
        message: "Service listing was saved but could not be normalized.",
        compatibilityMode: writeResult.compatibilityMode,
        strippedColumns: writeResult.strippedColumns,
      });
    }

    return {
      ok: true,
      row: listing,
      compatibilityMode: writeResult.compatibilityMode,
      strippedColumns: writeResult.strippedColumns,
    };
  }

  const draft = normalizeProductDraft(params.request.values);
  const validationError = firstValidationError(validateProductDraft(draft));
  if (validationError) {
    return toWriteError({ message: validationError });
  }

  const payload = buildProductWritePayload(params.userId, draft);
  const writeResult = await insertRowWithCompatibility({
    db: params.db,
    table: "product_catalog",
    payload,
  });

  if (!writeResult.ok) return writeResult;

  const listing = normalizeProductListingRow(writeResult.row);
  if (!listing) {
    return toWriteError({
      message: "Product listing was saved but could not be normalized.",
      compatibilityMode: writeResult.compatibilityMode,
      strippedColumns: writeResult.strippedColumns,
    });
  }

  return {
    ok: true,
    row: listing,
    compatibilityMode: writeResult.compatibilityMode,
    strippedColumns: writeResult.strippedColumns,
  };
};

export const updateProviderListing = async (params: {
  db: SupabaseClient;
  userId: string;
  request: UpdateProviderListingRequest;
}): Promise<
  | ProviderListingWriteSuccess<
      NonNullable<ReturnType<typeof normalizeServiceListingRow>> | NonNullable<ReturnType<typeof normalizeProductListingRow>>
    >
  | ProviderListingWriteError
> => {
  if (params.request.listingType === "service") {
    const draft = normalizeServiceDraft(params.request.values);
    const validationError = firstValidationError(validateServiceDraft(draft));
    if (validationError) {
      return toWriteError({ message: validationError });
    }

    const payload = buildServiceWritePayload(params.userId, draft);
    const writeResult = await updateRowWithCompatibility({
      db: params.db,
      table: "service_listings",
      listingId: params.request.listingId.trim(),
      userId: params.userId,
      payload,
    });

    if (!writeResult.ok) return writeResult;

    const listing = normalizeServiceListingRow(writeResult.row);
    if (!listing) {
      return toWriteError({
        message: "Service listing was updated but could not be normalized.",
        compatibilityMode: writeResult.compatibilityMode,
        strippedColumns: writeResult.strippedColumns,
      });
    }

    return {
      ok: true,
      row: listing,
      compatibilityMode: writeResult.compatibilityMode,
      strippedColumns: writeResult.strippedColumns,
    };
  }

  const draft = normalizeProductDraft(params.request.values);
  const validationError = firstValidationError(validateProductDraft(draft));
  if (validationError) {
    return toWriteError({ message: validationError });
  }

  const payload = buildProductWritePayload(params.userId, draft);
  const writeResult = await updateRowWithCompatibility({
    db: params.db,
    table: "product_catalog",
    listingId: params.request.listingId.trim(),
    userId: params.userId,
    payload,
  });

  if (!writeResult.ok) return writeResult;

  const listing = normalizeProductListingRow(writeResult.row);
  if (!listing) {
    return toWriteError({
      message: "Product listing was updated but could not be normalized.",
      compatibilityMode: writeResult.compatibilityMode,
      strippedColumns: writeResult.strippedColumns,
    });
  }

  return {
    ok: true,
    row: listing,
    compatibilityMode: writeResult.compatibilityMode,
    strippedColumns: writeResult.strippedColumns,
  };
};

export const deleteProviderListing = async (params: {
  db: SupabaseClient;
  userId: string;
  request: DeleteProviderListingRequest;
}): Promise<ProviderListingWriteSuccess<{ id: string }> | ProviderListingWriteError> => {
  const table = params.request.listingType === "service" ? "service_listings" : "product_catalog";
  const listingId = params.request.listingId.trim();

  if (params.request.listingType === "product") {
    const imageReadResult = await params.db
      .from("product_catalog")
      .select("image_path,image_url")
      .eq("id", listingId)
      .eq("provider_id", params.userId)
      .maybeSingle();

    if (!imageReadResult.error && imageReadResult.data && isRecord(imageReadResult.data)) {
      const imagePath =
        extractListingImagePath(imageReadResult.data.image_path) ||
        extractListingImagePath(imageReadResult.data.image_url);

      if (imagePath) {
        await params.db.storage.from("listing-images").remove([imagePath]);
      }
    }
  }

  const result = await params.db
    .from(table)
    .delete()
    .eq("id", listingId)
    .eq("provider_id", params.userId)
    .select("id")
    .maybeSingle();

  if (result.error) {
    return normalizeInsertOrUpdateError({
      message: result.error.message || "Unable to delete listing.",
      code: result.error.code || null,
      details: result.error.details || null,
      strippedColumns: [],
    });
  }

  if (!result.data || typeof (result.data as { id?: unknown }).id !== "string") {
    return toWriteError({
      message: "Listing not found or you do not have permission to delete it.",
      notFound: true,
    });
  }

  return {
    ok: true,
    row: { id: (result.data as { id: string }).id },
    compatibilityMode: false,
    strippedColumns: [],
  };
};

export const buildProviderListingsSnapshot = (params: {
  services: NonNullable<ReturnType<typeof normalizeServiceListingRow>>[];
  products: NonNullable<ReturnType<typeof normalizeProductListingRow>>[];
}) => ({
  services: params.services,
  products: params.products,
  stats: calculateProviderListingsStats(params.services, params.products),
});
