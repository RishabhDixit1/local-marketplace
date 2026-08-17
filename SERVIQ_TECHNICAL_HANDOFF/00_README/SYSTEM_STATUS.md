# ServiQ System Status

**Last verified:** August 14, 2026  
**Verification method:** Codebase inspection, migration file audit, on-device testing

---

## System Component Status

| Area | Status | Evidence | Notes |
|------|--------|----------|-------|
| **Authentication** | Verified | Supabase Auth, 7 auth methods | Email, phone OTP, Google, Apple, magic link, password |
| **User Profiles** | Verified | `profiles` table, 30+ columns, triggers | Auto-computed completion %, trust score |
| **Provider System** | Verified | Provider tables, onboarding flow | Listings, portfolios, availability, trust |
| **Service Listings** | Verified | Dual system (legacy + V2) | `service_listings` + `services` tables |
| **Product Catalog** | Verified | Dual system (legacy + V2) | `product_catalog` + `products` tables |
| **Help Requests** | Verified | `help_requests` + matching RPCs | AI-powered provider matching |
| **Orders** | Verified | `orders` table, status workflow | 8 status states, audit trail, commission |
| **Quotes/Deal Room** | Verified | `quote_drafts` + line items + versions | Multi-version negotiation |
| **Chat/Messaging** | Verified | `conversations` + `messages` | Direct chat, image attachments, read receipts |
| **Connections** | Verified | `connection_requests` | Pending/accepted/rejected lifecycle |
| **Notifications** | Verified | In-app + FCM + SMS | 5 notification channels, deep-link routing |
| **Payments** | Partial | Razorpay integration | Orders, refunds, webhooks, subscriptions. Production transaction data: limited |
| **Subscriptions** | Verified | `subscription_plans` + `provider_subscriptions` | Free/Essential(₹299)/Premium(₹999) |
| **Reviews** | Verified | `reviews` + `review_votes` | 1-5 rating, helpful votes |
| **Trust Scoring** | Verified | 6-input weighted formula | Rating, completion, on-time, repeat, verification, response time |
| **Search/AI** | Verified | Gemini + intent engine | Intent parsing, provider matching, quote drafting |
| **Feed System** | Verified | `feed_card_saves` + `shares` + `feedback` | Save, share, report functionality |
| **Geography** | Verified | `localities` + `market_zones` | 44+ localities, 5 zones |
| **Workspaces/Teams** | Verified | `workspaces` + members + branches | Multi-branch business support |
| **Referrals** | Verified | `referral_codes` + events + payouts | Points-based referral system |
| **Invoices** | Verified | `invoices` table | Auto-generated from orders |
| **Disputes** | Verified | `disputes` table | File, resolve, track |
| **Cart** | Verified | `carts` + `cart_items` | Per-user cart with stock reservation |
| **Background Jobs** | Verified | `background_jobs` table | Priority queue with retry |
| **Feature Flags** | Verified | `feature_flags` + overrides | Per-user flag overrides |
| **Rate Limiting** | Verified | `rate_limits` table + `cleanup_expired_rate_limits()` | Atomic upsert, cron cleanup |
| **Admin Dashboard** | Partial | `admin/` API routes exists | Basic admin APIs present, full dashboard TBD |
| **Analytics** | Partial | Firebase Analytics + intent_logs | Screen tracking present, custom event tracking incomplete |
| **Live Talk (A/V)** | Compile-time OFF | `flutter_webrtc` dependency | Schema exists, UI exists, but disabled at compile time |
| **KYC/Verification** | Partial | `verification_documents` table | Document upload present, manual review workflow TBD |
| **Email Notifications** | Partial | `lib/email.ts` + templates | SendGrid configured, limited template coverage |
| **SMS Notifications** | Partial | Twilio integration | `sms_notifications` table, OTP flow working |
| **WhatsApp Notifications** | Partial | WhatsApp Business API | `provider_push_subscriptions.whatsapp` field, implementation partial |
| **Listing Moderation** | Verified | `moderation_status` column + policies | Admin moderation on listings |
| **User Suspension** | Verified | `is_suspended` column + `blocked_users` | Account suspension + user blocking |
| **Migration Tracking** | Verified | `_migrations` table + `record_migration()` | 66 migrations tracked |
| **Performance Monitoring** | Partial | Sentry (web) + Firebase Performance (mobile) | Error tracking works, performance dashboards partial |
| **Backup System** | Verified | GitHub Actions + S3 | Daily backup + verification workflow |
| **Uptime Monitoring** | Verified | GitHub Actions (15-min cron) | Health checks + auto-issue creation |

