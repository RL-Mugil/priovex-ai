# PrioVex.AI — Complete Deployment Guide
## From Zero to Production

---

# PART 1 — LOCAL DEVELOPMENT DEPLOYMENT

---

## PHASE 1: System Prerequisites

### Step 1.1 — Install Node.js 22

**Windows:**
1. Go to https://nodejs.org
2. Download "22.x LTS" installer
3. Run installer → accept all defaults
4. Verify:
```cmd
node --version    # Should show v22.x.x
npm --version     # Should show 10.x.x
```

### Step 1.2 — Install Docker Desktop

**Windows:**
1. Go to https://www.docker.com/products/docker-desktop
2. Download "Docker Desktop for Windows"
3. Run installer → enable WSL2 integration when prompted
4. After install, open Docker Desktop and wait for green "Running" status
5. Verify:
```cmd
docker --version          # Docker version 27.x.x
docker-compose --version  # Docker Compose version 2.x.x
```

### Step 1.3 — Install Git

**Windows:**
1. Go to https://git-scm.com/download/win
2. Download and run installer → accept all defaults
3. Verify:
```cmd
git --version    # git version 2.x.x
```

### Step 1.4 — Install VS Code (Recommended)

1. Go to https://code.visualstudio.com
2. Download and install
3. Install extensions:
   - Prisma (for schema highlighting)
   - Tailwind CSS IntelliSense
   - TypeScript Error Translator

---

## PHASE 2: Project Setup

### Step 2.1 — Navigate to Project Directory

```cmd
cd "C:\Users\mugil\OneDrive\Desktop\CLAUDE.AI\PROJECTS\priovex-ai"
```

### Step 2.2 — Copy Environment File

```cmd
copy .env.example .env
```

Open `.env` in VS Code:
```cmd
code .env
```

**You will fill this in across the next phases. Leave it open.**

### Step 2.3 — Install All Dependencies

```cmd
npm install
```

Expected output: `added 847 packages` (number varies). This installs dependencies for all packages and apps.

---

## PHASE 3: External Service Setup (Free Tiers)

### Step 3.1 — Clerk (Authentication)

**What it does:** Handles user signup, login, OAuth, session management.

1. Go to https://clerk.com → click "Sign Up" (free)
2. Create account → verify email
3. Click "Create application"
4. Application name: `PrioVex.AI`
5. Choose sign-in methods: ✅ Email, ✅ Google
6. Click "Create application"

**Get your keys:**
- Dashboard → left sidebar → "API Keys"
- Copy "Publishable key" → paste into `.env`:
  ```
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxx
  ```
- Copy "Secret key" → paste into `.env`:
  ```
  CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxx
  ```

**Configure redirect URLs:**
- Dashboard → left sidebar → "Paths"
- Set:
  ```
  Sign-in URL:          /sign-in
  Sign-up URL:          /sign-up
  After sign-in URL:    /dashboard
  After sign-up URL:    /dashboard
  ```

**Set up webhook (for user sync):**
- Dashboard → left sidebar → "Webhooks"
- Click "Add Endpoint"
- URL: `http://localhost:3000/api/webhooks/clerk` (for local testing)
- Events: ✅ `user.created`, ✅ `user.updated`, ✅ `user.deleted`
- Click "Create" → copy "Signing Secret"
- Paste into `.env`:
  ```
  CLERK_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx
  ```

### Step 3.2 — Google Cloud (BigQuery for Patent Data)

**What it does:** Queries 100M+ patents from Google Patents Public Data.

1. Go to https://console.cloud.google.com
2. Sign in with Google account
3. Click "Select a project" → "New Project"
4. Project name: `priovex-ai` → click "Create"
5. Wait for project creation, then select it

**Enable BigQuery API:**
1. In search bar, type "BigQuery API"
2. Click on it → click "Enable"
3. Wait for it to enable (30 seconds)

