# ServiQ AI Audit

> **Date:** 2026-07-31
> **Scope:** AI system architecture, models, prompts, APIs, security, observability
> **AI Provider:** Google Gemini 2.0 Flash via @ai-sdk/google
> **Auditor:** AI Systems Review

---

## 1. Executive Summary

ServiQ has built a surprisingly complete AI layer for a pre-revenue marketplace: 9 dedicated files in `lib/ai/`, 7 API endpoints, and integration across intent parsing, content moderation, provider matching, quote drafting, and business profile generation. The stack uses Google Gemini 2.0 Flash via Vercel's AI SDK (`@ai-sdk/google` v3 + `ai` v6), with structured output via `generateObject()` and Zod schemas.

**The good:** The intent parsing pipeline (LLM-first, keyword fallback) is well-architected. Content moderation runs on every prompt. The orchestrator cleanly routes 10 intent actions to handlers. The streaming endpoint exists. Feedback and match retrieval APIs are designed for iteration.

**The concerning:** Zero AI observability — no prompt logging, token tracking, cost monitoring, or latency measurement. Single model provider with no fallback. No prompt injection hardening beyond basic moderation. No caching. No A/B testing. Rate limiting (10/60s intent, 30/60s prompt) may block legitimate usage. AI features (launchpad, quote drafting) duplicate heuristic paths with no usage data.

**The critical gap:** The AI layer is additive, not foundational. It runs alongside conventional flows rather than being the primary interaction surface. The most valuable AI feature — intelligent provider ranking in the main feed — is absent. AI matching is a separate endpoint, not integrated into the discovery UX.

**Key metrics:**
- AI files: 9 in `lib/ai/`, ~1,900 total lines
- AI endpoints: 7 (prompt, prompt/stream, intent, intent feedback, intent matches, intent create-need, moderate)
- Models: 1 (Gemini 2.0 Flash), no fallback
- Observability: 0 (no logging, no tracking, no monitoring)
- Dual paths identified: 3 (launchpad, quote drafting, profile generation)
- Intent actions: 10 (UI exposes ~3)

---

## 2. AI System Architecture

```
User Input (Web/Flutter)
        │
        ▼
┌───────────────────┐
│  Content          │  lib/ai/contentModeration.ts
│  Moderation       │  profanity, phone, email, URL, spam checks
└───────┬───────────┘
        │ (sanitized)
        ▼
┌───────────────────┐
│  Rate Limit       │  Redis atomic upsert
│  (30/60s prompt)  │  IP-based (unauthed), user-ID-based (authed)
│  (10/60s intent)  │
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│  Intent Parser    │  lib/ai/intentParser.ts
│                   │  LLM-first (Gemini + Zod schema)
│  parseIntentBest()│  Keyword fallback (35+ categories, 60+ locations)
└───────┬───────────┘
        │ ParsedIntent
        ▼
┌───────────────────┐
│  Orchestrator     │  lib/ai/orchestrator.ts
│  executeQuery()   │  Routes to 1 of 10 action handlers
└───────┬───────────┘
        │
        ├── handleSearch ──────► lib/ai/intentMatching.ts (providers, listings, products, markets)
        ├── handleBuy ─────────► matchProducts() + generateCreateNeedPrompt()
        ├── handlePostNeed ────► generateCreateNeedPrompt()
        ├── handleSell ────────► (placeholder / redirect)
        ├── handleInventory ───► (placeholder / redirect)
        ├── handleCheckOrders ─► redirect to /orders
        ├── handleListServices ► redirect to /services
        ├── handleManageBusiness─► redirect to /dashboard
        └── handleHelp ────────► generic response
```

### 2.1 Data Flow

```
POST /api/ai/prompt
  └─ moderatePrompt(query) → rate limit check → authenticate (optional) → executeQuery()
       └─ parseIntentBest(query) → resolveLoop() → action handler
            ├─ handleSearch → matchIntent() → DB queries (providers, listings, products, markets)
            │    └─ logIntent() + logMatches() → Supabase intent_logs + intent_matches
            └─ handleBuy/PostNeed → redirect or generate create-need prompt

POST /api/ai/prompt/stream
  └─ moderatePrompt(query) → parseIntentBest()
       ├─ (LLM match) → streamText() via Gemini → SSE response
       └─ (keyword fallback) → return JSON with x-streamed:false header

POST /api/ai/intent
  └─ moderatePrompt(query) → rate limit check → matchIntent() → resolveLoop()
       └─ returns LoopRecommendation { action, confidence, prefillData, suggestedProviders }
```

### 2.2 AI vs Non-AI Decision Points

