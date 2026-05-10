# PrioVex.AI - Local Deployment Setup Checklist

## ✅ PHASE 1: System Prerequisites — COMPLETED

- [x] Node.js 22 installed
- [x] Git installed  
- [x] Docker Desktop needs to be downloaded and installed (see instructions below)

### Docker Desktop Installation

Since Docker is not yet installed, follow these steps:

1. **Download Docker Desktop**
   - Go to: https://www.docker.com/products/docker-desktop
   - Download "Docker Desktop for Windows"
   - Run the installer and accept all defaults
   - Enable WSL2 integration when prompted
   - Restart your computer if needed

2. **Verify Installation**
   - Open Command Prompt and run:
     ```cmd
     docker --version
     docker-compose --version
     ```

---

## 📋 PHASE 2: Project Setup — IN PROGRESS

### ✅ Part 1: Create .env File
- [x] Copied .env.example to .env

### 📝 Part 2: Install Dependencies (NEXT STEP)

**Action Required:**
1. Open Command Prompt
2. Navigate to: `C:\Users\mugil\OneDrive\Desktop\CLAUDE.AI\PROJECTS\priovex-ai`
3. Run:
   ```cmd
   npm install
   ```
4. Wait for completion (this may take 3-5 minutes)

---

## 🔑 PHASE 3: External Service Setup — REQUIRES YOUR ACTION

You need to set up these FREE tier services and collect credentials. Complete these in any order, then return here to populate the .env file.

### Service 1: Clerk Authentication
**What it does:** User signup, login, OAuth, session management  
**Setup Time:** 5-10 minutes

1. Go to: https://clerk.com → Click "Sign Up"
2. Create account → Verify email
3. Click "Create application"
4. Name: `PrioVex.AI`
5. Choose sign-in methods: ✅ Email, ✅ Google
6. Click "Create application"

**Collect These Credentials:**
- Dashboard → Left sidebar → "API Keys"
  - [ ] Copy Publishable key: `pk_test_...`
  - [ ] Copy Secret key: `sk_test_...`

**Configure Paths:**
- Left sidebar → "Paths"
- Sign-in URL: `/sign-in`
- Sign-up URL: `/sign-up`
- After sign-in URL: `/dashboard`
- After sign-up URL: `/dashboard`

**Set Up Webhook:**
- Left sidebar → "Webhooks" → "Add Endpoint"
- URL: `http://localhost:3000/api/webhooks/clerk`
- Events: ✅ `user.created`, ✅ `user.updated`, ✅ `user.deleted`
- Click "Create" and copy Signing Secret: `whsec_...`

### Service 2: Google Cloud (BigQuery for Patent Data)
**What it does:** Query 100M+ patents from Google Patents Public Data  
**Setup Time:** 10-15 minutes

1. Go to: https://console.cloud.google.com
2. Sign in with Google account
3. Click "Select a project" → "New Project"
4. Project name: `priovex-ai` → Click "Create"
5. Wait for project creation, then select it

**Enable BigQuery API:**
1. Search bar → Type "BigQuery API"
2. Click it → Click "Enable"

**Create Service Account:**
1. Left sidebar → "IAM & Admin" → "Service Accounts"
2. Click "Create Service Account"
3. Name: `priovex-bigquery`
4. Description: `PrioVex.AI BigQuery access`
5. Click "Create and Continue"
6. Role: Search "BigQuery" → Select "BigQuery Job User"
7. Click "Continue" → "Done"

**Download Credentials:**
1. Click on your service account
2. Tab "Keys" → "Add Key" → "Create new key"
3. Format: JSON → "Create"
4. A JSON file downloads automatically

