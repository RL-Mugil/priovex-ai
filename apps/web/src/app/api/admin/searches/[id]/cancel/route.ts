import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@priovex/database';
import { requireAdmin } from '@/lib/admin-auth';

interface Props { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, props: Props) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await props.params;
  const search = await prisma.search.findUnique({ where: { id }, select: { status: true } });
  if (!search) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const terminal = ['COMPLETED', 'FAILED', 'CANCELLED'];
  if (terminal.includes(search.status)) {
    return NextResponse.json({ error: 'Already in terminal state' }, { status: 400 });
  }

  await prisma.search.update({
    where: { id },
    data: { status: 'CANCELLED', cancelRequested: true },
  });

  return NextResponse.json({ ok: true });
}
