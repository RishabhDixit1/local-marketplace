# Migration Reconciliation Report

**Generated:** 2026-07-11
**EC2 Host:** ec2-user@54.253.40.174
**DB Container:** `supabase-db`
**Cutoff Date:** 2026-04-22 (last update to `pending-migrations-bundle.sql`)
**Method:** Read-only SSH + `docker exec psql` — zero write operations performed against EC2 database

---

## Summary

| Status | Count |
|--------|-------|
| **FULLY APPLIED** | 33 |
| **PARTIALLY APPLIED** | 1 |
| **NOT APPLIED** | 2 |
| **Total post-2026-04-22 migrations** | 35 (files dated after 2026-04-22) |

**Critical finding:** `transition_post_status` (20260710000000) and its grant fix (20260711000000) were never applied to production, causing a 500 error when the app calls this RPC via the `service_role` client.

**Only 1 migration (`_migrations` self-record) is tracked in the `_migrations` table.** All other 34 migrations were applied manually with no tracking.

---

## Full Migration Inventory

### FULLY APPLIED (33 migrations)

| # | Migration File | Summary |
|---|---------------|---------|
| 1 | `20260522000000_deal_room_extensions.sql` | Adds `countered` to `quote_drafts` status check; creates `quote_versions`, `quote_version_line_items`, `quote_attachments` tables with indexes, triggers, RLS, realtime |
| 2 | `20260522000100_localities.sql` | Creates `localities` table (society/market/supply_area/expansion zones with lat/lng/radius), indexes, public RLS select, realtime |
| 3 | `20260522000200_service_categories.sql` | Creates `service_categories` table (name, slug, pricing, duration) with 9 seed rows, indexes, public RLS select, realtime |
| 4 | `20260522000300_provider_locality.sql` | Adds `locality_id`, `service_zone_ids`, `service_category_ids`, `service_area_radius_km` to `profiles` with GIN indexes |
| 5 | `20260522000400_rpc_providers_near_locality.sql` | Adds `completed_jobs` to `profiles`; creates `providers_near_locality()` RPC with anon/authenticated/service_role grants |
| 6 | `20260523000100_lead_assignments.sql` | Creates `lead_assignments` table (help_request→provider scoring/assignment), indexes, 4 RLS policies, realtime |
| 7 | `20260523000200_trust_artifacts.sql` | Creates `trust_artifacts` table (badges, certifications, proof-of-work), indexes, 4 RLS policies, realtime |
| 8 | `20260523000300_team_workspaces.sql` | Creates `workspaces`, `workspace_branches`, `workspace_members`, `workspace_assignment_rules`, `workspace_activity_log` with indexes, role-based RLS, realtime |
| 9 | `20260523000400_growth_integrations.sql` | Creates `referral_codes`, `review_requests`, `campaign_schedules`, `widget_embeds` tables; `notify_review_request_event()` trigger function, indexes, RLS, realtime |
| 10 | `20260523000500_google_business_tokens.sql` | Creates `google_business_tokens` table (OAuth tokens per provider), unique index, 4 RLS policies, realtime |
| 11 | `20260529010000_verification_referral_seo.sql` | Creates `verification_documents`, `referral_payouts` tables; adds `verification_status` to `profiles`, `meta_title`/`meta_description` to `localities`; creates `verification-docs` storage bucket with RLS policies |
| 12 | `20260529020000_commission_email_cron.sql` | Adds `platform_fee_paise`, `provider_payout_paise`, `commission_rate` to `orders` |
| 13 | `20260530000000_payouts_booking_webhooks.sql` | Creates `provider_payouts`, `payout_items`, `provider_bank_accounts`, `booking_slots`, `razorpay_webhook_events` tables with indexes and RLS |
| 14 | `20260605000000_subscription_plans.sql` | Creates `subscription_plans` (3 seed rows: Free/Essential/Premium) and `provider_subscriptions` tables with indexes and RLS |
| 15 | `20260605010000_featured_placements_extend.sql` | Adds `listing_id`, `price_paise`, `payment_id`, `razorpay_order_id` to `featured_placements`; replaces RLS insert policy |
| 16 | `20260605020000_disputes.sql` | Creates `disputes` table (order disputes with open/dismissed/resolved statuses), indexes, RLS |
| 17 | `20260606010000_feature_flags.sql` | Creates `feature_flags` (8 seed rows) and `feature_flag_overrides` tables with RLS |
| 18 | `20260606020000_invoices.sql` | Creates `invoices` table with GST columns, 4 indexes, 3 RLS policies |
| 19 | `20260606030000_seeker_onboarding.sql` | Adds `seeker_onboarding_completed` boolean to `profiles` |
| 20 | `20260608000000_background_jobs.sql` | Creates `background_jobs` table with pending index and admin RLS |
| 21 | `20260611010000_review_enhancements.sql` | Creates `review_votes` table with indexes/RLS; creates `review-photos` storage bucket with policies |
| 22 | `20260612000000_booking_calendar_extensions.sql` | Adds `timezone` to `provider_availability_slots`; creates `availability_exceptions` table with RLS; replaces `check_booking_slot_available()` function |
| 23 | `20260613000000_admin_analytics_rpc.sql` | Creates `count_by_day()` RPC function with authenticated/service_role grants |
| 24 | `20260614000000_blocked_users.sql` | Creates `blocked_users` table with 2 indexes and RLS |
| 25 | `20260616000000_cart_sync.sql` | Creates `carts` and `cart_items` tables with indexes, unique constraint, and RLS |
| 26 | `20260617000000_performance_optimizations.sql` | Creates 7 performance indexes (`idx_profiles_services_gin`, `idx_connection_requests_status_*`, `idx_localities_zone_type_name`, `idx_feed_card_*`, `idx_featured_placements_provider_active`); creates `get_table_list()`, `get_bucket_list()`, `get_schema_diagnostics()` RPC functions |
| 27 | `20260623000000_monetization_recurring_payouts_promos.sql` | Adds Razorpay columns to `subscription_plans`, `provider_subscriptions`, `provider_bank_accounts`, `provider_payouts`, `referral_payouts`; creates `promo_codes` and `order_promo_codes` tables; creates `validate_promo_code()` and `consume_promo_code()` functions |
| 28 | `20260628000000_otp_codes.sql` | Creates `otp_codes` table, `cleanup_expired_otps()` function, service_role grants |
| 29 | `20260629120000_add_generation_source_to_launchpad.sql` | Adds `generation_source` column with check constraint (`'ai'`/`'template'`) to `business_launchpad_drafts` |
| 30 | `20260704000000_add_whatsapp_notifications.sql` | Adds `whatsapp_notifications` boolean to `user_settings` |
| 31 | `20260708000001_market_zones.sql` | Creates `market_zones` table (5 seed zones), adds `zone_id` FK to `localities`, indexes, RLS. **Note: realtime publication not added (see PARTIALLY APPLIED)** |
| 32 | `20260708000002_backfill_zone_ids.sql` | Backfills `zone_id` on `localities` for all Crossing Republik entries (20 rows affected) |
| 33 | `20260709000000_migration_tracking.sql` | Creates `_migrations` table, `record_migration()` and `migration_applied()` functions, insert-only RLS |

