import { NextResponse } from "next/server";
import { createSupabaseAnonServerClient } from "@/lib/server/supabaseClients";
import { executeQuery } from "@/lib/ai/orchestrator";
import { moderatePrompt } from "@/lib/ai/contentModeration";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const query = typeof body?.query === "string" ? body.query.trim() : "";

    if (!query) {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 },
      );
    }

    if (query.length > 500) {
      return NextResponse.json(
        { error: "Query too long (max 500 characters)" },
        { status: 400 },
      );
    }

    const moderation = moderatePrompt(query);
    if (!moderation.safe) {
      console.warn(`[Moderation] Blocked query: "${query.slice(0, 100)}" — reason: ${moderation.reason}`);
      return NextResponse.json(
        { error: moderation.reason },
        { status: 403 },
      );
    }
    if (moderation.sanitized) {
      console.info(`[Moderation] Sanitized query: "${query.slice(0, 100)}"`);
    }

    const effectiveQuery = moderation.sanitized ?? query;

    let userId: string | undefined;
    let userRole: string | undefined;

    const authHeader = request.headers.get("authorization")?.replace("Bearer ", "");
    if (authHeader) {
      const supabase = createSupabaseAnonServerClient();
      if (supabase) {
        const { data } = await supabase.auth.getUser(authHeader);
        if (data?.user) {
          userId = data.user.id;
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", userId)
            .single();
          userRole = profile?.role;
        }
      }
    }

    const context = {
      userId,
      userRole,
      location: typeof body?.context?.location === "string" ? body.context.location : undefined,
    };

    const result = await executeQuery(effectiveQuery, context);

    return NextResponse.json({
      response: result.response,
      action: result.action,
      redirect: result.redirect || null,
      data: result.data || null,
      suggestions: result.suggestions || [],
    });
  } catch (error) {
    console.error("AI prompt error:", error);
    return NextResponse.json(
      { error: "Failed to process query" },
      { status: 500 },
    );
  }
}
