# Google Cloud BigQuery Setup Guide

Complete these steps to set up Google Cloud BigQuery for patent data access in PrioVex.AI.

## 📧 Use This Email
**mugilvannan@myipstrategy.com**

---

## Step 1: Create Google Cloud Project

1. Open: https://console.cloud.google.com
2. Sign in with **mugilvannan@myipstrategy.com**
3. Click **"Select a project"** at the top
4. Click **"New Project"**
5. Fill in:
   - **Project name**: `priovex-ai`
   - Click **"Create"**
6. Wait for project creation (~30 seconds)
7. Select the new **priovex-ai** project from the dropdown

---

## Step 2: Enable BigQuery API

1. In the search bar at the top, type: **BigQuery API**
2. Click on **"BigQuery API"** result
3. Click the blue **"Enable"** button
4. Wait for it to enable (~1 minute)

---

## Step 3: Create Service Account

1. In the left sidebar, click **"IAM & Admin"**
2. Click **"Service Accounts"**
3. Click **"Create Service Account"** (blue button at top)
4. Fill in:
   - **Service account name**: `priovex-bigquery`
   - **Service account ID**: `priovex-bigquery` (auto-fills)
   - **Description**: `PrioVex.AI BigQuery access`
5. Click **"Create and Continue"**

### Grant Permissions

1. Under "Grant this service account access to project":
2. In the **"Select a role"** dropdown, search: **BigQuery**
3. Select: **"BigQuery Job User"**
4. Click **"Continue"**
5. Click **"Done"**

---

## Step 4: Generate and Download Credentials

1. You should now see the service account listed
2. Click on **"priovex-bigquery"** to open its details
3. Click the **"Keys"** tab
4. Click **"Add Key"** → **"Create new key"**
5. Select **JSON** format
6. Click **"Create"**
7. A JSON file will automatically download to your **Downloads** folder
   - File name: `priovex-ai-XXXXX.json`
   - **Keep this file safe!**

---

## Step 5: Enable Billing (Required for BigQuery)

1. In the left sidebar, click **"Billing"**
2. Click **"Link a billing account"**
3. If you don't have a billing account:
   - Click **"Create billing account"**
   - Add a credit card
   - You get **$300 free credit** for first 3 months
4. Link the billing account to the **priovex-ai** project

> **Note**: BigQuery costs ~$5/TB scanned. Patent searches use ~1-5 GB = pennies per search.

---

## Step 6: Collect Your Credentials

### Option A: From Downloaded JSON File
1. Open the downloaded JSON file in Notepad/TextEdit
2. Look for these values:
   - **"project_id"**: Copy this value
   - Copy the **entire JSON content** (Ctrl+A → Ctrl+C)

### Option B: From Google Cloud Console
1. Go back to the **priovex-ai** project
2. Click **"Project settings"** (gear icon top right)
3. Find **"Project ID"**: `priovex-ai`

---

## ✅ Save These Values

After completing all steps, you'll have:

### Google Cloud BigQuery Credentials:
```
PROJECT_ID = priovex-ai

SERVICE_ACCOUNT_JSON = {
  "type": "service_account",
  "project_id": "priovex-ai",
  "private_key_id": "...",
  "private_key": "...",
  ...
  (entire JSON file content)
}
```

---

## ⏱️ Timeline
- Project creation: ~30 sec
- API enablement: ~1 min
- Service account setup: ~2 min
- Credentials download: ~1 min
- Billing setup: ~3 min
- **Total: ~10-15 minutes**

---

## 🔐 Security Notes
- Keep the JSON file safe (contains sensitive credentials)
- Never commit it to git (`.gitignore` will protect it)
- For production, create a separate service account with narrower permissions

---

## ❓ Troubleshooting

**Q: Billing keeps asking for verification?**
- A: Credit card verification can take a few minutes. Try refreshing after 2-3 minutes.

**Q: Can't find BigQuery API in search?**
- A: Try: https://console.cloud.google.com/apis/library/bigquery.googleapis.com

**Q: Project creation failed?**
- A: Try creating with a different project name (add a number, e.g., `priovex-ai-2`)

---

## ✨ Next Steps

Once you complete this setup:
1. Save the **Service Account JSON** and **Project ID**
2. Continue with **Service 3**: Supabase File Storage
3. Then **Service 4**: AI Provider (Claude/OpenAI/Gemini)
4. Finally **Service 5**: Stripe (optional)
5. We'll populate your `.env` file with all credentials
