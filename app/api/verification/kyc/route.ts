import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { getKycProvider } from "@/lib/kyc";

export const runtime = "nodejs";

async function db() {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase server credentials are missing.");
  return admin;
}

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json(
      { ok: false, message: authResult.message },
      { status: 401 },
    );
  }

  let body: { documentType: string; documentNumber: string; fullName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  if (!body.documentType || !body.documentNumber) {
    return NextResponse.json(
      { ok: false, message: "documentType and documentNumber are required." },
      { status: 400 },
    );
  }

  const provider = getKycProvider();

  let result;
  if (body.documentType === "aadhaar") {
    result = await provider.verifyAadhaar({
      aadhaarNumber: body.documentNumber,
      fullName: body.fullName,
    });
  } else if (body.documentType === "pan") {
    result = await provider.verifyPan({
      panNumber: body.documentNumber,
      fullName: body.fullName,
    });
  } else {
    return NextResponse.json(
      { ok: false, message: "Unsupported document type. Use 'aadhaar' or 'pan'." },
      { status: 400 },
    );
  }

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
  }

  if (result.verified) {
    const supabase = await db();

    await supabase.from("profiles").upsert(
      {
        id: authResult.auth.userId,
        verification_level: "identity",
        verification_status: "verified",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    await supabase.from("verification_documents").insert({
      profile_id: authResult.auth.userId,
      document_type: body.documentType === "aadhaar" ? "id_proof" : "business_license",
      file_url: `kyc://${body.documentType}/${result.maskedId}`,
      status: "approved",
      reviewer_notes: `Auto-verified via ${provider.name} KYC. ${result.maskedId}`,
      reviewed_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    ok: true,
    verified: result.verified,
    documentType: result.documentType,
    maskedId: result.maskedId,
    message: result.message,
  });
}
