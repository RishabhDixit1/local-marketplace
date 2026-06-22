import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body: {
    eventName?: string;
    data?: Record<string, unknown>;
    testName?: string;
    variant?: string;
  } = await request.json().catch(() => ({}));

  console.log("[AB-Test Track]", {
    eventName: body.eventName,
    data: body.data,
    testName: body.testName,
    variant: body.variant,
    timestamp: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
