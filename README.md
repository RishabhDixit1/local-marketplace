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
- Playwright (smoke e2e)

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
2. `supabase/seed_dashboard_demo.sql`
3. `supabase/seed_realtime_tabs_demo.sql` (optional, richer demo data)

This enables:

- RLS hardening for core tables
- notifications table + trigger-based event fanout
- persistent unread tracking
- profile geo columns (`latitude`, `longitude`)
- helper RPCs used by dashboard surfaces

Detailed notes: `supabase/README.md`

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

Optional env vars for full flow:

- `E2E_LOGIN_EMAIL` for login request smoke
- `E2E_MAGIC_LINK_URL` for authenticated smoke
- `PLAYWRIGHT_SKIP_WEBSERVER=1` to skip auto web server startup

## Key Routes

- `/` - landing + auth
- `/dashboard` - unified marketplace feed
- `/dashboard/chat` - realtime chat
- `/dashboard/people` - provider discovery + presence
- `/dashboard/tasks` - task board + status actions
- `/dashboard/orders` - consumer orders
- `/dashboard/provider/orders` - provider orders

## Deployment Notes

The project is deployed on Vercel:

- Production URL: https://local-marketplace-eta.vercel.app

For preview/production rollouts, use standard Vercel workflows connected to this GitHub repo.
