# ServiQ API Documentation

> Base URL: `https://www.serviqapp.com/api` (production) / `http://localhost:3000/api` (development)
> All routes are Next.js App Router handlers in `app/api/`.

## Authentication

Every authenticated endpoint requires a `Bearer <supabase_access_token>` header. Use `requireRequestAuth()` from `lib/server/requestAuth.ts`. Returns 401 if missing/invalid.

Admin endpoints require `requireAdminAuth()` which checks `ADMIN_EMAIL_ALLOWLIST` env var OR `profiles.is_admin = true`.

Cron endpoints require `x-cron-secret` header matching `CRON_SECRET` env var.

Rate-limited endpoints use `applyRateLimit()` with identity (userId or "anonymous") + route key.

---

## 1. Ab Test

### POST /api/ab-test/track
- **Auth:** Required
- **Body:** `{ experimentId: string, variant: string, event: string }`
- **Response:** `{ ok: true }`
- **Notes:** Tracks A/B test event via `lib/abTest.ts`. Uses `ab_test_events` table.

---

## 2. Account

### DELETE /api/account/delete
- **Auth:** Required
- **Body:** `{ confirmation: string }` (must equal "DELETE MY ACCOUNT")
- **Response:** `{ ok: true, message: string }`
- **Notes:** Anonymizes profile data, marks `is_suspended = true`. Does NOT delete auth user (Supabase limitation). Sends confirmation email.

---

## 3. Admin

### GET /api/admin/analytics (admin/stats)
- **Auth:** Admin required
- **Response:** `{ ok: true, data: { totalUsers, totalProviders, totalOrders, totalRevenue, activeListings, ... } }`
- **Notes:** Uses `get_platform_startup_diagnostics()` RPC and aggregation queries.

### GET /api/admin/users
- **Auth:** Admin required
- **Query:** `?page=1&limit=50&search=&role=&status=`
- **Response:** `{ ok: true, users: ProfileRow[], total: number, page: number, limit: number }`

### PUT /api/admin/users
- **Auth:** Admin required
- **Body:** `{ userId: string, action: "suspend" | "unsuspend" | "make_admin" | "remove_admin" }`
- **Response:** `{ ok: true }`

### GET /api/admin/orders
- **Auth:** Admin required
- **Query:** `?status=&page=1&limit=50`
- **Response:** `{ ok: true, orders: OrderRow[], total: number }`

### GET /api/admin/payouts
- **Auth:** Admin required
- **Response:** `{ ok: true, payouts: PayoutRow[] }`

### POST /api/admin/payouts
- **Auth:** Admin required
- **Body:** `{ payoutId: string, action: "approve" | "reject" }`
- **Response:** `{ ok: true }`

### POST /api/admin/batch-payouts
- **Auth:** Admin required
- **Body:** `{ payoutIds: string[] }`
- **Response:** `{ ok: true, processed: number, failed: number }`

### GET /api/admin/reports
- **Auth:** Admin required
- **Response:** `{ ok: true, reports: ReportRow[] }`

### GET /api/admin/system
- **Auth:** Admin required
- **Response:** `{ ok: true, system: { dbSize, lastMigration, uptime, ... } }`

### GET /api/admin/promo-codes
- **Auth:** Admin required
- **Response:** `{ ok: true, codes: PromoCodeRow[] }`

### POST /api/admin/promo-codes
- **Auth:** Admin required
- **Body:** `{ code: string, discountPercent: number, maxUses: number, expiresAt: string }`
- **Response:** `{ ok: true, id: string }`

### GET /api/admin/verifications
- **Auth:** Admin required
- **Response:** `{ ok: true, verifications: VerificationRow[] }`

### POST /api/admin/verifications
- **Auth:** Admin required
- **Body:** `{ verificationId: string, action: "approve" | "reject", reason?: string }`
- **Response:** `{ ok: true }`

### GET /api/admin/feature-flags
- **Auth:** Admin required
- **Response:** `{ ok: true, flags: FeatureFlagRow[] }`

### POST /api/admin/feature-flags
- **Auth:** Admin required
- **Body:** `{ key: string, enabled: boolean, description?: string }`
- **Response:** `{ ok: true }`

### GET /api/admin/listings
- **Auth:** Admin required
- **Query:** `?page=1&limit=50&status=`
- **Response:** `{ ok: true, listings: ListingRow[], total: number }`

### POST /api/admin/disputes
- **Auth:** Admin required
- **Body:** `{ disputeId: string, action: "resolve" | "escalate", resolution?: string }`
- **Response:** `{ ok: true }`

---

## 4. AI

### POST /api/ai/prompt
- **Auth:** Required (or rate-limited anonymous)
- **Body:** `{ query: string, userId?: string, location?: string, lat?: number, lng?: number, localityId?: string }`
- **Response:** `{ ok: true, response: string, intent: ParsedIntent, matches: IntentMatchItem[], suggestions: string[], redirect?: string }`
- **Notes:** Main AI endpoint. Parses intent via Gemini, matches providers/listings/products/markets, returns ranked results. Uses `lib/ai/orchestrator.ts` + `lib/ai/intentMatching.ts`. Rate-limited: 10 req/min for authenticated, 5 for anonymous.

### POST /api/ai/prompt/stream
- **Auth:** Required (or rate-limited anonymous)
- **Body:** Same as /api/ai/prompt
- **Response:** SSE stream with `data: { chunk }` events, ending with `data: [DONE]`
- **Notes:** Streaming variant using Vercel AI SDK `streamText`. Uses `getModel()` from `lib/ai/provider.ts` (Gemini 2.0 Flash).

