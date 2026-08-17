# Repository Structure

## Top-Level Layout

```
local-marketplace/
├── app/                    # Next.js App Router (web + API)
│   ├── api/                # 59 API route groups, 152 endpoints
│   ├── auth/               # Auth callback pages
│   ├── business/           # Public business pages
│   ├── checkout/           # Checkout flow
│   ├── components/         # React components
│   ├── dashboard/          # Provider/consumer dashboard
│   ├── docs/               # In-app documentation
│   ├── legal/              # Legal pages
│   ├── login/              # Login page
│   ├── market/             # Market/locality pages
│   ├── onboarding/         # Onboarding flows
│   ├── orders/             # Order detail pages
│   ├── page.tsx            # Landing page
│   ├── privacy/            # Privacy policy
│   ├── profile/            # Public profile pages
│   ├── search/             # Search page
│   ├── support/            # Support page
│   └── terms/              # Terms of service
├── components/             # Shared React components
├── lib/                    # Server-side libraries
│   ├── ai/                 # AI/LLM integration (Gemini)
│   ├── cache/              # Caching layer
│   ├── feature-flags/      # Feature flag system
│   ├── hooks/              # React hooks
│   ├── kyc/                # KYC verification
│   ├── launchpad/          # Provider launchpad
│   ├── leads/              # Lead scoring/routing
│   ├── profile/            # Profile management
│   ├── provider/           # Provider operations
│   ├── quotes/             # Quote/deal room
│   ├── server/             # Server utilities
│   └── trust/              # Trust scoring
├── mobile/                 # Flutter mobile app
│   ├── lib/
│   │   ├── app/            # App shell, router, theme
│   │   ├── core/           # API, auth, config, design system
│   │   ├── features/       # 41 feature modules
│   │   ├── l10n/           # 6 language translations
│   │   ├── models/         # Data models
│   │   └── shared/         # Shared components
│   ├── android/            # Android platform
│   ├── ios/                # iOS platform
│   └── test/               # 200+ tests
├── supabase/               # Database
│   ├── migrations/         # 66 SQL migration files
│   └── seed_*.sql          # Seed data files
├── tests/                  # Web tests
│   ├── e2e/                # Playwright E2E tests
│   ├── load/               # Load tests
│   └── unit/               # Vitest unit tests
├── docs/                   # 76 documentation files
├── scripts/                # Deployment and utility scripts
├── .github/workflows/      # CI/CD pipelines
├── public/                 # Static assets
├── messages/               # i18n translation files (6 languages)
└── Configuration files     # next.config.ts, tsconfig.json, etc.
```

## API Route Groups (59 groups, 152+ endpoints)

```
app/api/
├── ab-test/                # A/B testing experiments
├── account/                # Account management
├── admin/                  # Admin operations
├── ai/                     # AI/LLM endpoints (prompt, prompt/stream)
├── app/                    # Mobile app endpoints
├── auth/                   # Auth helpers
├── block/                  # User blocking
├── bookings/               # Booking management
├── campaigns/              # Campaign scheduling
├── cart/                   # Cart sync (cross-device)
├── chat/                   # Chat operations
├── community/              # Community feed
├── connections/            # Connection requests
├── consumer/               # Consumer operations
├── cron/                   # Background job triggers
├── disputes/               # Order disputes
├── escalations/            # Notification escalation
├── feature-flags/          # Feature flag checks
├── feed-card-interactions/ # Feed card engagement
├── feed-card-saves/        # Saved feed items
├── google/                 # Google Business integration
├── health/                 # Health check
├── help-requests/          # Help request CRUD
├── invoices/               # Invoice generation
├── launchpad/              # Provider launchpad
├── leads/                  # Lead scoring/routing
├── live-talk/              # A/V call signaling
├── localities/             # Locality/zone queries
├── market/                 # Market page data
├── mobile/                 # Mobile-specific endpoints
├── needs/                  # Need/requirement posting
├── notifications/          # Notification CRUD
├── observability/          # Monitoring/logging
├── og/                     # Open Graph image generation
├── orders/                 # Order management
├── payment/                # Razorpay payment flow
├── posts/                  # Post CRUD
├── presence/               # Online presence
├── profile/                # Profile management
├── promo/                  # Promo code validation
├── provider/               # Provider operations
├── providers/              # Provider listing/search
├── public/                 # Public (unauthenticated) endpoints
├── push/                   # Push notification dispatch
├── quotes/                 # Quote/deal room
├── referrals/              # Referral program
├── reports/                # Analytics reports
├── review-requests/        # Review request management
├── reviews/                # Review CRUD
├── service-categories/     # Category catalog
├── subscriptions/          # Subscription management
├── system/                 # System diagnostics
├── tasks/                  # Task/order operations
├── upload/                 # File upload helpers
├── user-settings/          # User notification settings
├── verification/           # KYC verification
├── webhooks/               # Razorpay webhook receiver
├── widgets/                # Embeddable widgets
└── workspaces/             # Team workspace management
```

