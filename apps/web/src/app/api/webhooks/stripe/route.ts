import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@priovex/database';
import { PlanTier, SubStatus } from '@priovex/database';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-09-30.acacia' });

const QUOTA_BY_TIER: Record<string, number> = {
  free: 1,
  pro: 10,
  agency: 50,
  enterprise: -1,
};

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) return NextResponse.json({ error: 'No signature' }, { status: 400 });

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error('[Stripe Webhook] Invalid signature:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Idempotency — skip already-processed events
  const existing = await prisma.stripeEvent.findUnique({ where: { id: event.id } });
  if (existing?.processed) return NextResponse.json({ ok: true });

  // Store event
  await prisma.stripeEvent.upsert({
    where: { id: event.id },
    update: {},
    create: { id: event.id, type: event.type, payload: event as any },
  });

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const tier = (subscription.metadata.tier as string) ?? 'free';
        const status = mapStripeStatus(subscription.status);
        const quotaLimit = QUOTA_BY_TIER[tier] ?? 1;

        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            subscriptionId: subscription.id,
            subscriptionTier: tier.toUpperCase() as PlanTier,
            subscriptionStatus: status,
            subscriptionPeriodEnd: new Date(subscription.current_period_end * 1000),
            searchQuotaLimit: quotaLimit,
          },
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            subscriptionId: null,
            subscriptionTier: PlanTier.FREE,
            subscriptionStatus: SubStatus.CANCELLED,
            searchQuotaLimit: 1,
          },
        });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: { subscriptionStatus: SubStatus.PAST_DUE },
        });
        break;
      }
    }

    await prisma.stripeEvent.update({
      where: { id: event.id },
      data: { processed: true, processedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const errorMsg = (err as Error).message;
    console.error('[Stripe Webhook] Processing error:', errorMsg);

    await prisma.stripeEvent.update({
      where: { id: event.id },
      data: { error: errorMsg },
    });

    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

function mapStripeStatus(status: string): SubStatus {
  const map: Record<string, SubStatus> = {
    active: SubStatus.ACTIVE,
    trialing: SubStatus.TRIALING,
    past_due: SubStatus.PAST_DUE,
    canceled: SubStatus.CANCELLED,
    unpaid: SubStatus.UNPAID,
  };
  return map[status] ?? SubStatus.ACTIVE;
}
