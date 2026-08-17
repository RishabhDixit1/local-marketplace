# Dashboard Requirements

**Last updated:** August 2026  
**Status:** Spec only (not yet implemented)

---

## Overview

ServiQ currently has no admin dashboard. All operational queries are run manually against the Supabase database. This document specifies the requirements for a production admin dashboard.

---

## 1. Executive Dashboard (Home)

### KPI Cards (Top Row)

| Metric | Definition | Refresh |
|--------|-----------|---------|
| Total Users | `count(*) FROM profiles` | Real-time |
| Total Providers | `count(DISTINCT profile_id) FROM services WHERE is_active` | Real-time |
| Total Orders | `count(*) FROM orders` | Real-time |
| Total Revenue | `sum(total_amount) FROM orders WHERE status='completed'` | Real-time |
| MRR | `sum(price_paise) FROM provider_subscriptions JOIN subscription_plans WHERE status='active'` | Real-time |
| Avg Trust Score | `avg(trust_score) FROM trust_scores` | Daily |

### Charts (Below KPIs)

1. **User Growth (30-day):** Line chart, daily new users
2. **Order Volume (30-day):** Bar chart, daily orders by status
3. **Revenue (30-day):** Line chart, daily revenue in rupees
4. **Request Funnel:** Funnel chart (posted → matched → quoted → booked → completed)

---

## 2. Users Tab

### User List
- Paginated table with search
- Columns: Name, Email, Phone, Role, Locality, Verified, Created, Last Active
- Filters: Role, Locality, Verification status, Date range
- Click → User detail page

### User Detail
- Profile info, contact details
- Orders (as buyer and as provider)
- Reviews (given and received)
- Chat activity
- Verification documents
- Activity timeline (from task_events, messages, orders)

### User Analytics
- Registrations over time (line chart)
- Users by role (pie chart)
- Users by locality (bar chart / map)
- Verification funnel (email → phone → identity → business)

---

## 3. Providers Tab

### Provider List
- Paginated table with search
- Columns: Name, Category, Locality, Trust Score, Orders, Rating, Status, Joined
- Filters: Category, Locality, Trust score range, Verification status, Subscription plan
- Click → Provider detail page

### Provider Detail
- Profile info, services, portfolio
- Trust score breakdown (6 inputs)
- Order history and completion rate
- Reviews and ratings
- Subscription status
- Payout history
- Availability schedule
- Verification documents

### Provider Analytics
- Providers by category (bar chart)
- Trust score distribution (histogram)
- Provider growth over time (line chart)
- Provider utilization rate (active this month / total)
- Top providers by orders, rating, revenue

---

## 4. Orders Tab

### Order List
- Paginated table with search
- Columns: Order ID, Buyer, Provider, Category, Status, Amount, Created, Completed
- Filters: Status, Category, Date range, Amount range, Provider
- Click → Order detail page

### Order Detail
- Full order timeline (from task_events)
- Buyer and provider info
- Quote details and line items
- Payment status and Razorpay IDs
- Review (if completed)
- Chat messages (if any)

### Order Analytics
- Orders by status (donut chart)
- Orders over time (stacked bar by status)
- Average order value over time (line chart)
- Average time to completion (line chart)
- Completion rate (line chart)
- Revenue by category (bar chart)

---

## 5. AI / Intent Engine Tab

### Intent Log List
- Paginated table
- Columns: User, Raw Input, Strategy, Results, Latency, Timestamp
- Filters: Strategy, Date range, Result count
- Click → Intent detail page

### Intent Detail
- Raw input and parsed intent
- Matched providers with scores
- User feedback (if any)
- Latency breakdown

### Intent Analytics
- Queries per day (line chart)
- AI vs keyword fallback ratio (pie chart)
- Average latency (line chart)
- Top searched categories (bar chart)
- Zero-result queries (table)
- Feedback distribution (helpful / not relevant / no results)

---

## 6. Chat Tab

### Conversation List
- Paginated table
- Columns: Participants, Message Count, Last Message, Created, Has Images
- Filters: Date range, Message count range

### Conversation Analytics
- Conversations per day (line chart)
- Average messages per conversation (line chart)
- Image attachment rate (%)
- Response time distribution

---

## 7. Revenue Tab

### Revenue Overview
- Total revenue (all time)
- Revenue this month
- MRR (Monthly Recurring Revenue)
- Commission collected
- Refund total
- Net revenue

### Revenue Charts
- Revenue over time (line chart, daily/weekly/monthly)
- Revenue by category (bar chart)
- Commission vs provider earnings (stacked bar)
- Subscription revenue breakdown (bar chart by plan)
- Payout history (line chart)

---

## 8. Geography Tab

### Coverage Map
- Interactive map (Google Maps / Leaflet)
- Markers for providers by locality
- Heatmap for request density
- Click → Locality detail

### Locality Detail
- Provider count, request count
- Top categories
- Average trust score
- Completion rate
- Growth over time

---

## 9. Notifications Tab

### Notification Analytics
- Notifications sent per day (line chart)
- By channel: push, SMS, email, in-app (stacked bar)
- Delivery rate
- Click rate (if trackable)

### SMS Log
- Recent SMS notifications
- Status (sent, delivered, failed)
- Recipient, message, timestamp

---

## 10. Subscriptions Tab

### Subscription Overview
- Free providers count
- Essential subscribers count
- Premium subscribers count
- MRR
- Churn rate

### Subscription Analytics
- Plan distribution (pie chart)
- MRR over time (line chart)
- New subscriptions per week (bar chart)
- Churn over time (line chart)

---

## 11. System Health Tab

### Infrastructure
- EC2 status (CPU, memory, disk)
- Docker container status (PostgreSQL, Kong, GoTrue, PostgREST, Realtime, Storage)
- Database connections
- Active realtime subscriptions

### Error Monitoring
- Recent errors (from logs)
- Crashlytics crash rate
- API response times (p50, p95, p99)
- Failed payment webhooks

---

## 12. Technical Requirements

### Stack (Recommended)
- **Frontend:** Next.js (same stack as ServiQ web)
- **Charts:** Recharts or Chart.js
- **Maps:** Leaflet + OpenStreetMap
- **Auth:** Supabase Auth (admin-only role)
- **Data:** Supabase REST API or direct PostgreSQL queries
- **Real-time:** Supabase Realtime for live KPI updates

### Access Control
- Admin-only (check `is_admin` flag in profiles)
- Read-only for most views
- Destructive actions (ban user, delete content) require confirmation

### Performance
- KPI cards load in < 500ms
- Charts load in < 2s
- Tables paginate (50 rows per page)
- Cache expensive queries (60s TTL)

### Deployment
- Deploy alongside ServiQ web (Vercel)
- Route: `/admin/*`
- Environment variables: same Supabase credentials
