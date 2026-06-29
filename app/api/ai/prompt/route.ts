import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseAnonServerClient } from "@/lib/server/supabaseClients";
import { executeQuery } from "@/lib/ai/orchestrator";
import { moderatePrompt } from "@/lib/ai/contentModeration";
import { resolveProfileAvatarUrl } from "@/lib/mediaUrl";

type SlimProvider = {
  id: string;
  name: string;
  location: string;
  avatarUrl: string;
  bio: string;
  services: string[];
  rating: number | null;
  reviewCount: number;
};

const SEARCH_ACTIONS = new Set(["find_service", "find_provider", "buy_product"]);

function toSearchLabel(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

async function fetchMatchingProviders(categorySlug: string, location?: string, limit = 6): Promise<SlimProvider[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];

  try {
    const label = toSearchLabel(categorySlug);
    let query = admin
      .from("profiles")
      .select("id, full_name, name, location, bio, avatar_url, services")
      .in("role", ["provider", "business"])
      .not("full_name", "is", null)
      .contains("services", [label])
      .limit(limit);

    if (location) {
      query = query.or(`location.ilike.%${location}%,bio.ilike.%${location}%`);
    }

    const { data: profiles, error } = await query;
    if (error || !profiles) return [];

    const ids = profiles.map((p) => p.id).filter(Boolean);
    if (ids.length === 0) return [];

    const { data: reviews } = await admin
      .from("reviews")
      .select("provider_id, rating")
      .in("provider_id", ids);

    const ratingMap: Record<string, number[]> = {};
    for (const r of reviews || []) {
      if (!ratingMap[r.provider_id]) ratingMap[r.provider_id] = [];
      ratingMap[r.provider_id].push(r.rating);
    }

    return profiles.map((p) => {
      const ratings = ratingMap[p.id] || [];
      const avg = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
      return {
        id: p.id,
        name: p.full_name || p.name || "",
        location: p.location || "",
        avatarUrl: resolveProfileAvatarUrl(p.avatar_url) || "",
        bio: p.bio || "",
        services: p.services || [],
        rating: avg ? Math.round(avg * 10) / 10 : null,
        reviewCount: ratings.length,
      };
    });
  } catch {
    return [];
  }
}

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

    let data: Record<string, unknown> | null = result.data || null;

    if (result.redirect && SEARCH_ACTIONS.has(result.action)) {
      const location = context.location || undefined;
      const providers = await fetchMatchingProviders(
        result.category || query,
        location,
      );
      if (providers.length > 0) {
        data = { ...(data || {}), providers };
      }
    }

    return NextResponse.json({
      response: result.response,
      action: result.action,
      redirect: result.redirect || null,
      data: data || null,
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