**Create Service Account:**
1. Left sidebar → "IAM & Admin" → "Service Accounts"
2. Click "Create Service Account"
3. Name: `priovex-bigquery`
4. Description: `PrioVex.AI BigQuery access`
5. Click "Create and Continue"
6. Role: Search for "BigQuery" → select "BigQuery Job User"
7. Click "Continue" → "Done"

**Download credentials:**
1. Click on your new service account
2. Tab "Keys" → "Add Key" → "Create new key"
3. Format: JSON → "Create"
4. A JSON file downloads automatically (e.g., `priovex-ai-abc123.json`)

**Add to environment:**
- Open the downloaded JSON file in a text editor
- Copy the entire content
- In `.env`, add:
  ```
  GOOGLE_CLOUD_PROJECT=priovex-ai
  GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"priovex-ai",...}
  ```
  (paste the entire JSON on one line, replacing newlines with spaces is fine)

**Enable billing (required for BigQuery queries):**
1. Left sidebar → "Billing"
2. Link a credit card (you get $300 free credit)
3. BigQuery costs ~$5/TB scanned. A search uses ~1-5 GB = pennies.

### Step 3.3 — Supabase (File Storage)

**What it does:** Stores generated PDF, Markdown, HTML reports.

1. Go to https://supabase.com → "Start your project" (free)
2. Sign up → create organization: `PrioVex`
3. Click "New project"
   - Name: `priovex-ai`
   - Database password: (generate a strong one and save it)
   - Region: choose closest to you
4. Click "Create new project" → wait ~2 minutes

**Get your keys:**
- Left sidebar → Settings → "API"
- Copy "Project URL" → paste into `.env`:
  ```
  SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
  ```
- Copy "anon public" key → paste into `.env`:
  ```
  SUPABASE_ANON_KEY=eyJxxxxxxxxxx
  ```
- Copy "service_role" key (secret) → paste into `.env`:
  ```
  SUPABASE_SERVICE_ROLE_KEY=eyJxxxxxxxxxx
  ```

**Create storage bucket:**
1. Left sidebar → "Storage"
2. Click "New bucket"
3. Name: `priovex-reports`
4. Public bucket: ✅ YES (so PDF links are directly accessible)
5. Click "Save"
6. In `.env`:
   ```
   SUPABASE_STORAGE_BUCKET=priovex-reports
   ```

### Step 3.4 — AI Provider (Choose at least ONE)

#### Option A — Anthropic Claude (Recommended)
1. Go to https://console.anthropic.com
2. Sign up → verify email
3. Left sidebar → "API Keys" → "Create Key"
4. Name: `priovex-local`
5. Copy the key → paste into `.env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx
   ```

#### Option B — OpenAI
1. Go to https://platform.openai.com
2. Sign up → add billing (minimum $5)
3. Top right → "API Keys" → "Create new secret key"
4. Copy → paste into `.env`:
   ```
   OPENAI_API_KEY=sk-xxxxxxxxxxxx
   ```

#### Option C — Google Gemini
1. Go to https://aistudio.google.com
2. Sign in → "Get API key"
3. Click "Create API key" → select your GCP project
4. Copy → paste into `.env`:
   ```
   GOOGLE_GEMINI_API_KEY=AIzaxxxxxxxxxxxx
   ```

### Step 3.5 — Stripe (Billing — Optional for Local Testing)

**For local testing you can skip Stripe and use test keys.**

1. Go to https://stripe.com → "Start now" (free)
2. Create account → verify email
3. Dashboard → top right → make sure "Test mode" toggle is ON
4. Left sidebar → "Developers" → "API keys"
5. Copy keys → paste into `.env`:
   ```
   STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxx
   STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxx
   ```

**Create products (for billing tiers):**
1. Left sidebar → "Products" → "Add product"
2. Create Pro plan:
   - Name: `PrioVex Pro`
   - Price: $49/month recurring
   - Copy Price ID → paste into `.env`:
     ```
     STRIPE_PRICE_PRO_MONTHLY=price_xxxxxxxxxxxx
     ```
3. Repeat for Agency ($199/month):
   ```
   STRIPE_PRICE_AGENCY_MONTHLY=price_xxxxxxxxxxxx
   ```