### POST /api/ai/intent
- **Auth:** Required
- **Body:** `{ query: string, lat?: number, lng?: number, localityId?: string }`
- **Response:** `{ ok: true, intentId: string, parsed: ParsedIntent, matches: IntentMatchItem[], responseText: string }`
- **Notes:** Records intent to `intent_logs` and matches to `intent_matches`.

### GET /api/ai/intent/[id]/matches
- **Auth:** Required
- **Response:** `{ ok: true, matches: IntentMatchItem[] }`

### POST /api/ai/intent/[id]/feedback
- **Auth:** Required
- **Body:** `{ matchId: string, feedback: "helpful" | "not_helpful" | "clicked" }`
- **Response:** `{ ok: true }`
- **Notes:** Records to `intent_feedback` table.

### POST /api/ai/intent/[id]/create-need
- **Auth:** Required
- **Body:** `{ title: string, description: string, category?: string, urgency?: string }`
- **Response:** `{ ok: true, postId: string }`

### POST /api/ai/moderate
- **Auth:** Required
- **Body:** `{ content: string, strictness?: "strict" | "relaxed" }`
- **Response:** `{ ok: true, safe: boolean, reason?: string, sanitized?: string }`
- **Notes:** Uses `lib/ai/contentModeration.ts` for profanity/PII filtering.

---

## 5. App

### GET /api/app/config
- **Auth:** None (public)
- **Response:** `{ ok: true, config: { minAppVersion: number, forceUpdate: boolean, features: Record<string, boolean> } }`
- **Notes:** Mobile app config endpoint. Returns feature flags and minimum version.

### GET /api/app/version-check
- **Auth:** None (public)
- **Query:** `?platform=ios|android&version=100`
- **Response:** `{ ok: true, updateAvailable: boolean, forceUpdate: boolean, version: number }`

---

## 6. Auth

### POST /api/auth/send-link
- **Auth:** None
- **Body:** `{ email: string }`
- **Response:** `{ ok: true, message: string }`
- **Notes:** Sends magic link via Supabase GoTrue. Rate-limited: 5 req/min per email.

### GET /api/auth/verify-link
- **Auth:** None (token in query)
- **Query:** `?token=xxx&type=magiclink`
- **Response:** Redirects to `/dashboard` with session cookie set.
- **Notes:** Verifies magic link token, creates session, sets Supabase auth cookie.

### GET /api/auth/google
- **Auth:** None
- **Response:** Redirects to Google OAuth consent screen.
- **Notes:** Initiates Google OAuth flow via Supabase.

### GET /api/auth/google/callback
- **Auth:** None (OAuth callback)
- **Query:** `?code=xxx&state=xxx`
- **Response:** Redirects to `/dashboard` with session cookie set.
- **Notes:** Handles Google OAuth callback, creates/links user, sets session.

---

## 7. Block

### POST /api/block
- **Auth:** Required
- **Body:** `{ targetUserId: string }`
- **Response:** `{ ok: true }`
- **Notes:** Blocks a user. Creates row in `blocked_users` table. Prevents chat, connection requests, and profile visibility between blocked users.

### DELETE /api/block
- **Auth:** Required
- **Body:** `{ targetUserId: string }`
- **Response:** `{ ok: true }`

---

## 8. Bookings

### GET /api/provider/bookings
- **Auth:** Required (provider)
- **Query:** `?status=confirmed|completed|cancelled&date=2026-08-15`
- **Response:** `{ ok: true, bookings: BookingRow[] }`

### POST /api/bookings/[id]/reschedule
- **Auth:** Required
- **Body:** `{ newDate: string, newTime: string, reason?: string }`
- **Response:** `{ ok: true }`
- **Notes:** Updates booking slot. Uses `booking_slots` table.

---

## 9. Campaigns

### GET /api/campaigns
- **Auth:** Admin required
- **Response:** `{ ok: true, campaigns: CampaignRow[] }`

### POST /api/campaigns
- **Auth:** Admin required
- **Body:** `{ name: string, type: string, targetAudience: object, content: string, scheduledAt?: string }`
- **Response:** `{ ok: true, id: string }`

### POST /api/campaigns/process
- **Auth:** Cron required
- **Response:** `{ ok: true, processed: number }`
- **Notes:** Processes pending campaign deliveries.

---

## 10. Cart

### GET /api/cart
- **Auth:** Required
- **Response:** `{ ok: true, items: CartItem[], total: number }`

### POST /api/cart
- **Auth:** Required
- **Body:** `{ productId: string, quantity: number }` or `{ serviceId: string }`
- **Response:** `{ ok: true }`
- **Notes:** Uses `cart_items` table with Supabase sync.

---

## 11. Chat

### POST /api/chat/direct
- **Auth:** Required
- **Body:** `{ recipientId: string }`
- **Response:** `{ ok: true, conversationId: string, isNew: boolean }`
- **Notes:** Gets or creates direct conversation. Uses `make_direct_conversation_key()` for dedup. Creates `conversations` + `conversation_participants` rows.

### GET /api/chat/messages
- **Auth:** Required
- **Query:** `?conversationId=xxx&limit=50&before=message_id`
- **Response:** `{ ok: true, messages: MessageRow[], hasMore: boolean }`
- **Notes:** Paginated message fetch. Checks `is_conversation_participant()`.

### POST /api/chat/messages
- **Auth:** Required
- **Body:** `{ conversationId: string, content: string, metadata?: { imageUrl?: string } }`
- **Response:** `{ ok: true, message: MessageRow }`
- **Notes:** Inserts message, updates `conversation_participants.last_read_at` for sender. Content moderation applied.

---

## 12. Community

### GET /api/community/feed
- **Auth:** Required
- **Query:** `?page=1&limit=20&category=&localityId=`
- **Response:** `{ ok: true, feedItems: FeedItem[], profiles: ProfileRecord[], hasMore: boolean }`

