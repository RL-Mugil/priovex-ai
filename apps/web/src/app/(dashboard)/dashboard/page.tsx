import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@priovex/database';
import { DashboardStats } from '@/components/dashboard/stats';
import { RecentSearches } from '@/components/dashboard/recent-searches';
import { QuotaUsage } from '@/components/dashboard/quota-usage';
import { QuickSearchButton } from '@/components/dashboard/quick-search-button';

export const dynamic = 'force-dynamic';

async function getDashboardData(clerkId: string) {
  const user = await prisma.user.findUnique({
    where: { clerkId },
    include: {
      searches: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { report: { select: { id: true, patentabilityScore: true, overallVerdict: true } } },
      },
    },
  });

  if (!user) return null;

  const [completedCount, failedCount, inProgressCount] = await Promise.all([
    prisma.search.count({ where: { userId: user.id, status: 'COMPLETED' } }),
    prisma.search.count({ where: { userId: user.id, status: 'FAILED' } }),
    prisma.search.count({
      where: {
        userId: user.id,
        status: { in: ['QUEUED', 'EXTRACTING', 'BROAD_SEARCH', 'AI_ANALYSIS', 'GENERATING_REPORT'] },
      },
    }),
  ]);

  return { user, completedCount, failedCount, inProgressCount };
}

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const data = await getDashboardData(userId);
  if (!data) redirect('/sign-in');

  const { user, completedCount, failedCount, inProgressCount } = data;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome back, {user.name.split(' ')[0]}</h1>
          <p className="text-slate-500 mt-1">AI-powered patent prior art search platform</p>
        </div>
        <QuickSearchButton />
      </div>

      <DashboardStats
        completedSearches={completedCount}
        failedSearches={failedCount}
        inProgressSearches={inProgressCount}
        searchesThisMonth={user.searchesUsedThisMonth}
        quotaLimit={user.searchQuotaLimit}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentSearches searches={user.searches as any} />
        </div>
        <div>
          <QuotaUsage
            used={user.searchesUsedThisMonth}
            limit={user.searchQuotaLimit}
            tier={user.subscriptionTier}
          />
        </div>
      </div>
    </div>
  );
}