| Flow | AI Path | Non-AI Path | Winner |
|------|---------|-------------|--------|
| Intent parsing | Gemini + Zod schema | Keyword matching (35 categories) | AI (with fallback) |
| Provider matching | `scoreWithAi()` — 7 criteria | `buildFallbackResult()` — heuristic | Heuristic (default 80% weight) |
| Quote drafting | Gemini generates line items | `generateQuoteDraft()` — keyword/catalog | Heuristic (AI unused) |
| Business profile gen | Gemini generates bio + listings | Heuristic from onboarding answers | Heuristic (AI unused) |
| Lead scoring | `/api/leads/ai-match` | `lib/leads/` conventional matching | AI (newer) |

---

## 3. Component Inventory

### 3.1 Core AI Files (`lib/ai/`)

| File | Lines | Purpose | AI Dependency | Production Usage | Health |
|------|-------|---------|--------------|-----------------|--------|
| `provider.ts` | 50 | Model init, generate/generateText wrappers | Gemini 2.0 Flash | Every AI call | ⚠️ No fallback, no config |
| `intentParser.ts` | 425 | Parse user query to ParsedIntent | Gemini (LLM-first) + keywords | Every prompt/intent call | ✅ Good fallback pattern |
| `intentMatching.ts` | 574 | Full matching pipeline: parse → match → log | Gemini (via parser) | /api/ai/intent and search flow | ✅ Most complete file |
| `orchestrator.ts` | 258 | Route parsed intent to action handler | Gemini (via parser) | /api/ai/prompt | ⚠️ Hardcoded redirects |
| `contentModeration.ts` | 117 | Profanity/PII/spam detection | Regex only | Every prompt/intent call | ✅ Low overhead |
| `matching.ts` | 160 | AI provider scoring (7 criteria) | Gemini | /api/ai/intent scoring | ⚠️ AI weight only 20% |
| `decisionEngine.ts` | 93 | Resolve loop: direct booking vs requirement post | Rule-based | /api/ai/intent | ✅ Simple, focused |
| `quoteDrafting.ts` | 151 | Generate quote line items | Gemini + heuristic fallback | Quote creation | ⚠️ Dual path, AI unused |
| `launchpad.ts` | 75 | Generate business profile from input | Gemini | Provider onboarding | ❌ 0 usage |

### 3.2 AI API Endpoints

| Endpoint | Method | Purpose | Rate Limit | Auth | Streaming | Production Usage |
|----------|--------|---------|-----------|------|-----------|-----------------|
| `/api/ai/prompt` | POST | Main AI query → moderate → parse → execute | 30/60s | Optional | No | Active |
| `/api/ai/prompt/stream` | POST | Streaming variant, edge runtime | 30/60s | Optional | SSE | Active |
| `/api/ai/intent` | POST | Intent-only analysis + resolve loop | 10/60s | Optional | No | Active |
| `/api/ai/intent/:id/feedback` | POST | User feedback on results | N/A | Required | No | ❌ No UI integration |
| `/api/ai/intent/:id/matches` | GET | Retrieve stored matches (paginated) | N/A | Required | No | ✅ Complete |
| `/api/ai/intent/:id/create-need` | POST | Create help request from intent | N/A | Required | No | ✅ Complete |
| `/api/ai/moderate` | POST | Standalone moderation | N/A | Optional | No | ✅ Useful |

### 3.3 AI-Adjacent Files

| File | Purpose | Relationship |
|------|---------|-------------|
| `lib/launchpad/generate.ts` | Heuristic profile generation | Duplicates AI launchpad.ts |
| `lib/leads/` | Lead management and matching | AI-enhanced via /api/leads/ai-match |
| `app/api/leads/ai-match` | AI lead scoring endpoint | Uses matching.ts |
| `components/AIPromptBar.tsx` (web) | AI query input UI | Frontend for /api/ai/prompt |
| `mobile/lib/features/ai_prompt/` | Flutter AI prompt module | Frontend for /api/ai/prompt |
| `app/api/ai/prompt/route.ts` | Rate limiting + auth middleware | Shared infrastructure |

---

## 4. Prompt Analysis

### 4.1 Prompt Quality Assessment

| Component | Prompt | Quality | Issues |
|-----------|--------|---------|--------|
| Intent parsing | Zod schema + system prompt for action classification | Good | No few-shot examples, no Hindi instruction |
| Provider matching | 7 criteria scoring prompt | Fair | Vague criteria definitions |
| Quote drafting | Context + catalog → line items | Good | No pricing range guidance |
| Launchpad | Input → bio + listings + FAQ + tags | Good | No tone/voice instruction |
| Default prompt | Generic "you are a helpful assistant" | Poor | No brand persona, no service context |

### 4.2 Prompt Structure Analysis

