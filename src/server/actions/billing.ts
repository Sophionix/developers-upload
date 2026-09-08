"use server";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { requireUser } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import {
  ConflictError,
  NotFoundError,
  RateLimitedError,
  ValidationError,
} from "@/lib/errors";
import { getStripe, getOrCreateStripeCustomer } from "@/lib/stripe";
import { toPlanDto, type PlanDto } from "@/lib/dto/billing";
import {
  toCurrentSubscriptionDto,
  type CurrentSubscriptionDto,
} from "@/lib/dto/subscription";
import { validateCouponPublic, type PublicCouponDto } from "@/lib/coupons";
import {
  createCheckoutSessionSchema,
  validateCouponSchema,
  createBillingPortalSessionSchema,
  type CreateCheckoutSessionInput,
  type ValidateCouponInput,
  type CreateBillingPortalSessionInput,
} from "@/lib/validation/billing";
import { redis } from "@/lib/redis";

async function enforceRate(
  key: string,
  limit: number,
  windowSec: number,
): Promise<void> {
  const r = await rateLimit({ key, limit, windowSec });
  if (!r.ok) throw new RateLimitedError();
}

const PLAN_SELECT = {
  id: true,
  slug: true,
  name: true,
  description: true,
  priceCents: true,
  currency: true,
  intervalMonths: true,
  trialDays: true,
  features: true,
  visibility: true,
  stripePriceId: true,
  stripeProductId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PricingPlanSelect;

export async function listPublicPlans(): Promise<PlanDto[]> {
  const rows = await prisma.pricingPlan.findMany({
    where: { isActive: true, visibility: "PUBLIC" },
    orderBy: [{ priceCents: "asc" }, { createdAt: "asc" }],
    select: PLAN_SELECT,
  });
  return rows.map(toPlanDto);
}

export async function getCurrentSubscription(): Promise<CurrentSubscriptionDto> {
  const user = await requireUser();
  const sub = await prisma.subscription.findUnique({
    where: { userId: user.id },
    select: {
      tier: true,
      status: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
      planId: true,
      trialEnd: true,
    },
  });
  if (!sub) return toCurrentSubscriptionDto(null, null);
  const plan = sub.planId
    ? await prisma.pricingPlan.findUnique({
        where: { id: sub.planId },
        select: {
          id: true,
          name: true,
          priceCents: true,
          currency: true,
          intervalMonths: true,
        },
      })
    : null;
  return toCurrentSubscriptionDto(sub, plan);
}

export async function validateCoupon(
  input: ValidateCouponInput,
): Promise<PublicCouponDto> {
  const user = await requireUser();
  const parsed = validateCouponSchema.parse(input);
  await enforceRate(`coupon-validate:${user.id}`, 20, 60);
  return validateCouponPublic(parsed);
}

interface CheckoutSessionResult {
  sessionId: string;
  url: string;
}

export async function createCheckoutSession(
  input: CreateCheckoutSessionInput,
): Promise<CheckoutSessionResult> {
  const user = await requireUser();
  const { planId, couponCode } = createCheckoutSessionSchema.parse(input);
  await enforceRate(`checkout:${user.id}`, 10, 60);

  const idempotencyKey = `checkout:${user.id}:${planId}`;
  const claim = await redis.set(idempotencyKey, "1", "EX", 120, "NX");
  if (claim !== "OK") throw new ConflictError("checkout_in_progress");

  try {
    const plan = await prisma.pricingPlan.findUnique({
      where: { id: planId },
      select: {
        id: true,
        isActive: true,
        visibility: true,
        stripePriceId: true,
        name: true,
      },
    });
    if (!plan || !plan.isActive || plan.visibility !== "PUBLIC") {
      throw new NotFoundError("plan_not_found");
    }
    if (!plan.stripePriceId) {
      throw new ValidationError("plan_not_synced_to_stripe");
    }

    const existingSub = await prisma.subscription.findUnique({
      where: { userId: user.id },
      select: { status: true, tier: true },
    });
    if (
      existingSub &&
      existingSub.tier !== "FREE" &&
      (existingSub.status === "ACTIVE" || existingSub.status === "TRIALING")
    ) {
      throw new ConflictError("subscription_already_active");
    }

    const userRow = await prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true, fullName: true, stripeCustomerId: true },
    });
    if (!userRow) throw new NotFoundError("user_not_found");

    const stripeCustomerId = await getOrCreateStripeCustomer({
      email: userRow.email,
      name: userRow.fullName,
      metadata: { userId: user.id },
      existingCustomerId: userRow.stripeCustomerId,
    });
    if (userRow.stripeCustomerId !== stripeCustomerId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId },
      });
    }

    let stripeCouponId: string | null = null;
    if (couponCode) {
      const coupon = await validateCouponPublic({ code: couponCode, planId });
      const full = await prisma.coupon.findUnique({
        where: { code: coupon.code },
        select: { stripeCouponId: true },
      });
      stripeCouponId = full?.stripeCouponId ?? null;
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: env.STRIPE_CHECKOUT_SUCCESS_URL,
      cancel_url: env.STRIPE_CHECKOUT_CANCEL_URL,
      client_reference_id: user.id,
      customer: stripeCustomerId,
      ...(stripeCouponId && {
        discounts: [{ coupon: stripeCouponId }],
      }),
      metadata: {
        userId: user.id,
        planId: plan.id,
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          planId: plan.id,
        },
      },
    });

    if (!session.url) throw new ValidationError("stripe_session_no_url");
    return { sessionId: session.id, url: session.url };
  } catch (err) {
    await redis.del(idempotencyKey).catch(() => undefined);
    throw err;
  }
}

export interface BillingHistoryDto {
  id: string;
  date: Date;
  description: string;
  amountCents: number;
  currency: string;
  receiptUrl: string | null;
}

export async function getBillingHistory(
  input: { cursor?: string; take?: number } = {},
): Promise<{ items: BillingHistoryDto[]; nextCursor: string | null }> {
  const user = await requireUser();
  const take = input.take ?? 20;

  const rows = await prisma.payment.findMany({
    where: { userId: user.id, status: "SUCCEEDED" },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      amountCents: true,
      currency: true,
      receiptUrl: true,
      subscriptionId: true,
      cardUnlockId: true,
      createdAt: true,
    },
  });

  const hasMore = rows.length > take;
  const items = (hasMore ? rows.slice(0, take) : rows).map((row) => ({
    id: row.id,
    date: row.createdAt,
    description: row.subscriptionId
      ? "Subscription payment"
      : row.cardUnlockId
        ? "Card unlock"
        : "Payment",
    amountCents: row.amountCents,
    currency: row.currency,
    receiptUrl: row.receiptUrl,
  }));

  return {
    items,
    nextCursor: hasMore ? rows[take - 1]!.id : null,
  };
}

export async function createBillingPortalSession(
  _input: CreateBillingPortalSessionInput = {},
): Promise<{ url: string }> {
  const user = await requireUser();
  createBillingPortalSessionSchema.parse(_input);
  await enforceRate(`billing-portal:${user.id}`, 10, 60);

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { stripeCustomerId: true },
  });
  if (!row?.stripeCustomerId) throw new NotFoundError("no_stripe_customer");

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: row.stripeCustomerId,
    return_url: env.STRIPE_CHECKOUT_SUCCESS_URL,
  });
  logger.info({ userId: user.id }, "billing_portal_created");
  return { url: session.url };
}