**Stripe webhook (local testing with Stripe CLI):**

Install Stripe CLI:
```cmd
# Windows — download from:
# https://github.com/stripe/stripe-cli/releases/latest
# Download stripe_x.x.x_windows_x86_64.zip
# Extract stripe.exe to C:\Windows\System32\
```

Login and forward webhooks:
```cmd
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```
Copy the webhook signing secret it shows → paste into `.env`:
```
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx
```

### Step 3.6 — Complete Your .env File

At this point your `.env` should have these minimum values filled in:

```env
# Database (filled in next step — use these exact values for local)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/priovex
DATABASE_DIRECT_URL=postgresql://postgres:postgres@localhost:5432/priovex

# Redis (filled in next step — use these exact values for local)
REDIS_URL=redis://localhost:6379

# Clerk (from Step 3.1)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# AI (at least one from Step 3.4)
ANTHROPIC_API_KEY=sk-ant-...
# OPENAI_API_KEY=sk-...
# GOOGLE_GEMINI_API_KEY=AIza...
DEFAULT_AI_PROVIDER=claude

# BigQuery (from Step 3.2)
GOOGLE_CLOUD_PROJECT=priovex-ai
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

# Supabase (from Step 3.3)
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_STORAGE_BUCKET=priovex-reports

# Stripe (from Step 3.5)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_AGENCY_MONTHLY=price_...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=PrioVex.AI
APP_SECRET=any-random-32-character-string-here
ENCRYPTION_KEY=any-random-32-character-string-!!
```

---

## PHASE 4: Database Setup (Local)

### Step 4.1 — Start Database and Redis with Docker

```cmd
docker-compose up -d postgres redis
```

Wait 10 seconds, then verify:
```cmd
docker ps
```

You should see:
```
CONTAINER ID   IMAGE                    STATUS
abc123...      pgvector/pgvector:pg16   Up 10 seconds
def456...      redis:7-alpine           Up 10 seconds
```

If containers failed:
```cmd
docker-compose logs postgres   # See what went wrong
docker-compose logs redis
```

### Step 4.2 — Generate Prisma Client

```cmd
npm run db:generate
```

Expected: `Generated Prisma Client`

### Step 4.3 — Run Database Migrations

This creates all tables, indexes, and extensions:
```cmd
npm run db:migrate:dev
```

When prompted "Enter a name for the new migration": type `initial_schema`

Expected output:
```
Applying migration `20250510_initial_schema`
Database migrated successfully
```

### Step 4.4 — Seed Database

Creates the admin user:
```cmd
npm run db:seed
```

Expected: `✅ Database seeded successfully`

### Step 4.5 — Verify Database (Optional)

Open Prisma Studio to browse your database visually:
```cmd
npm run db:studio
```

Opens browser at `http://localhost:5555` — you should see all tables.

---

## PHASE 5: Validate Environment

Run the built-in validator:
```cmd
node scripts/validate-env.js
```

Expected output:
```
✅ DATABASE_URL
✅ REDIS_URL
✅ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
✅ CLERK_SECRET_KEY
✅ GOOGLE_CLOUD_PROJECT
✅ SUPABASE_URL
✅ SUPABASE_SERVICE_ROLE_KEY

✅ AI Providers: Claude

✅ Validation PASSED
```

If you see ❌ errors, go back and fix those `.env` values.

---

## PHASE 6: Start Development Servers

### Step 6.1 — Start the Web App

Open Terminal 1:
```cmd
cd "C:\Users\mugil\OneDrive\Desktop\CLAUDE.AI\PROJECTS\priovex-ai\apps\web"
npm run dev
```

Expected:
```
▲ Next.js 15.0.0 (Turbopack)
- Local:    http://localhost:3000
- Ready in 2.1s
```

### Step 6.2 — Start the Workers

Open Terminal 2 (new terminal window):
```cmd
cd "C:\Users\mugil\OneDrive\Desktop\CLAUDE.AI\PROJECTS\priovex-ai\apps\workers"
npm run dev
```