## Flutter Feature Modules (41 modules)

```
mobile/lib/features/
├── admin/              # Admin dashboard
├── ai_prompt/          # AI query bar + results
├── analytics/          # Provider analytics
├── auth/               # Login, signup, OTP
├── availability/       # Provider availability management
├── blocking/           # User blocking
├── bookings/           # Booking calendar
├── cart/               # Shopping cart
├── chat/               # In-app messaging
├── connections/        # Connection request management
├── control/            # Provider control panel
├── discovery/          # Explore/discover page
├── disputes/           # Order dispute filing
├── feed/               # Social feed / posts
├── invoices/           # Invoice viewing
├── listings/           # Service/product listing CRUD
├── live_talk/          # A/V call (disabled)
├── marketplace/        # Marketplace landing
├── notifications/      # In-app notifications
├── onboarding/         # New user onboarding
├── orders/             # Order management
├── payments/           # Payment processing
├── payouts/            # Payout history
├── people/             # People directory
├── post_create/        # Create need/offer post
├── profile/            # User profile
├── promotions/         # Promo code management
├── provider/           # Provider-specific features
├── public_profile/     # Public provider profile view
├── quotes/             # Quote/deal room
├── referrals/          # Referral program
├── reporting/          # Content reporting
├── reviews/            # Review management
├── search/             # Search page
├── settings/           # User settings
├── subscriptions/      # Subscription management
├── task_post/          # Post a need/requirement
├── tasks/              # Task management (needs + work)
├── verification/       # KYC document upload
├── welcome/            # Home/welcome page
└── workspaces/         # Team workspace management
```

## Database Migrations (66 files)

