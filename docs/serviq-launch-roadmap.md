# ServiQ — 90-Day Launch Roadmap

**Team:** 3 people (no dedicated dev)
**Live at:** https://www.serviqapp.com
**Repo:** https://github.com/RishabhDixit1/local-marketplace
**Updated:** 2026-07-21

---

## Context (Current State)

- **Web App:** Production-grade. 47/47 unit test files passing (223 tests). Auth, payments (Razorpay), chat/realtime, onboarding, 30+ dashboard pages all complete. No TODO/FIXME markers. Clean lint.
- **Flutter:** 221 Dart files, 47 screens, 40 feature modules, 56 routes. Design system done. Auth, feed, chat, orders, profile all built. 15 unit tests + 1 integration test. `flutter analyze` clean.
- **Zone/Launch data:** 5 launch zones seeded (Crossing Republik phase 1, 4 phase 2 zones). Phase-2 society-level localities marked "unresearched."
- **i18n:** Hindi fully translated. Bengali/Tamil/Telugu/Marathi are stubs (only 3 landing keys each).
- **Traction to date:** ~500 users, 150+ posts in Crossing Republik pilot.
- **PedalStart:** $250k-$500k raise targeted, ~20-24L grant approved. Nitin checks in at month 1 and month 3.

---

## Launch Phases

### Phase 1: WebApp Production Hardening (Days 1-30)

**Goal:** Ship a rock-solid web experience. Fix every edge case. Make the core loop (request -> match -> quote -> pay -> complete) bulletproof.

#### Week 1: Fake-Success-State & Write-Path Audit

The most dangerous bugs are silent ones — where the UI says "success" but the data never wrote. We fixed one (`7e770f0 fix: resolve fake-success-state in write-path flows`) but need to audit all write paths.

```opencode
Audit every write path in the app for "fake success states." Search all API routes under app/api/ for patterns where we return a 200/success response before the database write completes. Specifically check: orders route, payment verify route, posts/feed-card-*, quotes, messages, reviews, connections. For each route, verify there's an await on the database write before the success response is returned. Also check optimistic UI patterns in the frontend — do we show success before the API confirms? Report findings as a table: route, file:line, risk (high/medium/low), fix needed (yes/no).
```

```opencode
Review the 48 unit test files and add edge-case coverage for the 5 most critical API routes: orders, payment verify, chat messages, quotes, and connection requests. For each route, add tests for: 1) missing auth returns 401, 2) malformed body returns 400, 3) database failure returns 500 (not 200), 4) idempotent retry returns same result, 5) rate limit exceeded returns 429. Run `npx vitest run` to confirm all 48+ test files pass.
```

#### Week 1-2: Onboarding Flow Polish

```opencode
Audit the provider onboarding flow at /onboarding/provider/{locality,availability,profile,publish}. Walk through every step as a new user. Check: 1) Does each step save state so the user can go back? 2) What happens if the user refreshes mid-flow? 3) Is there a "skip for now" option on non-critical steps? 4) Does the progress bar reflect actual completion? 5) After publish, does the provider land on their dashboard with a clear "what's next" state? Fix any gaps found. Also check the seeker onboarding at /onboarding/seeker/{page,profile,publish}.
```

```opencode
Add an "empty state" to every dashboard page that shows when the user has no data. Check: /dashboard/orders (no orders yet), /dashboard/chat (no conversations), /dashboard/tasks (no tasks), /dashboard/listings (no listings for providers), /dashboard/notifications (no notifications), /dashboard/saved (no saved items). Each empty state should have: 1) a helpful illustration/icon, 2) a clear message about what would appear here, 3) a CTA button to take the next action. Use the existing design patterns from the app.
```

#### Week 2-3: Payment Flow Hardening

```opencode
Audit the full payment flow end-to-end. Walk through: 1) Create a help request as a consumer, 2) Get matched with a provider, 3) Receive a quote, 4) Accept and go to checkout, 5) Select Razorpay payment, 6) Complete payment, 7) Verify the order shows as "paid" in the dashboard, 8) Check the provider sees the order on their end, 9) Cancel and verify refund works. Document any broken steps, unclear CTAs, missing loading states, or race conditions. Then fix them.
```