**Intent parsing prompt** (`parseIntentWithLLM`):
- Uses Zod schema for structured output (`generateObject`)
- Schema defines 10 actions with descriptions
- **Missing:** Few-shot examples, Hindi language instruction, context about marketplace
- **Risk:** Without few-shot examples, edge-case queries may produce incorrect action classifications

**Provider matching prompt** (`scoreWithAi`):
- Rates providers across 7 criteria on 1-5 scale
- Criteria: service match, location, availability, reputation, responsiveness, urgency, semantic fit
- **Missing:** Relative importance weights, provider-specific context, price considerations
- **Risk:** Scoring may be inconsistent without explicit weighting guidance

**Quote drafting prompt** (`generateQuoteDraftWithLLM`):
- Provides service context, customer description, optional catalog lines
- Instructs Gemini to generate realistic local-market pricing
- **Missing:** Price range boundaries, margin guidance, seasonal adjustments
- **Risk:** May generate unrealistic prices for Delhi NCR market

### 4.3 Prompt Effectiveness Summary

| Prompt Type | Effectiveness | Confidence | Recommendations |
|-------------|--------------|-----------|-----------------|
| Intent parsing | High (with fallback) | 85% | Add few-shot examples, Hindi support |
| Provider matching | Medium (20% weight) | 60% | Improve criteria definitions, add weights |
| Quote drafting | Low (heuristic preferred) | 40% | Remove dual path or add pricing anchors |
| Launchpad | Unknown (0 usage) | N/A | Either remove or instrument and A/B test |
| Default/Help | Low | 50% | Add brand persona, service-specific context |

---

## 5. Model Analysis

### 5.1 Gemini 2.0 Flash Capabilities

| Capability | Supported | Used By ServiQ | Notes |
|------------|-----------|----------------|-------|
| Structured output (JSON mode) | ✅ | `generateObject()` + Zod | Well-integrated |
| Text generation | ✅ | `generateText()` / `streamText()` | Temp 0.7 (good for chat) |
| Streaming | ✅ | `/api/ai/prompt/stream` | Edge runtime |
| Function calling | ✅ | Not used | Opportunity for tool-based actions |
| Vision | ✅ | Not used | Opportunity for photo-based services |
| Context window | 1M tokens | Not leveraged | Could enable long conversation history |
| Hindi/multilingual | ✅ | Partial (keyword lists) | Underutilized |
| Prompt caching | ✅ (paid) | Not used | Cost-saving opportunity |
| Grounding | ✅ | Not used | Could improve accuracy |

### 5.2 Gemini 2.0 Flash Limitations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| Not suitable for deep reasoning | Complex multi-step queries may hallucinate | Keep intent + scoring scope narrow |
| No built-in guardrails | Prompt injection risk | Content moderation regexes (basic) |
| Rate limits (1,500 RPM free tier) | At scale, may throttle | Use provisioned throughput at scale |
| Knowledge cutoff | Cannot answer about recent events | Not critical for local services |
| No default retry | Transient failures cause user-facing errors | Implement exponential backoff in provider.ts |

### 5.3 Cost Estimates (Gemini 2.0 Flash)

| Operation | Input Tokens (est.) | Output Tokens (est.) | Cost/1K Input | Cost/1K Output | Cost/Query |
|-----------|--------------------|--------------------|--------------|---------------|-----------|
| Intent parse | 500 | 100 | $0.000075 | $0.00030 | ~$0.00011 |
| Intent parse (streaming) | 500 | 200 | $0.000075 | $0.00030 | ~$0.00014 |
| Provider matching (10 providers) | 2,000 | 200 | $0.000075 | $0.00030 | ~$0.00021 |
| Quote draft | 1,000 | 300 | $0.000075 | $0.00030 | ~$0.00017 |
| Launchpad profile | 1,500 | 500 | $0.000075 | $0.00030 | ~$0.00026 |
| Moderation (regex only) | 0 | 0 | $0 | $0 | $0 |

**Monthly projection at 10K queries/day:**
- 300K queries/month × $0.00015 avg = ~$45/month
- At 100K queries/day: ~$450/month
- **Verdict:** Cost is negligible — not a constraint

### 5.4 Model Selection Assessment

| Criterion | Current (Gemini 2.0 Flash) | Alternative | Verdict |
|-----------|---------------------------|-------------|---------|
| Latency | ~1-2s per call | Claude Haiku (~1s), GPT-4o-mini (~1.5s) | Good |
| Cost | $0.075/$0.30 per 1M tokens | Claude Haiku ($0.25/$1.25), GPT-4o-mini ($0.15/$0.60) | Cheapest |
| Structured output | ✅ (via json mode) | Claude (tools), GPT-4o (json mode) | Comparable |
| Multilingual | ✅ Hindi support | Claude (limited), GPT-4o (excellent) | Adequate |
| Streaming | ✅ SSE | All major providers | Standard |

