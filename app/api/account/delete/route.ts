import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { withErrorHandling } from "@/lib/server/errorHandler";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";

async function postHandler(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Server configuration error." }, { status: 500 });
  }

  try {
    const { error } = await admin.auth.admin.deleteUser(auth.auth.userId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete account.";
    console.error("[account/delete] error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const POST = withErrorHandling(postHandler, "account:delete");