---

## Database Statistics (Schema-Level)

| Metric | Count | Source |
|--------|-------|--------|
| Total tables | 60+ | Migration files |
| Total migrations | 66 | `supabase/migrations/` |
| RPC functions | 30+ | Migration files |
| RLS policies | 50+ | Migration files |
| Storage buckets | 4 | `setup_all.sql` |
| Realtime publications | 33 tables | `verify_realtime_setup.sql` |
| Indexes | 80+ | Migration files |
| Triggers | 20+ | Migration files |
| Seed categories | 20+ | `service_categories` |
| Seed localities | 44+ | `localities` |
| Seed market zones | 5 | `market_zones` |

---

## API Route Statistics

| Category | Route Groups | Approximate Endpoints |
|----------|-------------|----------------------|
| AI/LLM | 3 | ~8 |
| Auth/Account | 4 | ~12 |
| Admin | 2 | ~6 |
| Chat | 2 | ~6 |
| Orders | 3 | ~10 |
| Profile | 3 | ~8 |
| Provider | 4 | ~12 |
| Notifications | 3 | ~8 |
| Feed/Posts | 4 | ~10 |
| Payments | 3 | ~8 |
| Search | 2 | ~4 |
| Connections | 2 | ~6 |
| Reviews | 2 | ~4 |
| Tasks/Needs | 3 | ~8 |
| Quotes | 2 | ~6 |
| Subscriptions | 2 | ~4 |
| Other (upload, health, etc.) | 15 | ~32 |
| **Total** | **59 groups** | **~152 endpoints** |

---

## What Is NOT Working / Not Built

| Area | Status | Impact |
|------|--------|--------|
| Live Talk (A/V calls) | Compile-time disabled | No video calls |
| Admin web dashboard | API routes only, no UI | Manual DB queries for admin |
| Email templates | Partial coverage | Some notifications missing emails |
| WhatsApp notifications | Schema only | No WhatsApp messages sent |
| KYC document review | Upload only, no review UI | Manual review required |
| Production analytics dashboard | No built-in dashboard | Firebase/console only |
| Automated testing (E2E) | 10+ Playwright specs | Not comprehensive |
| iOS App Store | Not submitted | Android APK only |
| Multi-language AI responses | English only | Hindi queries get English AI responses |
| Advanced search filters | Basic text search | No price range, rating filters |

---

## Production Infrastructure

| Component | Details |
|-----------|---------|
| **Web Hosting** | Vercel (Next.js) + EC2 (API server) |
| **EC2 Instance** | t3.medium, Amazon Linux 2 |
| **Web Server** | nginx (TLS termination) + Caddy |
| **Supabase** | Self-hosted on same EC2 (Docker Compose) |
| **Database** | PostgreSQL 15 (Supabase) |
| **Realtime** | supabase-realtime container |
| **Auth** | GoTrue (Supabase Auth) |
| **Storage** | Supabase Storage (local volumes) |
| **Domain** | serviqapp.com (Let's Encrypt TLS) |
| **CI/CD** | GitHub Actions |
| **Backup** | Daily S3 backup via GitHub Actions |
| **Monitoring** | Uptime checks every 15 min |
