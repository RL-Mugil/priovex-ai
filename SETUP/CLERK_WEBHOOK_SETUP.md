# Clerk Webhook Configuration - Manual Setup Guide

Due to a technical limitation with the Clerk dashboard's iframe-based interface, you'll need to complete the webhook endpoint creation manually. Below is a step-by-step guide.

## ✅ What You Already Have

From the API Keys page, you've collected:
- **Publishable Key (pk_test_...)**: Already saved
- **Secret Key (sk_test_...*)**: Already saved and copied to clipboard

## 🔧 Complete the Webhook Setup

### Step 1: Navigate to Webhooks > Endpoints
1. In Clerk Dashboard, go to **Developers → Webhooks** (left sidebar)
2. Click the **Endpoints** tab at the top
3. You should see a message: "Set up an endpoint to get started"

### Step 2: Create New Endpoint
1. Click the blue **"+ Add Endpoint"** button (top right)
2. A form should appear asking for endpoint configuration

### Step 3: Fill in Endpoint Details
In the form that appears, enter:

**Endpoint URL:**
```
http://localhost:3000/api/webhooks/clerk
```

**Select Events:**
Check the following boxes:
- ✅ `user.created`
- ✅ `user.updated`
- ✅ `user.deleted`

### Step 4: Create and Copy Signing Secret
1. Click **"Create Endpoint"** button
2. The endpoint will be created and you'll see the **Webhook Signing Secret**
3. It will look like: `whsec_...` (long string)
4. Click **Copy** next to the signing secret to copy it

### Step 5: Save Your Webhook Secret
The signing secret should be in this format:
```
whsec_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

You'll need this to populate your `.env` file in the next step.

---

## 📝 What to Do Next

Once you have the webhook signing secret:
1. Note down the three values you've collected:
   - Publishable Key: `pk_test_...`
   - Secret Key: `sk_test_...`
   - Webhook Secret: `whsec_...`

2. Proceed with the remaining external services:
   - **SERVICE 2**: Google Cloud BigQuery
   - **SERVICE 3**: Supabase File Storage
   - **SERVICE 4**: AI Provider (Claude/OpenAI/Gemini)
   - **SERVICE 5**: Stripe (optional for local testing)

3. Once all services are configured, we'll populate your `.env` file with all credentials.

---

## 🔐 Security Note
- Keep the webhook signing secret private
- Never commit these keys to git
- Your `.gitignore` already protects the `.env` file
