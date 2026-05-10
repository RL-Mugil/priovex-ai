# .env File Population Guide

Once you've collected all credentials from Services 1-5, use this guide to populate your `.env` file.

---

## 📍 Your .env File Location
```
C:\Users\mugil\OneDrive\Desktop\CLAUDE.AI\PROJECTS\priovex-ai\.env
```

This file should already exist (created from `.env.example`). If not, create it now.

---

## 📋 What to Do

1. Open `.env` file in your editor (VS Code, Notepad, etc.)
2. Replace the values below with your actual credentials
3. Save the file
4. Your app will automatically use these values

---

## 🔑 Environment Variables Template

Copy and paste this template, then replace `YOUR_VALUE_HERE` with actual credentials:

```env
# ═══════════════════════════════════════════════════════════════
# CLERK AUTHENTICATION
# ═══════════════════════════════════════════════════════════════
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY=sk_test_YOUR_CLERK_SECRET_KEY
CLERK_WEBHOOK_SECRET=whsec_YOUR_CLERK_WEBHOOK_SECRET

# Clerk Paths
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# ═══════════════════════════════════════════════════════════════
# GOOGLE CLOUD - BigQuery Patent Data
# ═══════════════════════════════════════════════════════════════
GOOGLE_CLOUD_PROJECT_ID=priovex-ai
GOOGLE_APPLICATION_CREDENTIALS=./credentials.json

# Service Account JSON (paste entire JSON content below)
# This is the downloaded JSON file from Service Account creation
GOOGLE_SERVICE_ACCOUNT_JSON={
  "type": "service_account",
  "project_id": "priovex-ai",
  "private_key_id": "YOUR_PRIVATE_KEY_ID",
  "private_key": "YOUR_PRIVATE_KEY",
  "client_email": "YOUR_SERVICE_ACCOUNT_EMAIL@priovex-ai.iam.gserviceaccount.com",
  "client_id": "YOUR_CLIENT_ID",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "YOUR_CERT_URL"
}

# ═══════════════════════════════════════════════════════════════
# SUPABASE - File Storage
# ═══════════════════════════════════════════════════════════════
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ_YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=eyJ_YOUR_SERVICE_ROLE_KEY
SUPABASE_BUCKET_NAME=priovex-reports

# ═══════════════════════════════════════════════════════════════
# AI PROVIDER - Patent Analysis
# ═══════════════════════════════════════════════════════════════
# Choose ONE of the following (uncomment your choice, comment out the rest)

# Option A: Anthropic Claude (Recommended)
ANTHROPIC_API_KEY=sk-ant-YOUR_CLAUDE_API_KEY
AI_PROVIDER=anthropic

# Option B: OpenAI (Commented out - uncomment if using)
# OPENAI_API_KEY=sk-YOUR_OPENAI_API_KEY
# OPENAI_MODEL=gpt-4
# AI_PROVIDER=openai

# Option C: Google Gemini (Commented out - uncomment if using)
# GOOGLE_API_KEY=AIza_YOUR_GEMINI_API_KEY
# GOOGLE_MODEL=gemini-pro
# AI_PROVIDER=gemini

# ═══════════════════════════════════════════════════════════════
# STRIPE BILLING (Optional - only if set up)
# ═══════════════════════════════════════════════════════════════
# Use TEST keys for local development (no real charges)
STRIPE_SECRET_KEY=sk_test_YOUR_STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_STRIPE_WEBHOOK_SECRET

# ═══════════════════════════════════════════════════════════════
# DATABASE
# ═══════════════════════════════════════════════════════════════
DATABASE_URL=postgresql://postgres:YOUR_DB_PASSWORD@localhost:5432/priovex_ai

# ═══════════════════════════════════════════════════════════════
# REDIS (Cache & Sessions)
# ═══════════════════════════════════════════════════════════════
REDIS_URL=redis://localhost:6379

# ═══════════════════════════════════════════════════════════════
# APPLICATION
# ═══════════════════════════════════════════════════════════════
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 🔄 Step-by-Step: Filling In Your Values

### 1. Clerk Values (from Service 1)
Find these in the `.env` and replace:
- `pk_test_YOUR_CLERK_PUBLISHABLE_KEY` → `pk_test_c21hc2hpbmctaGVuLTE2...`
- `sk_test_YOUR_CLERK_SECRET_KEY` → `sk_test_RVhPmaP9UAGzZ54hYRfT...`
- `whsec_YOUR_CLERK_WEBHOOK_SECRET` → `whsec_...` (from webhook setup)

### 2. Google Cloud Values (from Service 2)
- `priovex-ai` → Keep as is (this is your project ID)
- `GOOGLE_SERVICE_ACCOUNT_JSON` → Paste entire downloaded JSON file content

### 3. Supabase Values (from Service 3)
Replace with values from Supabase Settings → API:
- `YOUR_PROJECT_ID` → `smashing-hen-16` (from your project URL)
- `eyJ_YOUR_ANON_KEY` → Paste your Anon Public Key
- `eyJ_YOUR_SERVICE_ROLE_KEY` → Paste your Service Role Key

### 4. AI Provider (from Service 4)
Choose ONE provider:

**If using Claude:**
```
ANTHROPIC_API_KEY=sk-ant-YOUR_ACTUAL_KEY
AI_PROVIDER=anthropic
```

**If using OpenAI:**
```
# Uncomment these:
OPENAI_API_KEY=sk-YOUR_ACTUAL_KEY
OPENAI_MODEL=gpt-4
AI_PROVIDER=openai
```

**If using Gemini:**
```
# Uncomment these:
GOOGLE_API_KEY=AIza_YOUR_ACTUAL_KEY
GOOGLE_MODEL=gemini-pro
AI_PROVIDER=gemini
```

### 5. Stripe (Optional, from Service 5)
If you set up Stripe:
- `sk_test_YOUR_STRIPE_SECRET_KEY` → `sk_test_...`
- `pk_test_YOUR_STRIPE_PUBLISHABLE_KEY` → `pk_test_...`
- `whsec_YOUR_STRIPE_WEBHOOK_SECRET` → `whsec_...`

---

## ✅ Validation Checklist

Before saving, verify:

- [ ] All `pk_test_` values start with `pk_test_`
- [ ] All `sk_test_` values start with `sk_test_`
- [ ] All `whsec_` values start with `whsec_`
- [ ] Supabase URL follows format: `https://xxxx.supabase.co`
- [ ] One (and only one) AI provider is uncommented
- [ ] No placeholder text like `YOUR_` remains
- [ ] All required fields are filled in
- [ ] File ends with a newline (best practice)

