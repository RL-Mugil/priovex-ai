'use client';

import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const PLANS = [
  {
    tier: 'free',
    name: 'Free',
    price: 0,
    searches: 1,
    features: [
      '1 search per month',
      'Quick search depth',
      'Markdown report',
      'Email support',
    ],
  },
  {
    tier: 'pro',
    name: 'Pro',
    price: 49,
    searches: 10,
    popular: true,
    features: [
      '10 searches per month',
      'All search depths',
      'PDF + Markdown + JSON',
      'CPC deep search',
      'All AI providers',
      'Priority support',
    ],
  },
  {
    tier: 'agency',
    name: 'Agency',
    price: 199,
    searches: 50,
    features: [
      '50 searches per month',
      'All Pro features',
      '5 team seats',
      'White-label PDF',
      'API access',
      'Dedicated support',
    ],
  },
  {
    tier: 'enterprise',
    name: 'Enterprise',
    price: null,
    searches: -1,
    features: [
      'Unlimited searches',
      'All Agency features',
      'Unlimited team seats',
      'Custom AI config',
      'SSO / SAML',
      'SLA guarantee',
    ],
  },
];

interface Props {
  currentTier: string;
  status: string;
  periodEnd?: string;
  hasCustomer: boolean;
  searchesUsed: number;
  searchLimit: number;
}

export function BillingPlans({ currentTier, status, periodEnd, hasCustomer }: Props) {
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  const handleUpgrade = async (tier: string) => {
    if (tier === 'enterprise') {
      window.location.href = 'mailto:sales@priovex.ai';
      return;
    }

    setLoadingTier(tier);
    try {
      const res = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });

      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      alert('Failed to create checkout session');
    } finally {
      setLoadingTier(null);
    }
  };

  const handleManage = async () => {
    const res = await fetch('/api/billing/portal', { method: 'POST' });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  };

  const isCurrent = (tier: string) => tier.toUpperCase() === currentTier;

  return (
    <div className="space-y-6">
      {/* Current plan info */}
      {hasCustomer && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Current Plan</p>
              <p className="text-lg font-semibold text-slate-900 mt-0.5">
                {currentTier.charAt(0) + currentTier.slice(1).toLowerCase()} — {status}
              </p>
              {periodEnd && (
                <p className="text-xs text-slate-400 mt-1">
                  Renews {new Date(periodEnd).toLocaleDateString()}
                </p>
              )}
            </div>
            <button
              onClick={handleManage}
              className="border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Manage Subscription
            </button>
          </div>
        </div>
      )}

      {/* Plans grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map((plan) => (
          <div
            key={plan.tier}
            className={cn(
              'bg-white rounded-2xl border p-5 flex flex-col relative',
              plan.popular ? 'border-blue-500 shadow-lg shadow-blue-100' : 'border-slate-200',
              isCurrent(plan.tier) ? 'ring-2 ring-blue-600' : ''
            )}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-blue-600 text-white text-xs font-medium px-3 py-1 rounded-full">
                  Most Popular
                </span>
              </div>
            )}

            <div className="mb-4">
              <h3 className="font-bold text-slate-900 text-lg">{plan.name}</h3>
              <div className="mt-2">
                {plan.price === null ? (
                  <span className="text-2xl font-black text-slate-900">Custom</span>
                ) : (
                  <>
                    <span className="text-3xl font-black text-slate-900">${plan.price}</span>
                    {plan.price > 0 && <span className="text-slate-400 text-sm">/month</span>}
                  </>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {plan.searches === -1 ? 'Unlimited' : `${plan.searches} searches`}/month
              </p>
            </div>

            <ul className="space-y-2 flex-1 mb-5">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>

            {isCurrent(plan.tier) ? (
              <div className="text-center py-2.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg">
                Current Plan
              </div>
            ) : (
              <button
                onClick={() => handleUpgrade(plan.tier)}
                disabled={!!loadingTier}
                className={cn(
                  'w-full py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2',
                  plan.popular
                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                    : 'border border-slate-200 hover:bg-slate-50 text-slate-700'
                )}
              >
                {loadingTier === plan.tier && <Loader2 className="w-4 h-4 animate-spin" />}
                {plan.price === null ? 'Contact Sales' : plan.tier === 'free' ? 'Downgrade' : 'Upgrade'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
