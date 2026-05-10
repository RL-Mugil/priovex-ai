export type PlanTier = 'free' | 'pro' | 'agency' | 'enterprise';

export interface Plan {
  tier: PlanTier;
  name: string;
  priceMonthly: number;
  searchesPerMonth: number;
  features: string[];
  stripePriceId?: string;
}

export const PLANS: Record<PlanTier, Plan> = {
  free: {
    tier: 'free',
    name: 'Free',
    priceMonthly: 0,
    searchesPerMonth: 1,
    features: ['1 search/month', 'Quick depth only', 'Markdown report', 'Email support'],
  },
  pro: {
    tier: 'pro',
    name: 'Pro',
    priceMonthly: 49,
    searchesPerMonth: 10,
    features: [
      '10 searches/month',
      'All search depths',
      'PDF + Markdown + JSON reports',
      'CPC deep search',
      'All AI providers',
      'Priority support',
    ],
    stripePriceId: process.env.STRIPE_PRICE_PRO_MONTHLY,
  },
  agency: {
    tier: 'agency',
    name: 'Agency',
    priceMonthly: 199,
    searchesPerMonth: 50,
    features: [
      '50 searches/month',
      'All Pro features',
      'Team workspace (5 seats)',
      'White-label PDF',
      'API access',
      'Dedicated support',
    ],
    stripePriceId: process.env.STRIPE_PRICE_AGENCY_MONTHLY,
  },
  enterprise: {
    tier: 'enterprise',
    name: 'Enterprise',
    priceMonthly: -1,  // custom
    searchesPerMonth: -1, // unlimited
    features: [
      'Unlimited searches',
      'All Agency features',
      'Unlimited team seats',
      'Custom AI model config',
      'SSO/SAML',
      'SLA',
      'Custom BigQuery project',
    ],
    stripePriceId: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
  },
};