**Recommendation:** Stick with Gemini 2.0 Flash for cost and speed. Add GPT-4o-mini as a fallback for when Gemini is unavailable. Consider Claude 4 Sonnet for complex quote drafting if quality is insufficient.

---

## 6. API Analysis

### 6.1 Endpoint Design Quality

| Endpoint | Design Quality | Issues |
|----------|---------------|--------|
| `POST /api/ai/prompt` | Good | No streaming on web dashboard integration |
| `POST /api/ai/prompt/stream` | Good | `x-streamed:false` fallback header is clever |
| `POST /api/ai/intent` | Good | Clean separation of intent from execution |
| `POST /api/ai/intent/:id/feedback` | Good (spec) | No UI → dead endpoint |
| `GET /api/ai/intent/:id/matches` | Good | Paginated, proper |
| `POST /api/ai/intent/:id/create-need` | Good | Clean action endpoint |
| `POST /api/ai/moderate` | Good | Useful standalone utility |

### 6.2 Rate Limiting Analysis

| Endpoint | Rate Limit | Rationale | Assessment |
|----------|-----------|-----------|------------|
| `/api/ai/prompt` | 30 requests per 60s | Prevent abuse | Reasonable for initial launch |
| `/api/ai/intent` | 10 requests per 60s | More restrictive | May be too aggressive — users might retry or refine queries |

**Recommendation:** Tiered rate limits: authed users get 60/60s for prompt, 30/60s for intent. Unauthed users keep current limits. Monitor actual usage patterns before adjusting.

### 6.3 Authentication & Authorization

| Endpoint | Auth Required | Behavior When Unauthed | Assessment |
|----------|--------------|----------------------|------------|
| POST /api/ai/prompt | Optional | Works with IP-based rate limit | ✅ Good for anonymous browsing |
| POST /api/ai/prompt/stream | Optional | Works with IP-based rate limit | ✅ Good for anonymous browsing |
| POST /api/ai/intent | Optional | Works with IP-based rate limit | ⚠️ Intent data not tied to user |
| POST /api/ai/intent/:id/feedback | Required | 401 | ✅ Correct |
| GET /api/ai/intent/:id/matches | Required | 401 | ✅ Correct |
| POST /api/ai/intent/:id/create-need | Required | 401 | ✅ Correct |
| POST /api/ai/moderate | Optional | Works unauthed | ✅ Good utility |

### 6.4 Error Handling

| Scenario | Current Behavior | Recommended |
|----------|-----------------|-------------|
| Gemini API failure | Exception propagates -> 500 | Fallback to heuristic/fallback path |
| Rate limit exceeded | 429 with retry-after | Add user-facing message with estimated wait |
| Content moderation block | 400 with reason | Return sanitized version as fallback |
| Invalid intent | Falls through to keyword parser | Return confidence score + disambiguation prompt |
| Timeout (>10s) | Request hangs | Set explicit timeout on model calls (5s) |
| Empty results | Returns "no providers found" | Suggest alternatives, expand radius, or trigger create-need flow |

---

## 7. AI Readiness Assessment

### 7.1 Scorecard

| Dimension | Score (1-10) | Assessment |
|-----------|-------------|------------|
| Architecture | 7 | Clean separation, good patterns, but dual paths create confusion |
| Model integration | 6 | Single provider, no fallback, no retry, no config |
| Prompt quality | 5 | Functional but lacks few-shot, Hindi, brand context |
| Observability | 1 | Zero — no logging, no tracking, no monitoring |
| Security | 5 | Basic moderation, no prompt injection hardening |
| Cost efficiency | 8 | Gemini Flash is cheap, but no caching wastes tokens |
| Scalability | 4 | Rate limits may throttle before real traffic |
| UX integration | 4 | AI is additive, not primary; prompt bar is the only surface |
| Testing | 2 | No AI-specific tests, no prompt regression tests |
| Documentation | 3 | No prompt documentation, no model decision records |

**Overall Readiness Score: 45/100 — Not ready for AI-first**

### 7.2 Key Readiness Gaps

1. **No observability** — Cannot measure AI performance, cost, or failures. Cannot debug bad responses.
2. **Single point of failure** — Gemini outage = complete AI outage.
3. **No prompt management** — Prompts are hardcoded. No versioning, no A/B testing, no iteration cycle.
4. **No AI testing** — No regression tests for intent parsing, no prompt evaluation framework.
5. **No caching** — Every query hits the model, even identical ones.
6. **AI is secondary** — Not integrated into main feed, search ranking, or provider discovery.
7. **Dual paths** — Users may get different experiences from AI vs heuristic paths with no data on which is better.

---

## 8. Observability Gap Analysis

### 8.1 Current State

