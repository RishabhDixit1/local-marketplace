# ServiQ Technical Architecture
## System Design for Scale

---

# 1. HIGH-LEVEL ARCHITECTURE

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                   │
├─────────────────────────┬─────────────────────────┬─────────────┤
│      Web (Next.js)      │   Mobile (Flutter)      │   Admin    │
│   React 19 + Tailwind   │      Riverpod          │   (Web)    │
└───────────┬─────────────┴───────────┬─────────────┴─────┬───────┘
            │                         │                   │
            └─────────────────────────┼───────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API LAYER (Next.js)                        │
│                    /app/api/* Route Handlers                    │
└─────────────────────────────┬───────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   SUPABASE      │ │   FIREBASE     │ │   RAZORPAY     │
│   - Auth        │ │   - Push       │ │   - Payments    │
│   - Database    │ │   - Crashlytics│ │   - Payouts     │
│   - Realtime    │ │                 │ │                 │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

# 2. WEB APPLICATION ARCHITECTURE

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Next.js | 16.x |
| Runtime | Node.js | 20.x |
| Language | TypeScript | 5.x |
| UI Library | React | 19.x |
| Styling | Tailwind CSS | 4.x |
| State | React Context + Hooks | - |
| Forms | react-hook-form | 7.x |
| Animations | Framer Motion | 11.x |
| Maps | MapLibre GL JS | 3.x |
| Deployment | Vercel | - |

## Directory Structure

```
app/
├── api/                    # API Routes
│   ├── auth/
│   │   └── send-link/      # Magic link auth
│   ├── community/
│   │   ├── feed/          # Marketplace feed
│   │   └── people/        # Provider discovery
│   ├── orders/            # Order management
│   ├── quotes/            # Quote flows
│   ├── tasks/             # Task/help requests
│   ├── chat/             # Messaging
│   ├── notifications/     # Push subscriptions
│   └── upload/           # Media uploads
├── dashboard/             # Authenticated app
│   ├── welcome/           # Home feed
│   ├── people/           # Provider discovery
│   ├── tasks/            # Task board
│   ├── chat/             # Chat inbox
│   ├── orders/           # Order management
│   └── provider/         # Provider hub
├── business/[slug]/       # Public business pages
├── layout.tsx             # Root layout
└── page.tsx              # Landing + Auth
```

## Key Components

```
components/
├── ui/                    # Base UI components
│   ├── Button/
│   ├── Card/
│   ├── Input/
│   ├── Modal/
│   └── Badge/
├── layout/                # Shell components
│   ├── Header/
│   ├── Sidebar/
│   └── BottomNav/
├── feed/                  # Marketplace
│   ├── FeedCard/
│   ├── FeedList/
│   └── FeedFilters/
├── people/                # Provider discovery
│   ├── ProviderCard/
│   ├── ProviderMap/
│   └── ProviderFilters/
├── chat/                  # Messaging
│   ├── ChatWindow/
│   ├── MessageBubble/
│   └── ChatInput/
├── tasks/                 # Task management
│   ├── TaskBoard/
│   ├── TaskCard/
│   └── TaskFilters/
└── providers/             # Provider features
    ├── TrustPanel/
    ├── Storefront/
    └── Launchpad/
```

---

# 3. MOBILE APPLICATION ARCHITECTURE

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Flutter | 3.x |
| Language | Dart | 3.x |
| State | Riverpod | 2.x |
| Navigation | go_router | 14.x |
| HTTP | dio | 5.x |
| Local Storage | shared_preferences | - |
| Realtime | supabase_flutter | - |
| Push | firebase_messaging | - |
| Payments | razorpay_flutter | - |
| Maps | flutter_map + latlong2 | - |

## Directory Structure

```
mobile/lib/
├── app/
│   ├── app.dart           # App entry
│   ├── router/            # Navigation
│   │   ├── app_router.dart
│   │   └── post_auth_route_resolver.dart
│   └── presentation/
│       └── main_bottom_nav.dart
├── core/
│   ├── api/               # HTTP client
│   │   └── mobile_api_client.dart
│   ├── auth/              # Auth service
│   │   └── mobile_auth_service.dart
│   ├── design_system/     # UI components
│   │   ├── serviq_async_body.dart
│   │   ├── serviq_surface.dart
│   │   └── design_system.dart
│   ├── theme/             # Design tokens
│   │   ├── app_theme.dart
│   │   └── design_tokens.dart
│   ├── firebase/          # Push notifications
│   │   └── mobile_push_notifications.dart
│   └── utils/             # Utilities
├── features/
│   ├── auth/              # Sign in, setup
│   ├── welcome/           # Home feed
│   ├── feed/              # Marketplace
│   ├── people/            # Provider discovery
│   ├── tasks/             # Task board
│   ├── chat/              # Chat + threads
│   ├── profile/           # User profile
│   ├── orders/            # Order management
│   ├── quotes/            # Quote flows
│   ├── provider/          # Provider features
│   ├── search/            # Search
│   ├── cart/              # Cart
│   └── notifications/     # Push notifications
└── main.dart              # Entry point
```

## State Management (Riverpod)

```dart
// Provider structure
providers/
├── auth/
│   ├── auth_state_provider.dart
│   └── session_provider.dart
├── feed/
│   ├── feed_provider.dart
│   └── feed_interactions_provider.dart
├── people/
│   ├── people_provider.dart
│   └── provider_filters_provider.dart
├── tasks/
│   ├── tasks_provider.dart
│   └── task_filters_provider.dart
├── chat/
│   ├── conversations_provider.dart
│   └── messages_provider.dart
└── profile/
    ├── profile_provider.dart
    └── account_provider.dart
```

---

# 4. DATABASE ARCHITECTURE

## Supabase Schema

### Core Tables

```sql
-- User profiles
profiles (
  id UUID PRIMARY KEY,           -- auth.users ref
  phone TEXT,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT,                      -- 'seeker' | 'provider'
  bio TEXT,
  latitude FLOAT,
  longitude FLOAT,
  profile_completion_percent INTEGER,
  verification_status TEXT,       -- 'verified' | 'trusted' | 'new'
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Service listings (supply)
service_listings (
  id UUID PRIMARY KEY,
  provider_id UUID REFERENCES profiles(id),
  title TEXT,
  description TEXT,
  category TEXT,
  price_type TEXT,               -- 'fixed' | 'starting_from' | 'negotiable'
  price_amount INTEGER,
  images TEXT[],                 -- Array of URLs
  is_active BOOLEAN,
  created_at TIMESTAMP
)

-- Help requests (demand)
help_requests (
  id UUID PRIMARY KEY,
  seeker_id UUID REFERENCES profiles(id),
  title TEXT,
  description TEXT,
  category TEXT,
  budget_min INTEGER,
  budget_max INTEGER,
  location_lat FLOAT,
  location_lng TEXT,
  status TEXT,                   -- 'open' | 'matched' | 'completed' | 'cancelled'
  created_at TIMESTAMP
)

-- Orders/Tasks
orders (
  id UUID PRIMARY KEY,
  request_id UUID REFERENCES help_requests(id),
  provider_id UUID REFERENCES profiles(id),
  seeker_id UUID REFERENCES profiles(id),
  quoted_price INTEGER,
  status TEXT,                   -- 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled'
  created_at TIMESTAMP,
  completed_at TIMESTAMP
)

-- Messages
messages (
  id UUID PRIMARY KEY,
  conversation_id UUID,
  sender_id UUID REFERENCES profiles(id),
  content TEXT,
  message_type TEXT,             -- 'text' | 'image' | 'file'
  created_at TIMESTAMP
)

-- Conversations
conversations (
  id UUID PRIMARY KEY,
  participant_one UUID REFERENCES profiles(id),
  participant_two UUID REFERENCES profiles(id),
  context_type TEXT,             -- 'order' | 'quote' | 'direct'
  context_id UUID,
  last_message_at TIMESTAMP,
  created_at TIMESTAMP
)

-- Provider presence (online status)
provider_presence (
  provider_id UUID PRIMARY KEY,
  is_online BOOLEAN,
  availability TEXT,             -- 'available' | 'busy' | 'away'
  last_seen TIMESTAMP,
  response_time_minutes INTEGER
)

-- Reviews
reviews (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  reviewer_id UUID REFERENCES profiles(id),
  reviewee_id UUID REFERENCES profiles(id),
  rating INTEGER,                -- 1-5
  comment TEXT,
  created_at TIMESTAMP
)

-- Feed card saves
feed_card_saves (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  saved_type TEXT,               -- 'provider' | 'listing' | 'post'
  saved_id UUID,
  created_at TIMESTAMP
)

-- Notifications
notifications (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  type TEXT,
  title TEXT,
  body TEXT,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP
)
```

## Row-Level Security (RLS)

```sql
-- Profiles: Users can read all, update own
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Orders: Only participants can read
CREATE POLICY "Order participants can view"
  ON orders FOR SELECT
  USING (provider_id = auth.uid() OR seeker_id = auth.uid());

-- Messages: Only conversation participants
CREATE POLICY "Conversation participants can read"
  ON messages FOR SELECT
  USING (sender_id = auth.uid() OR conversation_id IN (
    SELECT id FROM conversations
    WHERE participant_one = auth.uid() OR participant_two = auth.uid()
  ));
```

---

# 5. API CONTRACTS

## API Endpoints

### Authentication
```
POST /api/auth/send-link
- Body: { email, redirect_url }
- Response: { success, message }
```

### Community Feed
```
GET /api/community/feed
- Query: { latitude, longitude, radius_km, category, cursor }
- Response: { items: [...], next_cursor }

POST /api/community/feed/express-interest
- Body: { feed_item_id, feed_item_type }
- Response: { success, conversation_id }
```

### Provider Discovery
```
GET /api/community/people
- Query: { latitude, longitude, radius_km, category, rating_min }
- Response: { providers: [...] }

GET /api/community/people/:id
- Response: { provider: {...} }
```

### Tasks
```
GET /api/tasks/help-requests
- Query: { status, role, cursor }
- Response: { requests: [...] }

POST /api/tasks/progress
- Body: { task_id, status, proof_images }
- Response: { success, task }
```

### Orders
```
GET /api/orders
- Query: { status, role }
- Response: { orders: [...] }

POST /api/orders
- Body: { request_id, provider_id, quoted_price }
- Response: { order }

PATCH /api/orders/:id
- Body: { status }
- Response: { order }
```

### Chat
```
POST /api/chat/direct
- Body: { recipient_id, initial_message }
- Response: { conversation_id }

POST /api/chat/messages
- Body: { conversation_id, content, type }
- Response: { message }
```

### Payments
```
POST /api/payment/create-order
- Body: { order_id, amount }
- Response: { razorpay_order_id }

POST /api/payment/verify
- Body: { razorpay_payment_id, order_id }
- Response: { success }
```

---

# 6. REAL-TIME ARCHITECTURE

## Supabase Realtime Channels

### 1. Presence (Online Status)
```
Channel: "presence:provider:{provider_id}"

Events:
- presence: sync     → Current online state
- presence: join     → Provider came online
- presence: leave    → Provider went offline
```

### 2. Feed Updates
```
Channel: "feed:{location_hash}"

Events:
- postgres_changes  → New help_requests in radius
- INSERT            → New demand in area
```

### 3. Chat Messages
```
Channel: "chat:{conversation_id}"

Events:
- postgres_changes  → New messages
- INSERT            → Message received
```

### 4. Notifications
```
Channel: "notifications:{user_id}"

Events:
- postgres_changes  → New notification
- INSERT            → Push + in-app
```

## Presence System

```typescript
// Server-side: Update presence every 60 seconds
async function updatePresence(providerId: string) {
  await supabase
    .from('provider_presence')
    .upsert({
      provider_id: providerId,
      is_online: true,
      availability: 'available',
      last_seen: new Date().toISOString()
    }, { onConflict: 'provider_id' })
}

// Client-side: Subscribe to presence changes
function subscribeToProviderPresence(providerId: string) {
  return supabase
    .channel(`presence:provider:${providerId}`)
    .on('presence', { event: 'sync' }, (payload) => {
      // Update UI with online status
    })
    .subscribe()
}
```

---

# 7. GEO-MATCHING ARCHITECTURE

## Distance Calculation

```typescript
// Haversine formula for distance
function distanceBetweenCoordinatesKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371 // Earth's radius in km
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat/2)² + 
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
            Math.sin(dLng/2)²
  const c = 2 * Math.atan2(√a, √(1-a))
  return R * c
}

// Provider ranking score
function calculateLocalRankScore(provider: ProviderProfile, userLocation: LatLng): number {
  const distance = distanceBetweenCoordinatesKm(
    userLocation.lat, userLocation.lng,
    provider.latitude, provider.longitude
  )
  
  const distanceScore = Math.max(0, 100 - distance * 2)  // -2 points per km
  const ratingScore = provider.rating * 20              // Max 100
  const completionScore = provider.profile_completion_percent
  const onlineBonus = provider.is_online ? 4 : 0
  
  return distanceScore * 0.3 + 
         ratingScore * 0.3 + 
         completionScore * 0.3 + 
         onlineBonus
}
```

## Map Integration

```typescript
// MapLibre setup with provider markers
<Map
  mapLib={maplibregl}
  initialViewState={{
    longitude: userLocation.lng,
    latitude: userLocation.lat,
    zoom: 14
  }}
  style="https://tiles.openfreemap.org/styles/liberty"
>
  {providers.map(provider => (
    <Marker
      key={provider.id}
      longitude={provider.longitude}
      latitude={provider.latitude}
      onClick={() => scrollToCard(provider.id)}
    >
      <ProviderMarker 
        isOnline={provider.is_online}
        isSelected={selectedProviderId === provider.id}
      />
    </Marker>
  ))}
</Map>
```

---

# 8. TRUST SYSTEM

## Trust Score Components

```typescript
interface TrustScore {
  verificationStatus: 'verified' | 'trusted' | 'new'
  profileCompletion: number      // 0-100
  rating: number                  // 0-5
  reviewCount: number
  completedJobs: number
  responseTimeMinutes: number
  isOnline: boolean
  memberSinceDays: number
}

function calculateVerificationStatus(profile: Profile): TrustScore {
  let score = 0
  
  // Profile completeness (0-25 points)
  score += Math.min(25, profile.completion_percent)
  
  // Reviews (0-25 points)
  score += Math.min(25, profile.rating * 5)
  
  // Activity (0-25 points)
  score += Math.min(25, Math.min(100, profile.completed_jobs))
  
  // Responsiveness (0-25 points)
  if (profile.response_time_minutes < 5) score += 25
  else if (profile.response_time_minutes < 15) score += 15
  else if (profile.response_time_minutes < 30) score += 5
  
  // Status mapping
  if (score >= 75) return 'verified'
  if (score >= 50) return 'trusted'
  return 'new'
}
```

## Trust Signals on UI

```dart
// Provider card trust display
Column(
  children: [
    Row(
      children: [
        if (provider.isOnline)
          OnlineIndicator(),
        TrustBadge(status: provider.verificationStatus),
      ]
    ),
    if (provider.rating > 0)
      RatingStars(rating: provider.rating),
    if (provider.responseTimeMinutes != null)
      Text("${provider.responseTimeMinutes} min response"),
    if (provider.completedJobs > 0)
      Text("${provider.completedJobs} jobs completed"),
  ]
)
```

---

# 9. AI LAUNCHPAD ARCHITECTURE

## Provider Onboarding Flow

```
User Input (7 questions)
        ↓
AI Processing (LLM)
        ↓
Generated Content
  - Business name
  - Tagline
  - Service descriptions (×5)
  - Pricing packs
  - FAQ content
  - SEO keywords
        ↓
Preview & Edit
        ↓
Publish to Profile
        ↓
Auto-create Service Listings
```

## AI Generation API

```typescript
// POST /api/launchpad/draft
interface LaunchpadInput {
  businessType: string           // "Electrician", "Plumber", "Cleaning"
  services: string[]             // List of services offered
  pricingModel: string            // "fixed" | "hourly" | "negotiable"
  serviceRadius: number           // Kilometers
  availability: string            // "weekdays" | "flexible" | "weekends"
  brandTone: string              // "Professional" | "Friendly" | "Expert"
}

interface LaunchpadOutput {
  businessName: string
  tagline: string
  about: string
  services: Array<{
    title: string
    description: string
    pricing: string
  }>
  faqs: Array<{ question: string, answer: string }>
  keywords: string[]
}
```

---

# 10. PAYMENT FLOW

## Razorpay Integration

```
Order Created (₹350)
       ↓
Create Razorpay Order (API)
       ↓
Client Checkout (Razorpay SDK)
       ↓
Payment Successful
       ↓
Webhook: Payment Verified
       ↓
Order Status: "paid"
       ↓
Provider Notified
       ↓
Task In Progress
```

## Payment Flow Code

```typescript
// Server: Create order
async function createPaymentOrder(orderId: string, amount: number) {
  const razorpayOrder = await razorpay.orders.create({
    amount: amount * 100,  // Paise
    currency: 'INR',
    receipt: orderId,
    notes: { orderId }
  })
  
  await db.orders.update(orderId, {
    razorpay_order_id: razorpayOrder.id
  })
  
  return razorpayOrder
}

// Client: Checkout
Future<void> checkout(RazorpayOrder order) async {
  final options = {
    'key': RAZORPAY_KEY,
    'amount': order.amount,
    'name': 'ServiQ',
    'order_id': order.id,
    'prefill': { 'contact': userPhone }
  }
  
  razorpay.open(options)
}
```

---

# 11. SECURITY

## Authentication Flow

```
1. User enters phone number
2. POST /api/auth/send-link { phone }
3. Supabase sends magic link via Exotel
4. User clicks link → redirects to /auth/callback
5. Session created, JWT stored
6. All API calls include Authorization: Bearer {jwt}
```

## Security Headers

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  return NextResponse.next({
    headers: {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    }
  })
}
```

## Rate Limiting

```typescript
// lib/rate-limit.ts
const rateLimit = new RateLimiter({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100  // limit each IP to 100 requests per window
})

export async function withRateLimit(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  
  const { success } = await rateLimit.consume(ip)
  
  if (!success) {
    throw new Error('Rate limit exceeded')
  }
}
```

---

# 12. SCALING CONSIDERATIONS

## Current Limits

| Resource | Current | Scale Target |
|----------|---------|--------------|
| Concurrent users | 100 | 10,000+ |
| DB connections | 10 | 50 |
| API requests/min | 100 | 1,000 |
| Realtime connections | 50 | 500 |
| File storage | 1 GB | 50 GB |

## Scaling Strategy

| Layer | Current | Scaling Action |
|-------|---------|----------------|
| Supabase | Pro plan | Add read replicas |
| Vercel | Pro | Add Enterprise |
| CDN | Vercel Edge | Global edge |
| Caching | None | Add Redis layer |
| Search | DB query | Add Algolia |

---

# 13. MONITORING

## Observability Stack

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │───▶│   Server     │───▶│   External  │
│  (Browser)  │    │  (Next.js)  │    │  (Ingest)   │
└─────────────┘    └─────────────┘    └─────────────┘
      │                  │                   │
      ▼                  ▼                   ▼
 ┌──────────┐      ┌──────────┐        ┌──────────┐
 │  Vercel  │      │ Sentry   │        │ Datadog  │
 │Analytics │      │ Errors   │        │ Metrics  │
 └──────────┘      └──────────┘        └──────────┘
```

## Metrics Tracked

| Category | Metrics |
|----------|---------|
| **Performance** | FCP, LCP, CLS, TTFB, INP |
| **Business** | Trans, GMV, Users, Providers |
| **Technical** | API latency, Error rate, Uptime |
| **Engagement** | DAU/MAU, Session length, Retention |

---

# 14. DEPLOYMENT

## Web (Vercel)

```yaml
# vercel.json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase-url",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase-anon-key"
  }
}
```

## Mobile (Flutter)

```bash
# Build Android
flutter build apk --release \
  --dart-define=SUPABASE_URL="$SUPABASE_URL" \
  --dart-define=SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  --dart-define=API_BASE_URL="https://www.serviqapp.com"

# Build iOS
flutter build ios --release \
  --dart-define=SUPABASE_URL="$SUPABASE_URL" \
  --dart-define=API_BASE_URL="https://www.serviqapp.com"
```

---

# 15. TESTING STRATEGY

## Web Testing

```bash
# Unit tests (Vitest)
npm run test:unit

# E2E tests (Playwright)
npm run test:e2e           # Unauthenticated
npm run test:e2e:auth     # Authenticated
npm run test:e2e:headed   # Browser visible
```

## Mobile Testing

```bash
# Unit tests
flutter test

# Widget tests
flutter test --no-pub

# Integration tests
flutter test integration/

# Analyze
flutter analyze --no-pub
```

---

# APPENDIX: DEPENDENCIES

## Web Dependencies

```json
{
  "dependencies": {
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@supabase/supabase-js": "^2.45.0",
    "tailwindcss": "^4.0.0",
    "framer-motion": "^11.0.0",
    "react-hook-form": "^7.52.0",
    "maplibre-gl": "^3.0.0",
    "@heroicons/react": "^2.1.0"
  }
}
```

## Mobile Dependencies

```yaml
dependencies:
  flutter:
    sdk: flutter
  flutter_riverpod: ^2.5.0
  go_router: ^14.0.0
  supabase_flutter: ^2.0.0
  dio: ^5.4.0
  firebase_messaging: ^14.7.0
  razorpay_flutter: ^1.3.0
  flutter_map: ^7.0.0
  cached_network_image: ^3.3.0
  shared_preferences: ^2.2.0
```