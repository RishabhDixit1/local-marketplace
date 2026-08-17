# ServiQ Search Architecture

## 1. AI-Powered Search

### 1.1 Flow
```
User query → Intent Parser → Provider/Service/Product Matching → Ranking → Response
     │              │                    │                        │
     │         Gemini API           Database queries          Scoring
     │         (or fallback)        (FTS + geo)              formula
     │              │                    │                        │
     └──────────────┴────────────────────┴────────────────────────┘
```

### 1.2 Entry Points
- **Web AI bar:** `POST /api/ai/prompt` → full intent parsing + matching
- **Web streaming:** `POST /api/ai/prompt/stream` → SSE streaming response
- **Mobile AI bar:** Same endpoints via `MobileApiClient`
- **Intent engine:** `POST /api/ai/intent` → structured intent + matches

### 1.3 Response Shape
```typescript
type IntentResult = {
  intentId: string;           // Logged to intent_logs
  parsed: ParsedIntent;       // Structured intent
  matches: IntentMatchItem[]; // Ranked results (max 10)
  responseText: string;       // Human-readable response
  createNeedPrompt: {         // Pre-filled need creation data
    title: string;
    category: string | null;
    urgency: string | null;
    location: string | null;
    suggestedDescription: string;
  };
  responseMs: number;         // Response time in ms
};
```

---

## 2. Intent Engine

### 2.1 ParsedIntent Structure
```typescript
type ParsedIntent = {
  action: "find_service" | "find_provider" | "buy_product" | "post_need"
         | "sell_product" | "manage_inventory" | "check_orders"
         | "list_services" | "manage_business" | "get_help";
  category: string | null;     // e.g., "plumbing", "electrician"
  subcategory: string | null;
  urgency: "now" | "today" | "this_week" | "flexible" | null;
  location: string | null;     // e.g., "Crossings Republik"
  budget: { min: number | null; max: number | null };
  keywords: string[];
  response: string;            // AI-generated response text
};
```

### 2.2 Intent Parser
- **File:** `lib/ai/intentParser.ts`
- **Primary:** Gemini structured output via `generateObject()` (Vercel AI SDK)
- **Fallback:** Keyword-based regex parser when Gemini fails
- **Model:** `gemini-2.0-flash` (default)
- **Timeout:** 5 seconds (falls back to keyword on timeout)

### 2.3 Intent Logs
```sql
CREATE TABLE intent_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  query text NOT NULL,
  parsed_action text,
  parsed_category text,
  parsed_urgency text,
  parsed_location text,
  parsed_budget_min numeric,
  parsed_budget_max numeric,
  parsed_keywords text[],
  locality_id uuid,
  latitude numeric,
  longitude numeric,
  matched_count integer,
  response_ms integer,
  created_at timestamptz DEFAULT now()
);
```

### 2.4 Intent Matches
```sql
CREATE TABLE intent_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id uuid REFERENCES intent_logs(id) ON DELETE CASCADE,
  match_type text NOT NULL,     -- "provider" | "service" | "product" | "market"
  match_id uuid NOT NULL,
  title text,
  score numeric,
  score_breakdown jsonb,
  rank integer,
  created_at timestamptz DEFAULT now()
);
```

### 2.5 Intent Feedback
```sql
CREATE TABLE intent_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id uuid REFERENCES intent_logs(id) ON DELETE CASCADE,
  match_id uuid,
  feedback text NOT NULL,       -- "helpful" | "not_helpful" | "clicked"
  user_id uuid,
  created_at timestamptz DEFAULT now()
);
```

---

## 3. Full-Text Search

### 3.1 GIN Indexes
```sql
-- Service listings FTS
CREATE INDEX idx_service_listings_fts ON service_listings
  USING GIN (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(category, '')));

-- Product catalog FTS
CREATE INDEX idx_product_catalog_fts ON product_catalog
  USING GIN (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(category, '')));

-- Posts FTS
CREATE INDEX idx_posts_fts ON posts
  USING GIN (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(text, '') || ' ' || coalesce(content, '')));
```

### 3.2 FTS Query Pattern
```typescript
// Service listing search
const { data } = await db
  .from("service_listings")
  .select("id, title, description, category, provider_id, price, availability, metadata")
  .textSearch("fts_text", searchTerms, { type: "plain" })
  .limit(20);

// searchTerms = "plumbing | repair | pipe" (pipe-separated for OR matching)
```

### 3.3 FTS Column
Each table has a computed `fts_text` column:
```sql
ALTER TABLE service_listings ADD COLUMN fts_text tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(category, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) STORED;
```

---

## 4. Category Matching

### 4.1 Category Synonyms
```sql
CREATE TABLE category_synonyms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical text NOT NULL,       -- "plumbing"
  synonyms text[] NOT NULL,      -- {"pipe repair", "plumber", "water pipe", "leak fix"}
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_category_synonyms_canonical ON category_synonyms(canonical);
```

### 4.2 FTS Enhancement
When searching for "pipe repair":
1. Look up `category_synonyms` for canonical categories
2. Expand query to include synonyms: `"pipe repair | plumbing | plumber | water pipe | leak fix"`
3. Execute FTS with expanded terms
4. Weight matches by category exactness

### 4.3 Category Fit Scoring
```typescript
computeCategoryFit(requestCategory, providerCategories) → number (0-1)

// Exact match: 1.0
// Same group (via categoryWeights config): 0.8
// Partial word overlap: 0.3 + overlap * 0.15
// No match: 0.1
```

---

## 5. Geographic Matching

