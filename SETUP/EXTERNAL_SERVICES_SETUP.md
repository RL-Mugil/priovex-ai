# PrioVex.AI External Services Setup Guide

Complete these 5 services to get all required credentials for local development.

---

## 📋 SERVICE 1: Clerk Authentication (5-10 minutes)
**Status:** ⬜ Not Started

### What it does
- User signup, login, and OAuth (Google)
- Session management
- Required for app authentication

### Setup Steps
1. Go to: https://clerk.com
2. Click "Sign Up" → Create account → Verify email
3. Click "Create application"
4. Name: `PrioVex.AI`
5. Choose sign-in methods: ✅ Email, ✅ Google
6. Click "Create application"

### Collect These Credentials
After app creation:
- [ ] **Publishable Key** - Dashboard → Left sidebar → "API Keys" → Copy: `pk_test_...`
- [ ] **Secret Key** - Same page → Copy: `sk_test_...`
- [ ] **Webhook Secret** - Left sidebar → "Webhooks" → "Add Endpoint" → URL: `http://localhost:3000/api/webhooks/clerk` → Events: `user.created`, `user.updated`, `user.deleted` → Copy Signing Secret: `whsec_...`

### Configure Paths
- Left sidebar → "Paths"
  - Sign-in URL: `/sign-in`
  - Sign-up URL: `/sign-up`
  - After sign-in URL: `/dashboard`
  - After sign-up URL: `/dashboard`

---

## 📋 SERVICE 2: Google Cloud BigQuery (10-15 minutes)
**Status:** ⬜ Not Started

### What it does
- Access 100M+ patents from Google Patents Public Data
- BigQuery API for patent search queries

### Setup Steps
1. Go to: https://console.cloud.google.com
2. Sign in with Google account
3. Click "Select a project" → "New Project"
4. Project name: `priovex-ai` → Click "Create"
5. Wait for project creation (30 seconds), then select it

### Enable BigQuery API
1. Search bar → Type "BigQuery API"
2. Click it → Click "Enable"

### Create Service Account
1. Left sidebar → "IAM & Admin" → "Service Accounts"
2. Click "Create Service Account"
3. Name: `priovex-bigquery`
4. Description: `PrioVex.AI BigQuery access`
5. Click "Create and Continue"
6. Role: Search "BigQuery" → Select "BigQuery Job User"
7. Click "Continue" → "Done"

### Download Credentials
1. Click on your service account
2. Tab "Keys" → "Add Key" → "Create new key"
3. Format: JSON → "Create"
4. **Save this JSON file to your Downloads folder**

### Enable Billing (Required)
1. Left sidebar → "Billing"
2. Link a credit card (you get $300 free credit)
3. Note: BigQuery costs ~$5/TB scanned, searches use ~1-5 GB = pennies

### Collect These Credentials
- [ ] **Service Account JSON** - Open the JSON file you downloaded, copy the entire content
- [ ] **Project ID** - From the JSON file, find and copy the `project_id` value

---

## 📋 SERVICE 3: Supabase File Storage (5-10 minutes)
**Status:** ⬜ Not Started

### What it does
- Stores generated PDF, Markdown, HTML reports
- S3-compatible file storage

### Setup Steps
1. Go to: https://supabase.com
2. Click "Start your project"
3. Sign up → Create organization: `PrioVex`
4. Click "New project"
   - Name: `priovex-ai`
   - Database password: **Generate a strong one and save it**
   - Region: Choose closest to you
5. Click "Create new project" → Wait ~2 minutes

### Create Storage Bucket
1. Left sidebar → "Storage"
2. Click "New bucket"
3. Name: `priovex-reports`
4. Public bucket: ✅ YES
5. Click "Save"

### Collect These Credentials
- [ ] **Project URL** - Left sidebar → Settings → "API" → Copy: `https://xxxx.supabase.co`
- [ ] **Anon Public Key** - Same page → Copy: `eyJ...` (labeled "anon public")
- [ ] **Service Role Key** - Same page → Copy: `eyJ...` (labeled "service_role")

---

## 📋 SERVICE 4: AI Provider - Choose ONE (5 minutes)
**Status:** ⬜ Not Started

### Option A: Anthropic Claude ⭐ Recommended
1. Go to: https://console.anthropic.com
2. Sign up → Verify email
3. Left sidebar → "API Keys" → "Create Key"
4. Name: `priovex-local`
5. [ ] Copy the key: `sk-ant-...`

### Option B: OpenAI
1. Go to: https://platform.openai.com
2. Sign up → Add billing (minimum $5)
3. Top right → "API Keys" → "Create new secret key"
4. [ ] Copy: `sk-...`

### Option C: Google Gemini
1. Go to: https://aistudio.google.com
2. Sign in → "Get API key"
3. Click "Create API key"
4. [ ] Copy: `AIza...`

**Collect:**
- [ ] **API Key** for your chosen provider

---

## 📋 SERVICE 5: Stripe Billing (5 minutes) - Optional for Local Testing
**Status:** ⬜ Not Started

### What it does
- Payment processing and subscription management
- For local testing, uses test keys (no real charges)

### Setup Steps
1. Go to: https://stripe.com
2. Click "Start now"
3. Create account → Verify email
4. Dashboard → Make sure **Test mode is ON** (top right toggle)
5. Left sidebar → "Developers" → "API keys"

### Collect These Credentials
- [ ] **Secret Key (Test)** - Copy: `sk_test_...`
- [ ] **Publishable Key (Test)** - Copy: `pk_test_...`

---

## 📊 Progress Checklist

- [ ] SERVICE 1: Clerk - Publishable Key, Secret Key, Webhook Secret
- [ ] SERVICE 2: Google Cloud - JSON file downloaded, Project ID collected
- [ ] SERVICE 3: Supabase - Project URL, Anon Key, Service Role Key
- [ ] SERVICE 4: AI Provider - API Key (pick one: Claude, OpenAI, or Gemini)
- [ ] SERVICE 5: Stripe - Secret Key, Publishable Key (optional)

---

## ⏱️ Timing
You can complete all 5 services in **30-40 minutes** while `npm install` runs.

Once complete, return here and we'll populate the .env file with all collected credentials.

---

## 🔒 Security Notes
- Keep all credentials private
- Never commit credentials to git
- .env file is already in .gitignore ✅
- For production, you'll need production credentials from these services

