# Environment Setup

**Last updated:** August 2026

How to set up ServiQ for local development.

---

## Prerequisites

### Required

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | `nvm install 20` or [nodejs.org](https://nodejs.org) |
| npm | 10+ | Comes with Node.js |
| Flutter | 3.41.x | [flutter.dev](https://flutter.dev) |
| Dart | 3.x | Comes with Flutter |
| PostgreSQL | 15 | `brew install postgresql@15` (macOS) or [postgresql.org](https://postgresql.org) |

### Optional

| Tool | Purpose |
|------|---------|
| Docker | For running Supabase locally |
| Supabase CLI | For local Supabase development |
| VS Code | Recommended IDE |
| Android Studio | For Flutter Android builds |
| Xcode | For Flutter iOS builds (macOS only) |

---

## Step 1: Clone the Repository

```bash
git clone https://github.com/RishabhDixit1/local-marketplace.git
cd local-marketplace
```

---

## Step 2: Set Up Environment Variables

```bash
# Copy the example env file
cp .env.example .env.local
```

Edit `.env.local` and fill in your credentials:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Razorpay (test keys)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your-razorpay-secret
RAZORPAY_WEBHOOK_SECRET=your-webhook-secret

# AI
GOOGLE_GEMINI_API_KEY=your-gemini-api-key

# Firebase (for mobile push notifications)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_PRIVATE_KEY=your-private-key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_ENV=development
```

**Never commit `.env.local` to git.**

---

## Step 3: Install Dependencies

```bash
npm install
```

---

## Step 4: Start the Development Server

```bash
npm run dev
```

The web app runs at [http://localhost:3000](http://localhost:3000).

---

## Step 5: Flutter Mobile Setup

```bash
# Navigate to mobile directory
cd mobile

# Get Flutter dependencies
flutter pub get

# Run on connected device/emulator
flutter run
```

### Flutter Environment Variables

Mobile uses `config/local.json` (gitignored). Create it from the template:

```bash
cd mobile
cp config/local.example.json config/local.json
```

Edit `config/local.json` with your Supabase and Firebase credentials.

### Running on Specific Platforms

```bash
# Android emulator
flutter run -d android

# iOS simulator (macOS only)
flutter run -d ios

# Chrome (web)
flutter run -d chrome

# List available devices
flutter devices
```

---

## Step 6: Database Setup

### Option A: Remote Database (Recommended for Quick Start)

Point your `.env.local` to the existing Supabase instance:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://supabase.serviqapp.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=<existing-anon-key>
```

### Option B: Local Database

1. Start PostgreSQL:
```bash
brew services start postgresql@15
```

2. Create database:
```bash
createdb serviq
```

3. Run migrations:
```bash
# Using the provided script
./scripts/apply-migrations.sh

# Or manually
for f in supabase/migrations/*.sql; do
  psql -d serviq -f "$f"
done
```

4. Seed data:
```bash
psql -d serviq -f supabase/seed.sql
```

### Option C: Local Supabase (Full Stack)

```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Start local Supabase
cd supabase
supabase start

# Apply migrations
supabase db reset
```

This starts PostgreSQL, PostgREST, GoTrue, Realtime, and Storage locally.

---

## Step 7: Verify Setup

### Web

1. Open [http://localhost:3000](http://localhost:3000)
2. You should see the ServiQ landing page
3. Try signing up or signing in

### Mobile

1. Ensure device/emulator is connected
2. Run `flutter run`
3. App should launch and show the welcome screen

### API Health Check

```bash
curl http://localhost:3000/api/health
# Should return: {"status": "ok"}
```

---

## Step 8: Running Tests

### Flutter Tests

```bash
cd mobile
flutter test
```

### TypeScript Type Check

```bash
npx tsc --noEmit
```

### ESLint

```bash
npx eslint app/ lib/
```

---

## .env.example

```bash
# ===========================================
# ServiQ Environment Configuration
# ===========================================
# Copy this file to .env.local and fill in values
# NEVER commit .env.local to git

# ---- Supabase ----
NEXT_PUBLIC_SUPABASE_URL=<YOUR_SUPABASE_URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<YOUR_SUPABASE_ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<YOUR_SUPABASE_SERVICE_ROLE_KEY>

# ---- Razorpay ----
RAZORPAY_KEY_ID=<YOUR_RAZORPAY_KEY_ID>
RAZORPAY_KEY_SECRET=<YOUR_RAZORPAY_KEY_SECRET>
RAZORPAY_WEBHOOK_SECRET=<YOUR_RAZORPAY_WEBHOOK_SECRET>

# ---- Google Gemini AI ----
GOOGLE_GEMINI_API_KEY=<YOUR_GEMINI_API_KEY>

# ---- Firebase (Server-side) ----
FIREBASE_PROJECT_ID=<YOUR_FIREBASE_PROJECT_ID>
FIREBASE_CLIENT_EMAIL=<YOUR_FIREBASE_CLIENT_EMAIL>
FIREBASE_PRIVATE_KEY=<YOUR_FIREBASE_PRIVATE_KEY>

# ---- App Configuration ----
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_ENV=development

# ---- Optional: Twilio (SMS) ----
TWILIO_ACCOUNT_SID=<YOUR_TWILIO_ACCOUNT_SID>
TWILIO_AUTH_TOKEN=<YOUR_TWILIO_AUTH_TOKEN>
TWILIO_PHONE_NUMBER=<YOUR_TWILIO_PHONE_NUMBER>

# ---- Optional: SendGrid (Email) ----
SENDGRID_API_KEY=<YOUR_SENDGRID_API_KEY>
```

---

## Common Issues

### "Module not found" errors

```bash
rm -rf node_modules .next
npm install
```

### Flutter build fails

```bash
cd mobile
flutter clean
flutter pub get
flutter run
```

### Database connection refused

Ensure PostgreSQL is running:
```bash
brew services start postgresql@15
# or
pg_isready
```

### Port 3000 already in use

```bash
lsof -ti:3000 | xargs kill -9
npm run dev
```

---

## Project Structure

```
local-marketplace/
├── app/                    # Next.js App Router (web)
│   ├── api/               # API routes (59 groups)
│   ├── (auth)/            # Auth pages (login, signup)
│   ├── (main)/            # Main app pages
│   └── public/            # Public pages (landing)
├── lib/                   # Shared TypeScript libraries
│   ├── ai/                # AI intent engine
│   ├── auth/              # Auth helpers
│   ├── chat/              # Chat logic
│   ├── orders/            # Order management
│   ├── payments/          # Razorpay integration
│   └── profile/           # Profile management
├── mobile/                # Flutter mobile app
│   ├── lib/              # Dart source code
│   │   ├── features/     # Feature modules
│   │   ├── shared/       # Shared components
│   │   └── ai/           # AI prompt bar
│   ├── test/             # Flutter tests
│   └── config/           # Environment config
├── supabase/
│   ├── migrations/       # 66 SQL migration files
│   └── seed.sql          # Seed data
├── scripts/              # Deployment scripts
├── docs/                 # Product documentation
└── .github/workflows/    # CI/CD pipelines
```
