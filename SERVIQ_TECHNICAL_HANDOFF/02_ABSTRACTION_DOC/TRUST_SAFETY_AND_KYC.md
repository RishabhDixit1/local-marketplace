# Trust, Safety & KYC

## Trust Score

Computed per provider using 6 weighted inputs:

| Input | Weight | Source |
|-------|--------|--------|
| Average Rating | 35% | reviews.rating × 20 |
| Job Completion Rate | 20% | completed ÷ accepted orders |
| On-Time Rate | 15% | profiles.on_time_rate |
| Repeat Clients | 15% | profiles.repeat_clients_count |
| Verification Level | 10% | profiles.verification_level |
| Response Time | 5% | profiles.response_time_minutes |

Score range: 0-100. Updated reactively on every order status change.

## Verification Levels

| Level | Documents | Badge |
|-------|-----------|-------|
| email | Email verification | Basic |
| phone | Phone OTP verification | Phone |
| identity | Government ID | Identity |
| business | Business registration | Business |

## Safety Features

- **User Blocking:** `blocked_users` table, prevents interactions
- **User Suspension:** `is_suspended` flag, admin-only
- **Listing Moderation:** `moderation_status` on listings
- **Content Moderation:** AI-powered on user input
- **Rate Limiting:** Prevents abuse
- **HMAC Verification:** Webhook authenticity

## KYC Implementation

- Document upload via `verification_documents` table
- Storage in Supabase Storage
- Manual review workflow (admin TBD)
- Status: pending → approved/rejected
