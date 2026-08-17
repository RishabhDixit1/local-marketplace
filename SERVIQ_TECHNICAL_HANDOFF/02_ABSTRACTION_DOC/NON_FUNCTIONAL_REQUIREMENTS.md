# Non-Functional Requirements

## Performance

- **API Response Time:** Target < 200ms for most endpoints
- **Database Queries:** Optimized with 80+ indexes
- **Mobile:** Offline fail-fast, cached feeds, batched queries
- **Realtime:** Reconnect with exponential backoff (5s-60s)

## Availability

- **Web:** Vercel (99.9% SLA)
- **API/DB:** Single EC2 (no HA - known limitation)
- **Backup:** Daily S3 backup with verification
- **Uptime Monitoring:** 15-minute health checks

## Security

- RLS-first authorization
- Rate limiting on all API routes
- HMAC webhook verification
- Content moderation
- Input validation
- No secrets in code

## Scalability

- **Current:** Single EC2 instance
- **Database:** PostgreSQL with connection pooling
- **Storage:** Supabase Storage (local volumes)
- **Known Limitation:** No horizontal scaling, no read replicas

## i18n

- 6 languages: English, Hindi, Bengali, Tamil, Telugu, Marathi
- 190+ translated strings
- RTL not supported (all languages are LTR)

## Accessibility

- Semantic labels on Flutter widgets
- Screen reader support (basic)
- Keyboard navigation (web)
- Color contrast (Material 3)
