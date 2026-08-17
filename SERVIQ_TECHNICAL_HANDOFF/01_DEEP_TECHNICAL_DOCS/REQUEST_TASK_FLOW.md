# ServiQ Request & Task Flow

## 1. Help Request Lifecycle

### 1.1 State Machine
```
                    ┌──────────┐
                    │   open   │
                    └────┬─────┘
                         │
              match_help_request()
                         │
                    ┌────▼─────┐
              ┌─────│ matched  │─────┐
              │     └────┬─────┘     │
              │          │           │
    express_interest  accept    withdraw_interest
              │          │           │
              │     ┌────▼─────┐     │
              │     │ accepted │     │
              │     └────┬─────┘     │
              │          │           │
              │  transition_status   │
              │          │           │
              │     ┌────▼──────┐    │
              │     │in_progress│    │
              │     └────┬──────┘    │
              │          │           │
              │   complete/cancel    │
              │          │           │
              │     ┌────▼─────┐     │
              └────►│completed │◄────┘
                    │cancelled │
                    └──────────┘
```

### 1.2 State Definitions
```typescript
type HelpRequestStatus =
  | "open"        // Created, not yet matched
  | "matched"     // Providers have been matched/notified
  | "accepted"    // A provider has been accepted by consumer
  | "in_progress" // Work has started
  | "completed"   // Work finished successfully
  | "cancelled";  // Cancelled by consumer or provider
```

### 1.3 Transitions
| From | To | Trigger | Actor |
|------|----|---------|-------|
| open | matched | `match_help_request()` RPC | System (auto) |
| matched | accepted | `POST /api/needs/accept` | Consumer |
| matched | cancelled | `POST /api/needs/status` | Consumer |
| accepted | in_progress | `POST /api/tasks/progress` | Provider |
| accepted | cancelled | `POST /api/tasks/progress` | Either |
| in_progress | completed | `POST /api/tasks/progress` | Provider |
| in_progress | cancelled | `POST /api/tasks/progress` | Either |

### 1.4 RPC Functions
- **`match_help_request(uuid)`** / **`match_help_request_v2(uuid)`**: Matches providers based on locality, services, availability
- **`accept_help_request(uuid)`**: Transitions from matched to accepted
- **`transition_help_request_status(uuid, text)`**: Generic status transition with audit trail

### 1.5 Events Audit Trail
Every transition creates a row in `task_events`:
```sql
CREATE TABLE task_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id),
  consumer_id uuid,
  provider_id uuid,
  actor_id uuid,        -- who triggered the transition
  event_type text,      -- "status_changed" | "created" | "price_updated" | ...
  title text,
  description text,
  previous_status text,
  next_status text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
```

---

## 2. Order Lifecycle

### 2.1 State Machine
```
                          ┌──────────┐
                          │ new_lead │
                          └────┬─────┘
                               │
                    provider: quote / accept / reject
                    consumer: cancel
                               │
                ┌──────────────┼──────────────┐
                │              │              │
          ┌─────▼────┐  ┌─────▼────┐  ┌──────▼─────┐
          │  quoted  │  │ accepted │  │  rejected  │
          └─────┬────┘  └─────┬────┘  └────────────┘
                │              │
    provider: accept/reject   provider: start work
    consumer: accept/cancel   consumer: pay / cancel
                │              │
                └──────┬───────┘
                       │
                ┌──────▼──────┐
                │    paid     │ (if payment required)
                └──────┬──────┘
                       │
                ┌──────▼──────┐
                │ in_progress │
                └──────┬──────┘
                       │
            provider: complete / consumer: complete
                       │
                ┌──────▼──────┐
                │  completed  │
                └──────┬──────┘
                       │
                ┌──────▼──────┐
                │   closed    │ (final)
                └─────────────┘
```

### 2.2 Canonical Statuses
```typescript
type CanonicalOrderStatus =
  | "new_lead"       // Initial state
  | "quoted"         // Provider sent a quote
  | "accepted"       // Quote accepted
  | "paid"           // Payment received
  | "payment_failed" // Payment failed
  | "in_progress"    // Work started
  | "completed"      // Work finished
  | "closed"         // Order closed (final)
  | "cancelled"      // Cancelled (final)
  | "rejected"       // Rejected (final)
  | "countered";     // Consumer requested changes
```

