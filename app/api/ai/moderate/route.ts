import { NextResponse } from "next/server";
import { moderatePrompt } from "@/lib/ai/contentModeration";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const query = typeof body?.query === "string" ? body.query.trim() : "";

    if (!query) {
      return NextResponse.json(
        { safe: false, reason: "Query is required" },
        { status: 400 },
      );
    }

    const strictness =
      body?.strictness === "relaxed" ? "relaxed" : "strict";

    const result = moderatePrompt(query, strictness);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Moderation error:", error);
    return NextResponse.json(
      { safe: false, reason: "Failed to moderate query" },
      { status: 500 },
    );
  }
}
