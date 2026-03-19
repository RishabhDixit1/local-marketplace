# AI Launchpad + Quote Flow Roadmap

## Product Direction

ServiQ already has the base rails for a realtime local-services platform:

- discovery and public business pages
- provider and seeker profiles
- service listings and product catalog
- help requests, matching, and notifications
- chat, live talk requests, and task/order lifecycle

The next winning move is to turn that foundation into a business operating layer for local service SMBs.

Primary wedge:

- local service businesses with 1-25 staff
- high-intent jobs that need a fast response and a clear quote
- categories where trust, responsiveness, and repeat work matter more than raw catalog depth

Core bet:

- help a business go live in minutes
- help it convert a lead into a quote faster
- help it run the job cleanly
- help it earn repeat revenue

## Product Pillars

### 1. AI Business Launchpad

Turn a short onboarding flow, catalog upload, or business profile import into:

- storefront copy
- service listings
- pricing packs
- FAQ content
- service area coverage
- operating hours and availability
- public mini-site content

### 2. Lead OS

Turn inbound demand into an operational queue:

- qualify the request
- score fit and urgency
- route to the best provider or teammate
- draft the first response
- follow up when the lead goes cold

### 3. Deal Room

Upgrade chat into a shared job workspace:

- scope summary
- quote and revisions
- files and proof-of-work
- live talk handoff
- approvals
- invoice and payment state

### 4. Trust Graph

Make provider quality legible:

- verified badge progression
- response score
- completion score
- repeat-customer score
- proof-of-work gallery
- dispute and support workflow

### 5. Team Workspaces

Support business growth without losing speed:

- workspace owner and staff seats
- branch locations
- shared inbox
- assignment rules
- SLA routing
- owner analytics

### 6. Growth Integrations

Help businesses compound distribution:

- website widget
- WhatsApp and SMS bridge
- Google Business sync
- referral engine
- reactivation campaigns
- review collection

## Priority Matrix

| Initiative | User value | Revenue value | Build effort | Why now |
| --- | --- | --- | --- | --- |
| AI Launchpad | Very high | Very high | Medium | Replaces manual provider setup and gets more supply online fast |
| Quote Flow | Very high | Very high | Medium | Fits the existing `orders` lifecycle and improves lead conversion immediately |
| Lead OS | High | Very high | Medium | Builds on help requests, matching, notifications, and chat already in the repo |
| Trust Graph | High | High | Medium | Converts more leads and supports provider quality ranking |
| Team Workspaces | Medium | Very high | High | Important for expansion, but not required to prove the wedge |
| Growth Integrations | Medium | High | High | Powerful once launchpad and quoting are working |

## 30-Day Roadmap

### Days 1-7: Foundation and Launchpad Input

Goals:

- define the SMB wedge and launchpad schema
- capture structured business onboarding data
- support import-to-draft workflows

Build:

- add an AI Launchpad dashboard entry point
- add a 7-10 question onboarding flow for business type, services, pricing model, hours, location, service radius, brand tone, and contact channels
- support import sources:
  - pasted catalog/menu text
  - pasted WhatsApp business description
  - website URL placeholder for later enrichment
- save launchpad draft state server-side
- map launchpad output to existing `profiles`, `service_listings`, and `product_catalog`

Exit criteria:

- a provider can complete onboarding without manually creating each listing first
- the system can generate a draft storefront pack from structured answers

### Days 8-14: Launchpad Output and Storefront Generation

Goals:

- generate business-ready assets
- let the provider review and approve before publish

Build:

- draft business bio, FAQ, service packs, pricing suggestions, and service areas
- generate listing bundles for services and optional products
- create a review screen with approve, edit, and republish actions
- publish approved output into:
  - `profiles`
  - `service_listings`
  - `product_catalog`
  - public business page copy

Exit criteria:

- a provider can go from blank account to public business page plus listings in under 5 minutes

### Days 15-21: Quote Flow and Deal Room MVP

Goals:

- move from lead capture to quote conversion
- use current order status primitives instead of inventing a new workflow

Build:

- generate a quote draft from:
  - help request details
  - existing service catalog
  - pricing packs
  - urgency and location context
- support provider review and send
- persist quote versions and line items
- sync quote status with existing order states:
  - `new_lead`
  - `quoted`
  - `accepted`
  - `in_progress`
  - `completed`
  - `closed`
- add Deal Room panels inside chat/tasks for scope, quote summary, files, and approval state

Exit criteria:

- a matched lead can become a reviewed quote without leaving ServiQ

### Days 22-30: Lead OS, Trust, and Growth Loops

Goals:

- improve response speed and conversion quality
- lay the groundwork for repeatable growth

Build:

- lead scoring by category fit, availability, distance, response history, and trust level
- idle lead follow-up automation
- provider trust summary with response and completion indicators
- review request and referral triggers after completion
- instrumentation for conversion funnel metrics

Exit criteria:

- the system can identify hot leads, nudge providers, and measure quote conversion

