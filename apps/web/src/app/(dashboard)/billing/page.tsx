import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@priovex/database';
import { BillingPlans } from '@/components/billing/billing-plans';

export const dynamic = 'force-dynamic';

export default async function BillingPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect('/sign-in');

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      subscriptionTier: true,
      subscriptionStatus: true,
      subscriptionPeriodEnd: true,
      searchesUsedThisMonth: true,
      searchQuotaLimit: true,
      stripeCustomerId: true,
    },
  });

  if (!user) redirect('/sign-in');

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Billing & Plans</h1>
        <p className="text-slate-500 mt-1">Manage your subscription and usage</p>
      </div>

      <BillingPlans
        currentTier={user.subscriptionTier}
        status={user.subscriptionStatus}
        periodEnd={user.subscriptionPeriodEnd?.toISOString()}
        hasCustomer={!!user.stripeCustomerId}
        searchesUsed={user.searchesUsedThisMonth}
        searchLimit={user.searchQuotaLimit}
      />
    </div>
  );
}
