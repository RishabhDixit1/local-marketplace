# Business Rules

## Order Status Transitions

| From | To | Allowed Actor |
|------|-----|--------------|
| new_lead | quoted | Provider |
| quoted | accepted | Consumer |
| quoted | rejected | Consumer |
| accepted | in_progress | Provider |
| in_progress | completed | Provider |
| in_progress | cancelled | Consumer |
| any | closed | System |

## Connection Request Rules

- `requester_id ≠ recipient_id` (CHECK constraint)
- Unique partial index prevents duplicate active pairs
- Mutual requests auto-accept
- Status: pending → accepted/rejected/cancelled

## Quote Rules

- Quotes expire after `valid_until`
- Each quote has line items with quantity × unit_price
- Versioning: each negotiation creates a new version
- Total computed as sum of line item totals

## Review Rules

- Rating: 1-5 (CHECK constraint)
- Reviewer must be different from provider
- One review per reviewer per provider (enforced by application logic)
- Helpful/not_helpful votes: one per user per review

## Subscription Rules

- Free: Basic features
- Essential (₹299/mo): Enhanced visibility
- Premium (₹999/mo): Maximum features
- Status: active → cancelled/expired/past_due

## Rate Limiting

- Per-key, per-user, per-window
- Atomic upsert prevents race conditions
- Cron job cleans up expired entries

## Content Moderation

- AI content moderation on user input
- Listing moderation (admin approval required)
- User suspension (admin only)
- User blocking (user-initiated)
