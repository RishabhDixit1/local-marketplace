import { createSupabaseAdminClient } from "../server/supabaseClients";
import { parseIntentBest, type ParsedIntent } from "./intentParser";
import { scoreLead, computeCategoryFit } from "../leads/scoring";

type SupabaseClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

export type IntentMatchItem = {
  matchType: "provider" | "service" | "product" | "market";
  matchId: string;
  title: string;
  score: number;
  scoreBreakdown: Record<string, number>;
  rank: number;
  metadata?: Record<string, unknown>;
};

export type IntentResult = {
  intentId: string;
  parsed: ParsedIntent;
  matches: IntentMatchItem[];
  responseText: string;
  createNeedPrompt: {
    title: string;
    category: string | null;
    urgency: string | null;
    location: string | null;
    suggestedDescription: string;
  };
  responseMs: number;
};

type CandidateRow = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  provider_id: string;
  price: number | null;
  availability: string | null;
  metadata: Record<string, unknown>;
  locality_id: string | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  headline: string | null;
  bio: string | null;
  locality_id: string | null;
  latitude: number | null;
  longitude: number | null;
  avatar_url: string | null;
  trust_score: number | null;
  average_rating: number | null;
  review_count: number | null;
  completed_jobs: number | null;
  availability: string | null;
};

type ReviewRow = {
  provider_id: string;
  rating: number;
};

type PresenceRow = {
  provider_id: string;
  is_online: boolean;
  last_seen: string;
};

const MAX_CANDIDATES = 60;
const MAX_RESULTS = 10;

export async function matchIntent(
  query: string,
  userId: string | null,
  userLat: number | null,
  userLng: number | null,
  userLocalityId: string | null,
): Promise<IntentResult> {
  const start = Date.now();
  const db = createSupabaseAdminClient();
  if (!db) throw new Error("Database client unavailable");

  const parsed = await parseIntentBest(query);

  const matches: IntentMatchItem[] = [];

  // --- 1. Provider matches (for find_service, find_provider) ---
  if (parsed.action === "find_service" || parsed.action === "find_provider") {
    const providerMatches = await matchProviders(db, parsed, userLocalityId, userLat, userLng);
    matches.push(...providerMatches);
  }

  // --- 2. Service listing matches (for find_service, buy_product) ---
  if (parsed.action === "find_service" || parsed.action === "buy_product") {
    const serviceMatches = await matchServiceListings(db, parsed);
    matches.push(...serviceMatches);
  }

  // --- 3. Product matches (for buy_product) ---
  if (parsed.action === "buy_product") {
    const productMatches = await matchProducts(db, parsed);
    matches.push(...productMatches);
  }

  // --- 4. Market matches (for find_service, buy_product) ---
  if (parsed.action === "find_service" || parsed.action === "buy_product") {
    const marketMatches = await matchMarkets(db, parsed, userLocalityId);
    matches.push(...marketMatches);
  }

  // Sort by score and assign ranks
  matches.sort((a, b) => b.score - a.score);
  const ranked = matches.slice(0, MAX_RESULTS).map((m, i) => ({ ...m, rank: i + 1 }));

  // Log intent to DB
  const intentId = await logIntent(db, {
    userId,
    query,
    parsed,
    localityId: userLocalityId,
    latitude: userLat,
    longitude: userLng,
    matchedCount: ranked.length,
    responseMs: Date.now() - start,
  });

  // Log matches to DB
  if (ranked.length > 0) {
    await logMatches(db, intentId, ranked);
  }

  const responseText = buildResponseText(parsed, ranked);
  const createNeedPrompt = buildCreateNeedPrompt(parsed);

  return {
    intentId,
    parsed,
    matches: ranked,
    responseText,
    createNeedPrompt,
    responseMs: Date.now() - start,
  };
}

