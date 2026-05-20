import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { prisma } from '@priovex/database';
import { sendTeamInvite } from '@priovex/email';

const InviteSchema = z.object({
  email: z.string().email(),
});

// POST /api/team/invite — send invite
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { clerkId },
    include: { organization: true },
  });

  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!user.organization) return NextResponse.json({ error: 'You must create a team first' }, { status: 400 });
  if (user.organization.ownerId !== user.id) {
    return NextResponse.json({ error: 'Only the team owner can invite members' }, { status: 403 });
  }

  // Check Agency seat limit (5 seats)
  const memberCount = await prisma.user.count({ where: { organizationId: user.organization.id } });
  const tier = user.organization.subscriptionTier;
  if (tier === 'AGENCY' && memberCount >= 5) {
    return NextResponse.json({ error: 'Agency plan is limited to 5 seats' }, { status: 400 });
  }

  const { email } = InviteSchema.parse(await req.json());

  // Check if already a member
  const existing = await prisma.user.findFirst({
    where: { email, organizationId: user.organization.id },
  });
  if (existing) return NextResponse.json({ error: 'This user is already a team member' }, { status: 400 });

  // Check for pending invite (not revoked, not expired)
  const pendingInvite = await prisma.organizationInvite.findFirst({
    where: {
      organizationId: user.organization.id,
      email,
      accepted: false,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  if (pendingInvite) return NextResponse.json({ error: 'An invite is already pending for this email' }, { status: 400 });

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  const invite = await prisma.organizationInvite.create({
    data: {
      organizationId: user.organization.id,
      email,
      invitedById: user.id,
      expiresAt,
    },
  });

  await sendTeamInvite({
    to: email,
    inviterName: user.name,
    teamName: user.organization.name,
    token: invite.token,
  });

  return NextResponse.json({ ok: true, inviteId: invite.id });
}