### 5.1 Locality-Based
- **Primary:** `profiles.locality_id` FK to `localities` table
- **Query:** Filter providers by matching `locality_id`
- **Function:** `providers_near_locality(locality_id, limit, offset)` RPC

### 5.2 Radius Search
```typescript
// Haversine formula for distance calculation
haversineKm(lat1, lng1, lat2, lng2) → number (kilometers)

// Used in:
// - Intent matching (provider distance scoring)
// - Lead scoring (distance component)
// - Nearby providers (radius filter)
```

### 5.3 Distance Scoring
```typescript
// In lead scoring:
distanceScore = distanceKm == null ? 50 : clamp(100 - distanceKm * 6, 0, 100);
// 0km = 100 points, ~16km = 0 points

// Weight: 20% of total lead score
```

### 5.4 Locality Hierarchy
```
Market Zones (market_zones)
  └── Localities (localities)
        ├── name: "Crossings Republik"
        ├── city: "Ghaziabad"
        ├── zone_type: "residential" | "commercial" | "mixed"
        ├── lat/lng: coordinates
        └── slug: URL-friendly name
```

---

## 6. Provider Trust Ranking

### 6.1 Trust Score Formula
From `lib/profile/marketplace.ts`:
```typescript
calculateMarketplaceTrustScore({
  averageRating,        // 0-5 star rating
  completionRate,       // 0-100% (completed / accepted jobs)
  onTimeRate,           // 0-100% (on-time completions)
  repeatClients,        // Count of repeat customers
  verificationLevel,    // "email" | "phone" | "identity" | "business"
  responseTimeMinutes,  // Average response time in minutes
}) → {
  ratingScore: number;        // (rating / 5) * 100
  completionRate: number;     // Direct percentage
  onTimeRate: number;         // Direct percentage
  repeatClientsScore: number; // clamp(repeatClients * 12)
  verificationScore: number;  // email=35, phone=65, identity=85, business=100
  responseTimeScore: number;  // clamp(100 - minutes * 2)
  trustScore: number;         // Weighted sum (see below)
}
```

### 6.2 Weight Distribution
```
ratingScore       × 0.35  (35%)
completionRate    × 0.20  (20%)
onTimeRate        × 0.15  (15%)
repeatClients     × 0.15  (15%)
verification      × 0.10  (10%)
responseTime      × 0.05  ( 5%)
```

### 6.3 Trust Score Refresh
- **Trigger:** `trg_orders_sync_metrics` fires on every `orders` status change
- **RPC:** `refresh_profile_marketplace_metrics(profile_id)` recalculates trust
- **Job completion:** `calculate_job_completion_rate(completed, accepted)` → percentage
- **Order stats:** `get_provider_order_stats(provider_ids[])` → batch fetch

---

## 7. Fallback to Keyword Search

### 7.1 When AI Fails
- **Gemini quota exhausted:** `RESOURCE_EXHAUSTED` error
- **Gemini timeout:** Response > 5 seconds
- **Network error:** Gemini unreachable
- **Parse failure:** Response doesn't match expected schema

### 7.2 Keyword Fallback
```typescript
// lib/ai/intentParser.ts fallback
function parseIntentKeyword(query: string): ParsedIntent {
  // Regex-based extraction:
  // - Category: match against known service categories
  // - Urgency: "now", "today", "asap", "this week"
  // - Location: "near me", "in [area]"
  // - Budget: "under ₹X", "below X"
  // - Action: "find", "buy", "need", "post"
  
  return {
    action: inferAction(query),
    category: extractCategory(query),
    urgency: extractUrgency(query),
    location: extractLocation(query),
    budget: extractBudget(query),
    keywords: extractKeywords(query),
    response: generateKeywordResponse(query),
  };
}
```

### 7.3 Fallback Response
When no AI matches are available:
```
"No {category} providers found near you. Would you like to post a need request instead?"
```

### 7.4 Keyword Search Limitations
- No semantic understanding (can't understand "leaky faucet" → "plumbing")
- No intent classification (can't distinguish "find plumber" from "buy pipes")
- No budget extraction from natural language
- Limited to exact category name matches

---

## 8. Search Result Ranking

### 8.1 Lead Scoring Formula
From `lib/leads/scoring.ts`:
```typescript
scoreLead(input) → {
  categoryFitScore:     categoryFit * 20 * 0.2,     // 20%
  distanceScore:        distance * 0.2,               // 20%
  availabilityScore:    availability * 0.1,           // 10%
  responsivenessScore:  responsiveness * 0.1,         // 10%
  trustScoreComponent:  trustScore * 0.2,             // 20%
  experienceScore:      experience * 0.2,             // 20%
  total:                sum of weighted components     // 0-100
}
```

### 8.2 Experience Score
```typescript
experienceScore = clamp(
  min(completedJobs, 50) * 1.2 +     // Up to 60 points from jobs
  min(reviewCount, 20) * 1.5 +        // Up to 30 points from reviews
  clamp(averageRating * 8, 0, 40) +   // Up to 40 points from rating
  min(repeatClients, 20) * 2,         // Up to 40 points from repeat clients
  0, 100
);
```

### 8.3 AI-Enhanced Scoring
```typescript
mergeAiIntoBreakdown(base, aiScore, aiWeight = 0.2) → AiEnhancedBreakdown
// Blends traditional scoring with AI match confidence
// total = base * (1 - aiWeight) + aiScore * aiWeight
```

### 8.4 Deduplication
- **Provider dedup:** One result per provider (highest-scoring listing wins)
- **Service dedup:** By listing ID
- **Product dedup:** By product ID
- **Market dedup:** By locality ID
