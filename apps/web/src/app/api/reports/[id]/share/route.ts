import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@priovex/database';
import { randomBytes } from 'crypto';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const report = await prisma.report.findFirst({ where: { id, userId: user.id } });
  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });

  const body = await req.json().catch(() => ({})) as { expiryDays?: number };
  const expiryDays = Math.min(body.expiryDays ?? 30, 90);
  const shareToken = report.shareToken ?? randomBytes(24).toString('base64url');
  const shareExpiresAt = new Date(Date.now() + expiryDays * 86400_000);

  await prisma.report.update({
    where: { id },
    data: { shareToken, shareExpiresAt },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://priovex-app.centralindia.cloudapp.azure.com';
  return NextResponse.json({ shareUrl: `${appUrl}/share/${shareToken}`, expiresAt: shareExpiresAt });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.report.updateMany({
    where: { id, userId: user.id },
    data: { shareToken: null, shareExpiresAt: null },
  });

  return NextResponse.json({ ok: true });
}
