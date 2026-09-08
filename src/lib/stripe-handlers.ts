import type Stripe from "stripe";
import { Prisma } from "@/generated/prisma/client";
import type {
  SubscriptionStatus,
  SubscriptionTier,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

function unixToDate(ts: number | null | undefined): Date | null {
  if (ts === null || ts === undefined) return null;
  return new Date(ts * 1000);
}

function mapStripeStatus(s: Stripe.Subscription.Status): SubscriptionStatus {
  switch (s) {
    case "active":
      return "ACTIVE";
    case "trialing":
      return "TRIALING";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
      return "CANCELED";
    case "unpaid":
      return "UNPAID";
    case "incomplete":
    case "incomplete_expired":
    case "paused":
      return "INCOMPLETE";
    default:
      return "INCOMPLETE";
  }
}

function tierForStatus(status: SubscriptionStatus): SubscriptionTier {
  if (status === "ACTIVE") return "PREMIUM";
  if (status === "TRIALING") return "TRIAL";
  return "FREE";
}

function subPeriodEnd(sub: Stripe.Subscription): Date | null {
  const item = sub.items?.data?.[0];
  if (item && typeof (item as { current_period_end?: number }).current_period_end === "number") {
    return unixToDate((item as { current_period_end: number }).current_period_end);
  }
  return null;
}

function subPeriodStart(sub: Stripe.Subscription): Date | null {
  const item = sub.items?.data?.[0];
  if (item && typeof (item as { current_period_start?: number }).current_period_start === "number") {
    return unixToDate((item as { current_period_start: number }).current_period_start);
  }
  return null;
}

async function resolveUserIdFromSub(
  sub: Stripe.Subscription,
): Promise<string | null> {
  const metaUserId = sub.metadata?.userId;
  if (metaUserId) return metaUserId;
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!customerId) return null;
  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  return user?.id ?? null;
}

async function resolvePlanIdFromSub(
  sub: Stripe.Subscription,
): Promise<string | null> {
  const metaPlanId = sub.metadata?.planId;
  if (metaPlanId) {
    const plan = await prisma.pricingPlan.findUnique({
      where: { id: metaPlanId },
      select: { id: true },
    });
    if (plan) return plan.id;
  }
  const priceId = sub.items?.data?.[0]?.price?.id;
  if (!priceId) return null;
  const plan = await prisma.pricingPlan.findUnique({
    where: { stripePriceId: priceId },
    select: { id: true },
  });
  return plan?.id ?? null;
}

export async function handleCheckoutSessionCompleted(
  event: Stripe.Event,
): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;
  const userId = session.client_reference_id ?? session.metadata?.userId;
  if (userId && customerId) {
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customerId },
    });
  }
  logger.info(
    { sessionId: session.id, mode: session.mode, userId },
    "checkout.session.completed",
  );
}

export async function handleSubscriptionUpserted(
  event: Stripe.Event,
): Promise<void> {
  const sub = event.data.object as Stripe.Subscription;
  const userId = await resolveUserIdFromSub(sub);
  if (!userId) {
    logger.warn({ subId: sub.id }, "subscription_event_no_user");
    return;
  }
  const planId = await resolvePlanIdFromSub(sub);
  const status = mapStripeStatus(sub.status);
  const tier = tierForStatus(status);

  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      planId,
      tier,
      status,
      stripeSubscriptionId: sub.id,
      trialStart: unixToDate(sub.trial_start),
      trialEnd: unixToDate(sub.trial_end),
      currentPeriodStart: subPeriodStart(sub),
      currentPeriodEnd: subPeriodEnd(sub),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      canceledAt: unixToDate(sub.canceled_at),
    },
    update: {
      planId,
      tier,
      status,
      stripeSubscriptionId: sub.id,
      trialStart: unixToDate(sub.trial_start),
      trialEnd: unixToDate(sub.trial_end),
      currentPeriodStart: subPeriodStart(sub),
      currentPeriodEnd: subPeriodEnd(sub),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      canceledAt: unixToDate(sub.canceled_at),
    },
  });
}

export async function handleSubscriptionDeleted(
  event: Stripe.Event,
): Promise<void> {
  const sub = event.data.object as Stripe.Subscription;
  const userId = await resolveUserIdFromSub(sub);
  if (!userId) return;
  await prisma.subscription.update({
    where: { userId },
    data: {
      tier: "FREE",
      status: "CANCELED",
      cancelAtPeriodEnd: false,
      canceledAt: unixToDate(sub.canceled_at) ?? new Date(),
    },
  });
}

