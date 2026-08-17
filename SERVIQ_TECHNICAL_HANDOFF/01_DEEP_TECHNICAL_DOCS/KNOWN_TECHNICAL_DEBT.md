# ServiQ Known Technical Debt

## 1. Critical (Launch-Blocking)

### 1.1 Supabase DNS Not Configured
- **Status:** ⚠️ Workaround in place
- **Issue:** `supabase.serviqapp.com` and `realtime.serviqapp.com` have NO DNS records
- **Workaround:** Production mobile builds use `https://www.serviqapp.com` (nginx proxies to Kong:8000)
- **Impact:** Cleartext `http://54.253.40.174:8000` no longer used; HTTPS working
- **Fix:** Add DNS records if direct Supabase subdomains needed

### 1.2 Featured Placements Empty
- **Status:** 🔴 Not started
- **Issue:** `public.featured_placements` table is EMPTY on live DB
- **Impact:** "Featured providers" section shows fallback top providers, no true featured badge
- **Fix:** Create featured placements or remove section

### 1.3 Browse-Auth-Gate Decision Pending
- **Status:** 🔴 Product decision needed
- **Issue:** All `/app/*` routes are auth-gated; anonymous users tapping "Browse all" land on Sign In
- **Impact:** No public full-listing route exists
- **Options:** Keep funnel (current) vs public listing route

### 1.4 Release-Build Firebase Verification
- **Status:** ⚠️ Unverified
- **Issue:** Crashlytics only works in release builds (`!kDebugMode`); no test-crash button exists
- **Impact:** Cannot verify Crashlytics is working until first real crash
- **Fix:** Add test-crash button in debug builds, or verify on first release build

### 1.5 Razorpay Live Keys
- **Status:** ⚠️ Pending
- **Issue:** Live Razorpay keys not yet configured
- **Impact:** Cannot process real payments
- **Fix:** Switch from `rzp_test_*` to `rzp_live_*` in env vars

---

## 2. High Priority (Post-Launch)

### 2.1 ETA Absent from Provider Quick-Response
- **Status:** 🔴 Not implemented
- **Issue:** No schema/API/mobile support for provider ETA on help requests
- **Impact:** Users cannot see estimated arrival time
- **Fix:** Add `eta_minutes` to help_request_matches, expose in mobile UI

### 2.2 Gemini Free-Tier Quota Exhausted
- **Status:** ⚠️ Degraded
- **Issue:** Gemini free-tier daily quota exhausted (0 requests/day)
- **Impact:** AI search degrades to keyword fallback (no semantic understanding)
- **Fix:** Upgrade to paid Gemini tier (founder decision)

### 2.3 WhatsApp Integration Partial
- **Status:** ⚠️ Incomplete
- **Issue:** Schema + templates exist, sending partially implemented
- **Impact:** WhatsApp notifications not fully functional
- **Fix:** Complete WhatsApp Business API integration

### 2.4 Live Talk Compile-Time Off
- **Status:** ⚠️ Feature disabled
- **Issue:** Live Talk feature compile-time disabled
- **Impact:** No real-time video calls
- **Fix:** Enable and test when ready

### 2.5 Realtime WebSocket 503
- **Status:** ⚠️ Intermittent
- **Issue:** Supabase Realtime occasionally returns 503
- **Impact:** Realtime subscriptions may fail on cold start
- **Fix:** Container health check + auto-restart

---

## 3. Medium Priority (Roadmap)

### 3.1 OTP Cooldown Timer
- **Status:** 🔴 Not implemented
- **Issue:** No 60-second countdown on OTP resend
- **Impact:** Users can spam OTP requests
- **Fix:** Add cooldown timer on both web + Flutter

### 3.2 Profile Hub Reorganization
- **Status:** 🔴 Not implemented
- **Issue:** 18 flat tiles in profile hub (overwhelming)
- **Impact:** Poor UX for finding settings
- **Fix:** Reorganize into 4 grouped sections

### 3.3 Push Notification Delivery Tracking
- **Status:** ⚠️ Incomplete
- **Issue:** `device_push_tokens.push_status` not always updated after send
- **Impact:** Cannot track delivery success rate
- **Fix:** Update push_status in background job after FCM send

### 3.4 Connection-First Chat Migration
- **Status:** ⚠️ Partial
- **Issue:** March 2026 relaxation allows any chat, but connection-gated logic still dominant
- **Impact:** New connections bypass gating, but UI may confuse users
- **Fix:** Clarify chat access rules in UI

### 3.5 Test Account Cleanup
- **Status:** ⚠️ Manual
- **Issue:** 10 test accounts flagged in production
- **Impact:** May appear in search results if RLS bypass occurs
- **Fix:** Remove or archive test accounts

---

## 4. Low Priority (Backlog)

### 4.1 Admin Dashboard Minimal
- **Status:** ⚠️ Basic
- **Issue:** Admin pages are functional but not polished
- **Impact:** Internal tooling only
- **Fix:** Redesign admin UI

### 4.2 Email Templates Minimal
- **Status:** ⚠️ Basic
- **Issue:** Most emails from Supabase GoTrue (plain text)
- **Impact:** No branded email templates
- **Fix:** Create custom email templates

### 4.3 Analytics Dashboard Basic
- **Status:** ⚠️ Basic
- **Issue:** Provider analytics show basic metrics only
- **Impact:** Limited insights for providers
- **Fix:** Add charts, trends, comparisons

