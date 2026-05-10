import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@priovex/database';
import { SearchesManager } from '@/components/search/searches-manager';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ status?: string; q?: string }>;
}

export default async function SearchesPage({ searchParams }: Props) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user) redirect('/sign-in');

  const { status: statusFilter = '', q = '' } = await searchParams;

  const where: Record<string, unknown> = { userId: user.id };
  if (statusFilter && statusFilter !== 'all') where.status = statusFilter;
  if (q) where.title = { contains: q, mode: 'insensitive' };

  const searches = await prisma.search.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      title: true,
      technicalField: true,
      status: true,
      depth: true,
      aiProvider: true,
      progressPercent: true,
      currentStep: true,
      totalSteps: true,
      patentsFound: true,
      patentsAnalyzed: true,
      nplFound: true,
      durationSeconds: true,
      errorMessage: true,
      createdAt: true,
      completedAt: true,
      report: { select: { id: true, patentabilityScore: true, overallVerdict: true } },
    },
  });

  const counts = await prisma.search.groupBy({
    by: ['status'],
    where: { userId: user.id },
    _count: true,
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Search History</h1>
        <p className="text-slate-500 mt-1">Manage all your patent prior art searches</p>
      </div>
      <SearchesManager
        initialSearches={searches as any}
        statusCounts={Object.fromEntries(counts.map((c) => [c.status, c._count]))}
        currentStatus={statusFilter}
        currentQ={q}
      />
    </div>
  );
}