### PARTIALLY APPLIED (1 migration)

| # | Migration File | Issue |
|---|---------------|-------|
| 1 | `20260708000001_market_zones.sql` | Table, indexes, RLS, seed data, and `zone_id` FK on `localities` all exist. **Missing:** `market_zones` was not added to the `supabase_realtime` publication. This means Supabase Realtime will not broadcast changes on `market_zones`. |

**Missing object for PARTIALLY APPLIED:**
```sql
-- The following statement needs to be run:
ALTER PUBLICATION supabase_realtime ADD TABLE public.market_zones;
```

### NOT APPLIED (2 migrations)

| # | Migration File | Summary of Missing Objects |
|---|---------------|---------------------------|
| 1 | `20260710000000_post_status_lifecycle.sql` | **6 missing objects:** `posts_status_check` CHECK constraint on `posts.status`; 4 lifecycle columns on `posts` (`matched_at`, `in_progress_at`, `completed_at`, `cancelled_at`); `post_status_history` audit table with index and 2 RLS policies; `transition_post_status()` security-definer RPC; `idx_posts_status_created` index on `posts(status, created_at desc)` |
| 2 | `20260711000000_fix_transition_post_status_grant.sql` | **1 missing object:** EXECUTE grant on `transition_post_status(uuid, text, uuid)` to `service_role` (depends on migration 20260710000000) |

