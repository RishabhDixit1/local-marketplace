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

Open `http://localhost:3000`.

## Supabase Setup

Run SQL in this order (Supabase SQL Editor):

1. `supabase/secure_realtime_rls.sql`
2. `supabase/enable_realtime_publication.sql`
3. `supabase/seed_dashboard_demo.sql`
4. `supabase/seed_realtime_tabs_demo.sql` (optional, richer demo data)

Important:
- In Supabase SQL Editor, paste the SQL file contents and run them.
- Do not run filenames like `supabase/secure_realtime_rls.sql` as SQL text.

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
  - production: your Vercel domain
- Redirect URLs:
  - `http://localhost:3000/auth/callback`
  - `https://<your-production-domain>/auth/callback`

## Scripts

- `npm run dev` - run local dev server
- `npm run build` - production build
- `npm run start` - run production server
- `npm run lint` - lint codebase
- `npm run test:e2e` - run Playwright smoke tests
- `npm run test:e2e:headed` - run Playwright smoke tests in headed mode

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
- `PLAYWRIGHT_SKIP_WEBSERVER=1` to skip auto web server startup

## CI Authenticated E2E

GitHub Actions workflow: `.github/workflows/e2e-authenticated.yml`

Required repository secrets:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `E2E_MAGIC_LINK_URL`

Optional secret:
- `E2E_LOGIN_EMAIL`

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