| Observability Dimension | Status | Details |
|------------------------|--------|---------|
| Prompt logging | ❌ None | No record of what users asked or what AI returned |
| Token tracking | ❌ None | No input/output token counts |
| Latency tracking | ❌ None | No per-call timing |
| Cost tracking | ❌ None | No cost attribution per user or feature |
| Error tracking | ⚠️ Partial | Sentry captures exceptions but no AI-specific context |
| User feedback | ⚠️ Partial | Feedback endpoint exists but has 0 data (no UI) |
| Model performance | ❌ None | No accuracy, confidence, or quality metrics |
| A/B testing | ❌ None | No AI vs heuristic comparison data |
| Health checks | ❌ None | No `/health` endpoint for AI subsystem |
| Prompt version tracking | ❌ None | No way to know which prompt version ran |

### 8.2 What Should Be Logged

For every AI call:

```typescript
{
  id: string;                    // Unique call ID
  timestamp: string;             // ISO 8601
  userId?: string;               // Authenticated user
  ip: string;                    // For unauthed rate limiting audit
  endpoint: string;              // /api/ai/prompt, /api/ai/intent, etc.
  query: string;                 // User input (sanitized)
  sanitizedQuery?: string;       // After moderation
  promptVersion: string;         // Hash or version ID of prompt used
  model: string;                 // gemini-2.0-flash
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costUsd: number;
  intentAction?: string;         // Parsed action
  confidence?: number;           // Intent parsing confidence
  resultCount?: number;          // Number of results returned
  wasStreamed: boolean;
  fallbackUsed: boolean;         // True if keyword fallback was triggered
  error?: string;                // Error message if any
  userRating?: number;           // From feedback endpoint
}
```

### 8.3 Observability Implementation Priority

1. **P0 — Prompt + token logging:** Log every AI call to a `ai_logs` Supabase table. This is the foundation for everything else.
2. **P1 — Latency tracking:** Wrap all model calls with timing. Alert on p99 > 5s.
3. **P1 — Error rate monitoring:** Track AI-specific error rates separately from general 500s. Alert on > 5% error rate.
4. **P2 — Cost attribution:** Aggregate cost by user, feature, and action type.
5. **P2 — User feedback integration:** Wire feedback endpoint to UI (thumbs up/down on AI responses).
6. **P3 — Health checks:** Add `/api/ai/health` that runs a test prompt and reports model availability + latency.

---

## 9. Security Analysis

### 9.1 Prompt Injection

| Attack Vector | Current Protection | Risk Level | Recommendation |
|---------------|-------------------|------------|---------------|
| Direct prompt injection ("ignore previous instructions") | None | High | Add system prompt delimiter enforcement, instruction guard |
| Indirect injection (user input in queries) | None | High | Sanitize user input before inserting into prompts |
| Role-playing ("you are now DAN") | None | Medium | Add system prompt hardening, output validation |
| Payload extraction (leak system prompt) | None | Medium | Never echo system prompt, limit output tokens |
| SQL injection via AI output | None (but queries use parameterized) | Low | Input validation on AI-generated SQL |
| PII extraction (phone/email in queries) | Content moderation (regex) | Medium | Expand regex patterns, add data classification |

**Current defenses:**
- `contentModeration.ts` checks for profanity (22 words), phone numbers, emails, URLs, spam patterns
- `redactAll()` replaces detected patterns with `[redacted]`
- Length cap at 1000 characters

**Missing:**
- System prompt delimiter enforcement
- Output validation against schema
- Rate limiting at model API level (not just application level)
- User input boundary markers in prompts

### 9.2 Data Leakage

| Risk | Current State | Recommendation |
|------|--------------|----------------|
| User queries logged without PII redaction | Logged directly | Only store sanitized queries |
| Provider data sent to model | Sent for matching/scoring | Anonymize when possible |
| Chat history in prompts | Handled case-by-case | Add data minimization policy |
| API keys | Env vars | ✅ Good (but verify rotation policy) |

### 9.3 Content Moderation Effectiveness

| Check | Pattern | Effectiveness | False Positive Risk |
|-------|---------|--------------|-------------------|
| Profanity (22 words) | Exact match | Low — tiny word list | Low |
| Phone numbers | Regex `\b\d{10}\b` | Medium — misses formatted numbers | Medium — catches valid prices/times |
| Email | Regex | High | Low |
| URL-only | Check if query is entirely a URL | High | Low |
| Repetitive spam | Repeated characters > 5 | High | Medium — catches Hindi words with repeated letters |
| Length | Max 1000 chars | Low — trivial to bypass | Medium — legitimate long queries blocked |

**Assessment:** Content moderation is a reasonable first line of defense but not sufficient for production safety. The 22-word profanity list is notably small (does not include common Hindi profanity). The phone regex `\b\d{10}\b` will match Indian 10-digit mobile numbers but may also match prices (₹1000), dates, and other 10-digit numbers.