```
supabase/migrations/
├── 20260307170000_platform_core.sql              # notifications, help_requests, help_request_matches, provider_presence, provider_push_subscriptions, notification_escalations, provider_trust_metrics, referral_events, featured_placements
├── 20260308120000_task_operations_realtime.sql   # task_events, trg_log_task_order_event trigger
├── 20260309143000_profile_onboarding_upgrade.sql # profiles table, profile completion functions
├── 20260309193000_multiuser_marketplace_core.sql # posts, service_listings, product_catalog, reviews, orders, conversations, messages, connection_requests
├── 20260310123000_connected_marketplace_visibility.sql # live_talk_requests, connection-gated post visibility
├── 20260320123000_business_launchpad_drafts.sql  # business_launchpad_drafts
├── 20260320143000_quote_flow.sql                # quote_drafts, quote_line_items
├── 20260326010000_profile_system_v2.sql          # services, products, portfolio, work_history, availability, payment_methods, trust_scores, profile_sections
├── 20260331190000_user_settings.sql              # user_settings
├── 20260401000000_manual_offerings.sql           # manual_offerings
├── 20260401130000_payment_and_storage.sql        # Orders payment columns, listing-images bucket
├── 20260419174500_feed_card_feedback.sql         # feed_card_feedback
├── 20260502094000_order_stock_reservation.sql    # decrement_product_stock, increment_product_stock RPCs
├── 20260518090000_rate_limits.sql                # rate_limits
├── 20260522000000_deal_room_extensions.sql       # quote_versions, quote_version_line_items, quote_attachments
├── 20260522000100_localities.sql                 # localities
├── 20260522000200_service_categories.sql         # service_categories (seeded with 7 categories)
├── 20260522000300_provider_locality.sql          # provider_locality junction
├── 20260523000100_lead_assignments.sql           # lead_assignments
├── 20260523000200_trust_artifacts.sql            # trust_artifacts
├── 20260523000300_team_workspaces.sql            # workspaces, workspace_branches, workspace_members, workspace_assignment_rules, workspace_activity_log
├── 20260523000400_growth_integrations.sql        # referral_codes, review_requests, campaign_schedules, widget_embeds
├── 20260523000500_google_business_tokens.sql     # google_business_tokens
├── 20260529010000_verification_referral_seo.sql  # verification_documents, referral_payouts, seo columns
├── 20260529020000_commission_email_cron.sql       # Orders commission columns (platform_fee_paise, provider_payout_paise, commission_rate)
├── 20260530000000_payouts_booking_webhooks.sql   # provider_payouts, payout_items, provider_bank_accounts, provider_availability_slots, booking_slots, razorpay_webhook_events
├── 20260605000000_subscription_plans.sql          # subscription_plans, provider_subscriptions (seeded: Free/Essential/Premium)
├── 20260605010000_featured_placements_extend.sql  # featured_placements listing targeting + payment
├── 20260605020000_disputes.sql                   # disputes
├── 20260606010000_feature_flags.sql              # feature_flags, feature_flag_overrides
├── 20260606020000_invoices.sql                   # invoices (GST billing)
├── 20260608000000_background_jobs.sql            # background_jobs
├── 20260611010000_review_enhancements.sql        # review_votes, review-photos bucket
├── 20260612000000_booking_calendar_extensions.sql # availability_exceptions, check_booking_slot_available RPC
├── 20260614000000_blocked_users.sql              # blocked_users
├── 20260616000000_cart_sync.sql                  # carts, cart_items
├── 20260623000000_monetization_recurring_payouts_promos.sql # promo_codes, order_promo_codes, Razorpay subscription/payout columns
├── 20260628000000_otp_codes.sql                  # otp_codes (email verification)
├── 20260708000001_market_zones.sql               # market_zones (5 launch zones seeded)
├── 20260709000000_migration_tracking.sql          # _migrations
├── 20260710000000_post_status_lifecycle.sql       # post_status_history, transition_post_status RPC
├── 20260714000000_user_suspension.sql            # is_suspended on profiles, suspension RLS blocks
├── 20260714100000_listing_moderation.sql          # is_flagged/removed_at on listings and posts
├── 20260716010000_intent_engine.sql              # category_synonyms, intent_logs, intent_matches, intent_feedback, FTS indexes
├── 20260718000000_booking_slot_race_condition_fix.sql # Atomic booking slot reservation
├── 20260731000000_admin_role.sql                 # is_admin on profiles
├── 20260803000000_provider_trust_job_completion.sql # Job completion rate, order stats RPC, order-triggered metrics refresh
├── 20260814000000_test_account_flagging_and_name_hygiene.sql # is_test flag, name sanitizer
└── (+ ~16 intermediate fix/migration files)
```

## Code Conventions

### Next.js (Web + API)
- App Router with route groups
- Server Components by default, `'use client'` for interactive
- API routes use `NextRequest`/`NextResponse`
- Supabase server client for DB operations (service role for mutations)
- Tailwind CSS for styling
- CSS variables for theming (dark mode support)

### Flutter (Mobile)
- Feature-first directory structure (`lib/features/<feature>/`)
- Riverpod for state management
- go_router for navigation
- Supabase Flutter SDK for backend
- Design system: `lib/core/design_system/` (AppSpacing, AppRadii, AppColors, AppTypography)
- Shared components: `lib/shared/components/` (AppAvatar, AppTextField, ServiqScaffold, ServiqTopBar, EmptyStateView, LoadingShimmer)
- 6 locale translations: en, hi, bn, mr, ta, te
- Design tokens: AppSpacing (xs=8, sm=12, md=16, lg=20, xl=24, xxl=32), AppRadii (xs=4, sm=6, md=8, lg=12, xl=16, pill=999)

### Database
- UUID primary keys (gen_random_uuid())
- `created_at`/`updated_at` timestamps on all tables
- `set_updated_at()` trigger on most tables
- RLS policies on all user-facing tables
- Triggers for computed fields (profile completion %, trust score, onboarding status)
- All monetary values in paise (integer) or numeric (for calculations)
- `metadata jsonb DEFAULT '{}'` on most tables for extensibility
- Realtime publication for key tables (orders, messages, conversations, connection_requests, task_events, posts, services, products)
