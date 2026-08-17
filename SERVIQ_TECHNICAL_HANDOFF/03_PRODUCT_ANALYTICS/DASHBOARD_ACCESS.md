# Dashboard Access Guide

**Last updated:** August 2026

---

## Live Dashboard

A self-contained HTML dashboard is included at:

```
04_LIVE_DASHBOARD/dashboard/index.html
```

This is a **static HTML file** with no build step required.

---

## How to Use

### Step 1: Open the Dashboard

Open `dashboard/index.html` in any modern browser (Chrome, Firefox, Safari, Edge).

```bash
# From the project root
open SERVIQ_TECHNICAL_HANDOFF/04_LIVE_DASHBOARD/dashboard/index.html
```

Or simply double-click the file in your file manager.

### Step 2: View the Layout

The dashboard shows the full layout with:
- KPI cards (Total Users, Providers, Orders, Revenue)
- Chart placeholders
- Tables with category demand, geographic data
- Activity feed

All metric values show **[QUERY REQUIRED]** placeholders.

### Step 3: Run SQL Queries

Each metric section includes the SQL query needed to populate it. The full query list is also in the JavaScript comments at the bottom of `index.html`.

To run queries:

1. Open Supabase SQL Editor (or any PostgreSQL client connected to the ServiQ database)
2. Copy the SQL query from the dashboard
3. Execute the query
4. Note the result

### Step 4: Update the Dashboard

Replace the placeholder values in the HTML with your query results. The dashboard is designed for manual updates — edit the HTML file and refresh the browser.

### Step 5: For a Live Dashboard (Optional)

To make the dashboard pull live data automatically:

1. Create a Supabase Edge Function that runs the analytics queries
2. Have the dashboard fetch from that endpoint via `fetch()`
3. Update the DOM with the returned data

Example:
```javascript
async function loadMetrics() {
  const response = await fetch('https://your-project.supabase.co/functions/v1/analytics');
  const data = await response.json();
  document.getElementById('total-users').textContent = data.total_users;
  // ... update other elements
}
loadMetrics();
```

---

## What the Dashboard Shows

| Section | Metrics | Source |
|---------|---------|--------|
| **Header** | ServiQ Command Center, timestamp | — |
| **KPI Cards** | Total Users, Providers, Orders, Revenue | `profiles`, `services`, `orders` |
| **User Growth** | Daily new users (30-day chart) | `profiles` |
| **Request Activity** | Daily requests (30-day chart) | `orders` |
| **Request Status** | Open / Accepted / Completed / Cancelled | `orders` |
| **Provider Status** | Active / Pending / Verified | `services`, `profiles` |
| **Category Demand** | Category, Requests, Providers, Conversion | `service_categories`, `orders`, `services` |
| **Activity Feed** | Recent orders, reviews, signups | `orders`, `reviews`, `profiles` |
| **Geographic Heatmap** | Providers and requests by locality | `localities`, `profiles`, `orders` |

---

## Files

| File | Purpose |
|------|---------|
| `dashboard/index.html` | The dashboard (open in browser) |
| `README.md` | Quick start instructions |
| `../03_PRODUCT_ANALYTICS/METRICS_DICTIONARY.md` | All SQL queries with definitions |

---

## Limitations

- **Placeholder data only:** The dashboard does not connect to a live database
- **Manual updates required:** Edit the HTML to update numbers
- **No authentication:** The HTML file is static and has no auth
- **No real-time:** Refresh the page after updating data

For a production dashboard, see `03_PRODUCT_ANALYTICS/DASHBOARD_REQUIREMENTS.md`.
