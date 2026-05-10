import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@priovex/database';
import { cancelSearch } from '@priovex/queue';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const search = await prisma.search.findFirst({
    where: { id, userId: user.id },
    include: {
      report: true,
      progressLogs: { orderBy: { timestamp: 'desc' }, take: 100 },
    },
  });

  if (!search) return NextResponse.json({ error: 'Search not found' }, { status: 404 });

  return NextResponse.json(search);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const search = await prisma.search.findFirst({ where: { id, userId: user.id } });
  if (!search) return NextResponse.json({ error: 'Search not found' }, { status: 404 });

  // Remove from BullMQ queue if still pending/active
  if (search.bullJobId) {
    await cancelSearch(search.id).catch(() => {});
  }

  // Hard delete — cascades to report, progressLogs, savedPatents
  await prisma.search.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
