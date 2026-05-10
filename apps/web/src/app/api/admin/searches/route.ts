import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@priovex/database';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? '';
  const search = searchParams.get('search') ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = 50;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
      { user: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [searches, total] = await Promise.all([
    prisma.search.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        title: true,
        status: true,
        depth: true,
        searchType: true,
        progressPercent: true,
        patentsFound: true,
        nplFound: true,
        createdAt: true,
        completedAt: true,
        durationSeconds: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.search.count({ where }),
  ]);

  return NextResponse.json({ searches, total, page, pages: Math.ceil(total / limit) });
}
