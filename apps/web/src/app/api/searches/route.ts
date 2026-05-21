import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { prisma } from '@priovex/database';
import { enqueueSearch } from '@priovex/queue';

const CreateSearchSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(5000),
  technicalField: z.string().min(2).max(200),
  problemSolved: z.string().min(5).max(2000),
  keyInnovations: z.array(z.string()).min(1).max(10),
  claimsDraft: z.string().max(5000).optional(),
  jurisdictions: z.array(z.enum(['US', 'EP', 'WO', 'CN', 'JP', 'KR', 'GB', 'DE', 'FR'])).default(['US']),
  depth: z.enum(['quick', 'standard', 'thorough']).default('standard'),
  aiProvider: z.enum(['claude', 'openai', 'gemini']).default('claude'),
  reportStyle: z.enum(['legal', 'technical', 'investor', 'concise', 'comprehensive']).default('comprehensive'),
  searchType: z.enum(['patentability', 'invalidity', 'fto', 'novelty', 'examiner_style']).default('patentability'),
});

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Check quota
    const quotaLimit = user.searchQuotaLimit;
    if (quotaLimit !== -1 && user.searchesUsedThisMonth >= quotaLimit) {
      return NextResponse.json(
        { error: 'Monthly search quota exceeded. Please upgrade your plan.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const input = CreateSearchSchema.parse(body);

    // Create search record
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
        depth: input.depth.toUpperCase() as any,
        aiProvider: input.aiProvider.toUpperCase() as any,
        reportStyle: input.reportStyle.toUpperCase() as any,
        searchType: input.searchType.toUpperCase() as any,
        status: 'QUEUED',
      },
    });

    // Increment usage counter
    await prisma.user.update({
      where: { id: user.id },
      data: { searchesUsedThisMonth: { increment: 1 } },
    });

    // Enqueue the search job
    const jobId = await enqueueSearch({
      searchId: search.id,
      userId: user.id,
      organizationId: user.organizationId ?? undefined,
      input: {
        title: input.title,
        description: input.description,
        technicalField: input.technicalField,
        problemSolved: input.problemSolved,
        keyInnovations: input.keyInnovations,
        claimsDraft: input.claimsDraft,
        jurisdictions: input.jurisdictions,
        depth: input.depth,
        aiProvider: input.aiProvider,
        reportStyle: input.reportStyle,
        searchType: input.searchType,
      },
      retryCount: 0,
      createdAt: new Date().toISOString(),
    });

    // Save job ID to search
    await prisma.search.update({
      where: { id: search.id },
      data: { bullJobId: jobId },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'search.created',
        resource: 'search',
        resourceId: search.id,
        metadata: { title: input.title, depth: input.depth, aiProvider: input.aiProvider },
      },
    });

    return NextResponse.json({ searchId: search.id, status: 'queued' }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: err.errors }, { status: 400 });
    }
    console.error('[API/searches] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') ?? '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20'), 50);
    const offset = (page - 1) * limit;

    const [searches, total] = await Promise.all([
      prisma.search.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          report: {
            select: { id: true, patentabilityScore: true, overallVerdict: true },
          },
        },
      }),
      prisma.search.count({ where: { userId: user.id } }),
    ]);

    return NextResponse.json({
      searches,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('[API/searches] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
