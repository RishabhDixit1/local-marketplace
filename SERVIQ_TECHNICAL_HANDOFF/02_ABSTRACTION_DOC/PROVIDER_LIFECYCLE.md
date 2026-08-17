# Provider Lifecycle

## Stages

1. **Registration** → Sign up with email/phone/OAuth
2. **Intent Selection** → Choose "Earn Nearby" or "Set Up Business"
3. **Launchpad** → Business profile creation wizard
4. **Profile Completion** → Add services, portfolio, availability
5. **Verification** → Email → Phone → Identity → Business
6. **Active** → Receiving leads, creating quotes
7. **Growth** → Subscriptions, featured placements, workspace
8. **Established** → Team management, multiple branches

## Verification Levels

| Level | Requirement | Badge |
|-------|------------|-------|
| email | Email verified | Basic |
| phone | Phone verified | Phone |
| identity | ID document verified | Identity |
| business | Business document verified | Business |

## Profile Completion Formula (10 inputs, weighted)

The `calculate_marketplace_profile_completion()` function computes completion % from:
1. Name present
2. Headline present
3. Bio present (min 32 chars)
4. Location present
5. Services/interests non-empty
6. Avatar URL present
7. At least one service listing
8. Phone verified
9. Email verified
10. Onboarding completed

## Trust Score Formula (6 inputs, weighted)

The `calculate_marketplace_trust_score()` function:
- Rating score (avg × 20) × 0.35
- Job completion rate × 0.20
- On-time rate × 0.15
- Repeat clients score × 0.15
- Verification level score × 0.10
- Response time score × 0.05