```opencode
Add a "test transaction" mode or sandbox indicator for development. Wrap the Razorpay key selection in payment routes to automatically use test keys when NEXT_PUBLIC_APP_ENV is not "production". Also add a dev-only banner on the checkout page showing "TEST MODE — no real charges" when test keys are active.
```

#### Week 3-4: Error Handling & Recovery

```opencode
Audit every API route handler for proper error boundaries. Check: 1) Does every route use the `withErrorHandling` wrapper? 2) Are there any bare try/catch blocks that swallow errors? 3) Do database operation errors include enough context for debugging? 4) Are client-facing error messages user-friendly (no raw SQL or stack traces)? 5) Do timeout scenarios return a clear 503/504? Search for patterns like `catch (e)` without logging, `console.error` without structured logging, and error messages containing internal details.
```

```opencode
Add global error boundary UI polish. Check the existing error.tsx and global-error.tsx at the root layout level. Then audit: what happens when an individual dashboard page component throws? Add error boundaries to key dashboard sections (orders list, chat list, feed grid) so a crash in one doesn't take down the whole dashboard. Use React error boundaries or the app router's error.tsx convention.
```

#### Week 4: Performance & SEO Basics

```opencode
Run a Lighthouse audit on the landing page, login page, dashboard, and a provider profile page. Fix any scores below 80 for Performance and Accessibility. Common issues to check: 1) image dimensions and lazy loading, 2) render-blocking resources, 3) tap target sizes on mobile, 4) color contrast, 5) missing aria labels. Use `npx perfaudit` if available, or `npx lighthouse <url> --view`.
```

```opencode
Add the bare minimum SEO metadata to public pages: landing page, provider profiles (/profile/[slug]), market pages (/market/[society]), and search page. Each page should have: unique title tag, meta description, og:title, og:description, og:image (a generic ServiQ brand image), and canonical URL. Use Next.js Metadata API. For user-generated pages (profiles, listings), generate dynamic metadata server-side.
```

---

### Phase 2: Zone/Locale & Infrastructure (Days 10-20, parallel)

```opencode
Apply the two unapplied migration files: supabase/seed_new_zones_localities.sql and supabase/setup_all.sql (or run them individually). First review the seed data for correctness — check that locality names match actual areas in Greater Noida West, Gaur City 1, Gaur City 2, and Shahberi. For any societies marked "unresearched," comment them out or flag as phase 3. Run the migrations via `npx tsx scripts/run-migration.ts seed_new_zones_localities` or direct psql. Verify with a SELECT count(*) from localities and market_zones.
```

```opencode
Complete the 4 remaining locale files (bn.json, ta.json, te.json, mr.json). Use Google Translate or a native speaker to translate all ~163 keys for at least Bengali and Tamil first (largest untapped user bases in Delhi NCR). For each file, open the English file as reference, then fill in every key with a native translation, keeping the {variable} placeholders intact. The translation must be idiomatic for the target language's service-app context, not literal word-for-word.
```

```opencode
Deploy the locale changes and applied migrations to Vercel preview. Run `vercel deploy` (or push to main if auto-deploy is set). Then test: 1) Visit the landing page with ?locale=bn in the URL, 2) Verify the page renders in Bengali, 3) Switch locale in the UI and confirm it persists, 4) Check that marketplace content still loads correctly in all locales, 5) Verify no keys show as "undefined" or raw key names.
```

---

### Phase 3: Flutter Mobile Polish for Launch (Days 15-45)

**Goal:** Ship a stable, polished Flutter app to both app stores. Not every web feature needs to be there — but the core loop must work and feel native.

#### Sprint 1: Fix Known Issues (Days 15-22)

```opencode
Fix the P0 People page performance regression: convert the `Column` with spread `...filtered.map()` pattern in mobile/lib/features/people/presentation/people_page.dart to `ListView.builder` with proper item builder. The current code at approximately line 383-586 wraps a Column inside a ListView, which eagerly builds all items. Replace with a single ListView.builder that only builds visible items. Run `flutter analyze --no-fatal-infos --no-fatal-warnings` to verify no new issues.
```

```opencode
Add pre-warming for SecureStorage reads. In mobile/lib/core/supabase/app_bootstrap.dart, before the Supabase.initialize() call, add a warm-up step that reads a dummy key from FlutterSecureStorage to trigger the platform channel initialization. Then in mobile/lib/core/secure_storage/local_storage.dart, check if pre-warming was done and skip the cold sequential reads. This should reduce cold-start time by ~300-500ms.
```

