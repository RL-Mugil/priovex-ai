import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { prisma } from '@priovex/database';

const CreateTeamSchema = z.object({
  name: z.string().min(2).max(100),
});

// GET /api/team — get current user's org
export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { clerkId },
    include: {
      organization: {
        include: {
          members: { select: { id: true, name: true, email: true, avatarUrl: true, role: true, createdAt: true } },
          invites: { where: { accepted: false, expiresAt: { gt: new Date() } }, select: { id: true, email: true, createdAt: true } },
        },
      },
    },
  });

  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ organization: user.organization });
}

// POST /api/team — create a new org
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (user.organizationId) {
    return NextResponse.json({ error: 'You are already in a team' }, { status: 400 });
  }

  const { name } = CreateTeamSchema.parse(await req.json());
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);

  const org = await prisma.organization.create({
    data: {
      name,
      slug,
      ownerId: user.id,
      subscriptionTier: user.subscriptionTier,
      subscriptionStatus: user.subscriptionStatus,
      searchQuotaLimit: user.searchQuotaLimit,
      members: { connect: { id: user.id } },
    },
  });

  return NextResponse.json({ organization: org }, { status: 201 });
}
