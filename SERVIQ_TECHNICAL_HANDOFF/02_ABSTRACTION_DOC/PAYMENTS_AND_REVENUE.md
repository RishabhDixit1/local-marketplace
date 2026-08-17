# Payments & Revenue

## Payment Flow

1. **Order Creation** → Razorpay order created via `POST /api/payment/create`
2. **Consumer Payment** → Razorpay checkout (UPI, card, netbanking, wallet)
3. **Webhook Confirmation** → `POST /api/webhooks/razorpay` (HMAC verified)
4. **Idempotency** → `razorpay_webhook_events.event_id` prevents double-processing
5. **Refund** → Via Razorpay API, idempotency guard prevents double-refund

## Revenue Streams

| Stream | Implementation | Status |
|--------|---------------|--------|
| Subscriptions | `subscription_plans` + `provider_subscriptions` | Verified |
| Commission | `orders.commission_amount_paise` | Schema present |
| Featured Placements | `featured_placements` | Schema present, no active placements |
| Promo Codes | `promo_codes` | Schema present |

## Pricing (Subscription Plans)

| Plan | Price | Interval |
|------|-------|----------|
| Free | ₹0 | - |
| Essential | ₹299 | Monthly |
| Premium | ₹999 | Monthly |

## Payout Flow

1. Provider completes orders
2. Earnings accumulate (tracked via orders)
3. Provider requests payout → `provider_payouts` record
4. Admin processes → Bank/UPI transfer
5. Status: pending → processed

## Currency

All monetary values stored in **paise** (Indian Rupee cents). ₹1 = 100 paise. This avoids floating-point precision issues.
