# ServiQ User & Provider Flows

## 1. User Signup Flow

### 1.1 Entry Points
- **Web:** Landing page CTA → `/auth/signup` or sign-in modal
- **Mobile:** Welcome screen → Sign Up button
- **Invite:** Referral link → pre-filled signup with referral code

### 1.2 Signup Steps
```
1. Email/Phone entry
   ├── Email: Enter email → receive OTP code or magic link
   └── Phone: Enter phone → receive SMS OTP

2. OTP/Link verification
   ├── Email OTP: 6-digit code, 5-min TTL, 3 max attempts
   ├── Magic link: Click link in email → auto-redirect
   └── Phone OTP: 4-digit code, 3-min TTL

3. Profile creation (triggered by Supabase)
   ├── profiles row created via profiles_auto_insert trigger
   ├── Default values: role = null, onboarding_completed = false
   └── Auth user linked to profile via id = auth.uid()

4. Onboarding handoff
   ├── Stored in: OnboardingHandoffController (Flutter) / localStorage (Web)
   ├── Data: { intent, destination, lastRoute }
   └── Consumed once per session on signed-in landing redirect
```

### 1.3 Post-Signup Profile Fields
```typescript
{
  id: string;           // = auth.uid()
  full_name: string;    // from signup or Google OAuth
  email: string;
  phone: string | null;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  locality_id: string | null;
  role: string | null;  // "provider" | "seeker" | null
  services: string[];   // text[] column
  onboarding_completed: boolean;
  verification_level: string | null;
  is_admin: boolean;
  is_suspended: boolean;
  is_test: boolean;
}
```

---

## 2. Seeker Onboarding

### 2.1 Flow
```
1. Role selection ("What brings you to ServiQ?")
   ├── "Find help nearby" → Seeker flow
   ├── "Earn nearby" → Provider flow
   └── "Set up my business" → Provider flow

2. Locality selection
   ├── Search for locality/area
   ├── Or use current location (geolocator)
   └── Store: locality_id + lat/lng on profile

3. Need posting (optional, can skip)
   ├── Title: "What do you need help with?"
   ├── Category: Select from service categories
   ├── Description: Detailed description
   ├── Urgency: Now / Today / This week / Flexible
   ├── Budget: Optional max budget (₹)
   └── Location: Pre-filled from locality

4. Onboarding completion
   ├── profiles.onboarding_completed = true
   └── Redirect to AI home (Need Something tab)
```

### 2.2 Locality Selection
- **Data source:** `localities` table (seeded with Delhi NCR areas)
- **Search:** `localities` table with name/city ILIKE matching
- **Storage:** `profiles.locality_id` FK to localities, `profiles.latitude/longitude` for geo queries
- **Default:** If no locality selected, uses device location (if permitted)

---

## 3. Provider Onboarding

### 3.1 Flow
```
1. Launchpad entry
   ├── "Earn nearby" / "Set up my business" from role selection
   ├── Or "Become a provider" CTA
   └── Route: /app/provider-launchpad

2. Business profile creation
   ├── Business name / display name
   ├── Headline (e.g., "Expert Plumber in Crossings Republik")
   ├── Bio / description
   ├── Services offered (multi-select from categories)
   ├── Service area / locality
   └── Contact preferences

3. AI-assisted listing generation (optional)
   ├── POST /api/launchpad/generate
   ├── Input: business description + services
   ├── AI generates: listing titles, descriptions, pricing
   └── Provider reviews and edits

4. Listing creation
   ├── Service listings: title, description, price, pricing type, service type
   ├── Product listings: title, description, price, stock, delivery mode
   ├── Media: photos via upload/listing-image
   └── Availability: schedule, exceptions

5. Verification (optional, recommended)
   ├── Email verification (automatic)
   ├── Phone verification (SMS OTP)
   ├── Identity verification (document upload)
   └── Business verification (business document upload)

6. Onboarding completion
   ├── profiles.role = "provider"
   ├── profiles.onboarding_completed = true
   └── Redirect to provider dashboard/launchpad
```

