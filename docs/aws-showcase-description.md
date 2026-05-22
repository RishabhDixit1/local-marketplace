# ServiQ — AWS Startup Showcase

## Startup Name
ServiQ

## Tagline
The Operating System for Local Commerce — Connecting People with Human-Centered Services Near You

## Problem
Local service discovery is fragmented. Consumers juggle search engines, messaging apps, and word-of-mouth to find and hire service providers, while small businesses struggle to build an online presence, attract customers, and manage leads. Trust is a major barrier — there's no unified reputation or verification system for local providers.

## Solution
ServiQ is a hyperlocal marketplace platform that unifies service discovery, real-time communication, order management, and trust-building in one place. Consumers can discover verified providers nearby, chat in real time, request quotes, manage orders, and leave reviews. Providers get a digital storefront with AI-assisted onboarding, lead management, and reputation tools.

## AWS Architecture
ServiQ is migrating from Supabase + Vercel to a full AWS-native stack:

| Service | Usage |
|---------|-------|
| **Amazon Cognito** | Passwordless auth (magic link / OTP via Lambda + SES) |
| **Amazon S3** | File storage with presigned URLs for profile images, listings |
| **AWS Amplify / ECS Fargate** | Hosting Next.js web app and APIs |
| **API Gateway WebSocket + Lambda + DynamoDB** | Realtime chat, presence, and notifications |
| **Amazon RDS Aurora (PostgreSQL)** | Primary database |
| **Amazon Route 53 + CloudFront** | DNS, CDN, and edge caching |
| **AWS WAF + Shield** | Security and DDoS protection |
| **Amazon SES** | Transactional email (magic links, notifications) |

## Impact & Traction
- **Target Market:** Delhi NCR, India — expanding city by city
- **Target Users:** 10M+ urban consumers and 500K+ small service providers
- **Platform:** Web (Next.js) + Mobile (Flutter — Android & iOS)
- **Stage:** Pre-seed, live at serviqapp.com
- **Revenue Model:** Commission on transactions, tiered vendor subscriptions, featured listings, lead generation fees, AI tools

## Why AWS
AWS provides the scalability, reliability, and breadth of services needed to operate a location-aware realtime marketplace at city scale. The managed services (Cognito, RDS Aurora, API Gateway WebSockets) reduce operational overhead while maintaining enterprise-grade security and compliance. The migration targets a $1,000 AWS credits budget with ~$30/month ongoing cost, making it viable for a pre-seed startup.