Expected:
```
🚀 PrioVex.AI Workers starting...
✅ Database connected
✅ Search worker started (concurrency: 3)
✅ All workers running. Waiting for jobs...
```

### Step 6.3 — Start Stripe CLI (if testing billing)

Open Terminal 3:
```cmd
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

---

## PHASE 7: Verify Local Deployment

### Step 7.1 — Open the App

Go to: `http://localhost:3000`

You should see the PrioVex.AI landing page.

### Step 7.2 — Test Authentication

1. Click "Start Free" → redirects to `/sign-up`
2. Create an account with your email
3. Verify email (Clerk sends a code)
4. Should redirect to `/dashboard`

### Step 7.3 — Test a Search

1. Click "New Search"
2. Fill in:
   - Title: `Blockchain authentication system`
   - Technical Field: `Cybersecurity`
   - Description: `A system that uses distributed blockchain ledger for user authentication instead of centralized password databases, eliminating single points of failure.`
   - Problem Solved: `Centralized authentication systems are vulnerable to data breaches`
   - Key Innovation: `Distributed key verification using IPFS`
3. Click Continue → Continue → "Start Search"
4. Watch the live progress screen update in real-time
5. Wait for completion (5-45 min depending on depth)

### Step 7.4 — Check Worker Logs

In Terminal 2 (workers), you should see:
```
[Worker] Processing search job abc123
[Search:abc123] [INFO] Step 1: Extracting invention concepts via AI...
[Search:abc123] [SUCCESS] Extracted 8 key features
[Search:abc123] [INFO] Step 3: Running broad BigQuery patent search...
...
```

### Step 7.5 — Verify Report Generation

After completion:
1. Dashboard shows the search as "Completed"
2. Click the search → see patentability score + verdict
3. Download PDF, Markdown, or JSON report

---

**✅ LOCAL DEPLOYMENT COMPLETE**

Your app is running at `http://localhost:3000` with:
- Full authentication
- BigQuery patent search
- AI analysis
- Real-time progress via SSE
- PDF report generation
- Billing (test mode)

---
---

# PART 2 — PRODUCTION DEPLOYMENT

---

## PHASE 8: Production Account Setup

### Step 8.1 — Create Vercel Account (Frontend Hosting)

1. Go to https://vercel.com → "Sign Up"
2. Sign up with GitHub (recommended — enables auto-deploy)
3. Complete account setup

### Step 8.2 — Create Railway Account (Worker Hosting)

1. Go to https://railway.app → "Login with GitHub"
2. Connect your GitHub account
3. Complete account setup
4. Add $5 credit to start (Railway charges usage-based)

### Step 8.3 — Create GitHub Repository

1. Go to https://github.com → "New repository"
2. Name: `priovex-ai`
3. Visibility: Private
4. Click "Create repository"

**Push your code:**
```cmd
cd "C:\Users\mugil\OneDrive\Desktop\CLAUDE.AI\PROJECTS\priovex-ai"
git init
git add .
git commit -m "Initial commit: PrioVex.AI platform"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/priovex-ai.git
git push -u origin main
```

### Step 8.4 — Production Database (Supabase PostgreSQL)

Supabase also provides PostgreSQL — use it for production instead of self-hosted.

1. Log in to https://supabase.com
2. In your existing project → Settings → "Database"
3. Scroll to "Connection string" → choose "URI" tab
4. Copy the connection string (it includes your password)
5. Save this as your production `DATABASE_URL`

It looks like:
```
postgresql://postgres.xxxx:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

### Step 8.5 — Production Redis (Upstash)

1. Go to https://upstash.com → "Sign Up" (free tier available)
2. Click "Create Database"
3. Name: `priovex-redis`
4. Type: Regional
5. Region: Same as your Supabase (e.g., US East)
6. Click "Create"
7. Dashboard shows "Redis URL" → copy it
8. Save as production `REDIS_URL`

It looks like:
```
redis://default:PASSWORD@us1-xxxx.upstash.io:6379
```

### Step 8.6 — Switch Clerk to Production

1. Clerk Dashboard → top left dropdown → "Production" (switch from Development)
2. Click "Create production instance"
3. Follow domain verification steps
4. Get new production keys:
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
   CLERK_SECRET_KEY=sk_live_...
   ```