async function matchProviders(
  db: SupabaseClient,
  parsed: ParsedIntent,
  userLocalityId: string | null,
  userLat: number | null,
  userLng: number | null,
): Promise<IntentMatchItem[]> {
  // Fetch providers from service_listings that match category
  let query = db
    .from("service_listings")
    .select("id, title, description, category, provider_id, price, availability, metadata, locality_id, created_at")
    .eq("availability", "available")
    .limit(MAX_CANDIDATES);

  if (parsed.category) {
    query = query.ilike("category", `%${parsed.category}%`);
  }

  const { data: listings, error } = await query;
  if (error || !listings?.length) return [];

  // Batch-fetch profiles
  const providerIds = [...new Set(listings.map((l: CandidateRow) => l.provider_id))];
  const profiles = await fetchProfiles(db, providerIds);
  const reviews = await fetchReviews(db, providerIds);
  const presences = await fetchPresences(db, providerIds);

  const results: IntentMatchItem[] = [];

  for (const listing of listings) {
    const profile = profiles.get(listing.provider_id);
    if (!profile) continue;

    const providerReviews = reviews.get(listing.provider_id) || [];
    const avgRating = providerReviews.length
      ? providerReviews.reduce((sum: number, r: ReviewRow) => sum + r.rating, 0) / providerReviews.length
      : 0;
    const reviewCount = providerReviews.length;
    const presence = presences.get(listing.provider_id);
    const isOnline = presence?.is_online ?? false;

    const categoryFit = parsed.category
      ? computeCategoryFit(parsed.category, [listing.category || "", ...(profile.headline ? [profile.headline] : [])])
      : 0.3;

    const scoreResult = scoreLead({
      categoryFit,
      distanceKm: null, // TODO: compute from locality
      availability: listing.availability || profile.availability || "available",
      responseTimeMinutes: 30, // default
      trustScore: profile.trust_score ?? 50,
      completedJobs: profile.completed_jobs ?? 0,
      reviewCount,
      averageRating: avgRating,
      isOnline,
      repeatClientsCount: 0,
    });

    results.push({
      matchType: "provider",
      matchId: listing.provider_id,
      title: profile.display_name || "Unknown Provider",
      score: scoreResult.total,
      scoreBreakdown: scoreResult,
      rank: 0,
      metadata: {
        listingId: listing.id,
        listingTitle: listing.title,
        headline: profile.headline,
        avatarUrl: profile.avatar_url,
        price: listing.price,
        localityId: listing.locality_id,
      },
    });
  }

  // Deduplicate by provider (keep highest-scoring listing per provider)
  const bestByProvider = new Map<string, IntentMatchItem>();
  for (const r of results) {
    const existing = bestByProvider.get(r.matchId);
    if (!existing || r.score > existing.score) {
      bestByProvider.set(r.matchId, r);
    }
  }

  return [...bestByProvider.values()];
}

async function matchServiceListings(
  db: SupabaseClient,
  parsed: ParsedIntent,
): Promise<IntentMatchItem[]> {
  // Use FTS for text matching
  const searchTerms = [
    parsed.category,
    parsed.subcategory,
    ...parsed.keywords.slice(0, 3),
  ]
    .filter(Boolean)
    .join(" | ");

  if (!searchTerms) return [];

  const { data, error } = await db
    .from("service_listings")
    .select("id, title, description, category, provider_id, price, availability, metadata")
    .textSearch("fts_text", searchTerms, { type: "plain" })
    .limit(20);

  if (error || !data?.length) return [];

  return data.map((row: Record<string, unknown>, i: number) => ({
    matchType: "service" as const,
    matchId: row.id as string,
    title: row.title as string,
    score: Math.max(0, 70 - i * 3),
    scoreBreakdown: { ftsRank: 1 - i / data.length },
    rank: 0,
    metadata: {
      category: row.category,
      price: row.price,
      providerId: row.provider_id,
    },
  }));
}

