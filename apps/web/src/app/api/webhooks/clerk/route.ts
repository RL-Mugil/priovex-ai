import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { prisma } from '@priovex/database';
import { sendWelcome } from '@priovex/email';

interface ClerkUserEvent {
  type: string;
  data: {
    id: string;
    email_addresses: Array<{ email_address: string; id: string }>;
    first_name: string | null;
    last_name: string | null;
    image_url: string;
    primary_email_address_id: string;
  };
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing Svix headers' }, { status: 400 });
  }

  const webhook = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);

  let event: ClerkUserEvent;
  try {
    event = webhook.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkUserEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
  }

  const { type, data } = event;

  try {
    if (type === 'user.created') {
      const primaryEmail = data.email_addresses.find(
        (e) => e.id === data.primary_email_address_id
      )?.email_address;

      if (!primaryEmail) {
        return NextResponse.json({ error: 'No email found' }, { status: 400 });
      }

      const userName = [data.first_name, data.last_name].filter(Boolean).join(' ') || 'User';
      await prisma.user.upsert({
        where: { clerkId: data.id },
        update: {},
        create: {
          clerkId: data.id,
          email: primaryEmail,
          name: userName,
          avatarUrl: data.image_url,
          searchQuotaLimit: 1, // Free tier default
        },
      });
      sendWelcome({ to: primaryEmail, name: userName }).catch(() => {});
    }

    if (type === 'user.updated') {
      const primaryEmail = data.email_addresses.find(
        (e) => e.id === data.primary_email_address_id
      )?.email_address;

      await prisma.user.updateMany({
        where: { clerkId: data.id },
        data: {
          email: primaryEmail,
          name: [data.first_name, data.last_name].filter(Boolean).join(' ') || 'User',
          avatarUrl: data.image_url,
        },
      });
    }

    if (type === 'user.deleted') {
      await prisma.user.deleteMany({ where: { clerkId: data.id } });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Clerk Webhook] Error:', err);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
