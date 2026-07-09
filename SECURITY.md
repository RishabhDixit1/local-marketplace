# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | ✅        |

## Reporting a Vulnerability

We take the security of ServiQ seriously. If you believe you have found a
security vulnerability, please report it to us as described below.

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to **security@serviqapp.com**.

You should receive a response within 48 hours. If you do not hear back,
please follow up to ensure we received your original message.

### What to include

- Type of issue (e.g., SQL injection, XSS, broken authentication, etc.)
- Full paths of source file(s) related to the issue
- Step-by-step reproduction instructions
- Proof-of-concept or exploit code (if possible)
- Impact assessment

### What to expect

- We will acknowledge receipt within 48 hours
- We will provide an initial assessment within 5 business days
- We will keep you informed of progress toward a fix
- We will credit you in release notes when the fix is deployed (unless you prefer to remain anonymous)

## Disclosure Policy

We follow a coordinated disclosure process:

1. Report is received and acknowledged
2. Issue is investigated and a fix is prepared
3. Fix is deployed to production
4. Public disclosure (if appropriate) after a reasonable period for users to update

We aim to resolve critical issues within 7 days and high-severity issues within 30 days.

## Bug Bounty

We do not currently operate a paid bug bounty program, but we will publicly
acknowledge responsible disclosures.

## Security Measures

ServiQ employs the following security measures:

- End-to-end encryption for chat (in transit and at rest)
- Row-Level Security (RLS) on all database tables
- Rate limiting on auth endpoints (10 requests/minute)
- CSP headers with strict policies
- HSTS with preload (2-year max-age)
- Input validation on all API endpoints
- Suspended account detection at auth level
- Magic-link authentication with OTP (10-minute TTL)
- Session monitoring and forced logout capabilities
- Regular database backups with 30-day retention
- Sentry error monitoring with source maps disabled in production