```opencode
Fix explore lanes pre-materialization in feed_page.dart. Around lines 1014-1059, the `_ExploreMarketplaceLanes` builds a Column with spread children. Each child lane uses ListView.builder with shrinkWrap:true, but the input list is pre-materialized. Use a single ListView.builder that builds each lane lazily, or wrap each lane section in a builder pattern. Verify with `flutter run --profile` that scroll performance improves.
```

#### Sprint 2: Cart & Checkout (Days 22-30)

```opencode
Build the missing cart persistence layer. In mobile/lib/features/cart/, create a cart_provider.dart that stores cart items to SharedPreferences. Add add-to-cart, remove-from-cart, update-quantity methods. Persist the cart across app restarts. Wire the cart count badge to the bottom nav shell at mobile/lib/app/presentation/app_shell.dart. The cart state should hold: list of items with providerId, itemId, itemType, price, quantity, title.
```

```opencode
Build the cart bottom sheet widget (showServiqCartSheet) at mobile/lib/features/cart/presentation/cart_sheet.dart. This should: 1) Show all items grouped by provider, 2) Display item name, price, quantity controls, 3) Show subtotal per provider, 4) Show total at bottom, 5) Have a "Proceed to Checkout" button. Use ServiqSurface and design tokens. Match the web cart drawer UX pattern. Wire it to the checkout_page.dart route via go_router.
```

#### Sprint 3: Orders & Tasks IA (Days 30-38)

```opencode
Restructure the tasks_page.dart to match the unified Inbox/Active/Orders/Quotes/History IA pattern from web. Create 5 top tabs using TabBar. Inbox: new help requests needing response. Active: accepted/accepted tasks in progress. Orders: all placed orders with status filters (matching the P1 Flutter fix from AGENTS.md). Quotes: pending/sent/accepted quotes. History: completed/cancelled. Each section shows task/order cards with deep links to the detail page or chat thread. Remove any flat list that doesn't match this IA.
```

```opencode
Add order status filtering tabs to the mobile orders page (matching the P1 Flutter fix already done for web). Create tabs: All, Active, Completed, Cancelled. Add a TabController with 4 tabs. Filter the orders list by status when each tab is selected. Reuse the existing order_card.dart widget. Ensure the filter state persists when navigating away and back. Run `flutter test` to verify no regressions.
```

#### Sprint 4: Profile & Onboarding (Days 38-45)

```opencode
Refactor the mobile profile page at mobile/lib/features/profile/presentation/profile_page.dart to match the web's 4-section grouping: Provider Tools, Orders & Payments, Communication & Trust, Account. Use ServiqSurface cards with icons. Each section should conditionally show items based on user role (provider vs seeker). Add a "View Public Profile" option and a "Complete Profile" readiness banner at the top (similar to the web's QuickOnboardingSheet).
```

```opencode
Polish the provider launchpad page. The current page at mobile/lib/features/launchpad/presentation/provider_launchpad_page.dart is described as "too form-like." Convert it to a stepper flow with: Step 1: Category & services selection, Step 2: Location (with GPS helper), Step 3: Business hours (with presets), Step 4: Photos & description, Step 5: Review & publish. Use the existing ServiqStepper or build with PageView. Each step saves state so the user can go back. Add an AI generate button on Step 5 that calls the /api/launchpad endpoint.
```

---

### Phase 4: iOS & Android Build & Submission (Days 35-60)

**Goal:** Get the Flutter app into both app stores. This needs Apple Developer ($99/yr) and Google Play ($25 one-time) accounts.

#### iOS Build (Days 35-45)

```opencode
Set up the iOS build for App Store submission. Check mobile/ios/ for: 1) Update the App Store Connect app record (bundle ID com.serviq.serviq-mobile must match), 2) Update Info.plist with app name, description, privacy permissions (camera, photos, location, notifications), 3) Set the minimum iOS version to match the pubspec (15.0+), 4) Configure the signing team in Xcode or via fastlane, 5) Increment the build number. Run `flutter build ipa --release --no-codesign` to verify the archive builds clean.
```

