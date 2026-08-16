# Supabase HTTPS Provisioning Runbook (Checklist item 3.8)

> **Status: DONE — verified Aug 14, 2026.** Production mobile builds reach
> Supabase over HTTPS; the Realtime 503 is fixed. See "What was actually done"
> below for the exact fix (simpler than the original plan - no new DNS or certs
> were needed).
>
> Owner: [Ops]. Originally target: before 5 Sep beta (top launch-blocking item #1).
> That blocker is now closed.

## What was actually done (Aug 14, 2026)

The EC2 nginx already terminated TLS for `serviqapp.com`/`www.serviqapp.com`
(Let's Encrypt) and proxied all four Supabase path prefixes to Kong on
`127.0.0.1:8000`:

- `/auth/v1/`, `/rest/v1/`, `/storage/v1/` -> Kong (REST)
- `/realtime/v1/` -> Kong with `Upgrade`/`Connection: upgrade` (Realtime over Kong)

So **no DNS records and no new certificates were required**. The production
mobile build now uses:

```
--dart-define=SUPABASE_URL="https://www.serviqapp.com"
```

The Supabase client appends `/rest/v1`, `/auth/v1`, `/storage/v1`, and
`/realtime/v1/websocket` to that base URL - all four are already proxied.

**Realtime 503 root cause + fix**: the `supabase-realtime` container was never
running (Kong returned 503 for `/realtime/v1/*`). Fixed on the EC2 box:

```bash
cd /home/ec2-user/supabase
docker-compose up -d realtime   # image supabase/realtime:v2.76.5, restart: unless-stopped
```

Verification (Aug 14):

```bash
curl -sI https://www.serviqapp.com/rest/v1/          # 401 = Kong alive over HTTPS
curl -s -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" \
     -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
     "https://www.serviqapp.com/realtime/v1/websocket?apikey=<ANON>&vsn=1.0.0" -o /dev/null -w "%{http_code}\n"
# 101 Switching Protocols (raw handshake; was 503 before the fix)
```

Release APK built with the HTTPS URL and verified on emulator-5554: Supabase
bootstrap completes, Kong REST returns 401 (service alive), realtime websocket
upgrades. Artifact:
`mobile/release/apk/serviq-mobile-1.0.0-20260814-release-verify-https.apk`.

**Still open (optional)**: a clean host split where Supabase is served from its
own hostname. The original plan below (Route 53 A records for
`supabase.serviqapp.com`/`realtime.serviqapp.com` + certbot) is preserved for
that. Note the Caddyfile in `scripts/` is stale: Realtime does NOT listen on
host port 4000 - it is only reachable through Kong on port 8000, so
`realtime.serviqapp.com -> localhost:4000` must become `localhost:8000`.

---

## Original problem

The Android release manifest blocks cleartext traffic
(`usesCleartextTraffic="false"`), and a production mobile build must therefore
reach Supabase over HTTPS. Today:

- Live server runs **nginx 1.30.0** (the repo's Caddy TLS script
  `scripts/setup-ec2-tls.sh` was never applied).
- `supabase.serviqapp.com` and `realtime.serviqapp.com` have **no DNS records**
  (verified: `dig +short` returns nothing).
- Supabase Kong is only reachable at cleartext
  `http://54.253.40.174:8000` (returns 401 on a bare request = Kong is up).
- `serviqapp.com` returns 301 (nginx), `www.serviqapp.com` returns 200 (Vercel).

## Goal

Provide `https://supabase.serviqapp.com` (Kong, port 8000) and
`https://realtime.serviqapp.com` (Realtime, port 4000) so the mobile build can
use `SUPABASE_URL=https://supabase.serviqapp.com`.

## Prerequisites

- SSH access to the EC2 instance (`ec2-user@<EC2_HOST>`, key in hand).
- DNS provider access (the registrar/DNS hosting for `serviqapp.com`).
- Ports 80/443 open in the EC2 security group.

## Step 1 — Add DNS records

Add **A records** pointing to the EC2 public IP `54.253.40.174`:

| Name                    | Type | Value            | TTL |
|-------------------------|------|------------------|-----|
| `supabase.serviqapp.com` | A    | `54.253.40.174`  | 300 |
| `realtime.serviqapp.com` | A    | `54.253.40.174`  | 300 |

Wait for propagation, then verify from a laptop:

```bash
dig +short supabase.serviqapp.com   # -> 54.253.40.174
```

## Step 2 — Terminate TLS

Two options. Pick one; the repo's assets target Option A.

### Option A (recommended) — Caddy

The repo already ships `scripts/Caddyfile` (TLS for `serviqapp.com`,
`supabase.serviqapp.com`, `realtime.serviqapp.com`, staging) and
`scripts/setup-ec2-tls.sh` which installs Caddy, stops nginx, deploys the
Caddyfile, and verifies. Run it on the box:

```bash
ssh ec2-user@<EC2_HOST> 'bash -s' < scripts/setup-ec2-tls.sh
```

Check the current `scripts/Caddyfile` reverse_proxy targets before running:

- `supabase.serviqapp.com` → `localhost:8000` (Kong) - includes a WebSocket
  upgrade block (Realtime-over-Kong).
- `realtime.serviqapp.com` → `localhost:4000` (direct Realtime) - includes the
  same WebSocket block.
- `serviqapp.com` → `localhost:3000` (Next.js). Confirm the app is actually
  running on EC2 port 3000, or repoint this block to Vercel/`www` if the API
  now lives there.

### Option B — nginx (current server)

Since the server already runs nginx, add TLS server blocks instead. Sample:

```nginx
server {
    listen 443 ssl http2;
    server_name supabase.serviqapp.com;

    ssl_certificate     /etc/letsencrypt/live/supabase.serviqapp.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/supabase.serviqapp.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

server {
    listen 443 ssl http2;
    server_name realtime.serviqapp.com;

    ssl_certificate     /etc/letsencrypt/live/realtime.serviqapp.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/realtime.serviqapp.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Obtain certificates with certbot:

```bash
sudo apt-get update && sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d supabase.serviqapp.com -d realtime.serviqapp.com
sudo nginx -t && sudo systemctl reload nginx
```

## Step 3 — Verify

```bash
# Supabase Kong over HTTPS (expect HTTP 401 from Kong - that means TLS works)
curl -sI https://supabase.serviqapp.com | head -3

# Realtime WebSocket upgrade works
curl -s -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  https://realtime.serviqapp.com -o /dev/null -w "%{http_code}\n"

# DNS resolves
dig +short supabase.serviqapp.com realtime.serviqapp.com
```

## Step 4 — Point builds at the HTTPS URL

No code change needed; the production build already targets
`https://supabase.serviqapp.com` (see docs/serviq-technical-architecture.md and
AGENTS.md RELEASE BUILD COMMAND). Once TLS is up:

1. Rebuild the prod verification APK:
   `mobile/release/apk/serviq-mobile-1.0.0-20260809-release-verify-prod.apk`
   is stale until then.
2. Re-run on-device verification: sign in, push a test FCM message, confirm
   Realtime subscriptions connect over `wss://supabase.serviqapp.com`.

## Step 5 — Housekeeping

- Update `.env.ec2.example` comment for `SUPABASE_URL` (now `https://...`).
- Update `docs/LAUNCH_CHECKLIST.md` item 3.8 to ✅ once verified.
- Optionally keep nginx as a fallback or remove it after Caddy takes over.

## Rollback

Caddy: `sudo systemctl stop caddy && sudo systemctl start nginx` (restores the
previous nginx config; verify `serviqapp.com` still serves). DNS: remove the
two A records. No mobile code change is required either way.

---

## Why this blocks mobile

- `AppConfig` production path uses `SUPABASE_URL` from `--dart-define`; the
  value `https://supabase.serviqapp.com` is baked into the APK.
- Android release has `usesCleartextTraffic="false"`; the old
  `http://54.253.40.174:8000` URL would be refused by the OS in release.
- Realtime, auth redirects, and FCM message payloads all route through the
  Supabase URL, so OTP/auth and live chat also fail until TLS + DNS are live.
