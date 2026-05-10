# Supabase File Storage Setup Guide

Complete these steps to set up Supabase for storing generated reports (PDF, Markdown, HTML).

## 📧 Use This Email
**mugilvannan@myipstrategy.com**

---

## Step 1: Create Supabase Project

1. Open: https://supabase.com
2. Click **"Start your project"** button
3. Click **"Sign up"**
4. Sign in with **mugilvannan@myipstrategy.com** (Google or email)
5. Create organization: **PrioVex**
6. Click **"New project"**

### Configure Project
- **Project name**: `priovex-ai`
- **Database password**: Create a strong password and **save it somewhere safe**
  - Example: `Sup@b@se!PrioVex#2026$Secure`
- **Region**: Choose the region closest to you (e.g., us-west-1 for US)
- Click **"Create new project"**
- Wait for project creation (~2 minutes)

---

## Step 2: Create Storage Bucket

1. In the left sidebar, click **"Storage"**
2. Click **"New bucket"** (blue button)
3. Fill in:
   - **Bucket name**: `priovex-reports`
   - **Public bucket**: Toggle **ON** (✅ YES)
4. Click **"Save"**

---

## Step 3: Collect Your Credentials

### Find Project URL
1. Left sidebar → **"Settings"**
2. Click **"API"** tab
3. Look for **"Project URL"**: 
   - Format: `https://xxxx.supabase.co`
   - Example: `https://smashing-hen-16.supabase.co`
   - **Copy this value**

### Find API Keys
Same "Settings → API" page:

1. **Anon Public Key**
   - Labeled: "anon public"
   - Starts with: `eyJ...` (long string)
   - **Copy this value**

2. **Service Role Key**
   - Labeled: "service_role"
   - Starts with: `eyJ...` (long string)
   - **Copy this value**

---

## ✅ Save These Values

### Supabase Credentials:
```
PROJECT_URL = https://xxxx.supabase.co

ANON_PUBLIC_KEY = eyJ...

SERVICE_ROLE_KEY = eyJ...
```

---

## ⏱️ Timeline
- Sign up: ~1 min
- Organization creation: ~1 min
- Project creation: ~2 min
- Storage bucket setup: ~1 min
- Credential collection: ~2 min
- **Total: ~5-10 minutes**

---

## 🔐 Security Notes
- Keep the **Service Role Key** private (has write permissions)
- The **Anon Public Key** is safe to expose (read-only for your public bucket)
- Never commit these to git
- `.gitignore` will protect your `.env` file

---

## ✨ Next Steps

Once you complete this setup:
1. Save the **Project URL**, **Anon Public Key**, and **Service Role Key**
2. Continue with **Service 4**: AI Provider (Claude/OpenAI/Gemini)
3. Then **Service 5**: Stripe (optional)
4. Collect Clerk webhook secret from manual setup
5. We'll populate your `.env` file with all credentials
