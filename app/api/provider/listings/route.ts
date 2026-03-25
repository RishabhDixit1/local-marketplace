import { NextResponse } from "next/server";
import type {
  ListProviderListingsResponse,
  ProviderListingApiErrorCode,
  ProviderListingMutationResponse,
} from "@/lib/api/providerListings";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
import {
  buildProviderListingsSnapshot,
  createProviderListing,
  deleteProviderListing,
  isCreateProviderListingRequest,
  isDeleteProviderListingRequest,
  isUpdateProviderListingRequest,
  listProviderListings,
  updateProviderListing,
} from "@/lib/server/providerListings";

export const runtime = "nodejs";

const toErrorResponse = (
  status: number,
  code: ProviderListingApiErrorCode,
  message: string,
  details?: string
) =>
  NextResponse.json(
    {
      ok: false,
      code,
      message,
      details,
    } satisfies ListProviderListingsResponse | ProviderListingMutationResponse,
    { status }
  );

const mapWriteErrorStatus = (params: {
  message: string;
  notFound?: boolean;
}) => {
  if (params.notFound) return 404;
  if (/invalid|required|must|non-negative|url/i.test(params.message)) return 400;
  if (/permission|forbidden|blocked/i.test(params.message)) return 403;
  if (/missing|does not exist/i.test(params.message)) return 503;
  return 500;
};

const mapWriteErrorCode = (status: number): ProviderListingApiErrorCode => {
  if (status === 400) return "INVALID_PAYLOAD";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 503) return "NOT_FOUND";
  return "DB";
};

const getDbClient = (accessToken: string) => {
  const admin = createSupabaseAdminClient();
  return admin || createSupabaseUserServerClient(accessToken);
};

const readJsonBody = async (request: Request) => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

export async function GET(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return toErrorResponse(authResult.status, "UNAUTHORIZED", authResult.message);
  }

  const dbClient = getDbClient(authResult.auth.accessToken);
  if (!dbClient) {
    return toErrorResponse(
      500,
      "CONFIG",
      "Supabase server credentials are missing. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  const loadResult = await listProviderListings({
    db: dbClient,
    userId: authResult.auth.userId,
  });

  if (!loadResult.ok) {
    return toErrorResponse(500, "DB", loadResult.message, loadResult.details || undefined);
  }

  const snapshot = buildProviderListingsSnapshot({
    services: loadResult.services,
    products: loadResult.products,
  });

  return NextResponse.json({
    ok: true,
    ...snapshot,
    compatibilityMode: loadResult.compatibilityMode,
    strippedColumns: loadResult.strippedColumns,
  } satisfies ListProviderListingsResponse);
}

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return toErrorResponse(authResult.status, "UNAUTHORIZED", authResult.message);
  }

  const dbClient = getDbClient(authResult.auth.accessToken);
  if (!dbClient) {
    return toErrorResponse(
      500,
      "CONFIG",
      "Supabase server credentials are missing. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  const body = await readJsonBody(request);
  if (!isCreateProviderListingRequest(body)) {
    return toErrorResponse(400, "INVALID_PAYLOAD", "Request body does not match create listing schema.");
  }

  const writeResult = await createProviderListing({
    db: dbClient,
    userId: authResult.auth.userId,
    request: body,
  });

  if (!writeResult.ok) {
    const status = mapWriteErrorStatus({
      message: writeResult.message,
      notFound: writeResult.notFound,
    });
    return toErrorResponse(status, mapWriteErrorCode(status), writeResult.message, writeResult.details || undefined);
  }

  return NextResponse.json({
    ok: true,
    action: "create",
    listingType: body.listingType,
    listingId: writeResult.row.id,
    listing: writeResult.row,
    compatibilityMode: writeResult.compatibilityMode,
    strippedColumns: writeResult.strippedColumns,
  } satisfies ProviderListingMutationResponse);
}

export async function PATCH(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return toErrorResponse(authResult.status, "UNAUTHORIZED", authResult.message);
  }

  const dbClient = getDbClient(authResult.auth.accessToken);
  if (!dbClient) {
    return toErrorResponse(
      500,
      "CONFIG",
      "Supabase server credentials are missing. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  const body = await readJsonBody(request);
  if (!isUpdateProviderListingRequest(body)) {
    return toErrorResponse(400, "INVALID_PAYLOAD", "Request body does not match update listing schema.");
  }

  const writeResult = await updateProviderListing({
    db: dbClient,
    userId: authResult.auth.userId,
    request: body,
  });

  if (!writeResult.ok) {
    const status = mapWriteErrorStatus({
      message: writeResult.message,
      notFound: writeResult.notFound,
    });
    return toErrorResponse(status, mapWriteErrorCode(status), writeResult.message, writeResult.details || undefined);
  }

  return NextResponse.json({
    ok: true,
    action: "update",
    listingType: body.listingType,
    listingId: writeResult.row.id,
    listing: writeResult.row,
    compatibilityMode: writeResult.compatibilityMode,
    strippedColumns: writeResult.strippedColumns,
  } satisfies ProviderListingMutationResponse);
}

export async function DELETE(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return toErrorResponse(authResult.status, "UNAUTHORIZED", authResult.message);
  }

  const dbClient = getDbClient(authResult.auth.accessToken);
  if (!dbClient) {
    return toErrorResponse(
      500,
      "CONFIG",
      "Supabase server credentials are missing. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  const body = await readJsonBody(request);
  if (!isDeleteProviderListingRequest(body)) {
    return toErrorResponse(400, "INVALID_PAYLOAD", "Request body does not match delete listing schema.");
  }

  const deleteResult = await deleteProviderListing({
    db: dbClient,
    userId: authResult.auth.userId,
    request: body,
  });

  if (!deleteResult.ok) {
    const status = mapWriteErrorStatus({
      message: deleteResult.message,
      notFound: deleteResult.notFound,
    });
    return toErrorResponse(status, mapWriteErrorCode(status), deleteResult.message, deleteResult.details || undefined);
  }

  return NextResponse.json({
    ok: true,
    action: "delete",
    listingType: body.listingType,
    listingId: deleteResult.row.id,
    listing: null,
    compatibilityMode: deleteResult.compatibilityMode,
    strippedColumns: deleteResult.strippedColumns,
  } satisfies ProviderListingMutationResponse);
}