### Step 8.7 — Switch Stripe to Live Mode

1. Stripe Dashboard → toggle "Test mode" OFF (top right)
2. Get live keys:
   ```
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_PUBLISHABLE_KEY=pk_live_...
   ```
3. Recreate products in live mode (same as Step 3.5 but without "Test mode")

---

## PHASE 9: Deploy Web App to Vercel

### Step 9.1 — Import Project to Vercel

1. Go to https://vercel.com/dashboard
2. Click "Add New..." → "Project"
3. Click "Import" next to your `priovex-ai` repository
4. Vercel detects Next.js automatically

### Step 9.2 — Configure Build Settings

In the import screen:
- Framework Preset: `Next.js` (auto-detected)
- Root Directory: Click "Edit" → type `apps/web`
- Build Command: `cd ../.. && npm run db:generate && npm run build --workspace=apps/web`
- Output Directory: Leave as default (`.next`)
- Install Command: `npm install`

### Step 9.3 — Add Environment Variables to Vercel

Click "Environment Variables" and add ALL of these (one by one):

```
# Database
DATABASE_URL                    = postgresql://postgres.xxxx:PASSWORD@pooler.supabase.com:5432/postgres
DATABASE_DIRECT_URL             = postgresql://postgres.xxxx:PASSWORD@db.xxxx.supabase.co:5432/postgres

# Redis
REDIS_URL                       = redis://default:PASSWORD@us1-xxxx.upstash.io:6379

# Clerk (PRODUCTION keys)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = pk_live_...
CLERK_SECRET_KEY                  = sk_live_...
CLERK_WEBHOOK_SECRET              = whsec_... (set after step 9.5)
NEXT_PUBLIC_CLERK_SIGN_IN_URL   = /sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL   = /sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL = /dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL = /dashboard

# AI Providers
ANTHROPIC_API_KEY               = sk-ant-...
DEFAULT_AI_PROVIDER             = claude

# BigQuery
GOOGLE_CLOUD_PROJECT            = priovex-ai
GOOGLE_SERVICE_ACCOUNT_JSON     = {"type":"service_account",...}

# Supabase Storage
SUPABASE_URL                    = https://xxxx.supabase.co
SUPABASE_ANON_KEY               = eyJ...
SUPABASE_SERVICE_ROLE_KEY       = eyJ...
SUPABASE_STORAGE_BUCKET         = priovex-reports

# Stripe (LIVE keys)
STRIPE_SECRET_KEY               = sk_live_...
STRIPE_PUBLISHABLE_KEY          = pk_live_...
STRIPE_WEBHOOK_SECRET           = whsec_... (set after step 9.6)
STRIPE_PRICE_PRO_MONTHLY        = price_...
STRIPE_PRICE_AGENCY_MONTHLY     = price_...

# App
NEXT_PUBLIC_APP_URL             = https://app.priovex.ai (your domain)
NEXT_PUBLIC_APP_NAME            = PrioVex.AI
APP_SECRET                      = (generate: openssl rand -hex 32)
ENCRYPTION_KEY                  = (generate: openssl rand -hex 16)

# Sentry (optional but recommended)
SENTRY_DSN                      = https://xxx@sentry.io/xxx
NEXT_PUBLIC_SENTRY_DSN          = https://xxx@sentry.io/xxx
```

### Step 9.4 — Deploy

1. Click "Deploy"
2. Watch build logs — takes ~3-5 minutes
3. First deploy URL: `https://priovex-ai-xxxx.vercel.app`

**If build fails**, check logs for:
- Missing env vars
- Prisma generation errors → ensure `DATABASE_URL` is set
- TypeScript errors → check the error message

### Step 9.5 — Add Custom Domain (Optional)

