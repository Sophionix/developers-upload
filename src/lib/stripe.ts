import Stripe from "stripe";
import { env } from "@/lib/env";

type StripeApiVersion = ConstructorParameters<typeof Stripe>[1] extends
  | infer C
  | undefined
  ? C extends { apiVersion?: infer V }
    ? Exclude<V, undefined>
    : string
  : string;

export class StripeNotConfiguredError extends Error {
  readonly code = "STRIPE_NOT_CONFIGURED" as const;
  readonly status = 503;
  constructor(
    message = "Stripe is not configured. Set STRIPE_SECRET_KEY in .env.",
  ) {
    super(message);
    this.name = "StripeNotConfiguredError";
  }
}

function requireConfiguredString(
  value: string | undefined,
  message: string,
): string {
  if (!value || looksLikePlaceholder(value)) {
    throw new StripeNotConfiguredError(message);
  }
  return value;
}

let cached: Stripe | undefined;

function looksLikePlaceholder(key: string): boolean {
  if (!key) return true;
  return /placeholder|CHANGE_ME/i.test(key);
}

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = requireConfiguredString(
    env.STRIPE_SECRET_KEY,
    "Stripe is not configured. Set STRIPE_SECRET_KEY in .env.",
  );
  cached = new Stripe(key, {
    apiVersion: (env.STRIPE_API_VERSION ?? "2023-08-16") as StripeApiVersion,
  });
  return cached;
}

export function getStripeCheckoutUrls(): {
  successUrl: string;
  cancelUrl: string;
} {
  return {
    successUrl: requireConfiguredString(
      env.STRIPE_CHECKOUT_SUCCESS_URL,
      "Stripe is not configured. Set STRIPE_CHECKOUT_SUCCESS_URL in .env.",
    ),
    cancelUrl: requireConfiguredString(
      env.STRIPE_CHECKOUT_CANCEL_URL,
      "Stripe is not configured. Set STRIPE_CHECKOUT_CANCEL_URL in .env.",
    ),
  };
}

export function verifyWebhookSignature(
  rawBody: string,
  sigHeader: string,
): Stripe.Event {
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(
    rawBody,
    sigHeader,
    requireConfiguredString(
      env.STRIPE_WEBHOOK_SECRET,
      "Stripe is not configured. Set STRIPE_WEBHOOK_SECRET in .env.",
    ),
  );
}

export async function getOrCreateStripeCustomer(opts: {
  email: string;
  name?: string;
  metadata?: Record<string, string>;
  existingCustomerId?: string | null;
}): Promise<string> {
  const stripe = getStripe();

  // Self-heal: a stored customer id belongs to a specific Stripe account. If the
  // account/key changed, the old id won't resolve — verify it still exists and
  // fall through to (re)create when it doesn't. Callers must persist the return
  // value whenever it differs from what they passed in.
  if (opts.existingCustomerId) {
    try {
      const c = await stripe.customers.retrieve(opts.existingCustomerId);
      if (c && !(c as { deleted?: boolean }).deleted) {
        return opts.existingCustomerId;
      }
    } catch {
      // Not found on the current account — create a fresh one below.
    }
  }

  const existing = await stripe.customers.list({
    email: opts.email,
    limit: 1,
  });
  if (existing.data.length > 0) return existing.data[0]!.id;

  const customer = await stripe.customers.create({
    email: opts.email,
    ...(opts.name ? { name: opts.name } : {}),
    ...(opts.metadata ? { metadata: opts.metadata } : {}),
  });
  return customer.id;
}

export async function syncPlanToStripe(plan: {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  intervalMonths: number;
  isActive: boolean;
  stripeProductId: string | null;
  stripePriceId: string | null;
}): Promise<{ stripeProductId: string; stripePriceId: string }> {
  const stripe = getStripe();

  let productId = plan.stripeProductId;
  if (productId) {
    try {
      const updateParams: Parameters<typeof stripe.products.update>[1] = {
        name: plan.name,
        active: plan.isActive,
      };
      if (plan.description) updateParams.description = plan.description;
      await stripe.products.update(productId, updateParams);
    } catch {
      productId = null; // Doesn't exist, or belongs to a different account.
    }
  }
  if (!productId) {
    const products = await stripe.products.search({
      query: `metadata["planId"]:"${plan.id}"`,
    });
    if (products.data.length > 0) {
      productId = products.data[0]!.id;
    } else {
      const createParams: Parameters<typeof stripe.products.create>[0] = {
        name: plan.name,
        active: plan.isActive,
        metadata: { planId: plan.id },
      };
      if (plan.description) createParams.description = plan.description;
      const product = await stripe.products.create(createParams);
      productId = product.id;
    }
  }

  const interval = plan.intervalMonths === 12 ? "year" as const : "month" as const;
  const intervalCount = plan.intervalMonths === 12 ? 1 : plan.intervalMonths;
  const currency = plan.currency.toLowerCase();

  let priceId = plan.stripePriceId;
  if (priceId) {
    try {
      // Stripe Prices are immutable — if the amount/currency/interval no
      // longer matches what's stored, the existing price is stale (e.g. an
      // admin changed priceCents). Archive it and create a fresh one rather
      // than silently keep charging the old amount.
      const existing = await stripe.prices.retrieve(priceId);
      const stale =
        existing.product !== productId ||
        existing.unit_amount !== plan.priceCents ||
        existing.currency !== currency ||
        existing.recurring?.interval !== interval ||
        existing.recurring?.interval_count !== intervalCount;
      if (stale) {
        if (existing.active) await stripe.prices.update(priceId, { active: false });
        priceId = null;
      }
    } catch {
      priceId = null; // Doesn't exist, or belongs to a different account.
    }
  }

  if (!priceId) {
    const prices = await stripe.prices.list({
      product: productId,
      active: true,
      limit: 1,
    });
    const match = prices.data.find(
      (p) =>
        p.unit_amount === plan.priceCents &&
        p.currency === currency &&
        p.recurring?.interval === interval &&
        p.recurring?.interval_count === intervalCount,
    );
    if (match) {
      priceId = match.id;
    } else {
      const price = await stripe.prices.create({
        product: productId,
        unit_amount: plan.priceCents,
        currency,
        recurring: { interval, interval_count: intervalCount },
        metadata: { planId: plan.id },
      });
      priceId = price.id;
    }
  }

  return { stripeProductId: productId, stripePriceId: priceId };
}

export async function syncCouponToStripe(coupon: {
  id: string;
  code: string;
  type: "PERCENTAGE" | "FLAT";
  percentOff: number | null;
  amountOffCents: number | null;
  currency: string;
  maxRedemptions: number | null;
  stripeCouponId: string | null;
}): Promise<string> {
  const stripe = getStripe();

  if (coupon.stripeCouponId) {
    await stripe.coupons.update(coupon.stripeCouponId, {
      name: coupon.code,
      metadata: { couponId: coupon.id },
    });
    return coupon.stripeCouponId;
  }

  const params: Record<string, unknown> = {
    name: coupon.code,
    metadata: { couponId: coupon.id },
  };
  if (coupon.type === "PERCENTAGE" && coupon.percentOff !== null) {
    params["percent_off"] = coupon.percentOff;
  } else if (coupon.amountOffCents !== null) {
    params["amount_off"] = coupon.amountOffCents;
    params["currency"] = coupon.currency.toLowerCase();
  }
  if (coupon.maxRedemptions !== null) {
    params["max_redemptions"] = coupon.maxRedemptions;
  }

  const created = await stripe.coupons.create(
    params as Parameters<typeof stripe.coupons.create>[0],
  );
  return created.id;
}
