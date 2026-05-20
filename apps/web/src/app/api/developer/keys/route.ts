import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@priovex/database';
import { randomBytes, createHash } from 'crypto';

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const keys = await prisma.apiKey.findMany({
    where: { userId: user.id, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, keyPrefix: true, lastUsedAt: true, usageCount: true, expiresAt: true, createdAt: true },
  });

  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const existing = await prisma.apiKey.count({ where: { userId: user.id, revokedAt: null } });
  if (existing >= 5) return NextResponse.json({ error: 'Maximum 5 active API keys allowed' }, { status: 400 });

  const { name } = await req.json() as { name?: string };
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const rawKey = `pvx_${randomBytes(32).toString('base64url')}`;
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.slice(0, 12);

  const apiKey = await prisma.apiKey.create({
    data: { userId: user.id, name: name.trim(), keyHash, keyPrefix },
  });

  return NextResponse.json({ id: apiKey.id, name: apiKey.name, key: rawKey, keyPrefix, createdAt: apiKey.createdAt }, { status: 201 });
}
