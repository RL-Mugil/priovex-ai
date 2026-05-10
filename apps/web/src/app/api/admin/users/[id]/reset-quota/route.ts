import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@priovex/database';
import { requireAdmin } from '@/lib/admin-auth';

interface Props { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, props: Props) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await props.params;
  await prisma.user.update({
    where: { id },
    data: { searchesUsedThisMonth: 0, lastQuotaResetAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
