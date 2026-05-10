import type { User as ClerkUser } from '@clerk/nextjs/server';
import { prisma } from '@priovex/database';

export async function syncUser(clerkUser: ClerkUser): Promise<void> {
  const email = clerkUser.emailAddresses.find(
    (e) => e.id === clerkUser.primaryEmailAddressId
  )?.emailAddress;

  if (!email) return;

  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || 'User';

  await prisma.user.upsert({
    where: { clerkId: clerkUser.id },
    update: { email, name, avatarUrl: clerkUser.imageUrl },
    create: {
      clerkId: clerkUser.id,
      email,
      name,
      avatarUrl: clerkUser.imageUrl,
      searchQuotaLimit: 1,
    },
  });

  // Reset monthly quota if needed
  const user = await prisma.user.findUnique({ where: { clerkId: clerkUser.id } });
  if (user) {
    const now = new Date();
    const lastReset = new Date(user.lastQuotaResetAt);
    const isNewMonth =
      now.getFullYear() !== lastReset.getFullYear() ||
      now.getMonth() !== lastReset.getMonth();

    if (isNewMonth) {
      await prisma.user.update({
        where: { id: user.id },
        data: { searchesUsedThisMonth: 0, lastQuotaResetAt: now },
      });
    }
  }
}
