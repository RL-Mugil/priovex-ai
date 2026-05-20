import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@priovex/database';
import { enqueueSearch } from '@priovex/queue';
import { authenticateApiKey } from '@/lib/api-auth';

const Schema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(5000),
  technicalField: z.string().min(2).max(200),
  problemSolved: z.string().min(5).max(2000),
  keyInnovations: z.array(z.string()).min(1).max(10),
  claimsDraft: z.string().max(5000).optional(),
  jurisdictions: z.array(z.enum(['US', 'EP', 'WO', 'CN', 'JP', 'KR', 'GB', 'DE', 'FR'])).default(['US']),
  depth: z.enum(['quick', 'standard', 'thorough']).default('standard'),
});

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req.headers.get('authorization'));
  if (!auth) return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  if (user.searchQuotaLimit !== -1 && user.searchesUsedThisMonth >= user.searchQuotaLimit) {
    return NextResponse.json({ error: 'Monthly search quota exceeded' }, { status: 429 });
  }

  let input: z.infer<typeof Schema>;
  try { input = Schema.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: 'Invalid input', details: (e as z.ZodError).errors }, { status: 400 }); }

  const search = await prisma.search.create({
    data: {
      userId: user.id,
      title: input.title,
      description: input.description,
      technicalField: input.technicalField,
      problemSolved: input.problemSolved,
      keyInnovations: input.keyInnovations,
      claimsDraft: input.claimsDraft,
      jurisdictions: input.jurisdictions,
      depth: input.depth.toUpperCase() as never,
      status: 'QUEUED',
    },
  });

  await prisma.user.update({ where: { id: user.id }, data: { searchesUsedThisMonth: { increment: 1 } } });

  const jobId = await enqueueSearch({
    searchId: search.id, userId: user.id,
    input: { ...input, aiProvider: 'claude', reportStyle: 'comprehensive' },
    retryCount: 0, createdAt: new Date().toISOString(),
  });

  await prisma.search.update({ where: { id: search.id }, data: { bullJobId: jobId } });

  return NextResponse.json({ searchId: search.id, status: 'queued' }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req.headers.get('authorization'));
  if (!auth) return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20'), 50);
  const page = parseInt(url.searchParams.get('page') ?? '1');

  const [searches, total] = await Promise.all([
    prisma.search.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: { id: true, title: true, status: true, depth: true, progressPercent: true, patentsFound: true, createdAt: true, completedAt: true,
        report: { select: { id: true, patentabilityScore: true, overallVerdict: true } } },
    }),
    prisma.search.count({ where: { userId: auth.userId } }),
  ]);

  return NextResponse.json({ searches, pagination: { page, limit, total } });
}
