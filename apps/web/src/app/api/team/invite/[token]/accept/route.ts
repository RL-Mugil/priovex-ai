import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@priovex/database';

interface Props {
  params: Promise<{ token: string }>;
}

// POST /api/team/invite/[token]/accept
export async function POST(_req: NextRequest, props: Props) {
  const params = await props.params;
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const invite = await prisma.organizationInvite.findUnique({
    where: { token: params.token },
    include: { organization: true },
  });

  if (!invite) return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 });
  if (invite.accepted) return NextResponse.json({ error: 'Invite already accepted' }, { status: 400 });
  if (invite.revokedAt) return NextResponse.json({ error: 'This invite has been revoked' }, { status: 410 });
  if (invite.expiresAt < new Date()) return NextResponse.json({ error: 'Invite has expired' }, { status: 400 });
  if (invite.email !== user.email) {
    return NextResponse.json({ error: 'This invite was sent to a different email address' }, { status: 403 });
  }
  if (user.organizationId) {
    return NextResponse.json({ error: 'You are already in a team' }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.organizationInvite.update({
      where: { id: invite.id },
      data: { accepted: true, acceptedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { organizationId: invite.organizationId },
    }),
  ]);

  return NextResponse.json({ ok: true, organizationName: invite.organization.name });
}
