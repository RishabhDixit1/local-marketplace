# Local Marketplace

A realtime local marketplace platform connecting consumers and providers for services and products, with live chat, provider discovery, task/order workflow, and in-app notifications.

## Live Deployment

- App: https://local-marketplace-eta.vercel.app
- Repository: https://github.com/RishabhDixit1/local-marketplace

## Product Scope

- Consumer and provider dashboards
- Realtime chat with presence + typing indicators
- Provider discovery (people tab) with geo-based radius filtering
- Unified order/task lifecycle across consumer, provider, and task views
- Live notifications sourced from orders, messages, and reviews
- Marketplace feed with posts, listings, products, map, and trust surfaces

## Tech Stack

- Next.js 16 (App Router)
- React 19 + TypeScript
- Supabase (Auth, Postgres, Realtime, RLS)
- Tailwind CSS 4
- Playwright (authenticated smoke + welcome feed e2e)
- Vitest (fast unit tests for core business logic)

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Start the app

```bash
npm run dev
```

Open `http://localhost:3000` in your browser. Do not use `https://localhost:3000` for local development.
If a previous local Next dev process was left behind, rerunning `npm run dev` now cleans it up automatically before starting the app.

## Supabase Setup

### Automated (recommended)

Set your database connection string and run:

```bash
export SUPABASE_DB_URL='postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres'
npm run supabase:migrate
```

If your database password has special URL characters (for example `@`, `:`, `/`, `?`, `#`), URL-encode them first.
Example: use `%40` instead of `@` in the password segment.

Optional demo seeds:

```bash
npm run supabase:setup -- --with-seeds
```

### SQL Editor fallback (no direct DB access)

If your network cannot reach the direct database host (for example, IPv6-only routing issues), generate a single SQL bundle and run it in Supabase SQL Editor:

```bash
npm run supabase:sql-editor
```

This command copies canonical migrations + verification SQL to your clipboard.
Optional demo seeds can be included with:

```bash
npm run supabase:sql-editor -- --with-seeds
```

### Canonical migration source

Use only:

- `supabase/migrations/*.sql`

Legacy root-level SQL files in `supabase/` are retained for reference, but production should follow the migration runner to avoid schema drift.

Important:
- In Supabase SQL Editor, paste the SQL file contents and run them.
- Do not run filenames as SQL text.
- Set `SUPABASE_SERVICE_ROLE_KEY` in server environments (Vercel) for server-side publish APIs.
- Set `ADMIN_EMAIL_ALLOWLIST` for startup schema diagnostics banner (admin-only).

This enables:

- RLS hardening for core tables
- notifications table + trigger-based event fanout
- persistent unread tracking
- realtime table change streams via `supabase_realtime` publication
- profile geo columns (`latitude`, `longitude`)
- helper RPCs used by dashboard surfaces

Detailed notes: `supabase/README.md`

### Realtime verification

After setup, run `supabase/verify_realtime_setup.sql` and confirm publication entries + policies/triggers are present.

## Auth URL Configuration (Supabase)

In Supabase Dashboard -> Authentication -> URL Configuration:

- Site URL:
  - local: `http://localhost:3000`
  - production: `https://local-marketplace-eta.vercel.app`
- Redirect URLs:
  - `http://localhost:3000/auth/callback`
  - `http://127.0.0.1:3000/auth/callback`
  - `https://local-marketplace-eta.vercel.app/auth/callback`

Important:
- Production `Site URL` must never be localhost.
- `POST /api/auth/send-link` now derives the auth callback from the current request origin, so local logins stay on localhost and deployed logins stay on the active site host.
- `NEXT_PUBLIC_SITE_URL` should still be set per environment for canonical/share URLs and scripts:
  - local `.env.local`: `http://localhost:3000`
  - Vercel production env: `https://local-marketplace-eta.vercel.app`
- If a callback URL is missing from Redirect URLs, Supabase may still fall back to `Site URL`.

## Scripts

- `npm run dev` - run local dev server
- `npm run build` - production build
- `npm run start` - run production server
- `npm run lint` - lint codebase
- `npm run test:unit` - run Vitest unit tests
- `npm run test:e2e` - run Playwright smoke tests
- `npm run test:e2e:headed` - run Playwright smoke tests in headed mode
- `npm run test:e2e:auth` - run authenticated Playwright suite (auto-generates `E2E_MAGIC_LINK_URL` when possible)
- `npm run supabase:setup` - apply canonical Supabase migrations
- `npm run supabase:migrate` - apply migrations + verification checks
- `npm run supabase:sql-editor` - copy canonical migration SQL bundle for Supabase SQL Editor

## E2E Smoke Tests

Coverage includes:

- login request flow
- provider discovery
- start chat and send message
- create order
- task/status transition
- welcome feed card actions (render/share/context)

Optional env vars for full flow:

- `E2E_LOGIN_EMAIL` for login request smoke
- `E2E_MAGIC_LINK_URL` for authenticated smoke
- `SUPABASE_SERVICE_ROLE_KEY` to auto-generate `E2E_MAGIC_LINK_URL` when running `npm run test:e2e:auth`
- `E2E_ENABLE_LOGIN_REQUEST_SMOKE=1` to opt into login-request smoke (disabled by default in CI)
- `PLAYWRIGHT_SKIP_WEBSERVER=1` to skip auto web server startup

Authenticated E2E now uses Playwright `storageState` from `tests/e2e/.auth/user.json` generated in `tests/e2e/global-setup.ts`.

Recommended local authenticated run:

```bash
E2E_LOGIN_EMAIL=you@example.com SUPABASE_SERVICE_ROLE_KEY=... npm run test:e2e:auth
```

## CI Authenticated E2E

GitHub Actions workflow: `.github/workflows/e2e-authenticated.yml`

Required repository secrets:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Authentication secrets (choose one path):
- Path A: `E2E_MAGIC_LINK_URL`
- Path B: `SUPABASE_SERVICE_ROLE_KEY` + `E2E_LOGIN_EMAIL` (workflow auto-generates `E2E_MAGIC_LINK_URL`)

## Observability

Dashboard, chat, and tasks routes emit:
- client route views
- first-frame route performance
- Web Vitals (CLS, INP, LCP, FCP, TTFB)
- unhandled client errors / promise rejections

Optional forwarding env vars:
- `OBSERVABILITY_FORWARD_URL` - external ingest endpoint
- `OBSERVABILITY_FORWARD_TOKEN` - bearer token used when forwarding
- `NEXT_PUBLIC_OBSERVABILITY_DEBUG=1` - enable client capture in non-production environments

## Key Routes

- `/` - landing + auth
- `/dashboard` - unified marketplace feed
- `/dashboard/welcome` - visual live local feed
- `/dashboard/saved` - saved feed cards
- `/dashboard/chat` - realtime chat
- `/dashboard/people` - provider discovery + presence
- `/dashboard/tasks` - task board + status actions
- `/dashboard/orders` - consumer orders
- `/dashboard/provider/orders` - provider orders

## Deployment Notes

The project is deployed on Vercel:

- Production URL: https://local-marketplace-eta.vercel.app

For preview/production rollouts, use standard Vercel workflows connected to this GitHub repo.