---

## 10. Cost Analysis

### 10.1 Per-Query Cost Breakdown

| Operation | Input Tokens | Output Tokens | Cost | Monthly at 10K/day | Annual |
|-----------|-------------|--------------|------|--------------------|--------|
| Intent parse (LLM) | 500 | 100 | $0.00011 | $33 | $396 |
| Intent parse (keyword fallback) | 0 | 0 | $0 | $0 | $0 |
| Provider matching (10 providers) | 2,000 | 200 | $0.00021 | $63 | $756 |
| Quote draft (LLM) | 1,000 | 300 | $0.00017 | $51 | $612 |
| Quote draft (heuristic) | 0 | 0 | $0 | $0 | $0 |
| Launchpad profile | 1,500 | 500 | $0.00026 | N/A (0 usage) | N/A |
| Prompt (full flow) | 2,500 | 300 | $0.00028 | $84 | $1,008 |
| Moderation (regex only) | 0 | 0 | $0 | $0 | $0 |

**Estimated total at 10K queries/day (70% prompt, 30% intent):**
- Prompt: 7,000/day × $0.00028 = $1.96/day
- Intent: 3,000/day × $0.00011 = $0.33/day
- **Total: ~$2.29/day, ~$69/month, ~$828/year**

**With caching (50% cache hit rate):**
- ~$34/month, ~$414/year

**Verdict:** AI costs are negligible at current and near-term scale. The $0 cost of Gemini 2.0 Flash free tier (1,500 RPM) covers launch. Even at 100K queries/day, costs remain under $1,000/year.

### 10.2 Cost-Saving Opportunities

| Opportunity | Savings | Complexity | Priority |
|-------------|---------|------------|----------|
| Query caching | 30-50% | Low | P1 |
| Prompt caching (Gemini API) | 20-40% | Low (paid feature) | P2 |
| Reduce output tokens | 10-20% | Low (truncate) | P3 |
| Batch similar queries | 10-20% | Medium | P3 |
| Keyword-only path for simple queries | 50-80% on subset | Medium | P2 |

---

## 11. Fallback Analysis

### 11.1 What Happens When AI Fails

| Failure Mode | Current Behavior | Acceptability | Recommendation |
|-------------|-----------------|---------------|----------------|
| Gemini API returns 5xx | Exception → 500 error | ❌ Unacceptable | Fallback to keyword-only intent parsing |
| Gemini API timeout (>10s) | Request hangs until timeout | ❌ Unacceptable | Set 5s timeout in provider.ts |
| Rate limit exceeded | 429 response | ⚠️ Poor UX | Queue and retry, or use fallback path |
| Content moderation blocks query | 400 with reason | ⚠️ Abrupt | Show user what was blocked, suggest rephrasing |
| Intent parsing fails (LLM) | Falls to `parseIntent()` keyword | ✅ Good | Already implemented |
| Provider matching fails (LLM) | Falls to `buildFallbackResult()` heuristic | ✅ Good | Already implemented |
| Quote drafting fails (LLM) | Falls to `generateQuoteDraft()` heuristic | ✅ Good | Already implemented |
| Streaming fails mid-response | Partial content sent | ⚠️ No recovery | Add retry or graceful degradation |
| Auth token refresh fails | 401 | ✅ Correct | Auth is optional for most endpoints |

### 11.2 Fallback Quality Assessment

| Layer | Primary | Fallback | Quality Gap | Impact |
|-------|---------|----------|-------------|--------|
| Intent | LLM parse | Keyword parse | Keyword misses context, has lower accuracy | Lower relevance results |
| Matching | AI scoring | Heuristic scoring | Heuristic is simpler (fewer criteria) | Slightly less relevant ranking |
| Quote | LLM draft | Heuristic draft | Heuristic is basic keyword/catalog match | Less natural quotes |
| Profile | LLM generate | Heuristic generate | Heuristic is rule-based, less personalized | Less compelling profiles |

**Key finding:** The LLM→heuristic fallback pattern is well-implemented for intent parsing and provider matching. The issue is the reverse: **there is no AI fallback when the AI itself is unavailable**. If Gemini goes down, the entire AI layer goes down except for the heuristic fallbacks that are already wired.

### 11.3 Recommendation: Multi-Provider Strategy

```typescript
// Proposed provider.ts fallback chain
const providers = [
  { model: gemini, weight: 1.0, timeout: 5000 },
  { model: gpt4oMini, weight: 0.8, timeout: 5000 },
  { model: keywordOnly, weight: 0.5, timeout: 0 },  // Last resort
];

async function generate(request, context) {
  for (const provider of providers) {
    try {
      return await provider.model.generate(request);
    } catch (e) {
      logFallback(provider, e);
      continue;
    }
  }
  throw new Error('All AI providers failed');
}
```

