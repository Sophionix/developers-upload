"use server";

import { Prisma } from "@/generated/prisma/client";
import {
  PaymentStatus,
  SubscriptionStatus,
  SubscriptionTier,
  UserRole,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { requireRole } from "@/lib/rbac";
import { logAdminAction } from "@/lib/audit";
import { invalidateTag } from "@/lib/cache";
import { decodeCursor, paginateKeyset } from "@/lib/pagination";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { getStripe } from "@/lib/stripe";
import { logger } from "@/lib/logger";
import {
  toPaymentDto,
  type BillingOverviewDto,
  type PaymentDto,
  type RefundResultDto,
} from "@/lib/dto/admin-billing-ops";
import {
  extendTrialSchema,
  grantPremiumSchema,
  listPaymentsSchema,
  refundPaymentSchema,
  revokePremiumSchema,
  type ExtendTrialInput,
  type GrantPremiumInput,
  type ListPaymentsInput,
  type RefundPaymentInput,
  type RevokePremiumInput,
} from "@/lib/validation/admin-billing-ops";

const PAYMENTS_TAG = "payments";
const SUBSCRIPTIONS_TAG = "subscriptions";
const USERS_TAG = "users";

const PAYMENT_SELECT = {
  id: true,
  userId: true,
  amountCents: true,
  currency: true,
  status: true,
  stripePaymentIntentId: true,
  stripeChargeId: true,
  stripeInvoiceId: true,
  receiptUrl: true,
  cardUnlockId: true,
  subscriptionId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PaymentSelect;

const ACTIVE_SUB_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.PAST_DUE,
];

async function assertSuperAdmin(): Promise<{ userId: string }> {
  await requireUser();
  const { userId } = await requireRole([UserRole.SUPER_ADMIN]);
  return { userId };
}

export async function adminGetBillingOverview(): Promise<BillingOverviewDto> {
  await assertSuperAdmin();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);

  const [activeSubs, mrrAgg, refundsAgg] = await Promise.all([
    prisma.subscription.count({
      where: {
        status: { in: ACTIVE_SUB_STATUSES },
        tier: { in: [SubscriptionTier.PREMIUM, SubscriptionTier.TRIAL] },
      },
    }),
    prisma.payment.aggregate({
      where: {
        status: PaymentStatus.SUCCEEDED,
        createdAt: { gte: thirtyDaysAgo },
        subscriptionId: { not: null },
      },
      _sum: { amountCents: true },
    }),
    prisma.payment.aggregate({
      where: {
        status: PaymentStatus.REFUNDED,
        updatedAt: { gte: thirtyDaysAgo },
      },
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
  ]);

  return {
    activeSubscriptions: activeSubs,
    mrrCents: mrrAgg._sum.amountCents ?? 0,
    refundsLast30dCents: refundsAgg._sum.amountCents ?? 0,
    refundsLast30dCount: refundsAgg._count._all,
  };
}

export async function adminListPayments(
  input: ListPaymentsInput,
): Promise<{ items: PaymentDto[]; nextCursor: string | null }> {
  await assertSuperAdmin();
  const { cursor, take = 20, status, userId, createdFrom, createdTo } =
    listPaymentsSchema.parse(input);
  const decoded = decodeCursor(cursor);

  const where: Prisma.PaymentWhereInput = {
    ...(status && { status }),
    ...(userId && { userId }),
    ...((createdFrom || createdTo) && {
      createdAt: {
        ...(createdFrom && { gte: createdFrom }),
        ...(createdTo && { lte: createdTo }),
      },
    }),
    ...(decoded && {
      OR: [
        { createdAt: { lt: decoded.createdAt } },
        { createdAt: decoded.createdAt, id: { lt: decoded.id } },
      ],
    }),
  };

  const rows = await prisma.payment.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    select: PAYMENT_SELECT,
  });

  const page = paginateKeyset(rows, take, false);
  return {
    items: page.rows.map(toPaymentDto),
    nextCursor: page.nextCursor,
  };
}

