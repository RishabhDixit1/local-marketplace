import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body: {
    eventName?: string;
    data?: Record<string, unknown>;
    testName?: string;
    variant?: string;
  } = await request.json().catch(() => ({}));

  console.info("[AB-Test Track]", body.eventName, body.variant);

  return NextResponse.json({ ok: true });
}
