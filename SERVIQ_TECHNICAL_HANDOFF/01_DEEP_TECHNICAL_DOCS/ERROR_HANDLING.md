# ServiQ Error Handling

## 1. Web Error Handling (Next.js)

### 1.1 Error Boundary Hierarchy
```
app/not-found.tsx          → 404 Not Found (route-level)
app/error.tsx              → Route segment error (per-page)
app/global-error.tsx       → Root error (catches everything)
app/dashboard/error.tsx    → Dashboard section error
```

### 1.2 error.tsx Pattern
```typescript
// app/error.tsx
'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div>
      <h2>Something went wrong</h2>
      <p>{error.message}</p>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}
```

### 1.3 global-error.tsx Pattern
```typescript
// app/global-error.tsx
'use client';

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html>
      <body>
        <div>
          <h2>ServiQ encountered an error</h2>
          <p>Please refresh the page or try again later.</p>
          <button onClick={() => reset()}>Try again</button>
        </div>
      </body>
    </html>
  );
}
```

### 1.4 not-found.tsx Pattern
```typescript
// app/not-found.tsx
export default function NotFound() {
  return (
    <div>
      <h2>Page not found</h2>
      <p>The page you're looking for doesn't exist.</p>
      <a href="/">Go home</a>
    </div>
  );
}
```

### 1.5 RouteErrorPage (Mobile)
```dart
// RouteErrorPage takes failed location and shows:
// - Branded error copy
// - "Retry · /failed/path" button (when location isn't root)
// - No raw error leak to user
```

---

## 2. Mobile Error Handling (Flutter)

### 2.1 Three-Layer Error Capture
```dart
// lib/main.dart
void main() {
  // Layer 1: Flutter framework errors
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    if (!kDebugMode) {
      FirebaseCrashlytics.instance.recordFlutterFatalError(details);
    }
  };

  // Layer 2: Async errors
  runZonedGuarded(() {
    runApp(const ServiqApp());
  }, (error, stack) {
    if (!kDebugMode) {
      FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
    }
  });

  // Layer 3: Platform errors
  PlatformDispatcher.instance.onError = (error, stack) {
    if (!kDebugMode) {
      FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
    }
    return true;
  };
}
```

### 2.2 Offline Fail-Fast
```dart
// Every network call checks connectivity first:
Future<T?> safeNetworkCall<T>(Future<T> Function() call) async {
  if (!await Connectivity().checkConnectivity().then((c) => c != ConnectivityResult.none)) {
    ServiqToast.show('You appear to be offline');
    return null;
  }
  try {
    return await call().timeout(Duration(seconds: 15));
  } catch (e) {
    ServiqToast.show('Network error. Please try again.');
    return null;
  }
}
```

### 2.3 Supabase Error Translation
```dart
// Supabase errors translated to user-friendly messages:
String translateSupabaseError(SupabaseException e) {
  switch (e.message) {
    case 'Invalid login credentials': return 'Invalid email or password';
    case 'Email not confirmed': return 'Please confirm your email first';
    case 'User already registered': return 'An account with this email exists';
    case 'Rate limit exceeded': return 'Too many attempts. Please wait.';
    default: return 'Something went wrong. Please try again.';
  }
}
```

### 2.4 Session Refresh Timeout
```dart
// 8-second timeout prevents hung cold starts:
final session = await supabase.auth.currentSession;
if (session == null) {
  // Redirect to login
}
```

---

## 3. API Route Error Handling

### 3.1 Structured Error Response Pattern
```typescript
// lib/server/errorHandler.ts
export const captureApiError = (error: unknown, context: ApiErrorContext) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const status = context.status ?? 502;

  console.error(`[${context.route}]${context.action ? ` ${context.action}` : ''}`, message);

  if (process.env.NODE_ENV === 'production') {
    reportToSentry(error, context);
  }

  return NextResponse.json({ ok: false, message }, { status });
};

// Usage in routes:
export const withErrorHandling = (handler: RouteHandler, route: string): RouteHandler => {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      return captureApiError(error, { route });
    }
  };
};
```

### 3.2 Standard Error Response
```json
{
  "ok": false,
  "message": "Human-readable error description",
  "code": "OPTIONAL_ERROR_CODE"
}
```

