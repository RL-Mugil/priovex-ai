# Stripe Setup Guide (Optional for Local Testing)

Stripe is optional for local development. Use test keys to avoid real charges.

## 📧 Use This Email
**mugilvannan@myipstrategy.com**

---

## Step 1: Create Stripe Account

1. Open: https://stripe.com
2. Click **"Start now"** button
3. Sign up with **mugilvannan@myipstrategy.com**
4. Verify your email
5. Complete account setup (business info)

---

## Step 2: Access Test Mode

1. Dashboard → Top right corner
2. Look for **"Test mode"** toggle
3. Make sure it's **ON** (enabled)
   - You'll see "Test mode" label
   - This ensures you use test keys, not real money!

---

## Step 3: Get API Keys

1. Left sidebar → **"Developers"**
2. Click **"API Keys"**
3. You should see two keys listed:

### Copy These Test Keys:

**Secret Key (Test)**
- Starts with: `sk_test_...`
- Click **Copy** button
- **Save this value**

**Publishable Key (Test)**
- Starts with: `pk_test_...`
- Click **Copy** button
- **Save this value**

> ⚠️ **Important**: These are TEST keys, not production. Real transactions won't occur during local development.

---

## ✅ Save These Values

### Stripe Credentials (Test):
```
STRIPE_SECRET_KEY = sk_test_...

STRIPE_PUBLISHABLE_KEY = pk_test_...
```

---

## ⏱️ Timeline
- Account creation: ~3 min
- Email verification: ~1 min
- API key collection: ~1 min
- **Total: ~5 minutes**

---

## 🔐 Security Notes
- Test keys are safe to expose (they only work in test mode)
- Never use production keys in development
- Always keep secret keys private (don't commit to git)
- `.gitignore` will protect your `.env` file

---

## 💳 For Production (Later)

When deploying to production:
1. Enable **Live mode** (toggle on dashboard)
2. Collect LIVE API keys (not test keys)
3. Add billing information to Stripe account
4. Update `.env` with production keys

---

## ✨ Next Steps

After completing this (optional) setup:
1. Collect all credentials from Services 1-5:
   - ✅ **Service 1** (Clerk): Publishable Key, Secret Key, Webhook Secret
   - ✅ **Service 2** (Google Cloud): Project ID, Service Account JSON
   - ✅ **Service 3** (Supabase): Project URL, Anon Key, Service Role Key
   - ✅ **Service 4** (AI Provider): Choose one API key
   - ✅ **Service 5** (Stripe): Secret Key, Publishable Key (optional)

2. We'll populate your `.env` file with all credentials
3. Run `npm install` if not already done
4. Execute database setup and start dev servers
