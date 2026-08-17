# Backend Developer Handoff

**Audience:** Senior Backend Developer  
**Estimated read time:** 10 minutes  
**Last updated:** August 2026

---

## What Is ServiQ?

A hyperlocal services marketplace (like Urban Company) for Delhi NCR. Consumers post needs ("I need an electrician"), AI matches them with nearby providers, providers send quotes, consumers book and pay.

## Architecture

- **Web:** Next.js 16 (App Router) on Vercel
- **Mobile:** Flutter 3.41.x (Android + iOS)
- **Backend:** Next.js API Routes (59 groups, 152 endpoints)
- **Database:** Self-hosted Supabase (PostgreSQL 15) on EC2
- **Auth:** Supabase Auth (GoTrue) - 7 methods
- **Payments:** Razorpay (orders, refunds, webhooks)
- **AI:** Google Gemini (intent parsing, matching, quotes)
- **Push:** Firebase Cloud Messaging (5 channels)

## Where Is the Backend?

The "backend" is split:
1. **Next.js API routes** at `app/api/` - business logic, AI, payments
2. **Supabase** - database, auth, realtime, storage, RLS
3. **Database functions** - 30+ RPC functions for core logic

## Where Is the Database?

Self-hosted Supabase on the same EC2 instance:
- PostgreSQL 15 via Docker
- Kong API gateway
- GoTrue auth server
- PostgREST (auto-generated REST from schema)
- Realtime server
- Storage server

All behind nginx TLS termination at `www.serviqapp.com`.

## Core Tables (60+)

### Identity
- `profiles` - Core user entity (1:1 with auth.users), 30+ columns, trigger-computed fields

### Listings
- `services` / `products` - V2 profile-linked listings
- `service_listings` / `product_catalog` - Legacy provider-linked listings

### Orders
- `orders` - Core order entity, 8 status states, commission tracking
- `task_events` - Audit trail (auto-created by trigger)
- `booking_slots` - Scheduled bookings with GiST exclusion

### Chat
- `conversations` - Direct/group, dedup via `direct_key`
- `messages` - Content + metadata (images)
- `connection_requests` - Pending/accepted/rejected

### Trust
- `reviews` - 1-5 rating + helpful votes
- `trust_scores` - 6-input weighted formula (auto-computed)

### Geography
- `localities` - 44+ neighborhoods
- `market_zones` - 5 zones
- `service_categories` - 20+ categories

### Money
All monetary values in **paise** (integer). Rs. 1 = 100 paise.

## Authentication

7 methods via Supabase Auth:
1. Email code (send -> verify)
2. Magic link
3. Google OAuth
4. Apple OAuth
5. Password sign-in
6. Password sign-up
7. Phone SMS OTP

Server-side: cookie-based sessions via Supabase server client.
Mobile: FlutterSecureStorage + Supabase Flutter SDK.

## Authorization

**RLS-first model.** Every user-facing table has Row-Level Security policies:
- Users can only read/write their own data
- Conversation participants can read messages
- Providers can manage their own listings
- Admin users have elevated access via `is_admin` flag
- Service role used server-side for admin operations

## Major APIs

### AI (`/api/ai/prompt`)
Natural language -> parsed intent -> matched providers -> ranked results.
Falls back to keyword search when Gemini fails.

### Orders (`/api/orders/*`)
CRUD + status transitions + webhook processing.

### Chat (`/api/chat/*`)
Create conversation -> send messages -> read receipts.

### Payments (`/api/payment/*`)
Create Razorpay order -> verify payment -> process refunds.

### Profile (`/api/profile/*`)
Read/write profiles, marketplace metrics, trust scores.

### Provider (`/api/providers/*`)
Nearby search, category filtering, listing management.

## Request Flow

1. Consumer posts help request
2. `match_help_request()` RPC finds top 30 nearby providers
3. Providers see match, create quote with line items
4. Consumer compares quotes in deal room
5. Consumer accepts quote -> Order created
6. Provider accepts -> status: in_progress
7. Service delivered -> status: completed
8. Payment processed -> commission deducted
9. Review requested -> trust score updated

## Provider Interaction

1. Sign up -> intent selection -> launchpad wizard
2. Complete profile (services, portfolio, availability)
3. Get verified (email -> phone -> identity -> business)
4. Receive lead matches via AI
5. Create/send quotes
6. Negotiate in quote room
7. Complete orders
8. Get paid (payout flow)
9. Build reputation (reviews -> trust score)

## Chat

- Direct messaging between any two users
- Connection NOT required (relaxed March 2026)
- Image attachments via metadata
- Read receipts via last_read_at
- Realtime updates via Postgres changes

## Notifications

- In-app (notifications table, RLS own-user)
- Push via FCM (5 channels, deep-link routing)
- SMS via Twilio (OTP, order updates)
- WhatsApp (schema only, not implemented)
- Email (partial templates)

## Biggest Technical Risks

1. **Single EC2:** No horizontal scaling, no HA, no read replicas
2. **Self-hosted Supabase:** Upgrade complexity, operational burden
3. **Dual listing system:** Legacy + V2 creates confusion
4. **No admin dashboard:** Manual DB queries for admin tasks
5. **Limited analytics:** No centralized data warehouse
6. **Live Talk disabled:** WebRTC dependency exists but compile-time off
7. **Free-tier AI:** Gemini quota exhaustion degrades search
8. **No automated E2E:** 10+ Playwright specs, not comprehensive

## What Needs Work Next

1. Admin dashboard (web UI for user/order/analytics management)
2. Production analytics pipeline (events -> warehouse -> dashboard)
3. Horizontal scaling (multi-EC2 or managed Supabase)
4. Comprehensive E2E test coverage
5. Email template completion
6. WhatsApp notification implementation
7. KYC review workflow
8. Automated load testing in CI
9. iOS App Store submission
10. Multi-language AI responses