export async function adminRefundPayment(
  input: RefundPaymentInput,
): Promise<RefundResultDto> {
  const { userId: actorId } = await assertSuperAdmin();
  const { paymentId, reason, amountCents } = refundPaymentSchema.parse(input);

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      status: true,
      amountCents: true,
      currency: true,
      stripePaymentIntentId: true,
      stripeChargeId: true,
      rawEvent: true,
    },
  });
  if (!payment) throw new NotFoundError("payment_not_found");
  if (payment.status === PaymentStatus.REFUNDED) {
    throw new ConflictError("already_refunded");
  }
  if (payment.status !== PaymentStatus.SUCCEEDED) {
    throw new ConflictError("payment_not_refundable");
  }
  if (!payment.stripePaymentIntentId && !payment.stripeChargeId) {
    throw new ConflictError("no_stripe_reference");
  }
  if (amountCents && amountCents > payment.amountCents) {
    throw new ConflictError("refund_exceeds_payment");
  }

  const stripe = getStripe();
  try {
    const refund = await stripe.refunds.create({
      ...(payment.stripePaymentIntentId
        ? { payment_intent: payment.stripePaymentIntentId }
        : { charge: payment.stripeChargeId! }),
      ...(amountCents !== undefined && { amount: amountCents }),
      reason,
    });

    const refundedAmount = refund.amount ?? amountCents ?? payment.amountCents;
    const prevRaw =
      payment.rawEvent && typeof payment.rawEvent === "object"
        ? (payment.rawEvent as Prisma.JsonObject)
        : {};
    const mergedRaw: Prisma.InputJsonValue = {
      ...prevRaw,
      refund: {
        id: refund.id,
        amount: refundedAmount,
        reason,
        createdAt: new Date().toISOString(),
      },
    };

    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.REFUNDED,
        rawEvent: mergedRaw,
      },
    });

    await invalidateTag(PAYMENTS_TAG);
    await logAdminAction({
      actorId,
      action: "UPDATE",
      entity: "Payment",
      entityId: paymentId,
      meta: {
        op: "refund",
        reason,
        refundId: refund.id,
        refundedAmountCents: refundedAmount,
      },
    });

    return {
      paymentId,
      status: PaymentStatus.REFUNDED,
      refundId: refund.id,
      refundedAmountCents: refundedAmount,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "stripe_refund_failed";
    logger.error({ err, paymentId }, "admin_refund_failed");
    await logAdminAction({
      actorId,
      action: "UPDATE",
      entity: "Payment",
      entityId: paymentId,
      meta: { op: "refund", reason, error: message },
    });
    throw err;
  }
}

export async function adminGrantPremium(
  input: GrantPremiumInput,
): Promise<{ ok: true }> {
  const { userId: actorId } = await assertSuperAdmin();
  const { userId, expiresAt } = grantPremiumSchema.parse(input);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) throw new NotFoundError("user_not_found");

  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      tier: SubscriptionTier.PREMIUM,
      status: SubscriptionStatus.ACTIVE,
      grantedByAdminId: actorId,
      grantExpiresAt: expiresAt ?? null,
    },
    update: {
      tier: SubscriptionTier.PREMIUM,
      status: SubscriptionStatus.ACTIVE,
      grantedByAdminId: actorId,
      grantExpiresAt: expiresAt ?? null,
    },
  });

  await invalidateTag(SUBSCRIPTIONS_TAG);
  await invalidateTag(USERS_TAG);
  await logAdminAction({
    actorId,
    action: "GRANT",
    entity: "Subscription",
    entityId: userId,
    targetUserId: userId,
    meta: {
      op: "grant_premium",
      expiresAt: expiresAt?.toISOString() ?? null,
    },
  });
  return { ok: true };
}

export async function adminRevokePremium(
  input: RevokePremiumInput,
): Promise<{ ok: true }> {
  const { userId: actorId } = await assertSuperAdmin();
  const { userId } = revokePremiumSchema.parse(input);

  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: {
      id: true,
      stripeSubscriptionId: true,
      grantedByAdminId: true,
    },
  });
  if (!sub) throw new NotFoundError("subscription_not_found");
  if (!sub.grantedByAdminId) throw new ConflictError("not_admin_granted");

  const hasStripeSub = Boolean(sub.stripeSubscriptionId);

  await prisma.subscription.update({
    where: { userId },
    data: {
      grantedByAdminId: null,
      grantExpiresAt: null,
      ...(hasStripeSub
        ? {}
        : {
            tier: SubscriptionTier.FREE,
            status: SubscriptionStatus.CANCELED,
          }),
    },
  });

  await invalidateTag(SUBSCRIPTIONS_TAG);
  await invalidateTag(USERS_TAG);
  await logAdminAction({
    actorId,
    action: "REVOKE",
    entity: "Subscription",
    entityId: userId,
    targetUserId: userId,
    meta: { op: "revoke_premium", hadStripeSub: hasStripeSub },
  });
  return { ok: true };
}

export async function adminExtendTrial(
  input: ExtendTrialInput,
): Promise<{ ok: true; trialEnd: Date }> {
  const { userId: actorId } = await assertSuperAdmin();
  const { userId, days } = extendTrialSchema.parse(input);

  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { id: true, trialEnd: true },
  });
  if (!sub) throw new NotFoundError("subscription_not_found");

  const base = sub.trialEnd && sub.trialEnd > new Date() ? sub.trialEnd : new Date();
  const newTrialEnd = new Date(base.getTime() + days * 86_400_000);

  await prisma.subscription.update({
    where: { userId },
    data: {
      trialEnd: newTrialEnd,
      status: SubscriptionStatus.TRIALING,
      tier: SubscriptionTier.TRIAL,
    },
  });

  await invalidateTag(SUBSCRIPTIONS_TAG);
  await logAdminAction({
    actorId,
    action: "UPDATE",
    entity: "Subscription",
    entityId: userId,
    targetUserId: userId,
    meta: { op: "extend_trial", days, trialEnd: newTrialEnd.toISOString() },
  });
  return { ok: true, trialEnd: newTrialEnd };
}
