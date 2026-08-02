# ServiQ Repository Overview

> **ServiQ** is a hyperlocal services marketplace (like Urban Company) targeting Delhi NCR.  
> Live at [https://www.serviqapp.com](https://www.serviqapp.com)  
> Repository: [https://github.com/RishabhDixit1/local-marketplace](https://github.com/RishabhDixit1/local-marketplace)

---

## Executive Summary

ServiQ is a dual-platform (web + mobile) marketplace connecting service seekers with local providers across Delhi NCR. The monorepo contains a **Next.js 16** web application with **97 API route handlers**, a **Flutter 3.41** mobile app with **190+ Dart files** organized as **40 feature modules**, and **63 Supabase database migrations** supporting 50+ tables. The backend relies on Supabase for auth, Postgres, Realtime, RLS, and Storage; Razorpay for payments; and Google Gemini 2.0 Flash for AI-powered search and assistance. The deployment pipeline targets Vercel (web), with Docker Compose for local development, and is orchestrated by 7 GitHub Actions workflows with 8 Vercel cron jobs.

---

## 1. Tech Stack

### 1.1 Web — Next.js 16 (App Router)

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 6 |
| Styling | Tailwind CSS 4, CSS variables for theming |
| State / Forms | react-hook-form |
| Animations | Framer Motion |
| Icons | Lucide React |
| Charts | Recharts |
| Maps | MapLibre GL JS |
| Testing | Vitest (unit), Playwright (e2e), k6 (load) |

### 1.2 Mobile — Flutter 3.41.9

| Layer | Technology |
|---|---|
| Framework | Flutter 3.41.9, Dart 3.11+ |
| State Management | Riverpod 3 |
| Navigation | go_router 17 |
| Maps | flutter_map + latlong2 |
| Charts | fl_chart |
| Images | cached_network_image |
| Localization | 6 locales (en, hi, bn, mr, ta, te) |
| Payments | razorpay_flutter |
| Design System | AppColors, AppSpacing, AppRadii, AppShadows, AppDurations, AppGradients, AppGlassStyles, AppRoleColors |

### 1.3 Backend & Infrastructure

| Service | Role |
|---|---|
| Supabase | Auth, Postgres, Realtime, Row-Level Security (RLS), Storage |
| Razorpay | Payments, Payouts, Subscriptions |
| Google Gemini 2.0 Flash | AI search and assistance (via @ai-sdk/google) |
| Sentry | Error monitoring (web + mobile) |
| Vercel Analytics | Web analytics |
| Firebase Cloud Messaging | Push notifications (mobile) |
| Web Push API | Push notifications (web) |
| AWS SES | Email |
| Twilio | SMS, WhatsApp |
| Redis | Caching, rate limiting (via ioredis, docker-compose) |

---

## 2. Repository Structure

```
/
├── app/                    # Next.js App Router pages & API routes
│   ├── api/                # 97 API route handlers / 59 endpoint directories
│   ├── dashboard/          # 25+ authenticated dashboard sections
│   └── ...                 # Page routes
├── components/             # AppFooter only at root level
├── app/components/         # 44 component directories
│   ├── ui/                 # Generic UI primitives
│   ├── profile/            # Profile-related components
│   ├── trust/              # Trust & safety components
│   ├── motion/             # Animated components (Framer Motion)
│   ├── map/                # Map components (MapLibre GL)
│   ├── landing/            # Landing page components
│   └── login/              # Auth/Login components
├── lib/                    # 66 files/directories
│   ├── ai/                 # Gemini AI integration
│   ├── api/                # API utilities and clients
│   ├── cache/              # Redis caching layer
│   ├── hooks/              # React hooks
│   ├── profile/            # Profile logic
│   ├── provider/           # Provider-related logic
│   ├── quotes/             # Quote system
│   ├── realtime/           # Supabase realtime subscriptions
│   ├── server/             # Server-side utilities
│   ├── trust/              # Trust & safety logic
│   ├── kyc/                # KYC/verification logic
│   ├── feature-flags/      # Feature flag system
│   └── launchpad/          # Provider launchpad logic
├── mobile/                 # Flutter application
│   ├── lib/
│   │   ├── features/       # 40 feature modules (auth, chat, feed, orders, quotes, profile, etc.)
│   │   ├── core/           # 16 core infra modules (api, auth, cache, design_system, theme, network, realtime, firebase, etc.)
│   │   └── shared/         # 19 shared components + 8 shared widgets
│   └── ...
├── supabase/               # 63 migration files, config, README, verification SQL
├── scripts/                # 38 shell & mjs scripts (dev, build, deploy, migration, testing)
├── tests/                  # e2e (Playwright), unit (Vitest), load (k6)
├── docs/                   # 36 markdown documents
├── public/                 # Static assets, service worker, manifest, OG images
└── docker-compose.yml      # Local dev (node app + redis)
```

### 2.1 API Routes (`app/api/`)

**97 route handlers across 59 endpoint directories** covering:

| Category | Endpoints |
|---|---|
| Auth | login, signup, verify-otp, logout, reset-password, refresh-session |
| Profiles | profile, profile/[id], profile/search, profile/availability |
| Listings | service-listings, service-listings/[id], product-catalog, product-catalog/[id] |
| Orders | orders, orders/[id], orders/[id]/status |
| Payments | payment/create, payment/verify, payment/refund, payment/methods |
| Payouts | payouts, payouts/batch, payouts/schedule |
| Quotes | quotes, quotes/[id], quotes/[id]/accept, quotes/[id]/reject, quote-drafts |
| Messages | conversations, conversations/[id], conversations/[id]/messages |
| AI | ai/search, ai/suggest, ai/complete |
| Trust | reviews, reviews/[id], disputes, disputes/[id], blocked-users |
| Notifications | notifications, notifications/[id], notification-preferences |
| Admin | admin/users, admin/analytics, admin/reports, admin/feature-flags |
| Webhooks | webhooks/razorpay, webhooks/supabase, webhooks/twilio |

### 2.2 Dashboard Sections (`app/dashboard/`)

**25+ authenticated dashboard sections** including: overview, orders, listings, quotes, messages, reviews, earnings, payouts, subscriptions, analytics, team, workspace, availability, schedule, settings, notifications, disputes, referrals, promotions, boosts, documents, security, billing, notifications.

### 2.3 Flutter Feature Modules (`mobile/lib/features/`)

**40 feature modules** following feature-first clean architecture (data/domain/presentation):

| Module | Module |
|---|---|
| auth | chat |
| feed | orders |
| quotes | profile |
| product_listing | service_listing |
| checkout | cart |
| payments | payouts |
| subscriptions | reviews |
| disputes | notifications |
| search | map_discovery |
| workspace | team |
| connections | referrals |
| admin | analytics |
| settings | reporting |
| verification | bookings |
| launchpad | boosts |
| tasks | create_need |
| marketplace_landing | onboarding |
| onboarding_walkthrough | welcome |
| invoices | availability |
| quote_comparison | quote_room |

### 2.4 Flutter Core Infrastructure (`mobile/lib/core/`)

**16 core infra modules:**

| Module | Responsibility |
|---|---|
| api | HTTP client, interceptors, error handling |
| auth | Authentication state, token management |
| cache | Local caching layer |
| design_system | AppTextField, ServiqScaffold, ServiqTopBar, ServiqToast, AppPill, AppBottomSheet |
| theme | AppColors, AppTypography, AppSpacing, AppRadii, AppShadows, AppDurations, AppGradients, AppGlassStyles, AppRoleColors |
| network | Connectivity monitoring, offline detection |
| realtime | Reconnect-with-backoff, Supabase Realtime subscriptions |
| firebase | FCM, Crashlytics, Analytics, Performance |
| supabase | Supabase client initialization, session management |
| router | go_router config, post_auth_route_resolver |
| localization | 6 locales (en, hi, bn, mr, ta, te) |
| storage | flutter_secure_storage, pre-warm |
| notifications | Push notification handling |
| payments | Razorpay integration |
| haptics | Haptic feedback utilities |
| errors | Global error handling, Sentry integration |

---

## 3. Key Dependencies

### 3.1 Web (package.json)

| Dependency | Purpose |
|---|---|
| @supabase/ssr | Supabase Server-Side Rendering auth helpers |
| @sentry/nextjs | Error monitoring |
| framer-motion | Animations |
| react-hook-form | Form management |
| lucide-react | Icons |
| recharts | Charts and graphs |
| maplibre-gl | Maps |
| @ai-sdk/google | Google Gemini AI integration |
| razorpay | Payment gateway |
| twilio | SMS and WhatsApp |
| web-push | Web push notifications |
| firebase-admin | Firebase Admin SDK |
| ioredis | Redis client |

### 3.2 Mobile (pubspec.yaml)

| Dependency | Purpose |
|---|---|
| supabase_flutter | Supabase client |
| flutter_riverpod | State management |
| go_router | Navigation |
| flutter_map | Maps |
| cached_network_image | Image caching |
| razorpay_flutter | Payments |
| firebase_messaging | Push notifications |
| firebase_crashlytics | Error monitoring |
| connectivity_plus | Network status |
| fl_chart | Charts |
| image_picker | Media selection |
| share_plus | Sharing |
| flutter_secure_storage | Secure credential storage |
| google_fonts | Typography |

---

## 4. Database — Supabase (Postgres)

**63 migration files** defining 50+ tables.

### 4.1 Core Tables

| Table | Purpose |
|---|---|
| profiles | User profiles (seekers + providers, `services` column as `text[]`) |
| posts | Feed posts |
| service_listings | Provider service offerings |
| product_catalog | Provider product listings |
| reviews | Service reviews and ratings |
| orders | Service orders and transactions |
| help_requests | Seeker help requests |
| help_request_matches | Matching help requests to providers |
| conversations | Chat conversations |
| messages | Chat messages (with `metadata jsonb` for image attachments) |
| connection_requests | Provider-seeker connections |
| notifications | In-app notifications |
| provider_presence | Provider availability/location |
| quote_drafts | Draft quotes |
| quote_line_items | Line items within quotes |
| workspaces | Provider workspaces/teams |
| workspace_members | Workspace membership |
| subscription_plans | Subscription plan definitions |
| provider_subscriptions | Provider subscriptions to plans |
| promo_codes | Promotional codes |
| cart_items | Shopping cart items |
| disputes | Order disputes |
| invoices | Billing invoices |
| rate_limits | Rate limit tracking |
| intent_logs | Payment intent logging |
| background_jobs | Async job queue |
| user_settings | User preferences |
| feature_flags | Feature flag values |
| blocked_users | User blocks |
| verification_documents | KYC/document uploads |
| referral_events | Referral tracking |
| featured_placements | Featured listing placements |

### 4.2 Key SQL Patterns

- `services` column in profiles uses `text[]` type — queried with `services::text.ilike.%keyword%` (not `.cs.{keyword}`)
- Row-Level Security (RLS) policies on all user-facing tables
- Realtime subscriptions enabled for: conversations, messages, notifications, orders, provider_presence

---

## 5. Flutter Architecture

### 5.1 Layered Architecture (per feature)

```
features/<feature>/
├── data/
│   ├── repositories/    # Data source implementations
│   ├── datasources/     # Remote (Supabase) + local (cache)
│   └── models/          # DTOs, serialization
├── domain/
│   ├── entities/        # Business entities
│   ├── repositories/    # Repository interfaces
│   └── usecases/        # Business logic
└── presentation/
    ├── providers/       # Riverpod providers (state)
    ├── pages/           # Screen widgets
    └── widgets/         # UI components
```

### 5.2 Navigation

- **go_router 17** with `post_auth_route_resolver` for auth-gated routing
- **App shell** with main bottom navigation bar
- Route guards for authentication and role-based access

### 5.3 Design System

| Token Category | Examples |
|---|---|
| AppColors | Primary, surface, error, text roles |
| AppSpacing | xs(8), sm(12), md(16), lg(20), xl(24), xxl(32), xxxl(40) |
| AppRadii | xs(4), sm(6), md(8), lg(12), xl(16), pill(999) |
| AppShadows | Elevation presets |
| AppDurations | Animation timing presets |
| AppGradients | Reusable gradient definitions |
| AppGlassStyles | Glassmorphism presets |
| AppRoleColors | Semantic role colors (success, warning, error, info) |

### 5.4 Shared Widgets

| Component | Usage |
|---|---|
| AppTextField | All text input fields (36+ fields across 14 files) |
| ServiqScaffold | 17+ migrated pages |
| ServiqTopBar | Standard app bar |
| ServiqToast | Toast notifications (replaced 98 raw SnackBar calls) |
| AppPill | Filter chips, tag pills |
| AppBottomSheet | Bottom sheet primitive |
| OfflineBanner | Global offline indicator |
| EmptyStateView | Empty state illustrations |

### 5.5 Key Migrations Completed

- Migrated 36+ raw `TextField`/`TextFormField` → `AppTextField` across 14 files
- Migrated 17+ `Scaffold`/`AppBar` → `ServiqScaffold`/`ServiqTopBar`
- Replaced 98 raw `SnackBar` calls → `ServiqToast` across 27 files
- Applied design tokens (AppSpacing, AppRadii) across 40+ files
- Collapsed private widgets (`_ProfileTextField` → `AppTextField`, `_FilterChip` → `AppPill`)

---

## 6. Build & Deploy

### 6.1 Web

```bash
npm run build      # Next.js production build
npm run dev        # Local development
npx tsc --noEmit   # Type checking
npx eslint <file>  # Linting
```

Deployment: Vercel (automatic via GitHub integration)

### 6.2 Mobile

```bash
flutter build apk --release       # Android APK
flutter build ios --release       # iOS (via Xcode)
flutter analyze --no-pub          # Static analysis
flutter test                      # Unit/widget tests
```

Builds use `dart-define` for environment configuration.

### 6.3 Docker

```yaml
# docker-compose.yml services:
#   app - Node.js application
#   redis - Redis cache
```

### 6.4 CI/CD — GitHub Actions (7 Workflows)

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci.yml` | PR / push to main | Lint, typecheck, unit tests (web) |
| `web-ci.yml` | PR / push to main | Web-specific checks |
| `e2e.yml` | PR / scheduled | Playwright end-to-end tests |
| `mobile.yml` | PR / push to main | Flutter analyze, test |
| `deploy-ec2.yml` | Manual / push | Deploy to EC2 |
| `deploy-staging.yml` | Push to staging | Deploy staging environment |
| `backup-db.yml` | Scheduled | Database backup |

### 6.5 Cron Jobs — Vercel (8 Schedules)

| Cron | Schedule | Purpose |
|---|---|---|
| Abandoned requests | Every 15 min | Follow up on stale help requests |
| Weekly digest | Weekly | User activity digest emails |
| Reactivation | Daily | Re-engagement emails |
| Review reminders | Daily | Remind users to leave reviews |
| Payouts | Daily | Process provider payouts |
| Campaigns | Daily | Marketing campaign triggers |
| Escalations | Hourly | Escalate unresolved disputes |
| Cleanup | Daily | Purge expired tokens, stale data |

---

## 7. External Services

| Service | Integration Point | Purpose |
|---|---|---|
| Supabase | @supabase/ssr, supabase_flutter | Auth, database, realtime, storage, RLS |
| Vercel | Platform | Hosting, analytics, cron jobs, edge functions |
| Razorpay | razorpay (npm), razorpay_flutter | Payment processing, payouts, subscriptions |
| Google Gemini | @ai-sdk/google | AI-powered search, suggestions, autocomplete |
| Sentry | @sentry/nextjs, firebase_crashlytics | Error monitoring and performance |
| Twilio | twilio (npm) | SMS notifications, WhatsApp messaging |
| AWS SES | aws-sdk (npm) | Email delivery |
| Redis | ioredis (npm), docker-compose | Caching, rate limiting, session store |
| Firebase | firebase-admin, firebase_* packages | FCM push, analytics, crashlytics, performance monitoring |
| Google Maps | Maps API | Location services, geocoding |

---

## 8. Security & Reliability

### 8.1 Payment Security

- HMAC timing-safe comparison in `payment/verify/route.ts`
- Double-refund idempotency guard in `orders/[id]/route.ts`
- Payment intent logging via `intent_logs` table
- Razorpay webhook signature verification

### 8.2 Rate Limiting

- Atomic upsert pattern in `lib/rateLimit.ts`
- Rate limit tracking in dedicated `rate_limits` table
- AI endpoint rate limits keyed by user (auth token sent with prompts)

### 8.3 Background Jobs

- Conditional claim pattern preventing double-processing
- Exponential backoff for retries
- Dedicated `background_jobs` table

### 8.4 Mobile Hardening

| Measure | Implementation |
|---|---|
| Realtime reconnect | Exponential backoff (5s–60s, 20 retries) |
| Offline fail-fast | Network check via connectivity_plus on every call |
| Session refresh timeout | 8s timeout preventing hung cold starts |
| Secure storage pre-warm | FlutterSecureStorage pre-loaded at init |
| Global offline banner | OfflineBanner widget in app shell |
| Haptic feedback | Feed actions, chat send, quote operations |
| Semantic labels | Feed icons, chat back, feed card images |

### 8.5 Secret Safety (AGENTS.md Mandate)

- All secrets, credentials, API keys, tokens, and passwords use `{{resolve:secretsmanager:...}}` with `asm-exec`
- Direct `get-secret-value` calls are forbidden
- Secrets resolve at runtime without entering LLM context

---

## 9. Documentation & Scripts

### 9.1 Documentation (`docs/` — 36 files)

Covers architecture, API reference, deployment, design system, flutter architecture, database schema, migration guides, contributing guidelines, and operational runbooks.

### 9.2 Scripts (`scripts/` — 38 files)

Scripts organized into: development helpers, build scripts, deployment automation, database migration wrappers, testing utilities, one-off data migration scripts.

---

## 10. Key Development Conventions

1. **`services` text[] queries**: Use `services::text.ilike.%keyword%` — NOT `.cs.{keyword}` (fails)
2. **Toast notifications**: Mobile uses `ServiqToast.show()` from `serviq_chrome.dart`, not raw `SnackBar`
3. **Chat images**: The `messages` table `metadata jsonb` column is used for image attachments
4. **Design system**: All new UI must use design tokens (`AppSpacing`, `AppRadii`, etc.) and shared components (`AppTextField`, `ServiqScaffold`)
5. **Pull requests**: Before creating a PR, inspect status, diff, remote tracking, and recent commits; review all commits included, not just the latest
6. **Commits**: Only commit when explicitly asked; stage only intended files; never commit secrets
7. **AWS naming**: Use hyphens (not em dashes) in AWS resource names and descriptions

---

## 11. Audit Notes

- **AI search bug fix**: `.cs.{}` → `.ilike` for services `text[]` column queries
- **Intentionally kept raw** (not migrated to design system):
  - Auth pages (login, sign_up, forgot_password, setup)
  - welcome/onboarding, chat page (dynamic leading)
  - admin/connections/referrals (TabBar in bottom)
  - market_zones (custom search), ai_prompt_bar (custom container)
  - chat_composer (borderless), budget prefixText field
- **Wallet-style `_ThreadEmptyState`** in `chat_page.dart`: genuinely bespoke (safety notes + contextual logic — not candidate for `EmptyStateView` extension)
- **`_SheetScaffold`** in `provider_listings_page.dart`: one of 3 distinct `DraggableScrollableSheet` patterns — no shared `AppBottomSheet` primitive warranted