**Exact missing objects for NOT APPLIED:**

```sql
-- 1. posts_status_check CHECK constraint
ALTER TABLE public.posts
  ADD CONSTRAINT posts_status_check
  CHECK (lower(status) IN (
    'open', 'matched', 'in_progress', 'completed',
    'cancelled', 'archived', 'deleted', 'hidden', 'draft'
  ));

-- 2. Lifecycle timestamp columns
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS matched_at     timestamptz;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS in_progress_at timestamptz;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS completed_at   timestamptz;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS cancelled_at   timestamptz;

-- 3. post_status_history audit table
CREATE TABLE IF NOT EXISTS public.post_status_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  actor_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  old_status  text,
  new_status  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_post_status_history_post
  ON public.post_status_history (post_id, created_at DESC);

ALTER TABLE public.post_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY post_status_history_select_own
  ON public.post_status_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_status_history.post_id
        AND (
          auth.uid() = p.user_id OR auth.uid() = p.author_id
          OR auth.uid() = p.created_by OR auth.uid() = p.requester_id
          OR auth.uid() = p.owner_id OR auth.uid() = p.provider_id
        )
    )
  );

CREATE POLICY post_status_history_insert_admin
  ON public.post_status_history FOR INSERT TO authenticated
  WITH CHECK (true);

-- 4. transition_post_status RPC function
CREATE OR REPLACE FUNCTION public.transition_post_status(
  p_post_id   uuid,
  p_new_status text,
  p_actor_id  uuid DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status text;
  v_post record;
  v_allowed boolean := false;
BEGIN
  SELECT id, status, owner_id, user_id, author_id, created_by,
         requester_id, provider_id
  INTO v_post
  FROM posts WHERE id = p_post_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Post not found');
  END IF;

  v_old_status := lower(COALESCE(v_post.status, 'open'));
  p_new_status := lower(p_new_status);

  v_allowed := CASE v_old_status
    WHEN 'open'        THEN p_new_status IN ('matched','in_progress','completed','cancelled','archived','deleted','hidden','draft')
    WHEN 'matched'     THEN p_new_status IN ('in_progress','completed','cancelled','open')
    WHEN 'in_progress' THEN p_new_status IN ('completed','cancelled')
    WHEN 'completed'   THEN false
    WHEN 'cancelled'   THEN p_new_status IN ('open','archived','deleted')
    WHEN 'archived'    THEN p_new_status IN ('open','deleted')
    WHEN 'deleted'     THEN false
    WHEN 'hidden'      THEN p_new_status IN ('open','deleted')
    WHEN 'draft'       THEN p_new_status IN ('open','deleted')
    ELSE false
  END;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object(
      'ok', false,
      'message', format('Invalid status transition: %s -> %s', v_old_status, p_new_status)
    );
  END IF;

  UPDATE posts
  SET status     = p_new_status,
      updated_at = timezone('utc', now()),
      matched_at     = CASE WHEN p_new_status = 'matched'     THEN timezone('utc', now()) ELSE matched_at     END,
      in_progress_at = CASE WHEN p_new_status = 'in_progress' THEN timezone('utc', now()) ELSE in_progress_at END,
      completed_at   = CASE WHEN p_new_status = 'completed'   THEN timezone('utc', now()) ELSE completed_at   END,
      cancelled_at   = CASE WHEN p_new_status = 'cancelled'   THEN timezone('utc', now()) ELSE cancelled_at   END
  WHERE id = p_post_id;

  INSERT INTO post_status_history (post_id, actor_id, old_status, new_status)
  VALUES (p_post_id, p_actor_id, v_old_status, p_new_status);

  RETURN jsonb_build_object(
    'ok', true, 'postId', p_post_id,
    'oldStatus', v_old_status, 'newStatus', p_new_status
  );
END;
$$;

-- 5. Grants
GRANT EXECUTE ON FUNCTION public.transition_post_status(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_post_status(uuid, text, uuid) TO service_role;

-- 6. Index
CREATE INDEX IF NOT EXISTS idx_posts_status_created
  ON public.posts (status, created_at DESC);

-- 7. Backfill
UPDATE public.posts SET status = 'open' WHERE status IS NULL OR status = '';

-- 8. Reload schema cache
NOTIFY pgrst, 'reload schema';
```

