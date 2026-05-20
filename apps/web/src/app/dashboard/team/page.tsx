import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@priovex/database';
import { TeamView } from '@/components/team/team-view';

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect('/sign-in');

  const user = await prisma.user.findUnique({
    where: { clerkId },
    include: {
      organization: {
        include: {
          members: {
            select: { id: true, name: true, email: true, avatarUrl: true, role: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
          },
          invites: {
            where: { accepted: false, revokedAt: null, expiresAt: { gt: new Date() } },
            select: { id: true, email: true, createdAt: true, expiresAt: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      },
    },
  });

  if (!user) redirect('/sign-in');

  const isOwner = user.organization?.ownerId === user.id;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Team Workspace</h1>
        <p className="text-slate-500 mt-1">Manage your team members and invitations</p>
      </div>
      <TeamView
        user={{ id: user.id, name: user.name, email: user.email, subscriptionTier: user.subscriptionTier }}
        organization={user.organization as any}
        isOwner={isOwner}
      />
    </div>
  );
}
