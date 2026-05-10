import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@priovex/database';
import { SearchProgress } from '@/components/search/search-progress';
import { SearchResults } from '@/components/search/search-results';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
}

export default async function SearchDetailPage({ params }: Props) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user) redirect('/sign-in');

  const search = await prisma.search.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      report: {
        select: {
          id: true,
          patentabilityScore: true,
          overallVerdict: true,
          noveltyRating: true,
          obviousnessRating: true,
          pdfStorageUrl: true,
          markdownStorageUrl: true,
          generatedAt: true,
        },
      },
      progressLogs: {
        orderBy: { timestamp: 'desc' },
        take: 50,
      },
    },
  });

  if (!search) notFound();

  const isActive = [
    'QUEUED', 'EXTRACTING', 'KEYWORD_STRATEGY', 'BROAD_SEARCH',
    'CPC_IDENTIFICATION', 'DEEP_CPC_SEARCH', 'TIMELINE_ANALYSIS',
    'AI_ANALYSIS', 'GENERATING_REPORT',
  ].includes(search.status);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{search.title}</h1>
        <p className="text-slate-500 mt-1">
          {search.technicalField} &middot; {search.depth.toLowerCase()} depth
        </p>
      </div>

      {isActive ? (
        <SearchProgress searchId={search.id} initialSearch={search as any} />
      ) : (
        <SearchResults search={search as any} />
      )}
    </div>
  );
}