**Collect These Credentials:**
- [ ] Copy ENTIRE JSON file content (we'll paste it as one line)
- [ ] Copy `project_id` value from the JSON

**Enable Billing (Required for BigQuery):**
1. Left sidebar → "Billing"
2. Link a credit card (you get $300 free credit)
3. Note: BigQuery costs ~$5/TB scanned, searches use ~1-5 GB = pennies

### Service 3: Supabase (File Storage)
**What it does:** Stores generated PDF, Markdown, HTML reports  
**Setup Time:** 5-10 minutes

1. Go to: https://supabase.com → "Start your project"
2. Sign up → Create organization: `PrioVex`
3. Click "New project"
   - Name: `priovex-ai`
   - Database password: (generate a strong one and save it)
   - Region: choose closest to you
4. Click "Create new project" → wait ~2 minutes

**Collect These Credentials:**
- Left sidebar → Settings → "API"
  - [ ] Copy Project URL: `https://xxxx.supabase.co`
  - [ ] Copy "anon public" key: `eyJ...`
  - [ ] Copy "service_role" key: `eyJ...`

**Create Storage Bucket:**
1. Left sidebar → "Storage"
2. Click "New bucket"
3. Name: `priovex-reports`
4. Public bucket: ✅ YES
5. Click "Save"

### Service 4: AI Provider (Choose ONE)

#### Option A: Anthropic Claude (Recommended)
1. Go to: https://console.anthropic.com
2. Sign up → Verify email
3. Left sidebar → "API Keys" → "Create Key"
4. Name: `priovex-local`
5. [ ] Copy the key: `sk-ant-...`

#### Option B: OpenAI
1. Go to: https://platform.openai.com
2. Sign up → Add billing (minimum $5)
3. Top right → "API Keys" → "Create new secret key"
4. [ ] Copy: `sk-...`

#### Option C: Google Gemini
1. Go to: https://aistudio.google.com
2. Sign in → "Get API key"
3. Click "Create API key"
4. [ ] Copy: `AIza...`

### Service 5: Stripe (Optional for Local Testing)

For local testing, you can use test keys. For production, you'll need real keys later.

1. Go to: https://stripe.com → "Start now"
2. Create account → Verify email
3. Dashboard → Make sure **Test mode is ON** (top right toggle)
4. Left sidebar → "Developers" → "API keys"
5. [ ] Copy Secret key: `sk_test_...`
6. [ ] Copy Publishable key: `pk_test_...`

---

## 🔧 PHASE 3B: Populate .env File (After collecting credentials above)

Edit the file: `C:\Users\mugil\OneDrive\Desktop\CLAUDE.AI\PROJECTS\priovex-ai\.env`

Add these values (collect from services above):

```env
# Database (use these exact values for local)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/priovex
DATABASE_DIRECT_URL=postgresql://postgres:postgres@localhost:5432/priovex

# Redis (use these exact values for local)
REDIS_URL=redis://localhost:6379

# Clerk (from Service 1)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# AI (choose ONE from Service 4)
ANTHROPIC_API_KEY=sk-ant-...
# OPENAI_API_KEY=sk-...
# GOOGLE_GEMINI_API_KEY=AIza...
DEFAULT_AI_PROVIDER=claude

# BigQuery (from Service 2)
GOOGLE_CLOUD_PROJECT=priovex-ai
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

# Supabase (from Service 3)
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_STORAGE_BUCKET=priovex-reports

# Stripe (from Service 5)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_AGENCY_MONTHLY=price_...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=PrioVex.AI
APP_SECRET=<generate: 32 random characters>
ENCRYPTION_KEY=<generate: 32 random characters>
```

---

## 🗄️ PHASE 4: Database Setup

After npm install completes, run these commands in sequence:

### Step 1: Start Docker Containers
```cmd
docker-compose up -d postgres redis
```
Wait 10 seconds, then verify:
```cmd
docker ps
```

### Step 2: Generate Prisma Client
```cmd
npm run db:generate
```

### Step 3: Run Migrations
```cmd
npm run db:migrate:dev
```
When prompted for migration name, type: `initial_schema`

### Step 4: Seed Database
```cmd
npm run db:seed
```

### Step 5: Verify (Optional)
```cmd
npm run db:studio
```
Opens: http://localhost:5555

---

## 🚀 PHASE 5-7: Start Development Servers

### Terminal 1: Start Web App
```cmd
cd "C:\Users\mugil\OneDrive\Desktop\CLAUDE.AI\PROJECTS\priovex-ai\apps\web"
npm run dev
```

### Terminal 2: Start Workers
```cmd
cd "C:\Users\mugil\OneDrive\Desktop\CLAUDE.AI\PROJECTS\priovex-ai\apps\workers"
npm run dev
```

### Access the App
Open browser → http://localhost:3000

---

## 📊 Progress Tracking

- [ ] PHASE 1: System Prerequisites ✅ COMPLETED
- [ ] PHASE 2: Project Setup — npm install needed
- [ ] PHASE 3: External Services setup
- [ ] PHASE 3B: Populate .env file
- [ ] PHASE 4: Database setup
- [ ] PHASE 5-7: Start servers and test

---

## 🆘 Troubleshooting

**npm install fails:**
- Make sure you're in the correct directory
- Delete `node_modules` folder and `package-lock.json`
- Run `npm install` again

**Docker won't start:**
- Make sure Docker Desktop is running (check Windows taskbar)
- Check if WSL2 is enabled in Windows

**Port 3000 already in use:**
- Another process is using port 3000
- Kill the process or specify a different port in .env: `PORT=3001`

**Database connection fails:**
- Make sure Docker containers are running: `docker ps`
- Check if postgres is listening: Check Docker Desktop logs

---

## 📝 Notes

- All services offer free tiers, no credit card required initially
- For production deployment, see PART 2 of DEPLOYMENT.md
- Keep all credentials secure and never commit .env file to git
- The .env file is already in .gitignore ✅