---

## Reconciliation Plan

### For NOT APPLIED migrations (20260710000000 + 20260711000000)

These two migrations must be applied in order. Since neither has been partially applied, they can be run directly:

```bash
# Apply in order via SSH
ssh -i ~/.ssh/serviq-ec2-key.pem ec2-user@54.253.40.174 \
  "docker exec -i supabase-db psql -U postgres -d postgres" \
  < supabase/migrations/20260710000000_post_status_lifecycle.sql

ssh -i ~/.ssh/serviq-ec2-key.pem ec2-user@54.253.40.174 \
  "docker exec -i supabase-db psql -U postgres -d postgres" \
  < supabase/migrations/20260711000000_fix_transition_post_status_grant.sql
```

**Risk:** Low. The `posts` table currently has no CHECK constraint on `status`, so adding the constraint will succeed if all existing status values are already within the allowed set. The backfill migration sets NULL/empty statuses to `'open'` first.

**Pre-flight check (run before applying):**
```sql
-- Verify no existing status values would violate the new constraint
SELECT DISTINCT lower(status) FROM public.posts
WHERE lower(status) NOT IN (
  'open','matched','in_progress','completed',
  'cancelled','archived','deleted','hidden','draft'
);
-- Should return 0 rows
```

### For PARTIALLY APPLIED migration (20260708000001_market_zones)

Run the missing publication statement:
```bash
ssh -i ~/.ssh/serviq-ec2-key.pem ec2-user@54.253.40.174 \
  "docker exec supabase-db psql -U postgres -d postgres -c \
  \"ALTER PUBLICATION supabase_realtime ADD TABLE public.market_zones;\""
```

**Risk:** Negligible. The table exists and is functional; this only enables Supabase Realtime broadcasting.

### Proposed Reconciliation SQL Bundle

For a one-shot application of all missing objects, the following idempotent SQL can be concatenated and run:

