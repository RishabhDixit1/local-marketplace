# Known Limitations

**Last updated:** August 2026

System-level constraints that cannot be resolved without significant architectural changes.

---

## 1. Single EC2 Instance (No HA, No Scaling)

**Impact:** High  
**What:** ServiQ runs on a single EC2 instance. No load balancer, no auto-scaling group, no read replicas.

**Consequences:**
- Single point of failure — EC2 downtime = full outage
- No horizontal scaling — cannot handle traffic spikes
- No geographic redundancy — Delhi NCR only
- Database on same instance — no separation of compute/storage
- All Supabase services (PostgreSQL, Kong, GoTrue, PostgREST, Realtime, Storage) share one machine

**Mitigation:** Daily backups to S3, GitHub Actions uptime monitoring every 15 minutes.

**Fix:** Migrate to managed Supabase (supabase.com) or multi-EC2 with load balancer.

---

## 2. Self-Hosted Supabase (Operational Complexity)

**Impact:** High  
**What:** Supabase is self-hosted via Docker Compose on EC2.

**Consequences:**
- Manual upgrade process (Docker image updates)
- No managed backups (must build own pipeline)
- No automatic failover
- No built-in monitoring dashboard
- Must manage Docker containers, nginx, TLS certificates manually
- Realtime server was never started (discovered Aug 2026)

**Mitigation:** Automated backup workflow, uptime monitoring, documented runbooks.

**Fix:** Migrate to managed Supabase or dedicated database hosting.

---

## 3. No Admin Dashboard UI

**Impact:** High  
**What:** There is no web-based admin interface.

**Consequences:**
- All admin tasks require direct SQL queries
- User management is manual
- Order disputes resolved via database edits
- No visual analytics — must query DB for every metric
- No KYC review workflow for verification documents
- No content moderation tools

**Mitigation:** None currently.

**Fix:** Build admin dashboard (see `DASHBOARD_REQUIREMENTS.md`).

---

## 4. No Analytics Warehouse

**Impact:** Medium  
**What:** No centralized data store for analytics.

**Consequences:**
- Cannot build conversion funnels (signup -> first post -> first order)
- Cannot do cohort analysis (retention by signup week)
- Cannot measure A/B test impact
- Cannot compute DAU/MAU precisely
- Firebase Analytics (mobile) and Vercel Analytics (web) are separate silos
- Database-level analytics exist but are not aggregated

**Mitigation:** SQL queries in `METRICS_DICTIONARY.md` can compute basic metrics.

**Fix:** Build events table + warehouse (BigQuery, ClickHouse, or Supabase).

---

## 5. No Horizontal Scaling

**Impact:** Medium  
**What:** Single-instance deployment with no scaling strategy.

**Consequences:**
- Cannot handle more than ~100 concurrent users comfortably
- No read replicas for database-intensive operations
- No CDN for static assets (Vercel handles web, but mobile API goes through EC2)
- Search/matching queries are CPU-intensive and compete with other services

**Mitigation:** None currently.

**Fix:** Multi-EC2, managed database, CDN for API responses.

---

## 6. Limited Email Coverage

**Impact:** Low  
**What:** Email notification templates are incomplete.

**Consequences:**
- Most notifications are push/SMS only
- No transactional emails (order confirmation, password reset)
- No marketing emails (weekly digest, provider highlights)
- No email verification flow (phone OTP is primary)

**Mitigation:** Supabase Auth handles email-based auth (magic link, OTP).

**Fix:** Complete email templates for all notification channels.

---

## 7. WhatsApp Not Implemented

**Impact:** Low  
**What:** WhatsApp Business API integration is not built.

**Consequences:**
- No WhatsApp notifications for orders, quotes, or messages
- Schema exists (`whatsapp_notifications` table) but no API integration
- Indian users heavily use WhatsApp — missing channel

**Mitigation:** In-app notifications and SMS cover basic needs.

**Fix:** Implement WhatsApp Business API integration.

---

## 8. Live Talk Disabled

**Impact:** Low  
**What:** WebRTC Live Talk feature exists in codebase but is compile-time disabled.

**Consequences:**
- Camera and microphone permissions are still requested (iOS/Android)
- Permission strings mention "live video calls" (fixed in Aug 2026)
- WebRTC dependencies add bundle size
- Feature was never launched

**Mitigation:** Permission strings updated to reflect actual usage (voice input, photos).

**Fix:** Either complete and launch Live Talk, or remove the code entirely.

---

## 9. No Automated E2E Tests

**Impact:** Medium  
**What:** 10+ Playwright specs exist but are not comprehensive. No Flutter integration tests.

**Consequences:**
- Manual testing required for most features
- Regression risk on every deployment
- No confidence in cross-platform behavior
- Cannot test payment flows automatically (Razorpay sandbox)

**Mitigation:** Unit tests (190+ Flutter, TypeScript type checking).

**Fix:** Expand E2E suite to 50+ scenarios covering critical paths.

---

## 10. English-Only AI Responses

**Impact:** Low  
**What:** Gemini AI prompts and responses are English-only.

**Consequences:**
- Hindi-speaking users receive English responses
- AI search works in English only (Hindi input parsed but results in English)
- No multilingual intent parsing
- Delhi NCR has significant Hindi-speaking population

**Mitigation:** None currently.

**Fix:** Add Hindi prompts, translate AI responses, support bilingual input.

---

## 11. No RTL Support

**Impact:** None (current market)  
**What:** App is LTR only.

**Consequences:**
- Cannot expand to RTL-script markets (Arabic, Hebrew)
- Not a concern for current Delhi NCR target

**Mitigation:** N/A for current scope.

**Fix:** Add RTL layout support if expanding to Middle East markets.

---

## 12. Partial Offline Support

**Impact:** Low  
**What:** Basic offline detection exists but no offline-first architecture.

**Consequences:**
- Offline banner shown when disconnected
- Network calls fail fast (no hang)
- No offline data caching
- No offline queue for messages or actions
- No background sync when connectivity returns

**Mitigation:** Fail-fast pattern prevents UX hangs. Offline banner informs user.

**Fix:** Implement offline-first with Hive/Isar local cache + sync queue.

---

## 13. Dual Listing System

**Impact:** Medium  
**What:** Legacy (`service_listings`, `product_catalog`) and V2 (`services`, `products`) listing tables both exist.

**Consequences:**
- Code references both systems
- Data migration incomplete
- Provider can have listings in both systems
- Query complexity increased
- Confusion for new developers

**Mitigation:** V2 is the active system; legacy tables are read-only.

**Fix:** Complete migration to V2, drop legacy tables.

---

## 14. No A/B Testing Framework

**Impact:** Low  
**What:** No infrastructure for experimentation.

**Consequences:**
- UI changes are shipped without measurement
- Cannot compare conversion rates
- Cannot optimize onboarding flows
- Cannot test pricing changes

**Mitigation:** Manual feature flags exist (`feature_flags` table).

**Fix:** Implement experimentation platform (Statsig, LaunchDarkly, or custom).
