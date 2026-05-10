# AI Provider Setup Guide

Choose ONE AI provider for patent analysis. Claude (Anthropic) is recommended for best results.

## ⭐ Option A: Claude (Anthropic) - Recommended

### Step 1: Create Account
1. Open: https://console.anthropic.com
2. Click **"Sign up"**
3. Sign up with **mugilvannan@myipstrategy.com**
4. Verify your email

### Step 2: Create API Key
1. Left sidebar → **"API Keys"**
2. Click **"Create Key"**
3. Name: `priovex-local`
4. Click **"Create"**
5. **Copy the key**: `sk-ant-...` (long string)
   - This is your API key - keep it safe!

### Step 3: Add Billing (Optional but Recommended)
1. Left sidebar → **"Billing"**
2. Add a credit card
3. Claude API is pay-as-you-go ($0.003 per input token, $0.015 per output token)
4. You get free credits to test

✅ **Save this value**:
```
ANTHROPIC_API_KEY = sk-ant-...
```

---

## Option B: OpenAI

### Step 1: Create Account
1. Open: https://platform.openai.com
2. Click **"Sign up"**
3. Sign up with **mugilvannan@myipstrategy.com**
4. Verify email and phone

### Step 2: Add Billing
1. Left sidebar → **"Billing"**
2. Click **"Set up paid account"**
3. Add credit card
4. Minimum: $5 to start using API

### Step 3: Create API Key
1. Left sidebar → **"API Keys"** (under "Manage account")
2. Click **"Create new secret key"**
3. Copy the key: `sk-...`

✅ **Save this value**:
```
OPENAI_API_KEY = sk-...
```

---

## Option C: Google Gemini

### Step 1: Get API Key
1. Open: https://aistudio.google.com
2. Sign in with **mugilvannan@myipstrategy.com**
3. Left sidebar → **"Get API key"**
4. Click **"Create API key"**
5. Copy the key: `AIza...`

### Step 2: Optional Billing
- Google Gemini has free tier (50 requests/minute)
- For production, add billing for higher limits

✅ **Save this value**:
```
GOOGLE_API_KEY = AIza...
```

---

## 🎯 Recommendation: Use Claude

Why Claude is recommended for PrioVex.AI:

✅ **Best for Patent Analysis**
- Strong technical understanding
- Good at complex document analysis
- Excellent reasoning for patent claims

✅ **Cost Efficient**
- 10% cheaper than GPT-4
- Better context window for long documents

✅ **Reliable**
- High uptime
- Consistent performance

✅ **Native Integration**
- Easy setup with Node.js/Next.js

---

## ⏱️ Timeline per Provider
- Account creation: ~2 min
- API key generation: ~1 min
- Billing setup: ~2 min
- **Total: ~5 minutes**

---

## ✨ Next Steps

After choosing your AI provider:
1. Save the API key from your chosen provider
2. Continue with **Service 5**: Stripe (optional)
3. Collect remaining credentials:
   - Clerk: Publishable Key, Secret Key, Webhook Secret
   - Google Cloud: Project ID, Service Account JSON
   - Supabase: Project URL, Anon Key, Service Role Key
4. We'll populate your `.env` file with all credentials

---

## Environment Variable Names

Once you've collected all credentials, here's what each goes into your `.env`:

**For Claude:**
```
ANTHROPIC_API_KEY=sk-ant-...
```

**For OpenAI:**
```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4
```

**For Gemini:**
```
GOOGLE_API_KEY=AIza...
GOOGLE_MODEL=gemini-pro
```