```opencode
Set up Fastlane for iOS deployment at mobile/fastlane/. Update Fastfile with: 1) `match` lane for code signing certificates, 2) `build` lane that runs `flutter build ipa --release`, 3) `upload` lane that uploads to App Store Connect. Update Matchfile with the git repo URL for certificates. Update Appfile with the Apple ID and bundle identifier. Document the required environment variables in .env.example.
```

#### Android Build (Days 40-50)

```opencode
Configure the Android release build. Check mobile/android/ for: 1) Update the keystore path in key.properties to point to release/serviq-release.keystore (or create it if missing via `keytool -genkey`), 2) Update build.gradle.kts with the correct applicationId (com.serviq.serviq-mobile), 3) Set versionCode and versionName, 4) Configure ProGuard/R8 rules for release minification (keep Razorpay SDK, Supabase client, Firebase SDK), 5) Test a release APK with `flutter build apk --release --split-per-abi`. Verify the APK installs on a real device.
```

```opencode
Set up Firebase for the Android build. Download google-services.json from the Firebase Console and place it at mobile/android/app/google-services.json. Verify the SHA-1 fingerprint in the Firebase Console matches the release keystore. Test Firebase Messaging by sending a test notification to the app. Also configure iOS's GoogleService-Info.plist at mobile/ios/Runner/GoogleService-Info.plist.
```

#### App Store Submission (Days 45-60)

```opencode
Create App Store listing assets. Generate: 1) App icon (1024x1024 PNG) — use the ServiQ brand kit, 2) Screenshots: 4 iPhone screenshots (6.7" display) showing: Home/Welcome, Marketplace feed, Chat/Inbox, Order detail. Use a device frame. 3) App Store description (max 4000 chars): first paragraph is the most important — mention "Delhi NCR," "local services," "real-time," "trusted providers." 4) Keywords: services, local, plumber, electrician, Delhi, Noida, home repair. 5) Privacy policy URL (update privacy page on the web app if needed).
```

```opencode
Create Google Play Store listing. Go to Google Play Console, create a new app with the same name "ServiQ." Upload the release APK (from Phase 4 Android build). Fill in: 1) Store listing with the same text as iOS, 2) Feature graphic (1024x500 PNG), 3) Screenshots (min 2, max 8 — use same screenshots as iOS), 4) Categorize as "Lifestyle" or "Productivity," 5) Set content rating (likely "Everyone" or "Parental Guidance" — complete the questionnaire honestly), 6) Set pricing & distribution: free, all countries (or just India to start). Submit for review. Note: first review may take 2-7 days.
```

---

### Phase 5: Launch Prep & Traction Tracking (Days 45-90)

**Goal:** Be ready to onboard real users from Day 1. Have the numbers ready for Nitin's month-1 and month-3 check-ins.

#### Sales Hiring (Days 1-30, in parallel)

```opencode
Create a simple sales tracking dashboard at /dashboard/admin/sales or a separate page. It should track: 1) Salesperson name and contact, 2) Number of vendors onboarded, 3) Number of vendors with active listings, 4) Average time from first contact to first listing, 5) Zones assigned to each salesperson. Use a Supabase table `sales_team` and `vendor_onboarding_log` for storage. Add a POST endpoint at /api/admin/sales/log. This is for the 3 salespeople you're hiring for vendor onboarding in Crossing Republik.
```

#### Vendor Onboarding Script (Days 15-30)

```opencode
Create a quick-reference vendor onboarding page at /dashboard/admin/vendor-onboarding-guide. It should be a single-page guide that salespeople can view on their phones. Include: 1) Step-by-step: find a vendor → talk to them → what to say about ServiQ → take photos of their work → create their profile → set their prices → set their availability → publish their listing. 2) FAQs to answer ("Is it free?", "How do I get paid?", "What if I don't get customers?"). 3) A contact number for support. Use simple, large-text mobile-first formatting. This is not a product feature — it's an ops tool for your sales team.
```

#### Tracker Integration (Days 45-50)

```opencode
Set up a Supabase table `traction_metrics` with columns: id, date, gmv_inr (numeric), active_users (integer), new_users (integer), paid_transactions (integer), vendors_active (integer), repeat_users (integer). Create a POST endpoint at /api/traction/log that accepts these fields with auth. Then create a GET endpoint at /api/traction/summary that returns: total_gmv, total_transactions, current_active_users, vendors_onboarded, repeat_rate (%). These numbers feed the traction tracker dashboard. Also create a cron job at /api/cron/daily-traction-snapshot that runs at midnight and captures a daily snapshot into a `traction_snapshots` table for historical trending.
```

