import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@priovex/database';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') ?? '';
  const tier = searchParams.get('tier') ?? '';
  const role = searchParams.get('role') ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = 50;

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (tier) where.subscriptionTier = tier;
  if (role) where.role = role;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        clerkId: true,
        name: true,
        email: true,
        role: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        searchesUsedThisMonth: true,
        searchQuotaLimit: true,
        createdAt: true,
        lastQuotaResetAt: true,
        _count: { select: { searches: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({ users, total, page, pages: Math.ceil(total / limit) });
}
