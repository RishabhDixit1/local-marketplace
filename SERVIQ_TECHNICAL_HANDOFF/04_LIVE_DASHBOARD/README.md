# ServiQ Live Dashboard

A self-contained HTML dashboard for viewing ServiQ's key metrics.

## Quick Start

```bash
# Open in browser
open dashboard/index.html
```

No build step, no dependencies. Just open the file.

## What It Shows

| Section | Description |
|---------|-------------|
| KPI Cards | Total Users, Providers, Orders, Revenue |
| User Growth | 30-day new user trend |
| Order Volume | 30-day order trend by status |
| Request Status | Open / Accepted / Completed / Cancelled |
| Provider Status | Active / Pending Verification / Verified |
| Category Demand | Requests, providers, conversion rate per category |
| Recent Activity | Latest signups, orders, reviews, AI queries |
| Geographic Coverage | Providers and requests by locality |

## How to Populate

The dashboard uses **placeholder data** (`[QUERY REQUIRED]`). To populate with real numbers:

1. Open Supabase SQL Editor (or connect via `psql`)
2. Find the SQL query shown on each metric card
3. Execute the query
4. Edit `dashboard/index.html` and replace the placeholders with results
5. Refresh the browser

All SQL queries are also listed in the HTML comments at the bottom of `index.html` and in `../03_PRODUCT_ANALYTICS/METRICS_DICTIONARY.md`.

## For a Live Dashboard

To make this pull real data automatically:

1. Create a Supabase Edge Function at `functions/v1/analytics`
2. Have it run the analytics queries and return JSON
3. Add a `<script>` block that fetches from that endpoint and updates the DOM
4. Deploy the Edge Function with `supabase functions deploy analytics`

## Files

```
04_LIVE_DASHBOARD/
  dashboard/
    index.html      # The dashboard (open in browser)
  README.md         # This file
```

## Related

- `03_PRODUCT_ANALYTICS/METRICS_DICTIONARY.md` — All SQL queries with definitions
- `03_PRODUCT_ANALYTICS/ANALYTICS_DEFINITION.md` — Analytics architecture
- `03_PRODUCT_ANALYTICS/DASHBOARD_REQUIREMENTS.md` — Full dashboard spec
