# ServiQ Engineering Handoff Package

**Prepared for:** Backend / Platform Engineering  
**Date:** August 2026  
**Status:** Production (beta)  
**Live URL:** https://www.serviqapp.com  
**Mobile:** Flutter 3.41.x (Android + iOS)

---

## What This Package Contains

This is a complete engineering handoff for the ServiQ platform - a hyperlocal services marketplace (like Urban Company) targeting Delhi NCR. It contains verified documentation generated from actual codebase inspection.

| Directory | Contents | Audience |
|-----------|----------|----------|
| `00_README/` | Navigation, system status, index | Everyone |
| `01_DEEP_TECHNICAL_DOCS/` | Architecture, schema, API, auth, security | Backend engineers |
| `02_ABSTRACTION_DOC/` | Product overview, user journeys, workflows | PMs, new engineers |
| `03_PRODUCT_ANALYTICS/` | Metrics definitions, event tracking | Data, backend |
| `04_LIVE_DASHBOARD/` | Interactive HTML dashboard | Everyone |
| `05_HANDOFF/` | Open issues, limitations, setup guide | Backend engineers |

---

## Read In This Order

1. **`00_README/SYSTEM_STATUS.md`** - What is actually working today (2 min)
2. **`05_HANDOFF/BACKEND_DEVELOPER_HANDOFF.md`** - 10-minute architecture overview (10 min)
3. **`01_DEEP_TECHNICAL_DOCS/SYSTEM_ARCHITECTURE.md`** - Full architecture (15 min)
4. **`01_DEEP_TECHNICAL_DOCS/DATABASE_SCHEMA.md`** - Table-by-table reference (20 min)
5. **`01_DEEP_TECHNICAL_DOCS/ER_DIAGRAM.md`** - Visual database relationships (5 min)
6. **`01_DEEP_TECHNICAL_DOCS/API_DOCUMENTATION.md`** - All 152 API routes (reference)
7. **`02_ABSTRACTION_DOC/BUSINESS_WORKFLOWS.md`** - What the product actually does (15 min)
8. **`04_LIVE_DASHBOARD/dashboard/index.html`** - Open in browser for live metrics
9. **`DOCUMENTATION_AUDIT_REPORT.md`** - What was verified vs assumed

---

## Architecture At A Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                  │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Next.js Web │  │ Flutter App  │  │  Public Site  │          │
│  │  (App Router)│  │  (Android/   │  │  (Landing)    │          │
│  │              │  │   iOS)       │  │              │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                  │                   │
│         └─────────────────┼──────────────────┘                  │
│                           │                                     │
│                    ┌──────▼───────┐                              │
│                    │  Next.js API  │                              │
│                    │  Routes (59)  │                              │
│                    │  152 endpoints│                              │
│                    └──────┬───────┘                              │
│                           │                                     │
│              ┌────────────┼────────────┐                        │
│              │            │            │                         │
│         ┌────▼────┐ ┌─────▼─────┐ ┌───▼─────┐                  │
│         │Supabase │ │  Razorpay │ │  Google  │                  │
│         │Postgres │ │  Payments │ │  Gemini  │                  │
│         │ + Auth  │ │           │ │   AI     │                  │
│         │ + RLS   │ │           │ │          │                  │
│         │ + RT    │ │           │ │          │                  │
│         └─────────┘ └───────────┘ └──────────┘                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Details |
|-------|-----------|---------|
| Web Frontend | Next.js 16 (App Router) | React 19, Tailwind CSS, Vercel deployment |
| Mobile | Flutter 3.41.x | Riverpod state, go_router navigation |
| Database | Supabase (Postgres 15) | 60+ tables, RLS, Realtime, 30+ RPC functions |
| Auth | Supabase Auth | Email, phone OTP, Google OAuth, Apple OAuth, magic link |
| Payments | Razorpay | Orders, payments, refunds, webhooks, subscriptions |
| AI | Google Gemini | Intent parsing, provider matching, quote drafting |
| Push Notifications | Firebase Cloud Messaging | Foreground, background, deep-link routing |
| Monitoring | Sentry (web), Firebase Crashlytics (mobile) | Error tracking, performance |
| Hosting | EC2 (nginx + Caddy), Vercel | API server, web frontend |
| Storage | Supabase Storage | Profile avatars, post media, listing images, review photos |
| i18n | 6 languages | English, Hindi, Bengali, Tamil, Telugu, Marathi |

---

## Current Product State (August 2026)

- **Live at:** https://www.serviqapp.com
- **Mobile:** APK built and verified (Android), iOS compile-time ready
- **Target market:** Delhi NCR (Crossing Republik, Shahberi, Gaur City, Greater Noida West)
- **Seed data:** 44+ localities, 5 market zones, 20+ service categories
- **Database:** 60+ tables, 66 migrations, 30+ RPC functions
- **API routes:** 59 route groups, 152 endpoints
- **Test suite:** 200+ Flutter tests, 50+ web unit tests, 10+ E2E tests

---

## Security Notes

- **No secrets included** in this package
- `.env.example` provided with placeholder values only
- Database credentials, API keys, and tokens are NOT included
- RLS policies enforced on all user-facing tables
- Rate limiting implemented on API routes
- Content moderation on AI queries and user posts

---

## Verification

Every statement in these documents is traceable to:
- Actual source code in the repository
- Database migration files (66 migrations, March-August 2026)
- Configuration files
- Existing documentation in `docs/`

Unverified information is explicitly marked with `[UNVERIFIED]`.

---

## Repository

- **GitHub:** https://github.com/RishabhDixit1/local-marketplace
- **Primary branch:** main
- **CI/CD:** GitHub Actions (deploy-ec2.yml, web-ci.yml, mobile-flutter.yml)
