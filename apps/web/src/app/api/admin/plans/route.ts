import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@priovex/database';
import { requireAdmin, PLAN_QUOTA_KEY, getPlanQuotas } from '@/lib/admin-auth';

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const quotas = await getPlanQuotas();
  return NextResponse.json({ quotas });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json() as { quotas: Record<string, number> };
  const { quotas } = body;

  if (!quotas || typeof quotas !== 'object') {
    return NextResponse.json({ error: 'Invalid quotas' }, { status: 400 });
  }

  await prisma.systemConfig.upsert({
    where: { key: PLAN_QUOTA_KEY },
    update: { value: quotas },
    create: { key: PLAN_QUOTA_KEY, value: quotas },
  });

  // Apply new defaults to all users on each tier whose quota was NOT manually overridden
  // (We consider a quota "manually overridden" if it doesn't match any current plan default)
  const oldQuotas = await getPlanQuotas();
  const tiers = ['FREE', 'PRO', 'AGENCY', 'ENTERPRISE'] as const;
  for (const tier of tiers) {
    if (quotas[tier] !== undefined && quotas[tier] !== oldQuotas[tier]) {
      await prisma.user.updateMany({
        where: { subscriptionTier: tier, searchQuotaLimit: oldQuotas[tier] ?? -99 },
        data: { searchQuotaLimit: quotas[tier] },
      });
    }
  }

  return NextResponse.json({ ok: true, quotas });
}