### GET /api/community/people
- **Auth:** Required
- **Query:** `?page=1&limit=20&role=provider|seeker&localityId=`
- **Response:** `{ ok: true, profiles: ProfileRecord[], profilePreviewById: Record<string, CommunityProfilePreview>, hasMore: boolean }`

### GET /api/community/providers-by-category
- **Auth:** None (public)
- **Query:** `?category=plumbing&localityId=xxx&limit=20`
- **Response:** `{ ok: true, providers: ProviderRow[] }`
- **Notes:** Filters out `is_test` accounts.

---

## 13. Connections

### GET /api/connections
- **Auth:** Required
- **Response:** `{ ok: true, connections: ConnectionRequestRow[] }`

### POST /api/connections
- **Auth:** Required
- **Body:** `{ recipientId: string, message?: string }`
- **Response:** `{ ok: true, requestId: string }`
- **Notes:** Uses `send_connection_request()` RPC. Creates notification for recipient.

### POST /api/connections/[requestId]
- **Auth:** Required
- **Body:** `{ action: "accept" | "reject" | "cancel" }`
- **Response:** `{ ok: true }`
- **Notes:** Uses `respond_to_connection_request()` RPC.

---

## 14. Consumer

### GET /api/consumer/transactions
- **Auth:** Required
- **Query:** `?page=1&limit=20`
- **Response:** `{ ok: true, transactions: TransactionRow[], total: number }`

---

## 15. Cron

All cron endpoints require `x-cron-secret` header.

### POST /api/cron/cleanup
- **Cron:** Required
- **Response:** `{ ok: true, cleaned: number }`
- **Notes:** Calls `cleanup_expired_rate_limits()` + `cleanup_expired_otps()`.

### POST /api/cron/cleanup-jobs
- **Cron:** Required
- **Response:** `{ ok: true, cleaned: number }`
- **Notes:** Removes completed/failed background jobs older than 7 days.

### POST /api/cron/process-jobs
- **Cron:** Required
- **Response:** `{ ok: true, processed: number, failed: number }`
- **Notes:** Processes pending background jobs via `lib/server/backgroundJobs.ts`. Atomic claim + exponential backoff.

### POST /api/cron/weekly-digest
- **Cron:** Required
- **Response:** `{ ok: true, sent: number }`
- **Notes:** Sends weekly digest emails to active users.

### POST /api/cron/expire-quotes
- **Cron:** Required
- **Response:** `{ ok: true, expired: number }`
- **Notes:** Expires quotes older than 7 days.

### POST /api/cron/review-reminders
- **Cron:** Required
- **Response:** `{ ok: true, sent: number }`
- **Notes:** Sends review reminder notifications for completed orders without reviews.

### POST /api/cron/abandoned-requests
- **Cron:** Required
- **Response:** `{ ok: true, processed: number }`
- **Notes:** Follows up on help requests with no provider response.

### POST /api/cron/reactivation
- **Cron:** Required
- **Response:** `{ ok: true, sent: number }`
- **Notes:** Re-engagement emails for inactive users.

### POST /api/cron/auto-payouts
- **Cron:** Required
- **Response:** `{ ok: true, processed: number }`
- **Notes:** Auto-processes pending payouts.

---

## 16. Disputes

### GET /api/disputes
- **Auth:** Required
- **Response:** `{ ok: true, disputes: DisputeRow[] }`

### POST /api/disputes
- **Auth:** Required
- **Body:** `{ orderId: string, reason: string, description: string }`
- **Response:** `{ ok: true, disputeId: string }`
- **Notes:** Creates dispute against an order. Triggers notification to admin.

---

## 17. Escalations

### POST /api/escalations/process
- **Auth:** Cron required
- **Response:** `{ ok: true, processed: number }`
- **Notes:** Processes pending escalations (auto-escalate stale orders).

---

## 18. Feature Flags

### GET /api/feature-flags/check
- **Auth:** Required
- **Query:** `?key=flag_name`
- **Response:** `{ ok: true, enabled: boolean }`
- **Notes:** Checks feature flag with optional user override via `lib/feature-flags/server.ts`.

---

## 19. Feed Card Interactions

### POST /api/feed-card-interactions
- **Auth:** Required
- **Body:** `{ cardId: string, interaction: "like" | "share" | "comment" }`
- **Response:** `{ ok: true }`

---

## 20. Feed Card Saves

### POST /api/feed-card-saves
- **Auth:** Required
- **Body:** `{ cardId: string }` or `{ cardId: string, action: "save" | "unsave" }`
- **Response:** `{ ok: true, saved: boolean }`

---

## 21. Google

### POST /api/google/sync
- **Auth:** Required
- **Body:** `{ providerId: string }`
- **Response:** `{ ok: true, synced: number }`
- **Notes:** Syncs Google Business reviews to `reviews` table. Uses `google_business_tokens` for OAuth.

---

## 22. Health

### GET /api/health
- **Auth:** None (public)
- **Response:** `{ ok: true, status: "healthy", timestamp: string, version: string }`
- **Notes:** Used by uptime monitoring. Returns 200 when healthy.

---

## 23. Help Requests

### GET /api/help-requests/[id]/top-matches
- **Auth:** Required
- **Response:** `{ ok: true, matches: MatchRow[] }`
- **Notes:** Returns top-matched providers for a help request.

### GET /api/tasks/help-requests
- **Auth:** Required
- **Query:** `?status=open|matched|accepted|in_progress|completed|cancelled`
- **Response:** `{ ok: true, requests: HelpRequestRow[] }`

---

## 24. Invoices

