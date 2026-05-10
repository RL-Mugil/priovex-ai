import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@priovex/database';
import { requireAdmin } from '@/lib/admin-auth';

interface Props { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, props: Props) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await props.params;
  const body = await req.json() as {
    role?: string;
    subscriptionTier?: string;
    searchQuotaLimit?: number;
    subscriptionStatus?: string;
  };

  const data: Record<string, unknown> = {};
  if (body.role !== undefined) data.role = body.role;
  if (body.subscriptionTier !== undefined) data.subscriptionTier = body.subscriptionTier;
  if (body.searchQuotaLimit !== undefined) data.searchQuotaLimit = body.searchQuotaLimit;
  if (body.subscriptionStatus !== undefined) data.subscriptionStatus = body.subscriptionStatus;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const user = await prisma.user.update({ where: { id }, data });
  return NextResponse.json({ user });
}