```sql
-- Migration Reconciliation Bundle — 2026-07-11
-- Covers: 20260708000001 (partial), 20260710000000, 20260711000000

BEGIN;

-- ── 20260708000001_market_zones: fix missing realtime publication ──
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.market_zones';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- ── 20260710000000_post_status_lifecycle ──

-- 1. Backfill NULL/empty statuses before adding constraint
UPDATE public.posts SET status = 'open' WHERE status IS NULL OR status = '';

-- 2. Lifecycle timestamp columns (idempotent)
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS matched_at     timestamptz;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS in_progress_at timestamptz;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS completed_at   timestamptz;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS cancelled_at   timestamptz;

-- 3. CHECK constraint (guard: only add if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.posts'::regclass
      AND conname = 'posts_status_check'
  ) THEN
    ALTER TABLE public.posts
      ADD CONSTRAINT posts_status_check
      CHECK (lower(status) IN (
        'open','matched','in_progress','completed',
        'cancelled','archived','deleted','hidden','draft'
      ));
  END IF;
END $$;

-- 4. post_status_history table (idempotent)
CREATE TABLE IF NOT EXISTS public.post_status_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  actor_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  old_status  text,
  new_status  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_post_status_history_post
  ON public.post_status_history (post_id, created_at DESC);

ALTER TABLE public.post_status_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='post_status_history' AND policyname='post_status_history_select_own') THEN
    CREATE POLICY post_status_history_select_own
      ON public.post_status_history FOR SELECT TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_status_history.post_id
          AND (auth.uid() = p.user_id OR auth.uid() = p.author_id
            OR auth.uid() = p.created_by OR auth.uid() = p.requester_id
            OR auth.uid() = p.owner_id OR auth.uid() = p.provider_id))
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='post_status_history' AND policyname='post_status_history_insert_admin') THEN
    CREATE POLICY post_status_history_insert_admin
      ON public.post_status_history FOR INSERT TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- 5. transition_post_status function (CREATE OR REPLACE is idempotent)
CREATE OR REPLACE FUNCTION public.transition_post_status(
  p_post_id   uuid,
  p_new_status text,
  p_actor_id  uuid DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status text;
  v_post record;
  v_allowed boolean := false;
BEGIN
  SELECT id, status, owner_id, user_id, author_id, created_by,
         requester_id, provider_id
  INTO v_post FROM posts WHERE id = p_post_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Post not found');
  END IF;

  v_old_status := lower(COALESCE(v_post.status, 'open'));
  p_new_status := lower(p_new_status);

  v_allowed := CASE v_old_status
    WHEN 'open'        THEN p_new_status IN ('matched','in_progress','completed','cancelled','archived','deleted','hidden','draft')
    WHEN 'matched'     THEN p_new_status IN ('in_progress','completed','cancelled','open')
    WHEN 'in_progress' THEN p_new_status IN ('completed','cancelled')
    WHEN 'completed'   THEN false
    WHEN 'cancelled'   THEN p_new_status IN ('open','archived','deleted')
    WHEN 'archived'    THEN p_new_status IN ('open','deleted')
    WHEN 'deleted'     THEN false
    WHEN 'hidden'      THEN p_new_status IN ('open','deleted')
    WHEN 'draft'       THEN p_new_status IN ('open','deleted')
    ELSE false
  END;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object('ok', false,
      'message', format('Invalid status transition: %s -> %s', v_old_status, p_new_status));
  END IF;

  UPDATE posts
  SET status = p_new_status, updated_at = timezone('utc', now()),
      matched_at     = CASE WHEN p_new_status = 'matched'     THEN timezone('utc', now()) ELSE matched_at     END,
      in_progress_at = CASE WHEN p_new_status = 'in_progress' THEN timezone('utc', now()) ELSE in_progress_at END,
      completed_at   = CASE WHEN p_new_status = 'completed'   THEN timezone('utc', now()) ELSE completed_at   END,
      cancelled_at   = CASE WHEN p_new_status = 'cancelled'   THEN timezone('utc', now()) ELSE cancelled_at   END
  WHERE id = p_post_id;

  INSERT INTO post_status_history (post_id, actor_id, old_status, new_status)
  VALUES (p_post_id, p_actor_id, v_old_status, p_new_status);

  RETURN jsonb_build_object('ok', true, 'postId', p_post_id,
    'oldStatus', v_old_status, 'newStatus', p_new_status);
END;
$$;

-- 6. Grants (idempotent via DO blocks)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.role_routine_grants
    WHERE routine_schema='public' AND routine_name='transition_post_status'
      AND grantee='authenticated' AND privilege_type='EXECUTE'
  ) THEN
    GRANT EXECUTE ON FUNCTION public.transition_post_status(uuid, text, uuid) TO authenticated;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.role_routine_grants
    WHERE routine_schema='public' AND routine_name='transition_post_status'
      AND grantee='service_role' AND privilege_type='EXECUTE'
  ) THEN
    GRANT EXECUTE ON FUNCTION public.transition_post_status(uuid, text, uuid) TO service_role;
  END IF;
END $$;

-- 7. Index
CREATE INDEX IF NOT EXISTS idx_posts_status_created
  ON public.posts (status, created_at DESC);

-- 8. Reload schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
```

### Future Migration Strategy Recommendation

**Option A: Continue with `pending-migrations-bundle.sql` (NOT recommended)**

The manually-maintained bundle is fragile: it must be kept in sync with individual migration files, it has already drifted (missing all 35 post-2026-04-22 migrations), and it provides no audit trail. It also risks idempotency issues when re-running against a partially-applied database.

**Option B: Individual migrations + `_migrations` tracking table (RECOMMENDED)**

The project already has a `_migrations` table (from 20260709000000) and `record_migration()` / `migration_applied()` helper functions. This infrastructure should be used as follows:

1. Create a lightweight migration runner (a script or a Supabase Edge Function) that:
   - Reads all `.sql` files from `supabase/migrations/` in chronological order
   - Checks `migration_applied(filename)` before each one
   - Applies unapplied migrations inside a transaction
   - Calls `record_migration(filename, checksum, duration_ms)` on success
   - Aborts and reports on failure

2. The runner can be invoked:
   - Manually: `ssh ec2 ... "docker exec -i supabase-db psql -U postgres -d postgres" < run-migrations.sql`
   - Automatically: as part of the deploy pipeline (see below)

3. **Delete `pending-migrations-bundle.sql`** once the runner is in place — it becomes redundant and a source of confusion.

---

## Structural Issue: Missing Migration Deployment Pipeline

### The Problem

This project has **no automated migration deployment**. The `scripts/deploy-docker.sh` script only deploys the application container (env vars, health checks) — it does not run any database migrations. This means:

- Every local migration file must be manually applied to production
- There is no verification that all migrations have been applied
- There is no audit trail of what was applied and when
- The `_migrations` table exists but is not used by any deployment process

**This is the root cause of the `transition_post_status` production outage.** The migration was created locally, merged to the repo, but never applied to EC2. The app code assumed the function existed, resulting in a 500 error.

### The Recommendation

Add a migration-apply step to the deployment process. Two approaches:

**Approach 1: Extend `deploy-docker.sh`**

```bash
# Add to deploy() function, after container health check:
echo "==> Applying pending database migrations..."
ssh -i "${SSH_KEY}" "${DEPLOY_HOST}" << 'REMOTE'
  docker exec supabase-db psql -U postgres -d postgres -c \
    "SELECT public.migration_applied('placeholder');" >/dev/null 2>&1 || {
      echo "WARNING: _migrations table not found. Run migrations manually first."
      exit 0
    }
  # TODO: implement automated migration runner
REMOTE
```

**Approach 2: Separate `apply-migrations.sh` script**

```bash
#!/usr/bin/env bash
set -euo pipefail
# Usage: bash scripts/apply-migrations.sh [ssh-host] [ssh-key]

HOST="${1:-ec2-user@54.253.40.174}"
KEY="${2:-$HOME/.ssh/serviq-ec2-key.pem}"
MIGRATION_DIR="supabase/migrations"

# Get list of applied migrations from remote
APPLIED=$(ssh -i "$KEY" "$HOST" \
  "docker exec supabase-db psql -U postgres -d postgres -Atc \
    \"SELECT filename FROM public._migrations WHERE success = true;\"")

# Apply each unapplied migration in order
for f in $(ls "$MIGRATION_DIR"/*.sql | sort); do
  basename=$(basename "$f")
  if echo "$APPLIED" | grep -q "$basename"; then
    echo "✓ $basename (already applied)"
    continue
  fi
  echo "→ Applying $basename..."
  ssh -i "$KEY" "$HOST" \
    "docker exec -i supabase-db psql -U postgres -d postgres" < "$f"
  echo "✓ $basename applied"
done
```

Either approach should be added to the project's deployment workflow and documented in the README.

### What This Would Have Prevented

If a migration runner had been in place when `20260710000000_post_status_lifecycle.sql` was committed, it would have been applied to EC2 as part of the next deploy. The `transition_post_status` function would have existed, the `service_role` grant would have been in place, and the 500 error would never have occurred.

---

## Verification Statement

This report was generated using **read-only operations only**:
- `ssh` to EC2 for schema inspection
- `docker exec supabase-db psql -U postgres -d postgres -c "SELECT ..."` for all queries
- `docker exec supabase-db psql -U postgres -d postgres -c "\dt"`, `\df`, etc.
- `pg_tables`, `pg_class`, `pg_indexes`, `pg_policies`, `pg_constraint`, `pg_attribute`, `pg_publication_tables`, `pg_publication`, `information_schema.columns`, `information_schema.routines`, `information_schema.role_routine_grants`, `information_schema.triggers`

**Zero INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, or GRANT operations were performed on the EC2 database.**

No files were modified in the local repository except the creation of this report.
