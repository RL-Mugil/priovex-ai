import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@priovex/database';
import { DeveloperView } from '@/components/developer/developer-view';

export const dynamic = 'force-dynamic';

export default async function DeveloperPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user) redirect('/sign-in');

  const keys = await prisma.apiKey.findMany({
    where: { userId: user.id, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, keyPrefix: true, lastUsedAt: true, usageCount: true, expiresAt: true, createdAt: true },
  });

  return <DeveloperView keys={keys} />;
}