### 4.4 Search Analytics Empty
- **Status:** ⚠️ Unused
- **Issue:** `search_analytics` table exists but not populated
- **Impact:** Cannot analyze search patterns
- **Fix:** Instrument search queries to log to analytics

### 4.5 Feature Flags Unused
- **Status:** ⚠️ Unused
- **Issue:** Feature flags table exists but no flags configured
- **Impact:** Cannot do gradual rollouts
- **Fix:** Define flags and integrate into mobile/web

### 4.6 Subscription Guard Not Integrated
- **Status:** ⚠️ Partial
- **Issue:** `subscription_guard()` RPC exists but not called from API routes
- **Impact:** Free users can access paid features
- **Fix:** Integrate guard into gated endpoints

### 4.7 Referral Reward Logic Incomplete
- **Status:** ⚠️ Partial
- **Issue:** Referral tracking works, but reward fulfillment not automated
- **Impact:** Referrers not automatically credited
- **Fix:** Add background job for reward distribution

### 4.8 Provider Subscription Benefits Not Enforced
- **Status:** ⚠️ Partial
- **Issue:** Subscription plans exist but benefits not enforced
- **Impact:** Free users get same features as paid
- **Fix:** Integrate subscription guard into feature gates

---

## 5. Code Quality Issues

### 5.1 Duplicate Code
- **Issue:** Some logic duplicated between web and mobile
- **Impact:** Maintenance overhead
- **Examples:**
  - Profile completion calculation (web: `lib/profile/marketplace.ts`, mobile: `profile_completion_calculator.dart`)
  - Trust score formula (web: `lib/profile/marketplace.ts`, mobile: `lib/`, mobile: `lib/`)
- **Fix:** Extract shared logic to API endpoints

### 5.2 Inconsistent Error Messages
- **Issue:** Error messages vary across routes
- **Impact:** Confusing UX
- **Examples:** "Unauthorized" vs "Invalid token" vs "Missing bearer token"
- **Fix:** Standardize error response format

### 5.3 Missing Input Validation
- **Issue:** Some routes don't validate input thoroughly
- **Impact:** Potential security issues
- **Examples:** Some POST routes don't check required fields
- **Fix:** Add validation to all routes

### 5.4 Dead Code
- **Issue:** Unused functions, variables, imports
- **Impact:** Bundle bloat, confusion
- **Examples:** `_TextField` widget removed, `_avatarInitial` helpers removed
- **Fix:** Regular code cleanup

### 5.5 Inconsistent Naming
- **Issue:** Mixed naming conventions (camelCase vs snake_case)
- **Impact:** Developer confusion
- **Examples:** `is_provider` (DB) vs `isProvider` (JS)
- **Fix:** Follow conventions (DB: snake_case, JS: camelCase)

---

## 6. Infrastructure Issues

### 6.1 EC2 Single Point of Failure
- **Issue:** All Supabase services on one EC2 instance
- **Impact:** Instance failure = complete outage
- **Fix:** Multi-AZ deployment, load balancer, auto-scaling

### 6.2 No Auto-Scaling
- **Issue:** EC2 instance manually scaled
- **Impact:** Traffic spikes may overwhelm
- **Fix:** Auto-scaling group, CloudWatch alarms

### 6.3 No CDN for Static Assets
- **Issue:** Static assets served from Vercel (good) but Supabase Storage not behind CDN
- **Impact:** File downloads may be slow in some regions
- **Fix:** CloudFront in front of Supabase Storage

### 6.4 No Disaster Recovery Plan
- **Issue:** No documented DR plan
- **Impact:** Unclear recovery process
- **Fix:** Document DR procedures, test quarterly

### 6.5 No Log Aggregation
- **Issue:** Logs only in CloudWatch (EC2) and Sentry (web/mobile)
- **Impact:** Hard to correlate errors across services
- **Fix:** Centralized logging (ELK, Datadog, etc.)

---

## 7. Security Issues

### 7.1 RLS Bypass Risk
- **Issue:** Service role key bypasses RLS (intentional but risky)
- **Impact:** If leaked, attacker can access all data
- **Fix:** Rotate keys regularly, monitor usage

### 7.2 JWT Expiry Not Enforced
- **Issue:** Local JWT fallback doesn't enforce expiry
- **Impact:** Tokens never expire (until server restart)
- **Fix:** Add expiry check to `verifyLocalJwt()`

### 7.3 No Rate Limit on Password Reset
- **Issue:** `/api/auth/forgot-password` not rate-limited
- **Impact:** Potential email flooding
- **Fix:** Add rate limit to auth routes

### 7.4 CORS Too Permissive
- **Issue:** Some routes use `Access-Control-Allow-Origin: *`
- **Impact:** Potential CSRF attacks
- **Fix:** Restrict to `www.serviqapp.com`

### 7.5 Secrets in Git History
- **Issue:** Secrets may exist in git history (`.env.local` accidentally committed)
- **Impact:** Secrets exposed if repo is public
- **Fix:** Use `git filter-branch` or BFG to remove, rotate all secrets

---

## 8. Documentation Issues

### 8.1 API Docs Outdated
- **Issue:** API documentation not always updated after changes
- **Impact:** Developer confusion
- **Fix:** Update docs as part of PR process

### 8.2 Runbooks Incomplete
- **Issue:** Some operational procedures not documented
- **Impact:** Tribal knowledge
- **Fix:** Complete runbooks for common operations

### 8.3 Onboarding Docs Missing
- **Issue:** No developer onboarding guide
- **Impact:** Slow ramp-up for new developers
- **Fix:** Create onboarding documentation
