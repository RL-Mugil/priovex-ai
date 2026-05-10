#!/usr/bin/env node
// Validates all required environment variables before startup

const REQUIRED_VARS = {
  // Database
  DATABASE_URL: 'PostgreSQL connection string',
  REDIS_URL: 'Redis connection URL',

  // Auth
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'Clerk publishable key',
  CLERK_SECRET_KEY: 'Clerk secret key',
  CLERK_WEBHOOK_SECRET: 'Clerk webhook signing secret',

  // AI (at least one required)
  // ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_GEMINI_API_KEY

  // BigQuery
  GOOGLE_CLOUD_PROJECT: 'Google Cloud project ID',

  // Storage
  SUPABASE_URL: 'Supabase project URL',
  SUPABASE_SERVICE_ROLE_KEY: 'Supabase service role key',
  SUPABASE_STORAGE_BUCKET: 'Supabase storage bucket name',

  // Stripe
  STRIPE_SECRET_KEY: 'Stripe secret key',
  STRIPE_WEBHOOK_SECRET: 'Stripe webhook secret',

  // App
  NEXT_PUBLIC_APP_URL: 'Public application URL',
};

const OPTIONAL_VARS = {
  ANTHROPIC_API_KEY: 'Claude AI (at least one AI provider required)',
  OPENAI_API_KEY: 'OpenAI (at least one AI provider required)',
  GOOGLE_GEMINI_API_KEY: 'Google Gemini (at least one AI provider required)',
  SENTRY_DSN: 'Sentry error tracking',
  RESEND_API_KEY: 'Email via Resend',
  STRIPE_PRICE_PRO_MONTHLY: 'Pro plan Stripe price ID',
  STRIPE_PRICE_AGENCY_MONTHLY: 'Agency plan Stripe price ID',
};

let errors = 0;
let warnings = 0;

console.log('\n🔍 PrioVex.AI — Environment Validation\n');

// Check required vars
for (const [key, description] of Object.entries(REQUIRED_VARS)) {
  if (!process.env[key]) {
    console.error(`  ❌ MISSING: ${key} — ${description}`);
    errors++;
  } else {
    console.log(`  ✅ ${key}`);
  }
}

// Check at least one AI provider
const hasAI = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
if (!hasAI) {
  console.error('\n  ❌ CRITICAL: At least one AI provider key required (ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_GEMINI_API_KEY)');
  errors++;
} else {
  const providers = [];
  if (process.env.ANTHROPIC_API_KEY) providers.push('Claude');
  if (process.env.OPENAI_API_KEY) providers.push('OpenAI');
  if (process.env.GOOGLE_GEMINI_API_KEY) providers.push('Gemini');
  console.log(`\n  ✅ AI Providers: ${providers.join(', ')}`);
}

// Check optional vars
console.log('\n📋 Optional variables:');
for (const [key, description] of Object.entries(OPTIONAL_VARS)) {
  if (!process.env[key]) {
    console.log(`  ⚠️  MISSING: ${key} — ${description}`);
    warnings++;
  } else {
    console.log(`  ✅ ${key}`);
  }
}

console.log(`\n${'─'.repeat(50)}`);
if (errors > 0) {
  console.error(`\n❌ Validation FAILED: ${errors} required variable(s) missing, ${warnings} warnings`);
  console.error('   Fix the missing variables before running PrioVex.AI\n');
  process.exit(1);
} else {
  console.log(`\n✅ Validation PASSED (${warnings} optional variable(s) not set)\n`);
}