### GET /api/invoices
- **Auth:** Required
- **Query:** `?orderId=xxx`
- **Response:** `{ ok: true, invoices: InvoiceRow[] }`

### POST /api/invoices/generate
- **Auth:** Required
- **Body:** `{ orderId: string }`
- **Response:** `{ ok: true, invoiceId: string }`

### GET /api/invoices/list
- **Auth:** Required
- **Query:** `?page=1&limit=20`
- **Response:** `{ ok: true, invoices: InvoiceRow[], total: number }`

---

## 25. Launchpad

### GET /api/launchpad/draft
- **Auth:** Required
- **Response:** `{ ok: true, draft: LaunchpadDraft | null }`

### POST /api/launchpad/generate
- **Auth:** Required
- **Body:** `{ businessDescription: string, services: string[] }`
- **Response:** `{ ok: true, draft: LaunchpadDraft }`
- **Notes:** Uses AI to generate provider listing draft.

### POST /api/launchpad/publish
- **Auth:** Required
- **Body:** `{ draftId: string, listings: ListingData[] }`
- **Response:** `{ ok: true, published: number }`

---

## 26. Leads

### GET /api/leads/score
- **Auth:** Required
- **Query:** `?helpRequestId=xxx`
- **Response:** `{ ok: true, scores: LeadScoreBreakdown[] }`
- **Notes:** Scores providers for a help request using `lib/leads/scoring.ts`. 6-input formula: categoryFit (20%), distance (20%), availability (10%), responsiveness (10%), trust (20%), experience (20%).

### POST /api/leads/ai-match
- **Auth:** Required
- **Body:** `{ helpRequestId: string, query: string }`
- **Response:** `{ ok: true, matches: AiMatchResult[] }`
- **Notes:** AI-enhanced matching using Gemini for semantic understanding.

### GET /api/leads/status
- **Auth:** Required
- **Query:** `?helpRequestId=xxx`
- **Response:** `{ ok: true, status: string, matchedProviders: number }`

---

## 27. Live Talk

### POST /api/live-talk
- **Auth:** Required
- **Body:** `{ action: "start" | "end", conversationId: string }`
- **Response:** `{ ok: true }`
- **Notes:** **Disabled at compile time.** Live Talk feature is not active. Route exists but returns 501.

---

## 28. Localities

### GET /api/localities
- **Auth:** None (public)
- **Query:** `?city=delhi&limit=50`
- **Response:** `{ ok: true, localities: LocalityRow[] }`

### GET /api/localities/[id]/providers
- **Auth:** None (public)
- **Query:** `?page=1&limit=20`
- **Response:** `{ ok: true, providers: ProviderRow[] }`

---

## 29. Market

### GET /api/market/[slug]
- **Auth:** None (public)
- **Response:** `{ ok: true, market: MarketData }`
- **Notes:** Public market page data (locality info, providers, stats).

### GET /api/market/zones
- **Auth:** None (public)
- **Response:** `{ ok: true, zones: ZoneRow[] }`

### GET /api/market/demand-forecast
- **Auth:** Admin required
- **Query:** `?localityId=xxx&days=30`
- **Response:** `{ ok: true, forecast: ForecastData }`

---

## 30. Mobile

### GET /api/mobile/account
- **Auth:** Required
- **Response:** `{ ok: true, profile: ProfileRow, settings: UserSettings }`
- **Notes:** Mobile-specific account endpoint with combined profile + settings.

---

## 31. Needs

### POST /api/needs/publish
- **Auth:** Required
- **Body:** `{ title: string, description: string, category: string, urgency?: string, budget?: number, location?: string, lat?: number, lng?: number, localityId?: string }`
- **Response:** `{ ok: true, postId: string }`
- **Notes:** Creates help request + post. Triggers provider matching.

### POST /api/needs/express-interest
- **Auth:** Required (provider)
- **Body:** `{ helpRequestId: string, message?: string }`
- **Response:** `{ ok: true }`
- **Notes:** Provider expresses interest in a help request. Creates `help_request_matches` row.

### POST /api/needs/withdraw-interest
- **Auth:** Required
- **Body:** `{ helpRequestId: string }`
- **Response:** `{ ok: true }`

### POST /api/needs/accept
- **Auth:** Required (consumer)
- **Body:** `{ helpRequestId: string, providerId: string }`
- **Response:** `{ ok: true, orderId: string }`
- **Notes:** Consumer accepts a provider. Creates order + transitions help request to `accepted`.

### POST /api/needs/status
- **Auth:** Required
- **Body:** `{ helpRequestId: string, status: string }`
- **Response:** `{ ok: true }`
- **Notes:** Uses `transition_help_request_status()` RPC.

### POST /api/needs/reopen
- **Auth:** Required
- **Body:** `{ helpRequestId: string }`
- **Response:** `{ ok: true }`

---

## 32. Notifications

### GET /api/notifications/subscribe
- **Auth:** Required
- **Body:** `{ endpoint: string, p256dh: string, auth: string, fcmToken?: string }`
- **Response:** `{ ok: true }`
- **Notes:** Registers push subscription in `provider_push_subscriptions`.

### POST /api/notifications/send-push
- **Auth:** Required
- **Body:** `{ userId: string, title: string, body: string, data?: object }`
- **Response:** `{ ok: true, sent: number }`
- **Notes:** Sends push to specific user via FCM + web-push.

### POST /api/notifications/sms
- **Auth:** Required
- **Body:** `{ to: string, message: string }`
- **Response:** `{ ok: true, sid?: string }`
- **Notes:** Sends SMS via Twilio. Rate-limited.

### GET /api/notifications/read (implicit)
- **Auth:** Required
- **Notes:** Marking notifications read is done via direct Supabase update on `notifications` table (RLS own-user).

