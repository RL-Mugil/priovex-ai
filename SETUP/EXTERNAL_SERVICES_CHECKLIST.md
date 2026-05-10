# External Services Setup Checklist

Track your progress through all 5 external services. Complete these while `npm install` runs in the background.

---

## ✅ SERVICE 1: Clerk Authentication
**Status**: Manual setup required (iframe limitations)
**Guide**: See `CLERK_WEBHOOK_SETUP.md`
**Time**: 5-10 minutes

### Credentials to Collect:
- [ ] **Publishable Key** - `pk_test_...`
- [ ] **Secret Key** - `sk_test_...`
- [ ] **Webhook Signing Secret** - `whsec_...`

**Steps**:
1. Navigate to Clerk Dashboard → Developers → Webhooks
2. Click "+ Add Endpoint"
3. URL: `http://localhost:3000/api/webhooks/clerk`
4. Events: `user.created`, `user.updated`, `user.deleted`
5. Copy Webhook Signing Secret

---

## ⏳ SERVICE 2: Google Cloud BigQuery
**Status**: Ready for setup
**Guide**: See `GOOGLE_CLOUD_SETUP.md`
**Time**: 10-15 minutes
**Cost**: Free tier available ($300 credit)

### Credentials to Collect:
- [ ] **Project ID** - `priovex-ai`
- [ ] **Service Account JSON** - Entire JSON file content

**Steps**:
1. Go to https://console.cloud.google.com
2. Create project: `priovex-ai`
3. Enable BigQuery API
4. Create Service Account: `priovex-bigquery`
5. Grant role: "BigQuery Job User"
6. Generate and download JSON credentials
7. Enable Billing (link credit card)
8. Save Project ID and JSON content

---

## ⏳ SERVICE 3: Supabase File Storage
**Status**: Ready for setup
**Guide**: See `SUPABASE_SETUP.md`
**Time**: 5-10 minutes
**Cost**: Free tier available

### Credentials to Collect:
- [ ] **Project URL** - `https://xxxx.supabase.co`
- [ ] **Anon Public Key** - `eyJ...` (labeled "anon public")
- [ ] **Service Role Key** - `eyJ...` (labeled "service_role")

**Steps**:
1. Go to https://supabase.com
2. Create project: `priovex-ai`
3. Set database password (save it!)
4. Wait for project creation (~2 min)
5. Create storage bucket: `priovex-reports`
6. Set bucket to PUBLIC
7. Collect credentials from Settings → API

---

## ⏳ SERVICE 4: AI Provider (Choose ONE)
**Status**: Ready for setup
**Guide**: See `AI_PROVIDER_SETUP.md`
**Time**: 5 minutes each
**Recommended**: Claude (Anthropic)

### Option A: Claude (⭐ Recommended)
- [ ] **API Key** - `sk-ant-...`
- Go to https://console.anthropic.com
- Create account, get API key
- Add billing (optional but recommended)

### Option B: OpenAI
- [ ] **API Key** - `sk-...`
- Go to https://platform.openai.com
- Requires $5 minimum billing

### Option C: Google Gemini
- [ ] **API Key** - `AIza...`
- Go to https://aistudio.google.com
- Free tier available (50 req/min)

---

## ⏳ SERVICE 5: Stripe Billing (Optional)
**Status**: Optional for local testing
**Guide**: See `STRIPE_SETUP.md`
**Time**: 5 minutes
**Note**: Use TEST keys only

### Credentials to Collect (if setting up):
- [ ] **Secret Key (Test)** - `sk_test_...`
- [ ] **Publishable Key (Test)** - `pk_test_...`

**Steps**:
1. Go to https://stripe.com
2. Create account, verify email
3. Ensure "Test mode" is ON
4. Get API keys from Developers → API Keys
5. Copy both test keys

---

## 📊 Master Credential Checklist

Once all services are configured, you should have:

### Clerk (Service 1)
- [ ] Publishable Key: `pk_test_...`
- [ ] Secret Key: `sk_test_...`
- [ ] Webhook Secret: `whsec_...`

### Google Cloud (Service 2)
- [ ] Project ID: `priovex-ai`
- [ ] Service Account JSON: (entire file content)

### Supabase (Service 3)
- [ ] Project URL: `https://xxxx.supabase.co`
- [ ] Anon Public Key: `eyJ...`
- [ ] Service Role Key: `eyJ...`

### AI Provider (Service 4) - Choose ONE:
- [ ] **Claude**: `sk-ant-...`
  OR
- [ ] **OpenAI**: `sk-...`
  OR
- [ ] **Gemini**: `AIza...`

### Stripe (Service 5) - Optional:
- [ ] Secret Key (Test): `sk_test_...`
- [ ] Publishable Key (Test): `pk_test_...`

---

## ⏱️ Total Timeline
| Service | Time | Status |
|---------|------|--------|
| Clerk | 5-10 min | Manual |
| Google Cloud | 10-15 min | Ready |
| Supabase | 5-10 min | Ready |
| AI Provider | 5 min | Ready |
| Stripe | 5 min | Optional |
| **TOTAL** | **30-45 min** | In Progress |

---

## 🎯 Next After Collecting Credentials

Once you have all credentials:
1. Return to your terminal
2. I'll help you populate the `.env` file
3. Run database setup commands
4. Start development servers
5. Test the local deployment

---

## 📝 Where to Keep Your Credentials

**Temporary** (during setup):
- Google Cloud JSON file in Downloads folder
- Notes/text editor with copied values

**Final** (in .env):
- Keep in the `.env` file at your project root
- This is automatically in `.gitignore`
- Never commit to git

---

## ✨ Good Luck!

You've got this! These setups are straightforward—just follow each guide step-by-step. If you get stuck on any service, let me know and I can provide additional help.

---

## 🔗 Quick Links

- Clerk Dashboard: https://dashboard.clerk.com
- Google Cloud Console: https://console.cloud.google.com
- Supabase Dashboard: https://app.supabase.com
- Claude Console: https://console.anthropic.com
- OpenAI Platform: https://platform.openai.com
- Google AI Studio: https://aistudio.google.com
- Stripe Dashboard: https://dashboard.stripe.com
