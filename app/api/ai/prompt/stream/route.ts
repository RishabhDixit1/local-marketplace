import { streamText } from "ai";
import { google } from "@ai-sdk/google";
import { createSupabaseAnonServerClient } from "@/lib/server/supabaseClients";
import { parseIntentBest } from "@/lib/ai/intentParser";
import { moderatePrompt } from "@/lib/ai/contentModeration";
import { appName } from "@/lib/branding";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const query = typeof body?.query === "string" ? body.query.trim() : "";

    if (!query) {
      return new Response(JSON.stringify({ error: "Query is required" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    if (query.length > 500) {
      return new Response(JSON.stringify({ error: "Query too long (max 500 characters)" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const moderation = moderatePrompt(query);
    if (!moderation.safe) {
      console.warn(`[Moderation] Blocked query: "${query.slice(0, 100)}" — reason: ${moderation.reason}`);
      return new Response(JSON.stringify({ error: moderation.reason }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
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

    const location = typeof body?.context?.location === "string" ? body.context.location : undefined;
    const conversation: Array<{ role: "user" | "assistant"; content: string }> = Array.isArray(body?.conversation) ? body.conversation : [];

    const parsed = await parseIntentBest(effectiveQuery);

    const conversationContext = conversation.length > 0
      ? `\n\nPrevious conversation:\n${conversation.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n")}\n\nLatest user query: "${effectiveQuery}"`
      : `\n\nUser query: "${effectiveQuery}"`;

    const systemPrompt = `You are ${appName} AI assistant — a helpful guide for a local services marketplace.
Your job is to help users find services, products, and providers in their area.

User context: ${userRole ? `Role: ${userRole}` : "Not signed in"}${location ? `, Location: ${location}` : ""}

Respond conversationally and concisely (1-3 sentences). If you know what the user needs, guide them.
If they ask for something specific, confirm it and tell them what you found.
If you're unsure, ask clarifying questions.

Remember the context from previous messages — if the user refers to something they mentioned before, use that context.`;

    const result = streamText({
      model: google("gemini-2.0-flash"),
      system: systemPrompt,
      prompt: `${conversationContext}

Detected intent: ${parsed.action}
Category: ${parsed.category || "Not specified"}
Location: ${parsed.location || location || "Not specified"}
Keywords: ${parsed.keywords.join(", ")}

Provide a helpful response that acknowledges what they're looking for and guides them to find it.`,
      temperature: 0.7,
    });

    const textStream = result.textStream;

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of textStream) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "x-action": sanitizeHeaderValue(parsed.action || ""),
        "x-category": sanitizeHeaderValue(parsed.category || ""),
        "x-redirect": buildRedirectUrl(parsed),
        "cache-control": "no-cache",
      },
    });
  } catch (error) {
    console.error("AI stream error:", error);
    return new Response(JSON.stringify({ error: "Failed to process query" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\x00-\x1F\x7F-\x9F]/g, "").trim();
}

function buildRedirectUrl(parsed: {
  action?: string | null;
  category?: string | null;
  urgency?: string | null;
  keywords?: string[];
}): string {
  const params = new URLSearchParams();
  if (parsed.category) params.set("category", parsed.category);
  if (parsed.action) params.set("action", parsed.action);
  return `/dashboard?${params.toString()}`;
}
