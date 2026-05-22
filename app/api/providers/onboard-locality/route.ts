import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";

export const runtime = "nodejs";

export type OnboardLocalityBody = {
  locality_id: string;
  service_zone_ids?: string[];
  service_category_ids?: string[];
  service_area_radius_km?: number;
};

export type OnboardLocalityResponse = {
  ok: boolean;
  fields?: {
    locality_id: string;
    service_zone_ids: string[];
    service_category_ids: string[];
    service_area_radius_km: number;
  };
  code?: string;
  message?: string;
};

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", message: authResult.message } satisfies OnboardLocalityResponse,
      { status: authResult.status }
    );
  }

  let body: OnboardLocalityBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: "PARSE", message: "Invalid JSON body." } satisfies OnboardLocalityResponse,
      { status: 400 }
    );
  }

  if (!body.locality_id) {
    return NextResponse.json(
      { ok: false, code: "VALIDATION", message: "locality_id is required." } satisfies OnboardLocalityResponse,
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, code: "CONFIG", message: "Supabase server credentials are missing." } satisfies OnboardLocalityResponse,
      { status: 500 }
    );
  }

  try {
    const updateFields: Record<string, unknown> = {
      locality_id: body.locality_id,
    };

    if (body.service_zone_ids !== undefined) {
      updateFields.service_zone_ids = body.service_zone_ids;
    }

    if (body.service_category_ids !== undefined) {
      updateFields.service_category_ids = body.service_category_ids;
    }

    if (body.service_area_radius_km !== undefined) {
      updateFields.service_area_radius_km = body.service_area_radius_km;
    }

    const { error } = await admin
      .from("profiles")
      .update(updateFields)
      .eq("id", authResult.auth.userId);

    if (error) {
      return NextResponse.json(
        { ok: false, code: "DB", message: error.message } satisfies OnboardLocalityResponse,
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      fields: {
        locality_id: body.locality_id,
        service_zone_ids: body.service_zone_ids || [],
        service_category_ids: body.service_category_ids || [],
        service_area_radius_km: body.service_area_radius_km || 3.0,
      },
    } satisfies OnboardLocalityResponse);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "DB",
        message: error instanceof Error ? error.message : "Unable to update locality settings.",
      } satisfies OnboardLocalityResponse,
      { status: 500 }
    );
  }
}