export async function handleInvoicePaid(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;
  if (!customerId) return;

  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  if (!user) {
    logger.warn({ invoiceId: invoice.id, customerId }, "invoice_paid_no_user");
    return;
  }

  const paymentIntentId =
    typeof (invoice as { payment_intent?: unknown }).payment_intent === "string"
      ? ((invoice as { payment_intent?: string }).payment_intent ?? null)
      : null;

  const sub = await prisma.subscription.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  const amount = invoice.amount_paid ?? invoice.amount_due ?? 0;

  await prisma.payment.create({
    data: {
      userId: user.id,
      subscriptionId: sub?.id ?? null,
      type: "SUBSCRIPTION",
      amountCents: amount,
      currency: (invoice.currency ?? "usd").toUpperCase(),
      status: "SUCCEEDED",
      stripeStatus: "succeeded",
      stripeInvoiceId: invoice.id,
      stripePaymentIntentId: paymentIntentId,
      stripeCustomerId: customerId,
      receiptUrl: invoice.hosted_invoice_url ?? null,
      rawEvent: event as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function handleInvoicePaymentFailed(
  event: Stripe.Event,
): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;
  if (!customerId) return;
  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  if (!user) return;

  const paymentIntentId =
    typeof (invoice as { payment_intent?: unknown }).payment_intent === "string"
      ? ((invoice as { payment_intent?: string }).payment_intent ?? null)
      : null;

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { userId: user.id },
      data: { status: "PAST_DUE", tier: "FREE" },
    });
    await tx.payment.create({
      data: {
        userId: user.id,
        type: "SUBSCRIPTION",
        amountCents: invoice.amount_due ?? 0,
        currency: (invoice.currency ?? "usd").toUpperCase(),
        status: "FAILED",
        stripeStatus: "failed",
        failureReason: invoice.last_finalization_error?.message ?? null,
        stripeInvoiceId: invoice.id,
        stripePaymentIntentId: paymentIntentId,
        stripeCustomerId: customerId,
        rawEvent: event as unknown as Prisma.InputJsonValue,
      },
    });
  });
}

export async function handlePaymentIntentSucceeded(
  event: Stripe.Event,
): Promise<void> {
  const pi = event.data.object as Stripe.PaymentIntent;
  const cardUnlockId = pi.metadata?.cardUnlockId;
  if (!cardUnlockId) return;

  const unlock = await prisma.cardUnlock.findUnique({
    where: { id: cardUnlockId },
    select: {
      id: true,
      userId: true,
      guestSessionId: true,
      priceCents: true,
      currency: true,
      status: true,
    },
  });
  if (!unlock) {
    logger.warn({ cardUnlockId, piId: pi.id }, "pi_succeeded_no_unlock");
    return;
  }
  if (unlock.status === "SUCCEEDED") return;

  const customerId =
    typeof pi.customer === "string" ? pi.customer : pi.customer?.id ?? null;

  await prisma.$transaction(async (tx) => {
    await tx.cardUnlock.update({
      where: { id: unlock.id },
      data: {
        status: "SUCCEEDED",
        unlockedAt: new Date(),
        stripePaymentIntentId: pi.id,
      },
    });
    await tx.payment.create({
      data: {
        userId: unlock.userId,
        guestSessionId: unlock.guestSessionId,
        cardUnlockId: unlock.id,
        type: "CARD_UNLOCK",
        amountCents: pi.amount_received ?? pi.amount ?? unlock.priceCents,
        currency: (pi.currency ?? unlock.currency).toUpperCase(),
        status: "SUCCEEDED",
        stripeStatus: pi.status,
        stripePaymentIntentId: pi.id,
        stripeCustomerId: customerId,
        rawEvent: event as unknown as Prisma.InputJsonValue,
      },
    });
  });
}

export async function handlePaymentIntentFailed(
  event: Stripe.Event,
): Promise<void> {
  const pi = event.data.object as Stripe.PaymentIntent;
  const cardUnlockId = pi.metadata?.cardUnlockId;
  if (!cardUnlockId) return;

  const customerId =
    typeof pi.customer === "string" ? pi.customer : pi.customer?.id ?? null;
  const failureReason =
    pi.last_payment_error?.message ?? pi.last_payment_error?.code ?? null;

  const unlock = await prisma.cardUnlock.findUnique({
    where: { id: cardUnlockId },
    select: { id: true, userId: true, guestSessionId: true, priceCents: true, currency: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.cardUnlock.update({
      where: { id: cardUnlockId },
      data: { status: "FAILED", stripePaymentIntentId: pi.id },
    });
    if (unlock) {
      await tx.payment.create({
        data: {
          userId: unlock.userId,
          guestSessionId: unlock.guestSessionId,
          cardUnlockId,
          type: "CARD_UNLOCK",
          amountCents: pi.amount ?? unlock.priceCents,
          currency: (pi.currency ?? unlock.currency).toUpperCase(),
          status: "FAILED",
          stripeStatus: pi.status,
          failureReason,
          stripePaymentIntentId: pi.id,
          stripeCustomerId: customerId,
          rawEvent: event as unknown as Prisma.InputJsonValue,
        },
      });
    }
  });
}

export async function handleChargeRefunded(
  event: Stripe.Event,
): Promise<void> {
  const charge = event.data.object as Stripe.Charge;
  const piId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;
  if (!piId) return;

  const payment = await prisma.payment.findUnique({
    where: { stripePaymentIntentId: piId },
    select: { id: true, cardUnlockId: true, userId: true, guestSessionId: true },
  });
  if (!payment) return;

  const customerId =
    typeof charge.customer === "string"
      ? charge.customer
      : charge.customer?.id ?? null;

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "REFUNDED",
        stripeStatus: "refunded",
        stripeChargeId: charge.id,
      },
    });
    if (payment.cardUnlockId) {
      await tx.cardUnlock.update({
        where: { id: payment.cardUnlockId },
        data: { status: "REFUNDED" },
      });
    }
    await tx.payment.create({
      data: {
        userId: payment.userId,
        guestSessionId: payment.guestSessionId,
        type: "REFUND",
        amountCents: charge.amount_refunded ?? 0,
        currency: (charge.currency ?? "usd").toUpperCase(),
        status: "SUCCEEDED",
        stripeStatus: "refunded",
        stripeChargeId: charge.id,
        stripePaymentIntentId: piId,
        stripeCustomerId: customerId,
        rawEvent: event as unknown as Prisma.InputJsonValue,
      },
    });
  });
}
