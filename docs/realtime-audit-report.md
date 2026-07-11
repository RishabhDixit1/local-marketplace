# Supabase Realtime Instability — Full Audit Report

**Date:** 2026-07-11  
**Auditor:** opencode (read-only audit)  
**Target:** Serviq self-hosted Supabase on EC2 (`54.253.40.174`)  
**Status:** 🔴 ROOT CAUSE IDENTIFIED — Realtime container was never started

---

## Executive Summary

The five Realtime channels (`profile-live`, `notifications`, `unread-participants`, `unread-messages`, `feed-saves`) fail immediately with **503** because the `realtime` Docker container **does not exist** on the EC2 host. Kong (API gateway) attempts DNS resolution for `realtime-dev.supabase-realtime`, which maps to the Docker service name, but since no container is running, DNS returns a name error. Kong logs confirm this:

```
[lua] init.lua:381: execute(): DNS resolution failed: dns server error: 3 name error.
Tried: ["(short)realtime-dev.supabase-realtime:(na) - cache-miss",
        "realtime-dev.supabase-realtime:1 - cache-hit/stale/scheduled/dns server error: 3 name error",
        "realtime-dev.supabase-realtime.ap-southeast-2.compute.internal: 1 - cache-hit/stale/scheduled/dns server error: 3 name error"]
```

Every WebSocket upgrade request to `/realtime/v1/*` returns **503 Service Unavailable**.

**The fix:** Start the realtime container via `docker-compose up -d` on the EC2 host.

---

## 1. Container Health

### Findings

| Check | Result |
|-------|--------|
| `docker ps -a` (realtime-related) | Container `supabase-realtime` **does not exist** — not stopped, not crashed, never created |
| `docker images` (realtime-related) | **No Realtime Docker image found** — image was never pulled |
| `docker logs realtime-dev.supabase-realtime` | "No such container" |
| Other Supabase containers | Running (kong, auth, rest, storage, realtime-worker absent too) |

### Evidence

```
$ docker ps -a --filter "name=realtime"
CONTAINER ID   IMAGE   COMMAND   CREATED   STATUS    PORTS   NAMES
(empty)

$ docker images | grep -i realtime
(empty)
```

The `docker-compose.yml` on the EC2 host **does** define a `realtime` service, but it was never started. The realtime-worker is also absent.

### Root Cause

The Supabase stack was likely deployed without the realtime service, or it was removed at some point. Without pulling the `supabase/realtime` image and starting the container, all Realtime features are non-functional.

---

## 2. JWT Secret Consistency

### Findings

| Check | Result |
|-------|--------|
| `.env` JWT_SECRET | `13RfaYBVTWkQERcCpdSCDX0hUYygDMSI5k9qzkmj` |
| Kong JWT plugin | Uses `key_claim_name: "apikey"`, reads from query param |
| `ANON_KEY` (JWT) | Valid JWT with `role: anon`, `iss: supabase` |
| Realtime container auth | **N/A** — container doesn't exist |
| Supabase Studio | `AUTH_JWT_SECRET: ${JWT_SECRET}` — references same env var |

### Analysis

The JWT secret chain is:
1. Client obtains `ANON_KEY` from `.env.local` (derived from the same `JWT_SECRET`)
2. Client attaches `apikey` query param on WebSocket connect
3. Kong validates the JWT using its `jwt` plugin (consumer `anon`)
4. Kong passes the request to the realtime backend

The JWT chain is **structurally sound** — the same `JWT_SECRET` is used across all services. However, since the realtime container doesn't exist, step 4 fails at DNS/Kong level before JWT validation matters.

---

## 3. Realtime Service Configuration

### docker-compose.yml (EC2)

The `realtime` service is defined but never started:

```yaml
realtime:
  image: supabase/realtime:latest  # <-- image never pulled
  ...
  environment:
    DB_HOST: ${POSTGRES_HOST}
    DB_PORT: ${POSTGRES_PORT}
    ...
    JWT_SECRET: ${JWT_SECRET}
```

### Database Replication

| Check | Result |
|-------|--------|
| `wal_level` | `logical` ✅ |
| Publications | `supabase_realtime`, `supabase_realtime_messages_publication` ✅ |
| Replication slots | **0 rows** 🔴 |
| `_realtime` schema | Exists in DB ✅ |

Zero replication slots confirms no Realtime consumer has ever connected. The publications exist (likely created during initial Supabase setup), but nothing consumes them.

### Analysis

The database is correctly configured for Realtime (logical replication enabled, publications exist). The missing piece is the Realtime container that would create replication slots and stream changes.

---

## 4. Reverse Proxy / WebSocket Upgrade

### Kong (API Gateway)

| Route | Path | Target | Plugins |
|-------|------|--------|---------|
| `realtime-v1-ws` | `/realtime/v1/` | `http://realtime-dev:4000/socket/websocket` | `proxy_cache`, `cors`, `bot-detection` |
| `realtime-v1-ws` consumer ACL | `anon` group | ✅ | |

Kong config is correctly set up. The `realtime-dev` hostname resolves via Docker DNS to the realtime container — but the container doesn't exist.

**Kong error response (from curl test):**
```
HTTP/1.1 503 Service Unavailable
{"message":"Service is currently unavailable (DNS resolution failed)"}
```

### Nginx (Host-level)