### 3.3 HTTP Status Codes
| Code | Meaning | When |
|------|---------|------|
| 400 | Bad Request | Invalid input, missing required fields |
| 401 | Unauthorized | Missing or invalid bearer token |
| 403 | Forbidden | Account suspended, admin required, block |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate action (already connected, etc.) |
| 429 | Rate Limited | Too many requests |
| 500 | Server Error | Internal server error |
| 502 | Bad Gateway | Upstream service unavailable (Supabase, Razorpay) |
| 503 | Service Unavailable | Feature disabled (Live Talk) |

---

## 4. Supabase Error Handling

### 4.1 Common Supabase Errors
```typescript
// Error types from Supabase client:
type SupabaseError = {
  message: string;
  details: string;
  hint: string;
  code: string;  // Postgres error code
};

// Common codes:
// '23505' → Unique violation (duplicate key)
// '23503' → Foreign key violation
// '42501' → Insufficient privilege (RLS blocked)
// 'PGRST116' → Row not found (maybeSingle)
```

### 4.2 Error Translation Pattern
```typescript
function translateSupabaseError(error: SupabaseError): string {
  switch (error.code) {
    case '23505': return 'This action has already been performed';
    case '23503': return 'Referenced resource not found';
    case '42501': return 'You don\'t have permission for this action';
    case 'PGRST116': return 'Resource not found';
    default: return error.message || 'Database error';
  }
}
```

### 4.3 RLS Error Handling
```typescript
// When RLS blocks access, Supabase returns empty results (not errors)
const { data, error } = await db.from('profiles').select('*');

// If RLS blocks, data is [] and error is null
// Must check for empty results as potential RLS block
if (!data || data.length === 0) {
  // Could be RLS block or genuinely empty
  // Log for debugging but don't expose RLS details to user
}
```

---

## 5. Network Error Handling

### 5.1 Offline Detection
```dart
// Mobile: connectivity_plus package
final connectivity = await Connectivity().checkConnectivity();
final isOffline = connectivity == ConnectivityResult.none;

// Web: navigator.onLine
final isOffline = !navigator.onLine;
```

### 5.2 Retry with Backoff
```typescript
// Server-side: retry transient failures
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}
```

### 5.3 Mobile Retry Pattern
```dart
// Exponential backoff for Supabase Realtime reconnection:
// 5s → 10s → 20s → 40s → 60s (max)
// Max retries: 20
// Auto-reconnect on connectivity restore
```

---

## 6. Rate Limit Errors

### 6.1 Response Format
```json
{
  "ok": false,
  "code": "RATE_LIMITED",
  "message": "Too many requests. Try again in 30 seconds."
}
```

### 6.2 Headers
```
HTTP/1.1 429 Too Many Requests
Retry-After: 30
X-RateLimit-Reset: 1692100030
```

### 6.3 Client Handling
```dart
// Mobile: Show toast with retry countdown
if (response.statusCode == 429) {
  final retryAfter = int.parse(response.headers['retry-after'] ?? '30');
  ServiqToast.show('Too many requests. Please wait $retryAfter seconds.');
  // Auto-retry after delay
}
```

```typescript
// Web: Show error message
if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After');
  setError(`Too many requests. Please wait ${retryAfter} seconds.`);
}
```

---

## 7. Background Job Error Handling

### 7.1 Job Failure Pattern
```typescript
// lib/server/backgroundJobs.ts
try {
  await handler(db, job.payload);
  await db.from('background_jobs').update({ status: 'completed' }).eq('id', job.id);
} catch (err) {
  const willRetry = job.attempts + 1 < job.max_attempts;
  const backoffSeconds = willRetry ? Math.min(30 * Math.pow(2, job.attempts), 600) : 0;
  
  await db.from('background_jobs').update({
    status: willRetry ? 'pending' : 'failed',
    error: message,
    run_at: willRetry ? new Date(Date.now() + backoffSeconds * 1000).toISOString() : null,
  }).eq('id', job.id);
}
```

### 7.2 Retry Strategy
- **Max attempts:** 3 (configurable per job)
- **Backoff:** 30s → 60s → 120s (exponential, max 600s)
- **Double-processing prevention:** Atomic claim + status verification