### GET /api/notifications/unread-count (implicit)
- **Auth:** Required
- **Notes:** Client-side count via Supabase realtime subscription on `notifications` table.

---

## 33. Observability

### POST /api/observability
- **Auth:** None (but accepts optional Bearer)
- **Body:** `{ event_type: string, route: string, metric?: string, value?: number, message?: string, context?: object }`
- **Response:** `{ ok: true }`
- **Notes:** Client telemetry endpoint. Stores in `observability_events` table.

---

## 34. Orders

### GET /api/orders
- **Auth:** Required
- **Query:** `?status=&page=1&limit=20&role=consumer|provider`
- **Response:** `{ ok: true, orders: OrderRow[], total: number }`

### GET /api/orders/[id]
- **Auth:** Required
- **Response:** `{ ok: true, order: OrderRow, events: TaskEventRow[] }`
- **Notes:** Single order with full event audit trail.

### PUT /api/orders/[id]
- **Auth:** Required
- **Body:** `{ status: string, note?: string }`
- **Response:** `{ ok: true }`
- **Notes:** Transitions order status. Validates against `transitionMap` in `lib/orderWorkflow.ts`. **Idempotency guard**: double-refund prevention on cancellation.

### POST /api/orders/[id]/status
- **Auth:** Required
- **Body:** `{ status: string, note?: string }`
- **Response:** `{ ok: true }`
- **Notes:** Same as PUT but POST method. Used by mobile.

### POST /api/orders/[id]/book-slot
- **Auth:** Required
- **Body:** `{ date: string, time: string }`
- **Response:** `{ ok: true, slotId: string }`

### POST /api/orders/[id]/delivery
- **Auth:** Required
- **Body:** `{ status: "in_transit" | "delivered", photos?: string[] }`
- **Response:** `{ ok: true }`

### POST /api/orders/[id]/delivery/photos
- **Auth:** Required
- **Body:** `{ photos: File[] }`
- **Response:** `{ ok: true, urls: string[] }`

### POST /api/orders/[id]/retry-payment
- **Auth:** Required
- **Response:** `{ ok: true, paymentUrl: string }`

### POST /api/orders/calculate-commission
- **Auth:** Required
- **Body:** `{ orderId: string }`
- **Response:** `{ ok: true, commission: number, providerPayout: number }`
- **Notes:** Calculates ServiQ platform commission.

---

## 35. Payment

### POST /api/payment/create-order
- **Auth:** Required
- **Body:** `{ amount: number, orderId: string, currency?: "INR" }`
- **Response:** `{ ok: true, razorpayOrderId: string, amount: number, keyId: string }`
- **Notes:** Creates Razorpay order. Amount in paise.

### POST /api/payment/verify
- **Auth:** Required
- **Body:** `{ razorpay_order_id: string, razorpay_payment_id: string, razorpay_signature: string, orderId: string }`
- **Response:** `{ ok: true }`
- **Notes:** **HMAC timing-safe verification** of Razorpay signature. Updates order to `paid`. Creates `payments` row.

### POST /api/payment/release-funds
- **Auth:** Required
- **Body:** `{ orderId: string }`
- **Response:** `{ ok: true, payoutId: string }`
- **Notes:** Releases escrowed funds to provider. Creates payout record.

---

## 36. Posts

### POST /api/posts/publish
- **Auth:** Required
- **Body:** `{ title: string, text: string, category?: string, mediaUrls?: string[], metadata?: object }`
- **Response:** `{ ok: true, postId: string }`

### PUT /api/posts/manage
- **Auth:** Required
- **Body:** `{ postId: string, action: "edit" | "delete" | "archive" }`
- **Response:** `{ ok: true }`

### PUT /api/posts/status
- **Auth:** Required
- **Body:** `{ postId: string, status: string }`
- **Response:** `{ ok: true }`
- **Notes:** Uses `transition_post_status()` RPC.

---

## 37. Presence

### POST /api/presence/ping
- **Auth:** Required
- **Body:** `{ isOnline: boolean, status?: string, listingScore?: number }`
- **Response:** `{ ok: true }`
- **Notes:** Uses `upsert_provider_presence()` RPC. Updates `provider_presence` table.

---

## 38. Profile

### GET /api/profile/me
- **Auth:** Required
- **Response:** `{ ok: true, profile: ProfileRow, completion: ProfileCompletionBreakdown, completionPercent: number }`
- **Notes:** Full profile with marketplace bundle (services, products, portfolio, trust score, reviews, etc.)

### PUT /api/profile/save
- **Auth:** Required
- **Body:** `{ fullName?: string, headline?: string, bio?: string, location?: string, latitude?: number, longitude?: number, localityId?: string, services?: string[], ... }`
- **Response:** `{ ok: true }`
- **Notes:** Updates profile fields. Name normalization applied.

### POST /api/profile/avatar
- **Auth:** Required
- **Body:** `{ avatarUrl: string }`
- **Response:** `{ ok: true }`

### GET /api/profile/public
- **Auth:** None (public)
- **Query:** `?userId=xxx`
- **Response:** `{ ok: true, profile: ProfileRow, services: ServiceRow[], products: ProductRow[], reviews: ReviewRow[] }`
- **Notes:** Public provider profile. Filters `is_test` accounts.

### GET /api/profile/review
- **Auth:** Required
- **Query:** `?providerId=xxx`
- **Response:** `{ ok: true, reviews: ReviewRow[] }`

### PUT /api/profile/payment-preference
- **Auth:** Required
- **Body:** `{ preferredMethod: string }`
- **Response:** `{ ok: true }`

---

## 39. Promo

