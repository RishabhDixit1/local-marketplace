# Event Tracking

**Last updated:** August 2026

---

## 1. Mobile Events (Firebase Analytics)

### Screen Views

Every Flutter page logs a screen view. Tracked via `FirebaseAnalytics.instance.logScreenView()`.

| Screen Name | Widget | Trigger |
|-------------|--------|---------|
| `home_welcome` | `WelcomePage` | Tab 0 (Need Something) |
| `explore_discovery` | `DiscoveryPage` | Tab 1 (Explore) |
| `profile_hub` | `ProfilePage` | Tab 2 (You) |
| `chat_inbox` | `ChatPage` | Chat conversation list |
| `chat_thread` | `ChatPage` (with threadId) | Individual conversation |
| `feed_browse` | `FeedPage` | Community feed |
| `search_results` | `SearchPage` | Search page |
| `order_detail` | `OrderDetailPage` | Order detail |
| `provider_profile` | `ProviderProfilePage` | Public provider profile |
| `create_need` | `CreateNeedPage` | Post help request |
| `quote_comparison` | `QuoteComparisonPage` | Compare quotes |
| `checkout` | `CheckoutPage` | Payment checkout |
| `notifications` | `NotificationsPage` | Notification list |
| `availability` | `AvailabilityPage` | Provider availability |
| `settings` | `SettingsPage` | User settings |
| `sign_in` | `LoginPageClient` | Login |
| `sign_up` | `SignUpPage` | Registration |
| `setup` | `SetupPage` | Account setup |
| `workspaces` | `WorkspacesPage` | Workspace list |
| `workspace_detail` | `WorkspaceDetailPage` | Workspace detail |
| `analytics` | `AnalyticsPage` | Provider analytics |
| `payouts` | `PayoutsPage` | Provider payouts |
| `verification` | `VerificationPage` | Identity verification |
| `market_zones` | `MarketZonesScreen` | Market zones |
| `map_discovery` | `MapDiscoveryPage` | Map view |
| `provider_listings` | `ProviderListingsPage` | Provider listings management |
| `provider_boosts` | `ProviderBoostsPage` | Boost management |
| `referrals` | `ReferralsPage` | Referral dashboard |
| `disputes` | `DisputesPage` | Dispute management |

### Custom Events

| Event Name | Parameters | Source |
|------------|-----------|--------|
| `app_open_mobile` | `firebase_ready: bool`, `cold_start_ms: int` | `app.dart` |
| `first_engagement` | `method: string` | `welcome_page.dart` |
| `intent_chosen` | `intent: string` | `welcome_widgets.dart` |
| `ai_query_submitted` | `has_location: bool`, `result_count: int`, `latency_ms: int` | `ai_prompt_bar.dart` |
| `order_created` | `order_id: uuid`, `provider_id: uuid`, `amount_paise: int` | Order creation |
| `payment_completed` | `order_id: uuid`, `amount_paise: int`, `method: string` | Payment verify |
| `quote_sent` | `quote_id: uuid`, `order_id: uuid`, `amount_paise: int` | Quote creation |
| `quote_accepted` | `quote_id: uuid`, `order_id: uuid` | Quote acceptance |
| `review_submitted` | `order_id: uuid`, `rating: int` | Review submission |
| `chat_message_sent` | `conversation_id: uuid`, `has_image: bool` | Message send |
| `feed_card_saved` | `post_id: uuid` | Save action |
| `feed_card_shared` | `post_id: uuid`, `method: string` | Share action |
| `profile_completed` | `completion_pct: int` | Profile update |
| `provider_verified` | `level: string` | Verification step |
| `subscription_started` | `plan: string`, `price_paise: int` | Subscription purchase |
| `push_token_registered` | `platform: string` | FCM token registration |

### Firebase Crashlytics

Events sent to Crashlytics (not Analytics):
- `FlutterError.onError` → framework errors
- `runZonedGuarded` → async zone errors
- `PlatformDispatcher.instance.onError` → Dart engine errors
- Custom `recordError` calls in catch blocks

---

## 2. Web Events (Vercel Analytics)

