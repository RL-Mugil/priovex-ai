# PrioVex.AI — AI-Powered Patent Prior Art Search Platform

Enterprise-grade SaaS platform for patent prior art search, patentability analysis, and professional report generation.

## Architecture Overview

```
priovex-ai/                          # Turborepo monorepo
├── apps/
│   ├── web/                         # Next.js 15 (App Router) — Vercel
│   └── workers/                     # BullMQ workers — Railway
├── packages/
│   ├── types/                       # Shared TypeScript types
│   ├── database/                    # Prisma + PostgreSQL schema
│   ├── ai-providers/                # Claude / OpenAI / Gemini abstraction
│   ├── bigquery/                    # Google Patents BigQuery queries
│   ├── queue/                       # BullMQ queue definitions
│   └── report-generator/            # Markdown / HTML / PDF generation
├── docker-compose.yml               # Local dev environment
├── .github/workflows/ci.yml         # CI/CD pipeline
└── scripts/                         # Setup & validation scripts
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, TypeScript, TailwindCSS, shadcn/ui, Framer Motion |
| Auth | Clerk |
| Database | PostgreSQL (pgvector) + Prisma ORM |
| Queue | BullMQ + Redis (Upstash) |
| AI Providers | Anthropic Claude, OpenAI GPT-4o, Google Gemini |
| Patent Data | Google BigQuery (patents-public-data) |
| Storage | Supabase Storage |
| Billing | Stripe |
| Email | Resend |
| Monitoring | Sentry + OpenTelemetry |
| Deployment | Vercel (web) + Railway (workers) |

## 7-Step Search Pipeline

```
[1] Concept Extraction       — AI extracts technical entities & features
[2] Keyword Strategy         — AI builds keyword clusters & CPC hints
[3] Broad BigQuery Search    — Search 100M+ patents by keywords
[4] CPC Code Identification  — Extract & rank patent classifications
[5] Deep CPC Search          — Deep search by CPC classification
[6] Timeline Analysis        — Filing trends, assignee landscape
[7] AI Patentability Report  — Full 35 USC 102/103 analysis + claim strategy
```

## Quick Start

### Prerequisites
- Node.js 22+
- Docker (for local postgres + redis)
- Google Cloud account (BigQuery)
- Clerk account
- Anthropic/OpenAI/Gemini API key (at least one)
- Supabase account (storage)
- Stripe account (billing)

### Setup

```bash
# Clone and setup
git clone https://github.com/yourorg/priovex-ai
cd priovex-ai

# Run setup script (copies .env, installs deps, runs migrations)
bash scripts/setup.sh

# Start local infrastructure
docker-compose up -d postgres redis

# Start development
npm run dev
```

### Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
# Required
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/priovex
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
GOOGLE_CLOUD_PROJECT=your-gcp-project
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...

# At least one AI provider
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_GEMINI_API_KEY=AIza...

# Billing (for production)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Subscription Tiers

| Plan | Price | Searches/month | Key Features |
|------|-------|---------------|--------------|
| Free | $0 | 1 | Quick search, Markdown report |
| Pro | $49/mo | 10 | All depths, PDF/MD/JSON, all AI providers |
| Agency | $199/mo | 50 | Team workspace, API access, white-label |
| Enterprise | Custom | Unlimited | SSO, SLA, custom AI config |

## Deployment

### Frontend (Vercel)

```bash
vercel --prod
# Configure env vars in Vercel dashboard
```

### Workers (Railway)

```bash
railway up
# Set env vars in Railway dashboard
```

### Database Migrations

```bash
npm run db:migrate       # Run pending migrations
npm run db:migrate:dev   # Create new migration
npm run db:studio        # Open Prisma Studio
```

## Key API Endpoints

```
POST /api/searches              # Create new search
GET  /api/searches              # List user's searches
GET  /api/searches/:id          # Get search details
DELETE /api/searches/:id        # Cancel search
GET  /api/searches/:id/progress # SSE stream for real-time progress
GET  /api/reports/:id           # Get report (json/pdf/markdown)
POST /api/billing/create-checkout # Start Stripe checkout
POST /api/billing/portal        # Open billing portal
POST /api/webhooks/stripe       # Stripe webhook handler
POST /api/webhooks/clerk        # Clerk user sync webhook
```

## BigQuery Setup

1. Create Google Cloud project
2. Enable BigQuery API
3. Create service account with BigQuery Job User role
4. Download JSON key → set as `GOOGLE_SERVICE_ACCOUNT_JSON`
5. Dataset: `patents-public-data.patents.publications` (public, no billing for storage)

**Cost estimate**: ~$5/TB scanned. A standard search uses ~1-5 GB = $0.005-0.025 per search.

## AI Provider Cost Estimates (per search)

| Provider | Model | Estimated Cost |
|---------|-------|----------------|
| Claude | claude-opus-4-7 | $0.50–$2.00 |
| OpenAI | gpt-4o | $0.20–$1.00 |
| Gemini | gemini-2.0-flash | $0.01–$0.10 |

## Security

- All API routes protected by Clerk authentication
- SQL injection prevented via parameterized BigQuery queries
- Stripe webhooks verified with signing secrets
- Clerk webhooks verified with Svix
- Rate limiting at middleware layer
- CSP headers configured
- RBAC via user roles (USER, ADMIN, ENTERPRISE)
- Audit logging for all search operations

## License

Proprietary — PrioVex.AI © 2025