### POST /api/promo/validate
- **Auth:** Required
- **Body:** `{ code: string, orderAmount: number }`
- **Response:** `{ ok: true, discount: number, finalAmount: number }`

---

## 40. Provider

### GET /api/provider/analytics
- **Auth:** Required (provider)
- **Response:** `{ ok: true, analytics: { views, inquiries, conversions, revenue, rating, ... } }`

### GET /api/provider/availability
- **Auth:** Required (provider)
- **Response:** `{ ok: true, availability: AvailabilityRow[] }`

### PUT /api/provider/availability
- **Auth:** Required (provider)
- **Body:** `{ slots: AvailabilitySlot[] }`
- **Response:** `{ ok: true }`

### GET /api/provider/availability/exceptions
- **Auth:** Required (provider)
- **Response:** `{ ok: true, exceptions: ExceptionRow[] }`

### POST /api/provider/availability/exceptions
- **Auth:** Required (provider)
- **Body:** `{ date: string, isAvailable: boolean, reason?: string }`
- **Response:** `{ ok: true }`

### GET /api/provider/bank-accounts
- **Auth:** Required (provider)
- **Response:** `{ ok: true, accounts: BankAccountRow[] }`

### POST /api/provider/bank-accounts
- **Auth:** Required (provider)
- **Body:** `{ bankName: string, accountNumber: string, ifscCode: string, accountHolderName: string }`
- **Response:** `{ ok: true, id: string }`

### PUT /api/provider/bank-accounts/[id]
- **Auth:** Required (provider)
- **Body:** `{ action: "set_default" | "delete" }`
- **Response:** `{ ok: true }`

### GET /api/provider/boosts
- **Auth:** Required (provider)
- **Response:** `{ ok: true, boosts: BoostRow[] }`

### POST /api/provider/boosts
- **Auth:** Required (provider)
- **Body:** `{ listingId: string, plan: "featured" | "premium", durationDays: number }`
- **Response:** `{ ok: true, orderId: string }`

### POST /api/provider/boosts/verify
- **Auth:** Required
- **Body:** `{ boostOrderId: string, razorpayPaymentId: string, razorpaySignature: string }`
- **Response:** `{ ok: true }`

### GET /api/provider/listings
- **Auth:** Required (provider)
- **Response:** `{ ok: true, listings: ListingRow[] }`

### POST /api/provider/listings
- **Auth:** Required (provider)
- **Body:** `{ title: string, description: string, category: string, price?: number, pricingType?: string, serviceType?: string, mediaUrls?: string[] }`
- **Response:** `{ ok: true, listingId: string }`

### GET /api/provider/listing-score
- **Auth:** Required (provider)
- **Query:** `?listingId=xxx`
- **Response:** `{ ok: true, score: number, breakdown: object }`

### GET /api/provider/payouts
- **Auth:** Required (provider)
- **Response:** `{ ok: true, payouts: PayoutRow[], totalPending: number, totalPaid: number }`

### GET /api/provider/pricing-insights
- **Auth:** Required (provider)
- **Query:** `?category=plumbing`
- **Response:** `{ ok: true, insights: { medianPrice, percentileRank, ... } }`
- **Notes:** Uses Gemini for pricing analysis.

---

## 41. Providers

### GET /api/providers/[id]/profile
- **Auth:** None (public)
- **Response:** `{ ok: true, profile: MarketplaceProfileBundle }`
- **Notes:** Full public provider profile with all sections.

### POST /api/providers/onboard-locality
- **Auth:** Required
- **Body:** `{ localityId: string, lat: number, lng: number }`
- **Response:** `{ ok: true }`

### GET /api/providers/nearby (implicit via locality endpoints)
- **Notes:** Uses `providers_near_locality()` RPC.

### GET /api/providers/by-category
- **Auth:** None (public)
- **Query:** `?category=plumbing&localityId=xxx&limit=20`
- **Response:** `{ ok: true, providers: ProviderRow[] }`

---

## 42. Public

### GET /api/public/marketplace-stats
- **Auth:** None (public)
- **Response:** `{ ok: true, stats: { totalProviders, totalOrders, averageRating, ... } }`

### GET /api/public/featured-reviews
- **Auth:** None (public)
- **Response:** `{ ok: true, reviews: ReviewRow[] }`

---

## 43. Push

### POST /api/push/subscribe
- **Auth:** Required
- **Body:** `{ endpoint: string, p256dh: string, auth: string, fcmToken?: string }`
- **Response:** `{ ok: true }`
- **Notes:** Same as notifications/subscribe. Stores in `provider_push_subscriptions`.

---

## 44. Quotes

### POST /api/quotes/send
- **Auth:** Required (provider)
- **Body:** `{ helpRequestId: string, amount: number, description: string, validUntil?: string, attachments?: string[] }`
- **Response:** `{ ok: true, quoteId: string }`
- **Notes:** Creates quote. AI can draft via `/api/quotes/draft`.

### GET /api/quotes/for-request
- **Auth:** Required
- **Query:** `?helpRequestId=xxx`
- **Response:** `{ ok: true, quotes: QuoteRow[] }`

### POST /api/quotes/[quoteId]/accept
- **Auth:** Required (consumer)
- **Response:** `{ ok: true, orderId: string }`
- **Notes:** Accepts quote, creates order, triggers payment flow.

### POST /api/quotes/reject
- **Auth:** Required
- **Body:** `{ quoteId: string, reason?: string }`
- **Response:** `{ ok: true }`

### POST /api/quotes/draft
- **Auth:** Required (provider)
- **Body:** `{ helpRequestId: string }`
- **Response:** `{ ok: true, draft: { amount: number, description: string } }`
- **Notes:** AI-drafted quote using Gemini. Uses `lib/ai/quoteDrafting.ts`.