async function matchProducts(
  db: SupabaseClient,
  parsed: ParsedIntent,
): Promise<IntentMatchItem[]> {
  const searchTerms = [
    parsed.category,
    parsed.subcategory,
    ...parsed.keywords.slice(0, 3),
  ]
    .filter(Boolean)
    .join(" | ");

  if (!searchTerms) return [];

  const { data, error } = await db
    .from("product_catalog")
    .select("id, title, description, category, provider_id, price, stock, metadata")
    .textSearch("fts_text", searchTerms, { type: "plain" })
    .gt("stock", 0)
    .limit(20);

  if (error || !data?.length) return [];

  return data.map((row: Record<string, unknown>, i: number) => ({
    matchType: "product" as const,
    matchId: row.id as string,
    title: row.title as string,
    score: Math.max(0, 65 - i * 3),
    scoreBreakdown: { ftsRank: 1 - i / data.length },
    rank: 0,
    metadata: {
      category: row.category,
      price: row.price,
      providerId: row.provider_id,
    },
  }));
}

async function matchMarkets(
  db: SupabaseClient,
  parsed: ParsedIntent,
  userLocalityId: string | null,
): Promise<IntentMatchItem[]> {
  // Find markets/localities that match the parsed location or category
  const orFilters: string[] = [];

  if (parsed.location) {
    orFilters.push(`name.ilike.%${parsed.location}%`);
    orFilters.push(`city.ilike.%${parsed.location}%`);
  }

  if (parsed.category) {
    orFilters.push(`name.ilike.%${parsed.category}%`);
  }

  if (orFilters.length === 0) return [];

  const { data, error } = await db
    .from("localities")
    .select("id, name, slug, zone_type, city, lat, lng")
    .or(orFilters.join(","))
    .limit(10);

  if (error || !data?.length) return [];

  return data.map((row: Record<string, unknown>, i: number) => ({
    matchType: "market" as const,
    matchId: row.id as string,
    title: row.name as string,
    score: Math.max(0, 50 - i * 4),
    scoreBreakdown: { localityMatch: 1 - i / data.length },
    rank: 0,
    metadata: {
      slug: row.slug,
      zoneType: row.zone_type,
      city: row.city,
    },
  }));
}

async function fetchProfiles(
  db: SupabaseClient,
  ids: string[],
): Promise<Map<string, ProfileRow>> {
  const map = new Map<string, ProfileRow>();
  if (ids.length === 0) return map;

  const chunks = chunkArray(ids, 200);
  for (const chunk of chunks) {
    const { data } = await db
      .from("profiles")
      .select("id, display_name, headline, bio, locality_id, latitude, longitude, avatar_url, trust_score, average_rating, review_count, completed_jobs, availability")
      .in("id", chunk);

    if (data) {
      for (const row of data) {
        map.set(row.id, row as ProfileRow);
      }
    }
  }
  return map;
}

async function fetchReviews(
  db: SupabaseClient,
  providerIds: string[],
): Promise<Map<string, ReviewRow[]>> {
  const map = new Map<string, ReviewRow[]>();
  if (providerIds.length === 0) return map;

  const chunks = chunkArray(providerIds, 200);
  for (const chunk of chunks) {
    const { data } = await db
      .from("reviews")
      .select("provider_id, rating")
      .in("provider_id", chunk);

    if (data) {
      for (const row of data) {
        const existing = map.get(row.provider_id) || [];
        existing.push(row as ReviewRow);
        map.set(row.provider_id, existing);
      }
    }
  }
  return map;
}

async function fetchPresences(
  db: SupabaseClient,
  providerIds: string[],
): Promise<Map<string, PresenceRow>> {
  const map = new Map<string, PresenceRow>();
  if (providerIds.length === 0) return map;

  const chunks = chunkArray(providerIds, 200);
  for (const chunk of chunks) {
    const { data } = await db
      .from("provider_presence")
      .select("provider_id, is_online, last_seen")
      .in("provider_id", chunk);

    if (data) {
      for (const row of data) {
        map.set(row.provider_id, row as PresenceRow);
      }
    }
  }
  return map;
}

