# Documentation Audit Report

**Generated:** August 2026  
**Method:** Full codebase inspection by OpenCode  
**Auditor:** Automated (AI-assisted)

---

## Summary

| Metric | Count |
|--------|-------|
| Files inspected | 500+ (source code, configs, migrations) |
| Tables documented | 60+ |
| RPC functions documented | 30+ |
| API endpoints documented | 152 |
| Migration files reviewed | 66 |
| Documentation files created | 50+ |
| Existing docs reused | 20+ (from docs/) |
| Secrets detected and excluded | 0 (verified clean) |

---

## Verification Matrix

### Database Tables
| Domain | Tables | Verified | Source |
|--------|--------|----------|--------|
| Identity | profiles, user_settings, otp_codes | Yes | Migration files |
| Listings (Legacy) | service_listings, product_catalog | Yes | Migration files |
| Listings (V2) | services, products | Yes | Migration files |
| Orders | orders, task_events, booking_slots, razorpay_webhook_events | Yes | Migration files |
| Chat | conversations, conversation_participants, messages | Yes | Migration files |
| Connections | connection_requests, live_talk_requests | Yes | Migration files |
| Notifications | notifications, notification_escalations, provider_push_subscriptions, sms_notifications | Yes | Migration files |
| Reviews | reviews, review_votes, trust_scores, provider_trust_metrics, trust_artifacts | Yes | Migration files |
| Help Requests | help_requests, help_request_matches | Yes | Migration files |
| Feed | feed_card_saves, feed_card_shares, feed_card_feedback | Yes | Migration files |
| Geography | localities, market_zones, service_categories, category_synonyms | Yes | Migration files |
| Quotes | quote_drafts, quote_line_items, quote_versions, quote_version_line_items | Yes | Migration files |
| Workspaces | workspaces, workspace_branches, workspace_members, workspace_assignment_rules, workspace_activity_log | Yes | Migration files |
| Monetization | subscription_plans, provider_subscriptions, featured_placements, provider_payouts, payout_items, provider_bank_accounts, invoices, disputes, promo_codes | Yes | Migration files |
| Referrals | referral_codes, referral_events, referral_payouts, review_requests | Yes | Migration files |
| Business | business_launchpad_drafts, google_business_tokens, verification_documents | Yes | Migration files |
| Infrastructure | feature_flags, feature_flag_overrides, rate_limits, background_jobs, _migrations, blocked_users | Yes | Migration files |
| Other | post_status_history, lead_assignments, carts, cart_items, intent_logs, intent_matches, intent_feedback, availability_exceptions, provider_availability_slots | Yes | Migration files |

### API Routes
| Category | Route Groups | Endpoints | Verified |
|----------|-------------|-----------|----------|
| AI | ai/prompt, ai/prompt/stream, ai/match | ~8 | Yes |
| Auth | auth/send-code, auth/verify-code, auth/magic-link, auth/send-link | ~12 | Yes |
| Admin | admin/analytics, admin/users | ~6 | Yes |
| Chat | chat/direct, chat/messages | ~6 | Yes |
| Orders | orders/[id], orders/[id]/status | ~10 | Yes |
| Profile | profile/me, profile/public | ~8 | Yes |
| Provider | providers/nearby, providers/by-category | ~12 | Yes |
| Payments | payment/create, payment/verify | ~8 | Yes |
| Other | 49 remaining groups | ~82 | Yes |

### RPC Functions
| Function | Verified | Source |
|----------|----------|--------|
| match_help_request(uuid) | Yes | Migration 20260307 |
| match_help_request_v2(uuid) | Yes | Migration 20260408 |
| accept_help_request(uuid) | Yes | Migration 20260307 |
| transition_help_request_status(uuid, text) | Yes | Migration 20260307 |
| get_or_create_direct_conversation(uuid) | Yes | Migration 20260309 |
| send_connection_request(uuid) | Yes | Migration 20260310 |
| respond_to_connection_request(uuid, text) | Yes | Migration 20260310 |
| upsert_provider_presence(boolean, text, integer) | Yes | Migration 20260308 |
| enqueue_notification(...) | Yes | Migration 20260312 |
| mark_all_notifications_read() | Yes | Migration 20260312 |
| clear_all_notifications() | Yes | Migration 20260312 |
| get_feed_card_metrics(text[]) | Yes | Migration file |
| refresh_profile_marketplace_metrics(uuid) | Yes | Migration 20260326 |
| calculate_marketplace_trust_score(...) | Yes | Migration 20260803 |
| calculate_marketplace_profile_completion(...) | Yes | Migration 20260326 |
| calculate_job_completion_rate(bigint, bigint) | Yes | Migration 20260803 |
| get_provider_order_stats(uuid[]) | Yes | Migration 20260803 |
| providers_near_locality(uuid, int, int) | Yes | Migration 20260522 |
| decrement_product_stock(uuid, int) | Yes | Migration 20260502 |
| increment_product_stock(uuid, int) | Yes | Migration 20260502 |
| count_by_day(text, timestamptz, timestamptz) | Yes | Migration 20260613 |
| get_platform_startup_diagnostics() | Yes | Migration file |
| transition_post_status(uuid, text, text) | Yes | Migration 20260710 |
| All utility functions | Yes | Various migrations |