1. Vercel Dashboard → your project → "Settings" → "Domains"
2. Type: `app.priovex.ai` → "Add"
3. Vercel shows DNS records to add:
   - Go to your domain registrar (GoDaddy, Namecheap, etc.)
   - Add the CNAME record Vercel shows
4. Wait 5-15 minutes for DNS propagation
5. Vercel auto-issues SSL certificate

### Step 9.6 — Configure Production Webhooks

**Clerk Webhook (for user sync):**
1. Clerk Dashboard (Production) → "Webhooks" → "Add Endpoint"
2. URL: `https://app.priovex.ai/api/webhooks/clerk`
3. Events: `user.created`, `user.updated`, `user.deleted`
4. Copy Signing Secret → add to Vercel env as `CLERK_WEBHOOK_SECRET`
5. Vercel Dashboard → Redeploy (to pick up new env var)

**Stripe Webhook (for billing):**
1. Stripe Dashboard (Live mode) → "Developers" → "Webhooks"
2. Click "Add endpoint"
3. URL: `https://app.priovex.ai/api/webhooks/stripe`
4. Events to send:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. Click "Add endpoint"
6. Click "Reveal" on signing secret → copy
7. Add to Vercel env as `STRIPE_WEBHOOK_SECRET`
8. Vercel Dashboard → Redeploy

### Step 9.7 — Run Production Database Migration

Install Vercel CLI to run migrations against production DB:

```cmd
npm install -g vercel
vercel login

# Pull production env vars to local
vercel env pull .env.production --token YOUR_VERCEL_TOKEN

# Run migration against production database
$env:DATABASE_URL = "postgresql://postgres.xxxx:PASSWORD@pooler.supabase.com:5432/postgres"
npm run db:migrate
npm run db:seed
```

Or use Supabase SQL editor directly:
1. Supabase Dashboard → "SQL Editor"
2. You can run raw SQL if needed

---

## PHASE 10: Deploy Workers to Railway

### Step 10.1 — Create Railway Project

1. Go to https://railway.app/dashboard
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Select your `priovex-ai` repository
5. Click "Add service" → "GitHub Repo"

### Step 10.2 — Configure Worker Service

1. Click on the new service
2. Settings → "Source"
   - Root Directory: `apps/workers`
   - Dockerfile Path: `apps/workers/Dockerfile`
3. Settings → "Deploy"
   - Start Command: `node dist/index.js`

### Step 10.3 — Add Environment Variables to Railway

Click "Variables" tab → add all the same env vars as Vercel PLUS:

```
# All the same vars as Vercel, PLUS:
WORKER_CONCURRENCY          = 3
SEARCH_TIMEOUT_MS           = 2700000
MAX_SEARCH_DURATION_MS      = 3600000

# These should match production values:
DATABASE_URL                = postgresql://... (same as Vercel)
REDIS_URL                   = redis://... (same as Vercel)
ANTHROPIC_API_KEY           = sk-ant-...
GOOGLE_CLOUD_PROJECT        = priovex-ai
GOOGLE_SERVICE_ACCOUNT_JSON = {...}
SUPABASE_URL                = https://...
SUPABASE_SERVICE_ROLE_KEY   = eyJ...
SUPABASE_STORAGE_BUCKET     = priovex-reports
```

### Step 10.4 — Deploy Workers

1. Railway → your service → "Deploy" tab
2. Click "Deploy Now"
3. Watch build logs (takes 3-5 min — Docker build with Chromium)
4. Should show "Active" with green indicator

**Verify workers are running:**
1. Railway → your service → "Logs" tab
2. Should see:
   ```
   🚀 PrioVex.AI Workers starting...
   ✅ Database connected
   ✅ Search worker started (concurrency: 3)
   ✅ All workers running. Waiting for jobs...
   ```

### Step 10.5 — Scale Workers (Optional)

Railway supports multiple replicas:
1. Service → "Settings" → "Deploy"
2. Number of replicas: 2 (handles concurrent searches)

---

## PHASE 11: Post-Deployment Verification

### Step 11.1 — End-to-End Test

