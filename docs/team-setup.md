# ServiQ Team Setup Guide

This guide is for onboarding a teammate onto this repo with:

- local development
- Supabase setup
- Vercel deployment
- optional CI and E2E setup

It is written for this repo as it exists today:

- Next.js 16
- Node 20 in CI
- Supabase migrations in `supabase/migrations/*.sql`
- Vercel for hosting
- bash-backed repo scripts for `dev`, `supabase:*`, and authenticated E2E

## 1. Access checklist

Before the teammate starts, make sure they have:

- GitHub access to this repository
- Supabase access to the shared project, or permission to create a new Supabase project
- Vercel team/project access, or permission to import the repo into Vercel
- the current `SUPABASE_SERVICE_ROLE_KEY` if they need full local server behavior
- the Supabase database password if they will run migrations directly with `psql`

If you are reusing an existing shared Supabase project, also share:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- the production site URL
- any admin emails that should see startup diagnostics

## 2. Local prerequisites

### Windows

Install these first:

- Node.js 20 LTS
- Git for Windows
- a terminal that can run `bash`

Important:

- `npm run dev`
- `npm run supabase:setup`
- `npm run supabase:migrate`
- `npm run supabase:sql-editor`
- `npm run test:e2e:auth`

all call bash scripts internally.

Recommended Windows setup:

1. Install Git for Windows and keep the option that makes Git Bash available.
2. Open the repo in Git Bash for the smoothest experience.
3. If you prefer PowerShell, make sure `bash` works there too by running `bash --version`.

Optional but helpful:

- PostgreSQL client tools so `psql` is available
- Docker Desktop as a fallback for migration runs when `psql` is not installed

### macOS / Linux

Install:

- Node.js 20 LTS
- Git
- optional `psql`, or Docker as fallback

## 3. Clone and install the repo

```bash
git clone <repo-url>
cd local-marketplace
npm ci
```

If `npm ci` fails because Node is too old, switch to Node 20 and rerun it.

## 4. Create local env files

Copy the example file:

```bash
cp .env.example .env.local
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Then fill in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL=http://localhost:3000`
- `SUPABASE_SERVICE_ROLE_KEY` for full server-side features

Use `SUPABASE_SERVICE_ROLE_KEY` locally if you want these flows to work without friction:

- avatar upload
- profile save fallbacks
- server-side publish APIs
- startup diagnostics
- local authenticated E2E magic-link generation

Do not commit `.env.local` or `.env.e2e.local`.

## 5. Create or connect Supabase

You have two valid paths.

### Path A: reuse the existing shared Supabase project

This is fastest for a teammate laptop.

1. Ask the project owner for:
   - project URL
   - anon key
   - service role key
   - database password, if direct migrations are needed
2. Put the URL and keys into `.env.local`.
3. Continue to the migration step below if the shared database is not already up to date.

### Path B: create a fresh Supabase project

1. Go to the Supabase dashboard and create a new project.
2. Save the database password in your password manager when Supabase asks for it.
3. Wait until the database is fully provisioned.
4. In Supabase project settings, copy:
   - project URL
   - anon key
   - service role key
5. Put those values into `.env.local`.

Official references:

- Supabase database connection docs: https://supabase.com/docs/guides/database/connecting-to-postgres
- Supabase redirect URL docs: https://supabase.com/docs/guides/auth/redirect-urls

## 6. Configure Supabase Auth URLs

In Supabase Dashboard:

- Authentication
- URL Configuration

Set:

- Site URL:
  - local development: `http://localhost:3000`
  - production: your real production domain

Add Redirect URLs:

- `http://localhost:3000/auth/callback`
- `http://127.0.0.1:3000/auth/callback`
- `https://<your-production-domain>/auth/callback`
- `https://*-<team-or-account-slug>.vercel.app/**` if you want auth to work on Vercel previews

That preview wildcard format comes from the current Supabase redirect URL docs.

Important:

- production Site URL must not stay on localhost
- keep the local callback URLs even after production is live

## 7. Apply the canonical Supabase migrations

This repo treats `supabase/migrations/*.sql` as the source of truth.

### Preferred path: direct DB migration

First build the database URL from the Supabase project:

```text
postgresql://postgres:<db-password>@db.<project-ref>.supabase.co:5432/postgres
```

If the database password contains reserved URL characters like `@`, `:`, `/`, `?`, or `#`, URL-encode them.

Run the migrations:

Git Bash:

```bash
export SUPABASE_DB_URL='postgresql://postgres:<db-password>@db.<project-ref>.supabase.co:5432/postgres'
npm run supabase:migrate
```

PowerShell:

```powershell
$env:SUPABASE_DB_URL='postgresql://postgres:<db-password>@db.<project-ref>.supabase.co:5432/postgres'
npm run supabase:migrate
```

What this does:

- runs every file in `supabase/migrations/*.sql` in order
- runs realtime verification at the end
- uses local `psql` first
- falls back to Docker if `psql` is not installed

### Optional demo data

If the teammate needs realistic local data for the dashboard:

Git Bash:

```bash
npm run supabase:setup -- --with-seeds
```

PowerShell:

```powershell
npm run supabase:setup -- --with-seeds
```

### Fallback path: SQL Editor

Use this only if direct DB access is blocked.

Generate the SQL bundle:

Git Bash:

```bash
bash scripts/supabase_copy_sql.sh --stdout > supabase-bundle.sql
```

PowerShell:

```powershell
bash scripts/supabase_copy_sql.sh --stdout | Set-Content -Encoding utf8 supabase-bundle.sql
```

Then:

1. Open Supabase SQL Editor
2. Open `supabase-bundle.sql`
3. Paste the contents into the editor
4. Run it once

Do not paste only the filename into SQL Editor.

## 8. Start the app locally

```bash
npm run dev
```

Open:

- `http://localhost:3000`

Do not use:

- `https://localhost:3000`

## 9. Quick local verification

After local setup, check these flows:

1. Landing page loads without Supabase config errors.
2. Magic-link login sends successfully.
3. `/dashboard` loads after login.
4. `/dashboard/people` does not error on `connection_requests`.
5. `/dashboard/chat` and `/dashboard/tasks` render.

Useful checks:

- `npm run lint`
- `npm run test:unit`

Optional authenticated E2E:

1. Copy `.env.e2e.example` to `.env.e2e.local`
2. Set `E2E_LOGIN_EMAIL`
3. Run:

```bash
npm run test:e2e:auth
```

The repo can auto-generate `E2E_MAGIC_LINK_URL` if these are available:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `E2E_LOGIN_EMAIL`

## 10. Vercel project setup

This repo does not need a custom `vercel.json` for normal deployment. Vercel should detect it as a Next.js app.

Official references:

- Import an existing project: https://vercel.com/docs/getting-started-with-vercel/import
- Environment variables: https://vercel.com/docs/environment-variables
- Git deployments: https://vercel.com/docs/deployments

### Import the repo

1. In Vercel, click New Project.
2. Import this GitHub repository.
3. Let Vercel auto-detect the framework as Next.js.
4. Keep the default install and build commands unless your team intentionally changes them later.

### Add Vercel environment variables

Set these in Vercel Project Settings -> Environment Variables.

Required in Production, Preview, and Development:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Set this in Production:

- `NEXT_PUBLIC_SITE_URL=https://<your-production-domain>`

Recommended optional values:

- `ADMIN_EMAIL_ALLOWLIST=admin1@example.com,admin2@example.com`
- `OBSERVABILITY_FORWARD_URL=...`
- `OBSERVABILITY_FORWARD_TOKEN=...`

Notes:

- `SUPABASE_SERVICE_ROLE_KEY` is secret and must only be set in server environments
- `NEXT_PUBLIC_*` values are public by design
- for Preview deployments, it is usually safer to rely on Vercel's deployment URL than to hard-code `NEXT_PUBLIC_SITE_URL`

### Deploy

After env vars are saved:

1. trigger a fresh deployment
2. wait for the build to pass
3. open the deployed site
4. test login and `/dashboard`

## 11. Vercel local linking for teammates

If a teammate wants their laptop linked to the Vercel project:

```bash
npm install -g vercel
vercel login
vercel link
```

If your team wants to download Development env vars from Vercel, use:

```bash
vercel env pull .env.local
```

Only do this if the Vercel Development env is the source of truth for local secrets.

## 12. GitHub Actions secrets

If you want CI and authenticated E2E to run in GitHub Actions, add these repository secrets:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `E2E_LOGIN_EMAIL`

Optional:

- `E2E_MAGIC_LINK_URL`

If `E2E_MAGIC_LINK_URL` is missing, the workflow can generate one when `SUPABASE_SERVICE_ROLE_KEY` and `E2E_LOGIN_EMAIL` are present.

## 13. Common issues

### `Could not find the table 'public.connection_requests' in the schema cache`

The database is behind the repo schema.

Fix:

- rerun `npm run supabase:migrate`

### Local login redirects to the wrong host

Usually caused by Supabase Auth URL Configuration.

Fix:

- confirm `http://localhost:3000/auth/callback`
- confirm `http://127.0.0.1:3000/auth/callback`
- confirm production callback URL
- confirm production Site URL is not localhost

### Avatar upload or server-side publish routes fail

Usually caused by missing server credentials.

Fix:

- set `SUPABASE_SERVICE_ROLE_KEY` in local env and Vercel env

### `npm run dev` fails on Windows with `bash` not found

Fix one of these:

- run from Git Bash
- install Git for Windows and reopen the terminal
- make sure `bash` is available in `PATH`

## 14. Recommended handoff order

If you are walking a teammate through setup live, this order is the least painful:

1. clone repo and install Node 20
2. create `.env.local`
3. create or connect Supabase
4. configure Supabase auth URLs
5. run `npm run supabase:migrate`
6. run `npm run dev`
7. verify local login and dashboard
8. import repo into Vercel
9. add Vercel env vars
10. deploy and verify production login
