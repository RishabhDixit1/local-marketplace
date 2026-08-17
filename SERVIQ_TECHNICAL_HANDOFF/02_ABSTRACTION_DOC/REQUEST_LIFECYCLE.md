# Request Lifecycle

## Help Request State Machine

```
open → matched → accepted → in_progress → completed
                 ↓                       ↓
              cancelled              cancelled
```

### States
- **open:** Newly created, visible to providers
- **matched:** AI has matched providers (auto or manual)
- **accepted:** A provider has accepted
- **in_progress:** Work has started
- **completed:** Service delivered
- **cancelled:** Requester or provider cancelled

### Transitions
- `open → matched`: Automatic via `match_help_request()` RPC
- `matched → accepted`: Provider calls `accept_help_request()`
- `accepted → in_progress`: Provider updates status
- `in_progress → completed`: Provider marks complete
- Any → cancelled: Requester or provider cancels

## Order State Machine

```
new_lead → quoted → accepted → in_progress → completed
                        ↓           ↓
                     rejected    cancelled
                                  ↓
                               closed
```

### States
- **new_lead:** Initial state
- **quoted:** Provider has sent a quote
- **accepted:** Consumer accepted the quote
- **in_progress:** Work underway
- **completed:** Done
- **rejected:** Consumer rejected quote
- **cancelled:** Either party cancelled
- **closed:** Terminal state