```nginx
location /realtime/v1/ {
    proxy_pass http://127.0.0.1:8000;      # → Kong
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 60s;
}
```

WebSocket upgrade headers are properly configured. Nginx → Kong → Realtime chain is correct.

### Analysis

The entire reverse proxy chain is correctly configured:
- Client → Nginx (80/443) → Kong (8000) → Realtime (4000)

The failure point is Kong → Realtime, because the realtime container doesn't exist.

---

## 5. Client-Side Implementation

### Supabase Client Initialization

`lib/supabase.ts`:
```typescript
import { createBrowserClient } from "@supabase/ssr";
// Cached singleton, no custom realtime URL
// Uses default: ${SUPABASE_URL}/realtime/v1
```

### Channel Subscriptions (5 failing channels)

| Channel | File | Line | Status |
|---------|------|------|--------|
| `profile-live-${userId}` | `lib/profile/client.ts` | 57 | ❌ Fails |
| `notifications-${userId}` | `app/components/NotificationCenter.tsx` | 342 | ❌ Fails |
| `unread-participants-${userId}` | `lib/hooks/useUnreadChatCount.ts` | 169 | ❌ Fails |
| `unread-messages-${userId}` | `lib/hooks/useUnreadChatCount.ts` | 194 | ❌ Fails |
| `feed-saves-${userId}` | `app/dashboard/components/posts/useFeedActions.ts` | 209 | ❌ Fails |

### Reconnect / Retry Logic

**None.** All five channels:
- Subscribe once on mount
- Log errors to console
- Do NOT implement reconnect with backoff
- Do NOT implement exponential retry

Example pattern (all channels follow this):
```typescript
const channel = supabase
  .channel(`channel-name-${userId}`)
  .on("postgres_changes", { event: "*", schema: "public", table: "..." }, callback)
  .subscribe((status) => {
    if (status !== "SUBSCRIBED") {
      console.warn("Channel failed:", status);
    }
  });
```

### Analysis

The client-side implementation is functional but brittle:
1. **No reconnect logic** — if a channel fails, it stays failed until page reload
2. **No error state exposed** — failures are only logged to console, no UI feedback
3. **No connection state management** — users have no way to know Realtime is down
4. **Channel names are user-scoped** — each user gets their own channel (scales with user count)

---

## 6. Network / Connectivity Test

### curl from dev machine to Kong

```
GET /realtime/v1/websocket?apikey=eyJ...&vsn=1.0.0 HTTP/1.1
Host: 54.253.40.174:8000
```

**Response:**
```
HTTP/1.1 503 Service Unavailable
{"message":"Service is currently unavailable (DNS resolution failed)"}
```

### Kong Gateway Logs (from EC2)

```
2026/07/11 09:43:23 [warn] 22#22: *17794378 upstream server temporarily disabled
while connecting to upstream, client: 192.168.48.5, server: kong, request: "GET /realtime/v1/websocket?... HTTP/1.1"
```

```
[lua] init.lua:381: execute(): DNS resolution failed: dns server error: 3 name error.
Tried: ["(short)realtime-dev.supabase-realtime:(na) - cache-miss",
        "realtime-dev.supabase-realtime:1 - cache-hit/stale/scheduled/dns server error: 3 name error",
        "realtime-dev.supabase-realtime.ap-southeast-2.compute.internal: 1 - ...dns server error: 3 name error"]
```

**This is the definitive evidence.** Kong cannot resolve `realtime-dev.supabase-realtime` because no Docker container with that service name exists on the network.

---

## 7. Affected Business Features

| Feature | Status | Impact |
|---------|--------|--------|
| Profile live updates | 🔴 Broken | Users must refresh to see profile changes |
| Real-time notifications | 🔴 Broken | No push notification delivery via Realtime |
| Unread message count | 🔴 Broken | Chat badge count never updates live |
| Unread participant count | 🔴 Broken | Participant indicators are stale |
| Feed saves sync | 🔴 Broken | Saved posts don't sync across tabs/devices |

---

## 8. Remediation Plan

### Immediate Fix (Critical)

```bash
# On EC2 via SSH
ssh -i ~/.ssh/serviq-ec2-key.pem ec2-user@54.253.40.174

cd /home/ec2-user/supabase

# Pull the realtime image
docker-compose pull realtime

# Start the realtime service
docker-compose up -d realtime realtime-worker

# Verify it's running
docker-compose ps realtime
docker logs realtime-dev.supabase-realtime --tail 50
```

After starting, verify:
1. `docker-compose ps realtime` shows `Up` status
2. `curl http://54.253.40.174:8000/realtime/v1/health` returns OK
3. Replication slots appear: `SELECT * FROM pg_replication_slots;`
4. Client channels transition to `SUBSCRIBED` status

### Follow-up Improvements

1. **Add reconnect logic** to all Realtime channels with exponential backoff
2. **Add connection state UI** — show a banner when Realtime is disconnected
3. **Add health monitoring** — periodic check of Realtime health endpoint
4. **Pin the Realtime image version** instead of using `latest`
5. **Add Docker healthcheck** to the realtime service in docker-compose

---

## Conclusion

The root cause is singular and clear: **the Supabase Realtime container was never started on the EC2 host.** All infrastructure around it (database publications, Kong routing, Nginx WebSocket upgrade, client subscriptions) is correctly configured. The only missing piece is the container itself.

Starting the container should restore all five Realtime channels immediately.
