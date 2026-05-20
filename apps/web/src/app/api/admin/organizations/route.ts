import { NextResponse } from 'next/server';
import { prisma } from '@priovex/database';
import { requireAdmin } from '@/lib/admin-auth';

// GET /api/admin/organizations — list all orgs for admin assign-to-team
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true, subscriptionTier: true, _count: { select: { members: true } } },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ orgs });
}