### 2.3 Transition Map
From `lib/orderWorkflow.ts`:
```typescript
const transitionMap: Record<CanonicalOrderStatus, Record<OrderActorRole, CanonicalOrderStatus[]>> = {
  new_lead: {
    provider: ["quoted", "accepted", "rejected"],
    consumer: ["cancelled"],
  },
  quoted: {
    provider: ["accepted", "rejected"],
    consumer: ["accepted", "cancelled"],
  },
  accepted: {
    provider: ["in_progress"],
    consumer: ["paid", "cancelled"],
  },
  paid: {
    provider: ["in_progress", "completed"],
    consumer: ["cancelled"],
  },
  in_progress: {
    provider: ["completed"],
    consumer: ["completed", "cancelled"],
  },
  completed: {
    provider: ["closed"],
    consumer: ["closed"],
  },
  closed: { provider: [], consumer: [] },
  cancelled: { provider: [], consumer: [] },
  rejected: { provider: [], consumer: [] },
  countered: {
    provider: ["quoted", "accepted", "rejected"],
    consumer: ["cancelled"],
  },
};
```

### 2.4 Status Normalization
Multiple input values normalize to canonical statuses:
```typescript
// "lead", "pending", "active", "open" → "new_lead"
// "quote_sent" → "quoted"
// "booked" → "accepted"
// "in-progress", "active_work" → "in_progress"
// "done" → "completed"
// "canceled" → "cancelled"
// "declined" → "rejected"
```

### 2.5 Task Workflow Status (Simplified View)
For the mobile task list, canonical statuses map to 4 workflow states:
```typescript
type TaskWorkflowStatus = "active" | "in-progress" | "completed" | "cancelled";

// new_lead, quoted, countered → "active"
// accepted, in_progress → "in-progress"
// completed, closed → "completed"
// cancelled, rejected → "cancelled"
```

### 2.6 Progress Stages
Orders track granular progress via `metadata.progress_stage`:
```typescript
type ProgressStage =
  | "pending_acceptance"  // Quote sent, waiting for consumer
  | "accepted"           // Consumer accepted, provider confirming
  | "travel_started"     // Provider traveling to location
  | "work_started"       // Work has begun
  | "completed";         // Work finished
```

---

## 3. Booking Slot Lifecycle

### 3.1 State Machine
```
┌─────────────┐
│  confirmed  │
└──────┬──────┘
       │
  ┌────┼────────────┐
  │    │            │
┌─▼──┐ ┌▼──────────┐ ┌▼────────────┐
│done│ │cancelled   │ │rescheduled  │
└────┘ └────────────┘ └─────────────┘
```

### 3.2 States
```typescript
type BookingSlotStatus = "confirmed" | "completed" | "cancelled" | "rescheduled";
```

### 3.3 Transitions
| From | To | Trigger |
|------|----|---------|
| confirmed | completed | Provider marks work done |
| confirmed | cancelled | Either party cancels |
| confirmed | rescheduled | Either party reschedules |

### 3.4 Race Condition Protection
- **Fix:** `20260718000000_booking_slot_race_condition_fix.sql`
- **Pattern:** Atomic claim via `UPDATE ... WHERE status = 'confirmed'` (conditional update)
- **Effect:** Prevents double-booking of same slot

---

## 4. Post Status Lifecycle

### 4.1 States
```typescript
type PostStatus =
  | "draft"
  | "published"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "archived";
```

### 4.2 Transitions
Managed via `transition_post_status()` RPC:
```
draft → published
published → in_progress
published → archived
published → cancelled
in_progress → completed
in_progress → cancelled
completed → archived
```

### 4.3 RPC Function
```sql
CREATE OR REPLACE FUNCTION transition_post_status(
  p_post_id uuid,
  p_new_status text,
  p_note text DEFAULT NULL
) RETURNS void
-- Validates transition is allowed, creates task_events audit row
```

---

## 5. Task Events Audit Trail

### 5.1 Event Types
```typescript
type TaskEventType =
  | "status_changed"    // Status transition
  | "created"           // Task/order created
  | "price_updated"     // Quote/price modified
  | "payment_received"  // Payment confirmed
  | "review_submitted"  // Review posted
  | "message_sent"      // Chat message in task context
  | "booking_updated"   // Booking slot changed
  | "delivery_updated"  // Delivery status changed
  | "fallback_history"; // Generated from current state (no real events)
```

### 5.2 Event Tone Mapping
```typescript
// Visual tone for UI rendering
getTaskEventTone(event) → TaskEventTone:
  cancelled/rejected → "rose"
  completed/closed   → "emerald"
  accepted/in_progress → "violet"
  quoted/price_updated → "amber"
  created            → "sky"
  default            → "slate"
```

### 5.3 Event Feed Construction
- **With events:** `mapTaskEventToFeedItem()` transforms `task_events` rows into UI-ready feed items
- **Without events:** `buildFallbackTaskEventFeed()` generates synthetic events from current task state
- **Ordering:** Events ordered by `created_at` descending, limited to 12 most recent

### 5.4 Supabase Realtime
- `task_events` table is in the realtime publication
- Client subscribes to changes for live updates on task detail pages
- `orders` table also in publication for status change notifications
