# Database Operations & Disaster Recovery

Self-hosted Supabase on EC2 (`54.253.40.174`, Postgres in the `supabase-db`
Docker container). This doc covers backup cadence, restore procedure, and the
automated monitoring that guards them.

## Backup (automated)

- **Schedule**: daily 02:00 UTC via `.github/workflows/backup-db.yml`.
- **Method**: `scripts/backup-db.sh` runs on EC2, `pg_dump` (no-owner/no-acl)
  inside the Postgres container, gzip, upload to S3.
- **Destination**: `s3://<AWS_BACKUP_S3_BUCKET>/serviq/db/<ISO-timestamp>.sql.gz`
- **Retention**: 30 days (S3 cleanup in the same script).
- **RPO target**: 24 hours (a daily backup means at most 24h of data loss).

### Verify a backup ran

1. Check the workflow run: GitHub > Actions > "Database Backup" (last run should
   be green).
2. `aws s3 ls s3://<bucket>/serviq/db/ | tail -3` - confirm a file dated today.
3. Freshness is also guarded automatically by `.github/workflows/backup-verify.yml`
   (02:30 UTC daily): it fails if the newest backup is older than 27h or smaller
   than 1 MB, and pings Slack.

## Restore (manual, DR drill)

Download the gzip and pipe into psql. Two paths depending on the target:

**Path A - into a fresh Supabase Postgres container (same host):**
```bash
docker exec -i supabase-db psql -U postgres -d postgres < backup.sql
```

**Path B - from S3 (any Postgres):**
```bash
DATABASE_URL="postgresql://user:pass@host:5432/db" \
AWS_ACCESS_KEY_ID=xxx AWS_SECRET_ACCESS_KEY=xxx \
RESTORE_S3_BUCKET=<bucket> RESTORE_KEY=serviq/db/<file>.sql.gz \
bash scripts/restore-db.sh
```

> `restore-db.sh` pipes a raw `pg_dump` restore into the live database - it does
> NOT drop/recreate, and runs against whatever `DATABASE_URL` points at. Point it
> at a scratch DB first; never at the live DB without a plan.

### RTO target: 2 hours

Time to detect + restore from the newest S3 object on a fresh Postgres, then
point Supabase/Kong back at it.

### Restore drill checklist (quarterly, or before beta)

- [ ] Confirm newest S3 backup object exists and is > 1 MB (backup-verify passes).
- [ ] Provision a scratch Postgres (or second Supabase container) on a non-prod host.
- [ ] Restore via Path A/B and confirm row counts match `backup-db.sh` log
      (compare `profiles`, `orders`, `messages`).
- [ ] Run a smoke query: `select count(*) from profiles;` and one RLS-affected
      query through the API (restored data must pass RLS).
- [ ] Verify auth works: sign in with a seeded account on the restored DB.
- [ ] Record the drill result in `docs/LAUNCH_CHECKLIST.md` (5.9 / DR item).

## Monitoring (automated)

- **`.github/workflows/uptime-check.yml`** - every 15 min checks:
  - `https://www.serviqapp.com` (expect 200)
  - `https://www.serviqapp.com/api/health` (expect 200, `ok:true`)
  - `https://www.serviqapp.com/rest/v1/` Supabase Kong over HTTPS (expect 401 = service alive)
  - On failure: opens one labeled `uptime` GitHub issue (comments on the same
    open issue during an outage, so no spam). On recovery: closes it.
- **`.github/workflows/backup-verify.yml`** - daily at 02:30 UTC verifies the
  newest backup is fresh and non-trivial; Slack on failure.
- Slack notifications need `SLACK_BACKUP_WEBHOOK` (used by both failure paths).

### Known monitoring gaps

- Supabase Kong is now checked over HTTPS (`https://www.serviqapp.com/rest/v1/`,
  expect 401). If the optional `supabase.serviqapp.com` host split is done later
  (Route 53 A record + certbot), point the check at
  `https://supabase.serviqapp.com/rest/v1/`.
- No alerting for disk space on EC2 or the Postgres WAL volume. Add a cron check
  (`df -h` + `docker system df`) before beta if EC2 monitoring is not in place.
- Restore is not exercised on a schedule yet - first drill is a launch gate.
