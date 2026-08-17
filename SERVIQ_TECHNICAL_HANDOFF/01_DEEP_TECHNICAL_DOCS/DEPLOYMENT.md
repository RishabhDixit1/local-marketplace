# ServiQ Deployment

## 1. Architecture Overview

### 1.1 System Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                        USERS                                │
│   (Mobile: iOS/Android)     (Web: Browser)                  │
└─────────────┬───────────────────────────┬───────────────────┘
              │                           │
              ▼                           ▼
┌─────────────────────┐     ┌─────────────────────────────────┐
│   Firebase FCM      │     │        Vercel (Next.js)        │
│   (Push to Mobile)  │     │   www.serviqapp.com:443        │
└─────────────────────┘     └─────────────┬───────────────────┘
                                          │
                                          ▼
                              ┌─────────────────────────────────┐
                              │        EC2 (Supabase)          │
                              │   54.253.40.174:8000           │
                              │   Kong → PostgREST/GoTrue/etc  │
                              └─────────────────────────────────┘
```

### 1.2 Components
| Component | Host | Status |
|-----------|------|--------|
| Next.js Web | Vercel | ✅ Production |
| Flutter Mobile | Local build → App Stores | ✅ Production |
| Supabase | EC2 (self-hosted) | ✅ Production |
| Razorpay | Razorpay Cloud | ✅ Production |
| Firebase | Firebase Cloud | ✅ Production |
| Sentry | Sentry Cloud | ✅ Production |

---

## 2. Web Deployment (Vercel)

### 2.1 Build Configuration
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install",
  "framework": "nextjs",
  "nodeVersion": "20.x"
}
```

### 2.2 Environment Variables (Vercel Dashboard)
```
# Supabase
SUPABASE_URL=https://www.serviqapp.com
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Razorpay
RAZORPAY_KEY_ID=rzp_live_xxx
RAZORPAY_KEY_SECRET=xxx
RAZORPAY_WEBHOOK_SECRET=xxx
RAZORPAY_MODE=live

# Firebase
FIREBASE_SERVICE_ACCOUNT_JSON=xxx
FIREBASE_PROJECT_ID=xxx

# Analytics
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-xxx

# Cron
CRON_SECRET=xxx

# Sentry
SENTRY_DSN=https://xxx@sentry.io/xxx
```

