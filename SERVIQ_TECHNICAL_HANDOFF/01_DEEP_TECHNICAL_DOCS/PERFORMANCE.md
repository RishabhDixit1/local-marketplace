# ServiQ Performance

## 1. Client-Side Performance

### 1.1 Image Optimization
- **Next.js `<Image>` component:** Automatic WebP conversion, lazy loading, responsive srcsets
- **Mobile:** `CachedNetworkImage` with disk cache, placeholder shimmer, fade-in transition
- **Compression:** Client-side WebP conversion via `lib/clientImageCompression.ts` (quality 80, max 1200px)
- **Proxy:** `/api/image-proxy` routes external images through Next.js for optimization

### 1.2 Bundle Splitting
- **Next.js automatic:** Route-based code splitting
- **Dynamic imports:** Heavy components loaded on demand
- **Tree shaking:** Unused code eliminated in production

### 1.3 Caching Strategy
```typescript
// lib/cache/cache.ts — Three-tier fallback:
// 1. Redis (if UPSTASH_REDIS_REST_URL configured)
// 2. In-memory Map (default)
// TTL: 60 seconds for most queries

// Client-side: React Query for server state
// SWR pattern: stale-while-revalidate
// Cache invalidation: Mutations invalidate related queries
```

### 1.4 React Query Cache Keys
```typescript
// Consistent cache key patterns:
['categories']           // Service categories
['products']             // Product catalog
['user', userId]         // User profile
['provider', providerId] // Provider profile
['feed']                 // Community feed
['posts']                // Post listings
['leads', providerId]    // Lead dashboard
['analytics', providerId] // Provider analytics
['tasks']                // Task management
```

---

## 2. Server-Side Performance

### 2.1 Database Connection Pooling
- **Supabase client:** Connection pooling via PgBouncer (Supabase managed)
- **Service role:** Direct connection for admin operations
- **Connection limit:** Managed by Supabase (default: 100 connections)

### 2.2 Query Optimization

#### Indexes (Key Examples)
```sql
-- Profiles
CREATE INDEX idx_profiles_locality ON profiles(locality_id);
CREATE INDEX idx_profiles_is_provider ON profiles(is_provider);
CREATE INDEX idx_profiles_trust_score ON profiles(trust_score DESC NULLS LAST);
CREATE INDEX idx_profiles_is_test ON profiles(is_test) WHERE is_test = true;

-- Orders
CREATE INDEX idx_orders_consumer ON orders(consumer_id);
CREATE INDEX idx_orders_provider ON orders(provider_id);
CREATE INDEX idx_orders_status ON orders(status);

-- Help Requests
CREATE INDEX idx_help_requests_requester ON help_requests(requester_id);
CREATE INDEX idx_help_requests_status ON help_requests(status);

-- Messages
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_sender ON messages(sender_id);

-- Reviews
CREATE INDEX idx_reviews_provider ON reviews(provider_id);
CREATE INDEX idx_reviews_order ON reviews(order_id);

-- Posts
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_category ON posts(category);

-- Full-Text Search
CREATE INDEX idx_fts_localities ON localities USING gin(to_tsvector('english', name));
CREATE INDEX idx_fts_service_categories ON service_categories USING gin(to_tsvector('english', name));
CREATE INDEX idx_fts_service_listings ON service_listings USING gin(to_tsvector('english', description));
CREATE INDEX idx_fts_product_catalog ON product_catalog USING gin(to_tsvector('english', name || ' ' || description));
```

#### Materialized Views
```sql
-- Denormalized stats for fast feed rendering
CREATE MATERIALIZED VIEW feed_card_stats AS
SELECT
  p.id,
  p.title,
  p.category,
  p.created_at,
  p.user_id,
  COUNT(l.id) as likes,
  COUNT(s.id) as saves,
  COUNT(c.id) as comments,
  COUNT(r.id) as shares
FROM posts p
LEFT JOIN post_likes l ON p.id = l.post_id
LEFT JOIN post_saves s ON p.id = s.post_id
LEFT JOIN post_comments c ON p.id = c.post_id
LEFT JOIN post_shares r ON p.id = r.post_id
GROUP BY p.id;

-- Refreshed periodically via background job
```

### 2.3 Caching Layer
```typescript
// lib/cache/cache.ts
class MemoryCache {
  private cache: Map<string, { value: unknown; expiry: number }>;
  
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item || Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.value as T;
  }
  
  set(key: string, value: unknown, ttlSeconds: number = 60) {
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttlSeconds * 1000,
    });
  }
}
```

### 2.4 Rate Limiting
- **In-memory:** Default fallback (per-instance, not shared)
- **Redis:** Shared across instances (if configured)
- **PostgreSQL:** Persistent across restarts (if configured)
- **Window:** 60 seconds for most routes, 30 seconds for auth routes

---

## 3. API Performance