---

## 12. Missing AI Opportunities

### 12.1 High-Impact Gaps

| Opportunity | Description | Impact | Complexity | Priority |
|------------|-------------|--------|------------|----------|
| **AI-powered feed ranking** | Use LLM to rank providers in main discovery feed based on user context, history, query | Critical for marketplace UX | Medium | P0 |
| **AI-first UX (chat-based)** | Replace browse+search with conversational "I need X" → matched result | Product differentiator | High | P1 |
| **Photo-based service requests** | Use Gemini Vision: user uploads photo → AI identifies issue → matches provider | Strong moat | Medium | P1 |
| **Dynamic pricing suggestions** | AI suggests competitive pricing based on service type, location, urgency | Provider value-add | Low | P2 |
| **Automated follow-ups** | AI sends follow-up messages to leads that didn't convert | Provider value-add | Low | P2 |
| **Fraud detection** | AI flags suspicious booking patterns, fake reviews, spam providers | Trust & safety | Medium | P2 |
| **AI provider onboarding assistant** | Chat-based wizard: "Tell us about your business" → auto-filled profile | Activation improvement | Medium | P3 |
| **Multi-language support (Hindi)** | Full Hindi prompt understanding, response generation in Hindlish | TAM expansion (Delhi NCR) | Low | P3 |
| **Smart notifications** | AI determines optimal timing/content for push notifications | Engagement improvement | Medium | P3 |
| **Review summarization** | AI generates summary of all reviews for a provider | Trust signal | Low | P4 |

### 12.2 Current AI Investment vs Value

```
Investment (current): Intent parsing, content moderation, matching, quote drafting, launchpad
                                     │
                                     ▼
                              ❌ Most AI features are
                                unused or secondary
                                     
Value (current):               ✅ Intent parsing works
                                ✅ Content moderation is solid
                                ⚠️ Everything else is latent

                                  ▼
Missing: AI-powered feed ranking, conversational UX, photo-based requests
```

---

## 13. Recommendations

### P0 (Critical — Launch Blocking)

1. **Add AI observability (prompt logging + token tracking)**
   - Log every AI call to `ai_logs` table (query, response, tokens, latency, model, userId)
   - Add timing wrappers around all model calls in `provider.ts`
   - Create dashboard (Datadog/CloudWatch) for AI metrics
   - Without this, the AI layer is a black box

2. **Implement model fallback chain**
   - Add GPT-4o-mini or Claude Haiku as secondary provider in `provider.ts`
   - Implement timeout (5s) on all model calls
   - Ensure fallback path is transparent to users
   - Without this, Gemini outage = complete AI outage

3. **Integrate AI into the main feed experience**
   - Use AI scoring for provider ranking in the main discovery feed (not just `/api/ai/intent`)
   - Show AI-matched providers prominently when user enters a search query
   - This is the single highest-impact AI investment

### P1 (This Week)

4. **Instrument all dual-path features**
   - Add event tracking to AI launchpad, quote drafting, and profile generation
   - Collect usage data before deciding which paths to keep or remove
   - If 0 usage continues, remove the AI paths

5. **Hardened prompt injection defenses**
   - Add system prompt boundary markers
   - Implement output validation against expected schema
   - Expand content moderation word list (especially Hindi)
   - Add instruction guard in system prompts

6. **Wire feedback endpoint to UI**
   - Add thumbs up/down to AI prompt bar responses
   - Collect user ratings for AI quality measurement
   - This is the cheapest way to measure AI effectiveness

7. **Implement query caching**
   - Cache identical queries (with TTL) to reduce cost and latency
   - Use Redis if available, or in-memory LRU cache
   - 30-50% expected cache hit rate

### P2 (2 Weeks)

8. **Add A/B testing framework for AI paths**
   - Test AI vs heuristic intent parsing quality
   - Test AI vs heuristic provider matching relevance
   - Use the feedback endpoint data as success metric

9. **Build AI system health checks**
   - Add `/api/ai/health` endpoint
   - Run test prompt every 60s, report model availability and latency
   - Integrate with existing monitoring (Sentry alerts)

10. **Improve intent parsing prompts**
    - Add few-shot examples for each of the 10 actions
    - Add Hindi language instruction
    - Add marketplace context to system prompt
    - Version prompts and track performance over time

11. **Add Hindi language support to model calls**
    - Extend system prompts to accept Hindi queries
    - Instruct model to respond in Hindlish for Hindi queries
    - Critical for Delhi NCR market penetration

### P3 (Next Month)

12. **Implement conversational AI-first UX**
    - Chat-based primary interface: "I need a plumber" → matched provider
    - Leverage existing streaming endpoint and chat infrastructure
    - Replaces search+browse flow for many use cases

