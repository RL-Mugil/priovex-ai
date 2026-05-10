import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@priovex/database';
import { enqueueSearch } from '@priovex/queue';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const original = await prisma.search.findFirst({ where: { id, userId: user.id } });
  if (!original) return NextResponse.json({ error: 'Search not found' }, { status: 404 });

  if (!['FAILED', 'CANCELLED'].includes(original.status)) {
    return NextResponse.json({ error: 'Only failed or cancelled searches can be retried' }, { status: 400 });
  }

  // Check quota
  if (user.searchQuotaLimit !== -1 && user.searchesUsedThisMonth >= user.searchQuotaLimit) {
    return NextResponse.json({ error: 'Monthly search quota exceeded' }, { status: 429 });
  }

  const newSearch = await prisma.search.create({
    data: {
      userId: user.id,
      title: original.title,
      description: original.description,
      technicalField: original.technicalField,
      problemSolved: original.problemSolved,
      keyInnovations: original.keyInnovations,
      claimsDraft: original.claimsDraft,
      jurisdictions: original.jurisdictions,
      depth: original.depth,
      aiProvider: original.aiProvider,
      reportStyle: original.reportStyle,
      status: 'QUEUED',
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { searchesUsedThisMonth: { increment: 1 } },
  });

  const jobId = await enqueueSearch({
    searchId: newSearch.id,
    userId: user.id,
    organizationId: user.organizationId ?? undefined,
    input: {
      title: original.title,
      description: original.description,
      technicalField: original.technicalField,
      problemSolved: original.problemSolved,
      keyInnovations: original.keyInnovations,
      claimsDraft: original.claimsDraft ?? undefined,
      jurisdictions: original.jurisdictions,
      depth: original.depth.toLowerCase() as any,
      aiProvider: original.aiProvider.toLowerCase() as any,
      reportStyle: original.reportStyle.toLowerCase() as any,
    },
    retryCount: 0,
    createdAt: new Date().toISOString(),
  });

  await prisma.search.update({ where: { id: newSearch.id }, data: { bullJobId: jobId } });

  return NextResponse.json({ searchId: newSearch.id }, { status: 201 });
}