async function logIntent(
  db: SupabaseClient,
  params: {
    userId: string | null;
    query: string;
    parsed: ParsedIntent;
    localityId: string | null;
    latitude: number | null;
    longitude: number | null;
    matchedCount: number;
    responseMs: number;
  },
): Promise<string> {
  const { data, error } = await db
    .from("intent_logs")
    .insert({
      user_id: params.userId,
      query: params.query,
      parsed_action: params.parsed.action,
      parsed_category: params.parsed.category,
      parsed_urgency: params.parsed.urgency,
      parsed_location: params.parsed.location,
      parsed_budget_min: params.parsed.budget.min,
      parsed_budget_max: params.parsed.budget.max,
      parsed_keywords: params.parsed.keywords,
      locality_id: params.localityId,
      latitude: params.latitude,
      longitude: params.longitude,
      matched_count: params.matchedCount,
      response_ms: params.responseMs,
    })
    .select("id")
    .single();

  if (error) {
    console.warn("[intentEngine] Failed to log intent:", error.message);
    return crypto.randomUUID();
  }
  return data.id;
}

async function logMatches(
  db: SupabaseClient,
  intentId: string,
  matches: IntentMatchItem[],
): Promise<void> {
  const rows = matches.map((m) => ({
    intent_id: intentId,
    match_type: m.matchType,
    match_id: m.matchId,
    title: m.title,
    score: m.score,
    score_breakdown: m.scoreBreakdown,
    rank: m.rank,
  }));

  const { error } = await db.from("intent_matches").insert(rows);
  if (error) {
    console.warn("[intentEngine] Failed to log matches:", error.message);
  }
}

function buildResponseText(parsed: ParsedIntent, matches: IntentMatchItem[]): string {
  const prefix = parsed.urgency === "now" ? "⚡ Urgent! " : "";
  const locationSuffix = parsed.location ? ` near ${parsed.location}` : " near you";

  if (matches.length === 0) {
    const categoryLabel = parsed.category
      ? parsed.category.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
      : "service";
    return `${prefix}No ${categoryLabel} providers found${locationSuffix}. Would you like to post a need request instead?`;
  }

  const providerCount = matches.filter((m) => m.matchType === "provider").length;
  const serviceCount = matches.filter((m) => m.matchType === "service").length;
  const productCount = matches.filter((m) => m.matchType === "product").length;
  const marketCount = matches.filter((m) => m.matchType === "market").length;

  const parts: string[] = [];
  if (providerCount > 0) parts.push(`${providerCount} provider${providerCount > 1 ? "s" : ""}`);
  if (serviceCount > 0) parts.push(`${serviceCount} service${serviceCount > 1 ? "s" : ""}`);
  if (productCount > 0) parts.push(`${productCount} product${productCount > 1 ? "s" : ""}`);
  if (marketCount > 0) parts.push(`${marketCount} market${marketCount > 1 ? "s" : ""}`);

  return `${prefix}Found ${parts.join(", ")}${locationSuffix}. Tap to view details.`;
}

function buildCreateNeedPrompt(parsed: ParsedIntent): IntentResult["createNeedPrompt"] {
  const categoryLabel = parsed.category
    ? parsed.category.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
    : null;

  const title = categoryLabel
    ? `Need ${categoryLabel} service`
    : "Need help with a service";

  const description = [
    parsed.category ? `Looking for ${categoryLabel} in` : "Need help with",
    parsed.location ? ` ${parsed.location}` : " my area",
    parsed.urgency ? ` (${parsed.urgency === "now" ? "urgent" : parsed.urgency === "today" ? "today" : "this week"})` : "",
    parsed.budget.max ? ` — budget up to ₹${parsed.budget.max}` : "",
  ].join("");

  return {
    title,
    category: parsed.category,
    urgency: parsed.urgency,
    location: parsed.location,
    suggestedDescription: description,
  };
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