Vercel Analytics tracks automatically:
- **Page views:** Every Next.js route navigation
- **Web Vitals:** LCP, FID, CLS, TTFB
- **No custom events:** The web app does not programmatically log events to Vercel Analytics

Access: Vercel Dashboard → Analytics tab.

---

## 3. Database-Level Event Logging

### `intent_logs`

Every AI prompt bar query is logged.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | Requesting user (nullable for anonymous) |
| `raw_input` | text | Original user input |
| `parsed_intent` | jsonb | Gemini-parsed intent |
| `match_strategy` | text | `ai_match` or `keyword_fallback` |
| `result_count` | integer | Providers returned |
| `latency_ms` | integer | End-to-end latency |
| `created_at` | timestamptz | Timestamp |

### `intent_matches`

Each provider matched for an intent log entry.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `intent_log_id` | uuid | FK to intent_logs |
| `provider_id` | uuid | Matched provider |
| `trust_score` | numeric | Trust score at match time |
| `distance_km` | numeric | Distance from user |
| `rank` | integer | Position in result list |
| `selected` | boolean | User selected this provider |

### `intent_feedback`

User feedback on search results.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `intent_log_id` | uuid | FK to intent_logs |
| `feedback_type` | text | `helpful`, `not_relevant`, `no_results` |
| `created_at` | timestamptz | Timestamp |

### `task_events`

Auto-created by database trigger on `orders` status changes. Full audit trail.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `order_id` | uuid | FK to orders |
| `event_type` | text | `created`, `accepted`, `in_progress`, `completed`, `cancelled` |
| `actor_id` | uuid | User who triggered the event |
| `notes` | text | Optional notes |
| `created_at` | timestamptz | Timestamp |

### `workspace_activity_log`

Logs workspace events.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | FK to workspaces |
| `actor_id` | uuid | User who performed the action |
| `action` | text | `member_added`, `rule_created`, `assignment_made` |
| `details` | jsonb | Action-specific payload |
| `created_at` | timestamptz | Timestamp |

### `post_status_history`

Feed post status transitions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `post_id` | uuid | FK to feed post |
| `from_status` | text | Previous status |
| `to_status` | text | New status |
| `actor_id` | uuid | User who changed status |
| `created_at` | timestamptz | Timestamp |

### `razorpay_webhook_events`

Raw webhook payloads for debugging.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `event_type` | text | Razorpay event type |
| `payload` | jsonb | Full webhook payload |
| `processed` | boolean | Whether the event was handled |
| `created_at` | timestamptz | Timestamp |

---

## 4. What Is Missing

| Gap | Impact | Priority |
|-----|--------|----------|
| **No comprehensive user action tracking** | Cannot build funnels (signup → first post → first order) | P0 |
| **No web custom events** | Only page views, no click/interaction tracking | P0 |
| **No A/B test event logging** | Cannot measure experiment impact | P1 |
| **No referral attribution events** | Cannot track referral conversion funnel | P1 |
| **No provider response time tracking** | Cannot compute SLA metrics | P1 |
| **No search result click tracking** | Cannot measure search quality | P2 |
| **No session replay** | Cannot debug UX issues | P2 |
| **No error event tracking** | Errors go to Crashlytics but not to analytics | P2 |

---

## 5. Recommended Event Schema (Future)

```sql
CREATE TABLE events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id),
  event_name text NOT NULL,
  properties jsonb DEFAULT '{}',
  session_id text,
  platform text CHECK (platform IN ('web', 'android', 'ios')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_events_user ON events(user_id);
CREATE INDEX idx_events_name ON events(event_name);
CREATE INDEX idx_events_created ON events(created_at);
CREATE INDEX idx_events_name_created ON events(event_name, created_at);
```

**Suggested events to add:**
- `user_signed_up` (method, referral_code)
- `user_signed_in` (method)
- `first_need_posted` (category)
- `first_quote_received` (provider_id)
- `first_order_completed` (time_to_complete)
- `search_performed` (query, result_count, clicked_rank)
- `provider_profile_viewed` (provider_id, source)
- `category_browsed` (category, result_count)
- `feed_post_viewed` (post_id, dwell_time_ms)
- `feed_post_created` (category, has_image)