---

## Missing Information

| Item | Status | Impact |
|------|--------|--------|
| Live production metrics | Not available via code audit | Dashboard uses placeholder data |
| EC2 server configuration details | Partial (nginx config in repo) | Some deployment details unverifiable |
| Razorpay live key configuration | Not in repo (env var) | Expected |
| Supabase service role key | Not in repo (env var) | Expected |
| Firebase project configuration | Partial (google-services.json in repo) | Expected |
| SendGrid API key | Not in repo (env var) | Expected |
| Twilio credentials | Not in repo (env var) | Expected |
| Actual user counts | Requires database query | Dashboard queries provided |
| Actual transaction data | Requires database query | Dashboard queries provided |

---

## Unverified Assumptions

1. **Production Supabase is healthy** - Assuming Docker containers running on EC2 (verified Aug 14)
2. **Realtime is working** - Container started Aug 14, websocket upgrade verified
3. **FCM tokens are being registered** - Code verified, live registration unconfirmed
4. **Razorpay webhooks are processing** - Code verified, live processing unconfirmed
5. **Daily backups are succeeding** - GitHub Actions workflow exists, execution unverified

---

## Security Audit

| Check | Status |
|-------|--------|
| No secrets in documentation | PASS - No .env, keys, or tokens included |
| .env.example uses placeholders | PASS - All values are `<YOUR_...>` |
| RLS policies documented | PASS - All major tables covered |
| HMAC verification documented | PASS - Razorpay webhook verification |
| Rate limiting documented | PASS - Atomic upsert pattern |

---

## Dashboard Metrics Available (via SQL)

The following metrics can be computed from the database:

1. Total users: `SELECT count(*) FROM profiles`
2. Users by role: `SELECT role, count(*) FROM profiles GROUP BY role`
3. Total providers (V2): `SELECT count(DISTINCT profile_id) FROM services`
4. Total orders: `SELECT count(*) FROM orders`
5. Orders by status: `SELECT status, count(*) FROM orders GROUP BY status`
6. Total reviews: `SELECT count(*) FROM reviews`
7. Avg rating: `SELECT avg(rating) FROM reviews`
8. Total conversations: `SELECT count(*) FROM conversations`
9. Total messages: `SELECT count(*) FROM messages`
10. Providers by locality: Join profiles + localities
11. Orders by day: `SELECT date(created_at), count(*) FROM orders GROUP BY 1`
12. New users by day: `SELECT date(created_at), count(*) FROM profiles GROUP BY 1`

## Dashboard Metrics Unavailable

1. Revenue (no completed payment records in schema audit)
2. Active sessions (no session tracking table)
3. Page views (requires Vercel/Firebase Analytics export)
4. Conversion funnel (requires custom event tracking)
5. Real-time active users (requires presence tracking)

---

## Recommended Next Engineering Actions

1. **[P0] Admin Dashboard** - Build web UI for user/order/analytics management
2. **[P0] Analytics Pipeline** - Events -> warehouse -> dashboard
3. **[P1] Horizontal Scaling** - Multi-EC2 or migrate to managed Supabase
4. **[P1] E2E Test Coverage** - Expand from 10 to 50+ scenarios
5. **[P1] Email Templates** - Complete notification email coverage
6. **[P2] WhatsApp Notifications** - Implement using WhatsApp Business API
7. **[P2] KYC Review Workflow** - Build admin review UI for verification documents
8. **[P2] Load Testing in CI** - Automate performance regression detection
9. **[P3] iOS App Store** - Submit for review
10. **[P3] Multi-language AI** - Hindi AI responses
