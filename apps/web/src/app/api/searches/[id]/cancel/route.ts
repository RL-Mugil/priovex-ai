import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@priovex/database';
import { cancelSearch } from '@priovex/queue';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const search = await prisma.search.findFirst({ where: { id, userId: user.id } });
  if (!search) return NextResponse.json({ error: 'Search not found' }, { status: 404 });

  const terminalStatuses = ['COMPLETED', 'FAILED', 'CANCELLED'];
  if (terminalStatuses.includes(search.status)) {
    return NextResponse.json({ error: 'Search already finished' }, { status: 400 });
  }

  // Remove from BullMQ if still waiting
  if (search.bullJobId) {
    await cancelSearch(search.id).catch(() => {});
  }

  await prisma.search.update({
    where: { id },
    data: {
      cancelRequested: true,
      status: 'QUEUED' === search.status ? 'CANCELLED' : search.status,
    },
  });

  return NextResponse.json({ success: true });
}