### GET /api/quotes/catalog
- **Auth:** Required (provider)
- **Response:** `{ ok: true, catalog: QuoteTemplateRow[] }`

### GET /api/quotes/deal-room
- **Auth:** Required
- **Query:** `?orderId=xxx`
- **Response:** `{ ok: true, deal: DealRoomData }`

### POST /api/quotes/attachments
- **Auth:** Required
- **Body:** `{ quoteId: string, mediaUrls: string[] }`
- **Response:** `{ ok: true }`

---

## 45. Referrals

### GET /api/referrals
- **Auth:** Required
- **Response:** `{ ok: true, referralCode: string, referralCount: number, earnings: number }`

### GET /api/referrals/leaderboard
- **Auth:** Required
- **Response:** `{ ok: true, leaderboard: LeaderboardRow[] }`

### GET /api/referrals/milestones
- **Auth:** Required
- **Response:** `{ ok: true, milestones: MilestoneRow[] }`

### POST /api/referrals/payout
- **Auth:** Required
- **Body:** `{ amount: number }`
- **Response:** `{ ok: true, payoutId: string }`

---

## 46. Reports

### POST /api/reports
- **Auth:** Required
- **Body:** `{ entityType: string, entityId: string, reason: string, description?: string }`
- **Response:** `{ ok: true, reportId: string }`
- **Notes:** Content moderation report. Triggers admin notification.

---

## 47. Review Requests

### POST /api/review-requests
- **Auth:** Required
- **Body:** `{ orderId: string, providerId: string }`
- **Response:** `{ ok: true }`
- **Notes:** Sends review request notification to consumer.

---

## 48. Reviews

### GET /api/reviews/by-provider
- **Auth:** None (public)
- **Query:** `?providerId=xxx&page=1&limit=20`
- **Response:** `{ ok: true, reviews: ReviewRow[], averageRating: number, total: number }`

### POST /api/reviews/[id]/vote
- **Auth:** Required
- **Body:** `{ vote: "helpful" | "not_helpful" }`
- **Response:** `{ ok: true }`

### GET /api/reviews/[id]/vote/status
- **Auth:** Required
- **Response:** `{ ok: true, vote: "helpful" | "not_helpful" | null }`

### POST /api/reviews/[id]/photos
- **Auth:** Required
- **Body:** `{ photos: string[] }`
- **Response:** `{ ok: true }`

---

## 49. Service Categories

### GET /api/service-categories
- **Auth:** None (public)
- **Response:** `{ ok: true, categories: CategoryRow[] }`
- **Notes:** Returns all service categories with synonyms for FTS matching.

---

## 50. Subscriptions

### GET /api/subscriptions/plans
- **Auth:** None (public)
- **Response:** `{ ok: true, plans: SubscriptionPlanRow[] }`

### GET /api/subscriptions/current
- **Auth:** Required
- **Response:** `{ ok: true, subscription: SubscriptionRow | null }`

### POST /api/subscriptions/create-order
- **Auth:** Required
- **Body:** `{ planId: string }`
- **Response:** `{ ok: true, razorpayOrderId: string, amount: number }`

### POST /api/subscriptions/verify
- **Auth:** Required
- **Body:** `{ razorpayOrderId: string, razorpayPaymentId: string, razorpaySignature: string, planId: string }`
- **Response:** `{ ok: true }`

### GET /api/subscriptions/guard
- **Auth:** Required
- **Response:** `{ ok: true, hasActiveSubscription: boolean, features: string[] }`
- **Notes:** Checks if user has active subscription for gated features.

---

## 51. System

### GET /api/system/startup-check
- **Auth:** None (public)
- **Response:** `{ ok: true, checks: { database: boolean, storage: boolean, auth: boolean, ... } }`

---

## 52. Tasks

### GET /api/tasks/help-requests
- **Auth:** Required
- **Query:** `?status=open|matched|accepted|in_progress|completed|cancelled&role=consumer|provider`
- **Response:** `{ ok: true, tasks: Task[] }`
- **Notes:** Unified task view combining help requests + orders + posts.

### POST /api/tasks/progress
- **Auth:** Required
- **Body:** `{ orderId: string, progressStage: "accepted" | "travel_started" | "work_started" | "completed" }`
- **Response:** `{ ok: true }`
- **Notes:** Updates progress tracker stage in order metadata.

### POST /api/tasks/review
- **Auth:** Required
- **Body:** `{ orderId: string, rating: number, comment?: string }`
- **Response:** `{ ok: true, reviewId: string }`
- **Notes:** Creates review for completed order.

---

## 53. Upload

### POST /api/upload/chat-media
- **Auth:** Required
- **Body:** FormData with `file` field
- **Response:** `{ ok: true, url: string }`
- **Notes:** Uploads to `chat-media` bucket. Max 5MB. Content-type validated.

### POST /api/upload/listing-image
- **Auth:** Required
- **Body:** FormData with `file` field
- **Response:** `{ ok: true, url: string }`
- **Notes:** Uploads to `listing-images` bucket.

### POST /api/upload/post-media
- **Auth:** Required
- **Body:** FormData with `file` field
- **Response:** `{ ok: true, url: string }`
- **Notes:** Uploads to `post-media` bucket. Max 25MB.

### POST /api/upload/quote-media
- **Auth:** Required
- **Body:** FormData with `file` field
- **Response:** `{ ok: true, url: string }`
- **Notes:** Uploads to `review-photos` bucket (shared). Max 10MB.

---

## 54. User Settings

### GET /api/user-settings
- **Auth:** Required
- **Response:** `{ ok: true, settings: UserSettingsRow }`