### 2.3 Deployment Process
1. Push to `main` branch
2. Vercel auto-deploys (1-2 minutes)
3. Preview deploys for PRs
4. Custom domain: `www.serviqapp.com`
5. SSL: Automatic (Let's Encrypt)

### 2.4 Build Optimization
- **Edge functions:** Not used (standard serverless)
- **ISR:** Not used (dynamic content)
- **Static generation:** Limited (mostly dynamic routes)
- **Bundle analysis:** `@next/bundle-analyzer`

---

## 3. Mobile Deployment (Flutter)

### 3.1 Build Commands

#### Android Release APK
```bash
cd mobile
flutter build apk --release \
  --dart-define=APP_ENV=production \
  --dart-define=SUPABASE_URL=https://www.serviqapp.com \
  --dart-define=SUPABASE_ANON_KEY=xxx \
  --dart-define=API_BASE_URL=https://www.serviqapp.com \
  --dart-define=FIREBASE_API_KEY=xxx \
  --dart-define=FIREBASE_PROJECT_ID=xxx \
  --dart-define=FIREBASE_MESSAGING_SENDER_ID=xxx \
  --dart-define=FIREBASE_ANDROID_APP_ID=xxx \
  --dart-define=FIREBASE_IOS_APP_ID=xxx
```

#### Android Release AAB (Google Play)
```bash
flutter build appbundle --release --dart-define=APP_ENV=production ...
```

#### iOS Release IPA
```bash
flutter build ipa --release --dart-define=APP_ENV=production ...
```

### 3.2 Build Artifact
```
mobile/release/apk/serviq-mobile-1.0.0-YYYYMMDD-release.apk
```

### 3.3 Signing

#### Android
- **Keystore:** `mobile/android/app/serviq-release.jks`
- **Certificate:** CN=ServiQ
- **Verification:** `apksigner verify --print-certs` (v2+v3 signing)

#### iOS
- **Provisioning:** Apple Developer account required
- **Signing:** Xcode auto-manages (or manual in `ios/Runner.xcodeproj`)

### 3.4 Store Submission

#### Google Play Console
1. Upload AAB to Internal Testing track
2. Add release notes
3. Roll out to Production (100%)

#### Apple App Store Connect
1. Archive IPA via Xcode
2. Upload to App Store Connect
3. Add release notes
4. Submit for App Review

---

## 4. EC2 Deployment (Supabase)

### 4.1 Instance Details
- **IP:** 54.253.40.174
- **OS:** Amazon Linux 2
- **Type:** t3.medium (or similar)
- **Region:** ap-southeast-1

### 4.2 Docker Compose
```yaml
# /home/ec2-user/supabase/docker-compose.yml
version: "3.8"
services:
  supabase-db:
    image: supabase/postgres:15.6.1
    ports: ["5432:5432"]
    volumes: ["./data/postgres:/var/lib/postgresql/data"]

  supabase-auth:
    image: supabase/gotrue:v2.158.1
    ports: ["9999:9999"]
    depends_on: [supabase-db]

  supabase-rest:
    image: postgrest/postgrest:v12.2.3
    ports: ["3000:3000"]
    depends_on: [supabase-db]

  supabase-kong:
    image: Kong:2.1.1
    ports: ["8000:8000"]
    depends_on: [supabase-auth, supabase-rest]

  supabase-realtime:
    image: supabase/realtime:v2.76.5
    ports: ["4000:4000"]
    depends_on: [supabase-db]

  supabase-storage:
    image: supabase/storage-api:v1.11.13
    ports: ["5000:5000"]
    depends_on: [supabase-db]

  supabase-meta:
    image: supabase/postgres-meta:v0.84.2
    ports: ["8080:8080"]
    depends_on: [supabase-db]
```

### 4.3 Start Commands
```bash
# SSH into EC2
ssh -i serviq-key.pem ec2-user@54.253.40.174

# Start all Supabase services
cd /home/ec2-user/supabase
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f supabase-realtime
```

### 4.4 Nginx Configuration
```nginx
# /etc/nginx/conf.d/supabase.conf
server {
    listen 80;
    server_name www.serviqapp.com;

    location /rest/v1/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /auth/v1/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /storage/v1/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /realtime/v1/websocket {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

---

## 5. Database Migration

### 5.1 Migration Process
```bash
# Generate migration
supabase migration new <migration_name>

# Apply to local
supabase db push

# Apply to production (via Supabase Dashboard or direct SQL)
psql $DATABASE_URL < supabase/migrations/<timestamp>_<name>.sql
```

### 5.2 Migration Safety Rules
1. **Never drop columns** in production without backup
2. **Always add columns as nullable** or with defaults
3. **Test on local** before production
4. **Backup before** major schema changes
5. **Use `CREATE OR REPLACE`** for functions (avoids type-change errors)
6. **`DROP FUNCTION` first** if changing return types

### 5.3 Current Schema Version
- **40+ migrations** applied
- **Key tables:** profiles, orders, messages, posts, service_listings, product_catalog
- **RLS:** Enabled on all tables

---

## 6. Backup & Recovery

### 6.1 Database Backup
- **Schedule:** Daily at 02:30 UTC via GitHub Actions
- **Storage:** AWS S3 bucket
- **Retention:** 30 days
- **Verification:** Daily check (backup < 27h old and > 1MB)

### 6.2 Backup Script
```bash
# scripts/backup-db.sh
pg_dump $DATABASE_URL | gzip | \
  aws s3 cp - s3://$BACKUP_S3_BUCKET/backups/$(date +%Y%m%d).sql.gz

# Cleanup old backups
aws s3 ls s3://$BACKUP_S3_BUCKET/backups/ | \
  awk '$4 < "'$(date -d '30 days ago' +%Y%m%d)'" {print $4}' | \
  xargs -I {} aws s3 rm s3://$BACKUP_S3_BUCKET/backups/{}
```

### 6.3 Restore Process
```bash
# Download backup
aws s3 cp s3://$BACKUP_S3_BUCKET/backups/20260815.sql.gz /tmp/restore.sql.gz
gunzip /tmp/restore.sql.gz

# Restore (requires downtime)
psql $DATABASE_URL < /tmp/restore.sql
```

### 6.4 Recovery Time Objective (RTO)
- **Target:** 2 hours
- **Actual:** 1-2 hours (depending on database size)

### 6.5 Recovery Point Objective (RPO)
- **Target:** 24 hours (daily backups)
- **Actual:** 24 hours

---

## 7. Monitoring & Uptime

### 7.1 Uptime Checks
- **Workflow:** `.github/workflows/uptime-check.yml`
- **Schedule:** Every 15 minutes
- **Checks:**
  - `www.serviqapp.com` returns 200
  - `/api/health` returns 200
  - Kong `https://www.serviqapp.com/rest/v1/` returns 401 (unauthenticated)
- **Alert:** Opens/closes GitHub issue labeled `uptime`

### 7.2 Error Tracking
- **Sentry:** Web errors + performance
- **Firebase Crashlytics:** Mobile crashes
- **Console logs:** Server-side errors

### 7.3 Performance Monitoring
- **Vercel Analytics:** Web Core Web Vitals
- **Firebase Performance:** Mobile traces
- **Custom logging:** API response times

---

## 8. CI/CD Pipeline

### 8.1 GitHub Actions
```yaml
# .github/workflows/backup-db.yml — Daily backup
# .github/workflows/backup-verify.yml — Backup verification
# .github/workflows/uptime-check.yml — 15-minute health checks
```

### 8.2 Deployment Flow
```
Code Push → GitHub Actions → Vercel Deploy (web)
                          → Flutter Build (mobile, manual)
                          → EC2 SSH (Supabase, manual)
```

### 8.3 Manual Steps
- **Mobile release:** Run build command locally, submit to stores
- **Supabase migrations:** SSH into EC2, apply via psql
- **Environment variables:** Update in Vercel dashboard, EC2 env files