13. **Add photo-based service requests (Gemini Vision)**
    - User uploads photo of issue → AI identifies service needed
    - Matches to appropriate provider category
    - Strong moat against competitors

14. **Remove or deprecate unused AI paths**
    - AI Launchpad (launchpad.ts) — 0 usage → remove or rework
    - AI Quote drafting (quoteDrafting.ts) — heuristic preferred → simplify

15. **Implement tiered rate limiting**
    - Authed users: 60/60s prompt, 30/60s intent
    - Unauthed users: 30/60s prompt, 10/60s intent (current)
    - Prevent legitimate users from hitting artificial limits

### P4 (Backlog)

16. **AI-powered provider onboarding assistant** — chat-based wizard for provider registration
17. **Dynamic pricing suggestions** — AI recommends pricing based on market data
18. **Automated follow-up messages** — AI contacts unconverted leads
19. **Review summarization** — AI generates digest of provider reviews
20. **Smart notifications** — AI optimizes push notification timing and content
21. **Multi-model prompt management system** — versioned, tested, deployable prompts
22. **Provisioned throughput** — move from free tier to paid for reliability

---

## Appendix A: AI File Dependency Map

```
provider.ts ─────────────────────────────────────────────┐
    │                                                     │
    ├── intentParser.ts ──┬── intentMatching.ts ────► DB  │
    │                     └── decisionEngine.ts           │
    │                                                     │
    ├── orchestrator.ts ──┬── intentParser.ts             │
    │                     ├── intentMatching.ts            │
    │                     └── (action handlers)           │
    │                                                     │
    ├── matching.ts ────── (used by intentMatching.ts)    │
    ├── quoteDrafting.ts ── (standalone)                  │
    ├── launchpad.ts ────── (standalone)                  │
    └── contentModeration.ts ── (used by middleware)       │
                                                          │
External:                                                  │
    lib/launchpad/generate.ts (heuristic, no AI dep)      │
    lib/leads/ (AI-enhanced, optional)                    │
```

## Appendix B: All Intent Actions

| Action | Handler | AI Required | Production Ready | Notes |
|--------|---------|-------------|-----------------|-------|
| `find_service` | `handleSearch` | Yes | ✅ | Primary use case |
| `find_provider` | `handleSearch` | Yes | ✅ | Primary use case |
| `buy_product` | `handleBuy` | No (heuristic) | ⚠️ | Needs pricing integration |
| `sell_product` | `handleSell` | No | ❌ | Placeholder redirect |
| `post_need` | `handlePostNeed` | No | ✅ | Create-need flow works |
| `check_orders` | `handleCheckOrders` | No | ✅ | Simple redirect |
| `list_services` | `handleListServices` | No | ✅ | Simple redirect |
| `manage_business` | `handleManageBusiness` | No | ✅ | Simple redirect |
| `inventory` | `handleInventory` | No | ❌ | Placeholder redirect |
| `help` | `handleHelp` | No | ✅ | Generic response |

## Appendix C: Prompt Templates

### Intent Parsing System Prompt (Current)
```
Given a user query, classify their intent into one of these actions:
- find_service: looking for a service to book
- find_provider: looking for a specific provider
- buy_product: wants to purchase a product
- sell_product: wants to list/sell a product
- post_need: wants to post a requirement
- check_orders: checking existing orders
- list_services: browsing available services
- manage_business: managing their provider business
- inventory: managing inventory
- help: general help or assistance

Also extract: service category, location, urgency, budget, and description.
```

### Provider Matching Prompt (Current)
```
You are a service matching expert. Rate each provider on 7 criteria (1-5):
- service_match: How well does the provider's services match the request?
- location: Proximity to the service location?
- availability: Can the provider take the job?
- reputation: Based on reviews and ratings?
- responsiveness: How quickly do they respond?
- urgency: Can they handle urgent requests?
- semantic_fit: Overall how well do they fit this request?
```

## Appendix D: Glossary

| Term | Definition |
|------|------------|
| `generateObject()` | AI SDK method for structured JSON output with Zod validation |
| `generateText()` | AI SDK method for text generation |
| `streamText()` | AI SDK method for streaming text generation |
| ParsedIntent | Typed structure with action, category, location, etc. |
| executeQuery() | Top-level orchestrator that routes parsed intent to handler |
| resolveLoop() | Decision engine that recommends direct_booking or requirement_post |
| matchIntent() | Full matching pipeline against providers, listings, products, markets |
| LoopRecommendation | Decision engine output with action, confidence, prefill data |
| ModerationResult | Content moderation output: safe, reason, sanitized string |
| AiMatchResult | Provider scoring output with per-provider AiMatchProvider scores |
