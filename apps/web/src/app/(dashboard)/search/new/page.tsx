import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@priovex/database';
import { NewSearchForm } from '@/components/search/new-search-form';

export const dynamic = 'force-dynamic';

async function checkQuota(clerkId: string) {
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      id: true,
      searchesUsedThisMonth: true,
      searchQuotaLimit: true,
      subscriptionTier: true,
    },
  });

  if (!user) return { allowed: false, user: null };

  const allowed = user.searchQuotaLimit === -1 || user.searchesUsedThisMonth < user.searchQuotaLimit;
  return { allowed, user };
}

export default async function NewSearchPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const { allowed, user } = await checkQuota(userId);

  if (!user) redirect('/sign-in');

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">New Prior Art Search</h1>
        <p className="text-slate-500 mt-1">
          Describe your invention and we&apos;ll search 100M+ patents across multiple databases
        </p>
      </div>

      {!allowed ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <h3 className="text-lg font-semibold text-amber-800 mb-2">Monthly quota reached</h3>
          <p className="text-amber-700 mb-4">
            You&apos;ve used {user.searchesUsedThisMonth} of {user.searchQuotaLimit} searches this month.
          </p>
          <a
            href="/dashboard/billing"
            className="bg-amber-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-amber-500 transition-colors inline-block"
          >
            Upgrade Plan
          </a>
        </div>
      ) : (
        <NewSearchForm
          remainingSearches={
            user.searchQuotaLimit === -1
              ? Infinity
              : user.searchQuotaLimit - user.searchesUsedThisMonth
          }
        />
      )}
    </div>
  );
}