### 3.2 Provider Listing Types
```typescript
type ServiceListing = {
  id: string;
  profile_id: string;
  title: string;
  description: string | null;
  category: string;
  price: number | null;
  pricing_type: "fixed" | "hourly" | "custom" | "free";
  service_type: "onsite" | "remote" | "hybrid";
  availability: "available" | "busy" | "offline";
  area: string | null;
  payment_methods: string[];
  rating: number;
  review_count: number;
  is_featured: boolean;
  media_urls: string[];
};

type ProductListing = {
  id: string;
  profile_id: string;
  title: string;
  description: string | null;
  price: number;
  stock: number;
  category: string;
  delivery_mode: "pickup" | "delivery" | "both";
  availability: string;
  media_urls: string[];
};
```

---

## 4. Profile Completion Flow

### 4.1 Weighted Formula
Profile completion is calculated by `calculateMarketplaceProfileCompletion()` in `lib/profile/marketplace.ts`:

```typescript
{
  // Basic info (20 points total)
  basicInfo: {
    fullName: 5,      // full_name or name present
    username: 5,      // username present
    headline: 4,      // headline present
    location: 3,      // location present
    bio: 3,           // bio >= 40 characters
  },

  // Media (10 points)
  avatar: 10,         // avatar_url present

  // Listings (40 points total)
  serviceAdded: 20,   // at least 1 service listing
  productAdded: 10,   // at least 1 product listing
  portfolioAdded: 10, // at least 1 portfolio item

  // Engagement (20 points total)
  availability: 10,   // availability set or schedule configured
  paymentMethod: 10,  // payment method added

  // Trust (10 points)
  verification: 10,   // onboarding_completed OR (verification_level + avatar present = 8)
}
```

### 4.2 Completion Tiers
- **0-29%:** Incomplete profile (low visibility in search)
- **30-59%:** Basic profile (normal visibility)
- **60-79%:** Complete profile (boosted visibility)
- **80-100%:** Premium profile (featured in search results)

### 4.3 Completion Triggers
- Profile save (PUT /api/profile/save) recalculates completion
- Listing creation adds to serviceAdded/productAdded scores
- Verification submission adds to verification score
- Real-time updates via Supabase Realtime on profiles table

---

## 5. Provider Verification Levels

### 5.1 Verification Hierarchy
```
Level 0: None
  └── No verification completed

Level 1: Email Verified
  ├── Email confirmed via Supabase auth
  └── Score contribution: 35/100

Level 2: Phone Verified
  ├── Phone number verified via SMS OTP
  └── Score contribution: 65/100

Level 3: Identity Verified
  ├── Government ID document uploaded
  ├── Document verified (mock in dev, manual review in prod)
  └── Score contribution: 85/100

Level 4: Business Verified
  ├── Business registration document uploaded
  ├── Business document verified
  └── Score contribution: 100/100
```

### 5.2 Verification Storage
```sql
-- verification_documents table
{
  id: uuid,
  user_id: uuid REFERENCES profiles(id),
  document_type: text,  -- "email" | "phone" | "identity" | "business"
  document_url: text,
  status: text,         -- "pending" | "approved" | "rejected"
  reviewed_by: uuid,
  reviewed_at: timestamptz,
  rejection_reason: text,
  created_at: timestamptz
}
```

### 5.3 Verification API Flow
```
1. GET /api/verification/status
   └── Returns current level + pending documents

2. POST /api/verification/submit
   ├── Body: { type, documentUrl?, ... }
   ├── Creates verification_documents row (status: "pending")
   └── Admin review required for identity/business

3. Admin review (POST /api/admin/verifications)
   ├── Action: "approve" or "reject"
   ├── Updates verification_documents.status
   └── Updates profiles.verification_level
```

### 5.4 Trust Score Impact
Verification level directly impacts the provider's trust score via `calculateMarketplaceTrustScore()`:
- **Email:** 35 points (10% weight)
- **Phone:** 65 points (10% weight)
- **Identity:** 85 points (10% weight)
- **Business:** 100 points (10% weight)

The trust score formula weights verification at 10% of total trust:
```
trustScore = ratingScore * 0.35
           + completionRate * 0.20
           + onTimeRate * 0.15
           + repeatClientsScore * 0.15
           + verificationScore * 0.10
           + responseTimeScore * 0.05
```
