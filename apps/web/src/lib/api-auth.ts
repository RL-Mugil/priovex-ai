import { createHash } from 'crypto';
import { prisma } from '@priovex/database';

export async function authenticateApiKey(authHeader: string | null): Promise<{ userId: string } | null> {
  if (!authHeader?.startsWith('Bearer pvx_')) return null;
  const rawKey = authHeader.slice(7);
  const keyHash = createHash('sha256').update(rawKey).digest('hex');

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    select: { id: true, userId: true, revokedAt: true, expiresAt: true },
  });

  if (!apiKey || apiKey.revokedAt) return null;
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

  prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date(), usageCount: { increment: 1 } } }).catch(() => {});

  return { userId: apiKey.userId };
}