#### Launch Day Checklist (Days 50-60)

```opencode
Create a launch checklist page at /dashboard/admin/launch-checklist with the following items as a checkable list (stored in localStorage or a Supabase table):
- [ ] Seed data applied and verified (localities, zones)
- [ ] Hindi locale fully deployed
- [ ] Vendor onboarding guide ready
- [ ] 3 salespeople hired and briefed
- [ ] Test transaction completed end-to-end (consumer -> provider -> payment -> completion)
- [ ] Refund flow tested
- [ ] Error monitoring (Sentry) configured and sending
- [ ] Notifications working (email + push)
- [ ] Google OAuth working
- [ ] Payment release cron active and tested
- [ ] App store listings submitted (or at least in review)
- [ ] Privacy policy and terms of service up to date
- [ ] Analytics tracking active
- [ ] Backups configured
- [ ] Tracker ready to log
```

#### Launch Execution (Day ~60-75)

```opencode
Do not build anything new during this period. Your job is ops, not code. Activities:
- Post real help requests yourself to generate traction.
- Walk providers through their first transaction.
- Log GMV daily in the tracker.
- Fix any bugs that block a transaction within 24 hours (this is your sole code priority).
- Collect testimonials and screenshots.
- Prepare the month-1 report for Nitin at PedalStart.
```

#### Month-1 Nitin Check-in Prep (Day ~90)

```opencode
At this point you should have:
- Number of completed transactions (target: 10+)
- Number of active providers (target: 5+)
- Number of repeat consumers (target: 1+)
- CAC from the channel that worked (leaflets/WhatsApp/in-person)
- Real GMV numbers
- At least 1 provider objection documented

Compile these into a <30 minute deck: 1) What we've built (1 slide), 2) Traction (2-3 slides with charts), 3) Unit economics (1 slide), 4) What we learned (1 slide), 5) What's next / what we need from PedalStart (1 slide).
```

---

## Quick-Reference Command Palette

```bash
# Web
npm run dev              # Start dev server
npm run build            # Production build
npm run test:unit        # Run all web tests (47 files, 223 tests)
npm run lint             # ESLint
npx tsc --noEmit         # Type-check

# Flutter
cd mobile && flutter run  # Dev on connected device
flutter analyze --no-fatal-infos --no-fatal-warnings  # Lint (clean = no issues)
flutter test              # Run Flutter tests
flutter build apk --release --split-per-abi  # Android release
flutter build ipa --release --no-codesign     # iOS archive

# Mobile perf
flutter run --profile                 # Profile mode for real perf numbers
flutter run --release                 # Release mode on device
```

---

## What NOT to Build (Days 1-90)

Per the existing 90-day plan and confirmed by current codebase state:

| Don't Build | Why | Current State |
|---|---|---|
| AI Launchpad enhancements | Zero paid users have used it | Already built, just hide from nav |
| Lead OS | Zero lead volume | Already built, feature flag off |
| Trust Graph | 10 providers don't need it | Already built, feature flag off |
| Team Workspaces | You're a team of 3 | Already built, hide from nav |
| Premium features after basic sub | Nobody's paying yet | Subscription page exists |
| Any new Flutter screen not in Phase 3 | Ship what works, cut the rest | 47 screens is enough |
| Campaigns/A/B Tests/Referral Leaderboard on mobile | Admin features, low impact | Skip for v1 mobile |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| App store review takes >7 days | Medium | High (launch delay) | Submit iOS+Android early in Phase 4, don't wait for feature completion |
| Salespeople can't find vendors | Medium | High | You go with them for first 2 days, demonstrate the pitch |
| Users don't complete payment | Medium | Medium | Simplify checkout, add COD as fallback (already done), test yourself |
| Firebase/notification setup fails | Low | Medium | Test push notifications early in Phase 3, use email as fallback |
| Vercel+Hobby plan rate limits at launch | Low | Low-Medium | Minimal expected traffic in first 30 days; upgrade if needed |
| One of 3 team members gets sick/busy | Medium | Medium | Cross-train: each person should know how to do the critical path (create listing, accept order, process payment) |
