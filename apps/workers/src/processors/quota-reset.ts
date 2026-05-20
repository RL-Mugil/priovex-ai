import { prisma } from '@priovex/database';

export async function runMonthlyQuotaReset(): Promise<void> {
  const now = new Date();
  console.log(`[QuotaReset] Starting monthly reset at ${now.toISOString()}`);

  // Reset all users
  const userResult = await prisma.user.updateMany({
    data: {
      searchesUsedThisMonth: 0,
      lastQuotaResetAt: now,
    },
  });

  // Reset all organizations
  const orgResult = await prisma.organization.updateMany({
    data: {
      searchesUsedThisMonth: 0,
      lastQuotaResetAt: now,
    },
  });

  console.log(`[QuotaReset] Reset ${userResult.count} users, ${orgResult.count} organizations`);

  // Record in system config for audit trail
  await prisma.systemConfig.upsert({
    where: { key: 'last_quota_reset' },
    update: { value: now.toISOString() as any },
    create: { key: 'last_quota_reset', value: now.toISOString() as any },
  });
}