1. Go to `https://app.priovex.ai`
2. Sign up with a real email address
3. Verify you receive the confirmation email
4. Sign in → redirected to `/dashboard`
5. Create a new search (use "quick" depth for faster testing)
6. Verify:
   - Search is created ✅
   - Progress screen updates in real-time ✅ (SSE working)
   - Worker processes the job ✅ (check Railway logs)
   - Report is generated and downloadable ✅

### Step 11.2 — Test Billing Flow

1. Go to `/dashboard/billing`
2. Click "Upgrade" on Pro plan
3. Stripe checkout opens with test card:
   - Card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
4. Complete checkout
5. Return to billing page → should show "Pro" plan
6. Check Railway logs → Stripe webhook processed

### Step 11.3 — Monitor Health

**Vercel:**
- Dashboard → "Analytics" (page load times)
- Dashboard → "Functions" (API response times)
- Dashboard → "Logs" (error logs)

**Railway:**
- Service → "Metrics" (CPU, memory)
- Service → "Logs" (worker activity)

**Supabase:**
- Dashboard → "Database" → "Logs"
- Dashboard → "Storage" → verify reports are being uploaded

---

## PHASE 12: Production Hardening

### Step 12.1 — Set Up Sentry (Error Monitoring)

1. Go to https://sentry.io → "Create account"
2. Create project → select "Next.js"
3. Copy DSN → add to Vercel env:
   ```
   SENTRY_DSN=https://xxx@sentry.io/xxx
   NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
   ```
4. Create separate project for workers → same DSN or different

### Step 12.2 — Set Up Uptime Monitoring

1. Go to https://uptimerobot.com (free)
2. Click "Add New Monitor"
3. Monitor type: HTTP(s)
4. URL: `https://app.priovex.ai`
5. Check interval: Every 5 minutes
6. Notify via email on downtime

### Step 12.3 — Backup Strategy

**Database backups** (Supabase handles automatically):
- Free tier: 7-day backups
- Pro tier: Point-in-time recovery

**Enable Supabase scheduled backups:**
1. Supabase Dashboard → Settings → "Database"
2. Scroll to "Backups" → enable

---

## PHASE 13: CI/CD — Auto Deploy on Push

With GitHub connected to Vercel and Railway, every push to `main` auto-deploys.

### Workflow:
```
You push code → GitHub
     ↓
Vercel detects push → builds web app → deploys (3-5 min)
Railway detects push → builds Docker image → deploys workers (5-8 min)
```

### Protect main branch:
1. GitHub → repo → "Settings" → "Branches"
2. "Add branch protection rule" → branch: `main`
3. ✅ Require status checks to pass
4. Select checks: your CI job names

---

## QUICK REFERENCE SUMMARY

### Local Commands
```cmd
# Start infrastructure
docker-compose up -d postgres redis

# Start app (Terminal 1)
cd apps/web && npm run dev

# Start workers (Terminal 2)
cd apps/workers && npm run dev

# Database
npm run db:migrate:dev   # New migration
npm run db:studio        # Browse DB
npm run db:seed          # Seed data

# Validate env
node scripts/validate-env.js
```

### Production URLs
| Service | URL |
|---------|-----|
| Web App | https://app.priovex.ai |
| Vercel Dashboard | https://vercel.com/dashboard |
| Railway Workers | https://railway.app/dashboard |
| Supabase DB | https://supabase.com/dashboard |
| Upstash Redis | https://console.upstash.com |
| Clerk Auth | https://dashboard.clerk.com |
| Stripe Billing | https://dashboard.stripe.com |

### Cost Estimate (Production)
| Service | Cost |
|---------|------|
| Vercel Pro | $20/month |
| Railway | ~$10-30/month (usage-based) |
| Supabase Pro | $25/month |
| Upstash Redis | ~$0-10/month |
| BigQuery | ~$0.005-0.025 per search |
| Claude API | ~$0.50-2.00 per search |
| Stripe | 2.9% + $0.30 per transaction |
| **Total est.** | **~$60-100/month base** |

Revenue from 10 Pro users ($49 × 10) = $490/month → profitable from month 1.
