import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@priovex/database';

interface Props {
  params: Promise<{ id: string }>;
}

// DELETE /api/team/invites/[id] — revoke a pending invite (owner only)
export async function DELETE(_req: NextRequest, props: Props) {
  const { id } = await props.params;
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { clerkId },
    include: { organization: true },
  });

  if (!user?.organization) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (user.organization.ownerId !== user.id) {
    return NextResponse.json({ error: 'Only the team owner can revoke invites' }, { status: 403 });
  }

  const invite = await prisma.organizationInvite.findUnique({ where: { id } });
  if (!invite || invite.organizationId !== user.organization.id) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
  }
  if (invite.accepted) {
    return NextResponse.json({ error: 'Cannot revoke an already accepted invite' }, { status: 400 });
  }
  if (invite.revokedAt) {
    return NextResponse.json({ error: 'Invite already revoked' }, { status: 400 });
  }

  await prisma.organizationInvite.update({
    where: { id },
    data: { revokedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
