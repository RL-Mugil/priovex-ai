import { auth } from '@clerk/nextjs/server';
import { prisma } from '@priovex/database';
import { NextResponse } from 'next/server';

export async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) {
    return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user || user.role !== 'ADMIN') {
    return { user: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user, error: null };
}

export const PLAN_QUOTA_KEY = 'plan_quotas';

export async function getPlanQuotas(): Promise<Record<string, number>> {
  const config = await prisma.systemConfig.findUnique({ where: { key: PLAN_QUOTA_KEY } });
  if (!config) return { FREE: 3, PRO: 25, AGENCY: 100, ENTERPRISE: -1 };
  return config.value as Record<string, number>;
}