---

## 🔐 Security Reminders

✅ **SAFE**: 
- Keeping credentials in `.env`
- Your `.gitignore` includes `.env`
- Test API keys (they start with `_test_`)

❌ **NOT SAFE**:
- Committing `.env` to git
- Sharing credentials in messages
- Using production keys in development
- Hardcoding keys in code files

---

## 💾 After Saving

Once you've populated `.env`:

1. **Save the file** (Ctrl+S)
2. **Close your editor**
3. **Restart your development server** (npm run dev)
4. The app will now use your credentials

---

## 🆘 Troubleshooting

**"Connection refused" error?**
- Make sure PostgreSQL & Redis are running in Docker
- Check `docker-compose up` output

**"Invalid API key" error?**
- Verify you copied the key correctly (no extra spaces)
- Check you used the TEST key (not production)
- For Google Cloud, verify the JSON is properly formatted

**"Module not found" error?**
- Make sure you've completed `npm install`
- The app uses your credentials from `.env` at runtime

---

## 📞 When to Use This File

✅ Use this guide when:
- You've completed all 5 services setup
- You have all credentials collected
- You're ready to start development servers

❌ Don't use this yet if:
- You're still setting up services
- You haven't collected all credentials
- You're following SERVICE setup guides (they have specific steps)

---

## ✨ Next After .env is Ready

Once your `.env` file is populated and saved:

1. **Run database setup**:
   ```bash
   npm run db:setup
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```

3. **Access your app**:
   ```
   http://localhost:3000
   ```

4. **Sign in with Clerk**:
   - Use the sign-in URL created earlier
   - Test user creation and dashboard access

You're on the home stretch! 🚀