### PUT /api/user-settings
- **Auth:** Required
- **Body:** `{ pushNotifications?: boolean, emailNotifications?: boolean, whatsappNotifications?: boolean, ... }`
- **Response:** `{ ok: true }`
- **Notes:** Uses `user_settings` table. UPSERT pattern.

---

## 55. Verification

### GET /api/verification/status
- **Auth:** Required
- **Response:** `{ ok: true, verification: { level: string, documents: DocumentRow[], ... } }`

### POST /api/verification/submit
- **Auth:** Required
- **Body:** `{ type: "email" | "phone" | "identity" | "business", documentUrl?: string, ... }`
- **Response:** `{ ok: true, verificationId: string }`

### GET /api/verification/documents
- **Auth:** Required
- **Response:** `{ ok: true, documents: DocumentRow[] }`

### POST /api/verification/kyc
- **Auth:** Required
- **Body:** `{ documentType: string, documentNumber: string, documentUrl: string }`
- **Response:** `{ ok: true }`
- **Notes:** Uses `lib/kyc/` for document verification (mock in dev).

---

## 56. Webhooks

### POST /api/webhooks/razorpay
- **Auth:** Razorpay HMAC signature verification
- **Body:** Razorpay webhook event payload
- **Response:** `{ ok: true }`
- **Notes:** Handles `payment.captured`, `payment.failed`, `subscription.activated`, `subscription.deactivated`. HMAC timing-safe signature verification. Creates background jobs for async processing.

---

## 57. Widgets

### GET /api/widgets
- **Auth:** Required
- **Response:** `{ ok: true, widgets: WidgetRow[] }`

### POST /api/widgets
- **Auth:** Required
- **Body:** `{ type: string, config: object }`
- **Response:** `{ ok: true, widgetId: string }`

### GET /api/widgets/[id]/public
- **Auth:** None (public)
- **Response:** `{ ok: true, widget: WidgetData }`
- **Notes:** Embeddable widget data for external sites.

---

## 58. Workspaces

### GET /api/workspaces
- **Auth:** Required
- **Response:** `{ ok: true, workspaces: WorkspaceRow[] }`

### POST /api/workspaces
- **Auth:** Required
- **Body:** `{ name: string, description?: string }`
- **Response:** `{ ok: true, workspaceId: string }`

### GET /api/workspaces/[workspaceId]
- **Auth:** Required (member)
- **Response:** `{ ok: true, workspace: WorkspaceRow, members: MemberRow[] }`

### PUT /api/workspaces/[workspaceId]
- **Auth:** Required (admin)
- **Body:** `{ name?: string, description?: string }`
- **Response:** `{ ok: true }`

### GET /api/workspaces/[workspaceId]/members
- **Auth:** Required (member)
- **Response:** `{ ok: true, members: MemberRow[] }`

### POST /api/workspaces/[workspaceId]/invite
- **Auth:** Required (admin)
- **Body:** `{ email: string, role: "admin" | "member" }`
- **Response:** `{ ok: true }`

### GET /api/workspaces/[workspaceId]/analytics
- **Auth:** Required (member)
- **Response:** `{ ok: true, analytics: WorkspaceAnalytics }`

### GET /api/workspaces/[workspaceId]/branches
- **Auth:** Required (member)
- **Response:** `{ ok: true, branches: BranchRow[] }`

### POST /api/workspaces/[workspaceId]/branches
- **Auth:** Required (admin)
- **Body:** `{ name: string, localityId?: string }`
- **Response:** `{ ok: true, branchId: string }`

### GET /api/workspaces/[workspaceId]/rules
- **Auth:** Required (member)
- **Response:** `{ ok: true, rules: RuleRow[] }`

### POST /api/workspaces/[workspaceId]/rules
- **Auth:** Required (admin)
- **Body:** `{ name: string, condition: object, action: string }`
- **Response:** `{ ok: true, ruleId: string }`

---

## 59. Profile Public (Provider Profile)

### GET /api/providers/[id]/profile
- **Auth:** None (public)
- **Response:** Full marketplace profile bundle
- **Notes:** This is the public-facing provider profile endpoint used by the web app's provider pages.

---

## Common Response Patterns

### Success
```json
{ "ok": true, "data": { ... } }
```

### Error
```json
{ "ok": false, "message": "Error description", "code": "ERROR_CODE" }
```

### Rate Limited
```json
{ "ok": false, "code": "RATE_LIMITED", "message": "Too many requests. Try again in 30 seconds." }
```
Headers: `Retry-After: 30`, `X-RateLimit-Reset: <unix_timestamp>`

### Pagination
```json
{ "ok": true, "data": [...], "total": 100, "page": 1, "limit": 20, "hasMore": true }
```

---

## Rate Limit Tiers

| Tier | Window | Max Requests | Applied To |
|------|--------|-------------|------------|
| Default | 60s | 30 | Most read endpoints |
| Auth | 60s | 10 | Auth endpoints |
| Write | 60s | 20 | Mutation endpoints |
| AI Prompt | 60s | 10 | AI endpoints (authenticated) |
| AI Anonymous | 60s | 5 | AI endpoints (anonymous) |

## Implementation Notes

- All routes use `lib/server/requestAuth.ts` for authentication
- Rate limiting: Redis → Postgres → in-memory fallback (lib/server/rateLimit.ts)
- Error handling: `lib/server/errorHandler.ts` with `captureApiError()` + Sentry reporting
- Admin auth: email allowlist OR `profiles.is_admin` flag
- Cron auth: `CRON_SECRET` env var comparison
- All file uploads go through `lib/server/fileValidation.ts` for size/type checks
- AI routes use Gemini via `lib/ai/provider.ts` (gemini-2.0-flash default model)