## Concrete Repo Implementation Plan

### Reuse Existing Foundations

Current pieces that should stay central:

- `profiles` for business identity and public profile
- `service_listings` and `product_catalog` for publishable supply
- `help_requests` and `help_request_matches` for demand and routing
- `orders` for canonical workflow state
- `conversations`, `messages`, and `live_talk_requests` for communication
- `notifications` and `notification_escalations` for fanout and urgency
- public business pages in `app/business/[slug]/page.tsx`

### New Schema for MVP

Add new Supabase migrations for:

- `business_launchpad_drafts`
  - `id`
  - `owner_id`
  - `status`
  - `input_source`
  - `answers`
  - `import_payload`
  - `generated_profile`
  - `generated_services`
  - `generated_products`
  - `generated_faq`
  - `generated_service_areas`
  - `approved_at`
  - timestamps
- `quote_drafts`
  - `id`
  - `order_id`
  - `help_request_id`
  - `provider_id`
  - `consumer_id`
  - `status`
  - `summary`
  - `subtotal`
  - `tax_amount`
  - `total`
  - `notes`
  - `expires_at`
  - `metadata`
  - timestamps
- `quote_line_items`
  - `id`
  - `quote_id`
  - `label`
  - `description`
  - `quantity`
  - `unit_price`
  - `amount`
  - `sort_order`
- `lead_assignments`
  - `id`
  - `help_request_id`
  - `provider_id`
  - `workspace_member_id` nullable for future
  - `score`
  - `score_breakdown`
  - `assigned_at`
  - `responded_at`
- `trust_artifacts`
  - `id`
  - `provider_id`
  - `artifact_type`
  - `title`
  - `media_url`
  - `metadata`
  - timestamps

Use new canonical tables for quotes and launchpad state instead of overloading `orders.metadata` immediately.

### New Routes

Add dashboard and API surfaces:

- `app/dashboard/launchpad/page.tsx`
- `app/dashboard/launchpad/review/page.tsx`
- `app/dashboard/provider/quotes/page.tsx`
- `app/api/launchpad/draft/route.ts`
- `app/api/launchpad/generate/route.ts`
- `app/api/launchpad/publish/route.ts`
- `app/api/quotes/draft/route.ts`
- `app/api/quotes/send/route.ts`
- `app/api/quotes/[quoteId]/accept/route.ts`
- `app/api/leads/score/route.ts`

### New Libraries

Add focused modules rather than growing current route files:

- `lib/launchpad/types.ts`
- `lib/launchpad/validation.ts`
- `lib/launchpad/publish.ts`
- `lib/quotes/types.ts`
- `lib/quotes/calculations.ts`
- `lib/quotes/workflow.ts`
- `lib/leads/scoring.ts`
- `lib/trust/metrics.ts`

If and when an LLM is introduced, isolate it behind:

- `lib/ai/launchpad.ts`
- `lib/ai/quoteDrafting.ts`
- `lib/ai/leadFollowups.ts`

### UI Integration Points

Tie the new work into current UX instead of creating disconnected features:

- add Launchpad CTA in provider onboarding and listing-empty states
- add "Generate from my business" action before manual `add-service`
- add quote card surfaces in:
  - `app/dashboard/chat/page.tsx`
  - `app/dashboard/tasks/page.tsx`
- extend `app/business/[slug]/page.tsx` to show launchpad-generated FAQ, service packs, and trust artifacts
- extend profile readiness to treat launchpad completion as a major milestone

### Realtime and Notifications

Use the current Supabase realtime pattern for:

- quote status changes
- lead assignment updates
- approval events
- idle lead reminders
- post-job review requests

This should follow the same publication and trigger pattern already used for orders, help requests, notifications, and live talk requests.

## Suggested Build Order in This Repo

1. Launchpad schema and validation
2. Launchpad dashboard flow
3. Publish generated output into profile plus listings
4. Quote schema and quote workflow helpers
5. Deal Room UI in chat and tasks
6. Lead scoring and follow-up automation
7. Trust surfaces on public business page and people discovery
8. Team workspaces
9. Growth integrations

## Success Metrics

Track these from day one:

- time from signup to first published listing
- percent of providers who publish within first session
- help request to first provider response time
- matched lead to quote rate
- quote to acceptance rate
- acceptance to completion rate
- repeat booking rate
- review request completion rate

## Explicit Non-Goals for This Phase

Avoid these until the wedge is working:

- broad enterprise customization
- complex multi-market inventory systems
- full CRM replacement positioning
- generic AI assistant surfaces without workflow ownership

## Recommended Immediate Build Scope

If we start now, the best first shipping slice is:

1. Launchpad intake form
2. AI-generated service pack drafts
3. one-click publish into profile plus listings
4. quote draft attached to matched lead
5. provider review and send flow
6. order status sync to `quoted`

That gives ServiQ a crisp story:

- "Go online in minutes."
- "Reply to leads with a ready quote."
- "Run the job in one realtime workspace."