### 3.1 Response Times (Target)
| Endpoint | Target | Notes |
|----------|--------|-------|
| `/api/health` | < 100ms | Health check |
| `/api/categories` | < 200ms | Cached |
| `/api/feed` | < 500ms | Complex query |
| `/api/ai/prompt` | < 5s | External API (Gemini) |
| `/api/payment/create-order` | < 1s | External API (Razorpay) |
| `/api/posts/publish` | < 500ms | Image upload + DB |

### 3.2 Pagination
- **Cursor-based:** Preferred for infinite scroll (feed, leads, posts)
- **Offset-based:** Used for simple pagination (admin lists)
- **Default limit:** 20 items per page
- **Max limit:** 100 items per page

### 3.3 Query Selectivity
```typescript
// Bad: Fetches all columns, all rows
const { data } = await db.from('profiles').select('*');

// Good: Fetches only needed columns, filters by locality
const { data } = await db
  .from('profiles')
  .select('id, full_name, avatar_url, trust_score, headline')
  .eq('locality_id', localityId)
  .eq('is_provider', true)
  .order('trust_score', { ascending: false })
  .limit(20);
```

---

## 4. Mobile Performance

### 4.1 Cold Start
- **Flutter engine:** ~500ms
- **Supabase init:** ~1-2s (with session from FlutterSecureStorage)
- **First paint:** ~2s total (with pre-warmed storage)

### 4.2 Image Loading
- **CachedNetworkImage:** Disk cache (200MB default)
- **Memory cache:** LRU cache for thumbnails
- **Placeholder:** Shimmer loading effect
- **Fade-in:** 300ms animation

### 4.3 Offline Support
- **Realtime reconnection:** Exponential backoff (5s → 60s, max 20 retries)
- **Offline fail-fast:** Every network call checks connectivity first
- **Session refresh:** 8-second timeout to prevent hung cold starts
- **FlutterSecureStorage pre-warm:** Faster Supabase init

### 4.4 Build Size
- **APK:** ~25MB (release, with ProGuard)
- **AAB:** ~20MB (Android App Bundle)
- **iOS:** ~30MB (IPA)
- **Tree shaking:** Enabled in release builds

---

## 5. Database Performance

### 5.1 Table Sizes (Estimated)
| Table | Rows | Size | Indexes |
|-------|------|------|---------|
| profiles | 10K | 10MB | 5 |
| orders | 5K | 5MB | 4 |
| messages | 50K | 50MB | 3 |
| posts | 10K | 10MB | 3 |
| service_listings | 3K | 3MB | 4 |
| product_catalog | 2K | 2MB | 3 |
| notifications | 100K | 100MB | 4 |
| feed_card_interactions | 20K | 20MB | 3 |

### 5.2 Query Performance
- **Simple queries:** < 10ms (single table, indexed)
- **Complex queries:** < 100ms (joins, aggregations)
- **Full-text search:** < 50ms (GIN index)
- **Geographic queries:** < 200ms (with locality index)

### 5.3 Maintenance
- **Vacuum:** Auto-vacuum enabled (Postgres default)
- **Analyze:** Auto-analyze enabled
- **Index rebuild:** Not needed (B-tree self-balancing)
- **Materialized view refresh:** Every 5 minutes via background job

---

## 6. Third-Party Performance

### 6.1 External API Latency
| Service | Latency | Timeout |
|---------|---------|---------|
| Supabase REST | 50-100ms | 10s |
| Supabase Auth | 100-200ms | 10s |
| Razorpay | 200-500ms | 15s |
| Gemini AI | 1-3s | 30s |
| Twilio SMS | 500-1000ms | 10s |
| Firebase FCM | 100-300ms | 5s |

### 6.2 Timeout Strategy
- **Client timeout:** 15s for most requests
- **Server timeout:** 30s for AI requests, 15s for payment, 10s for auth
- **Background jobs:** 60s max execution time

### 6.3 Retry Strategy
- **Transient failures:** 3 retries with exponential backoff
- **Rate limiting:** Respect Retry-After header
- **Permanent failures:** No retry (4xx errors except 429)

---

## 7. Monitoring

### 7.1 Performance Metrics
```typescript
// Server-side logging:
console.time(`[${route}] ${action}`);
// ... operation ...
console.timeEnd(`[${route}] ${action}`);

// Sentry performance monitoring:
Sentry.startSpan({ name: `api.${route}.${action}` }, (span) => {
  // ... operation ...
  span.setData('userId', userId);
});
```

### 7.2 Client Performance
- **Flutter:** `FirebasePerformance.instance` for trace metrics
- **Web:** Core Web Vitals (LCP, FID, CLS) via Vercel Analytics
- **Custom:** Screen load times, API call durations

### 7.3 Alerts
- **Sentry:** Error rate > 1% triggers alert
- **Uptime:** 15-minute checks via GitHub Actions
- **Backup:** Daily verification (backup < 27h old)
