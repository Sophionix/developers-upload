import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { getStripe, StripeNotConfiguredError } from "@/lib/stripe";
import {
  GUEST_COOKIE_NAME,
  createGuestSession,
  guestCookieOptions,
  resolveGuestSession,
} from "@/lib/guest-session";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawCookie = req.cookies.get(GUEST_COOKIE_NAME)?.value ?? null;
  let guest = await resolveGuestSession(rawCookie);
  let mintedCookie: string | null = null;
  if (!guest) {
    const created = await createGuestSession(req);
    guest = created.record;
    mintedCookie = created.cookieRaw;
  }

  const rl = await rateLimit({ key: `guest:deck-pay:${guest.id}`, limit: 5, windowSec: 3600 });
  if (!rl.ok) {
    const res = NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
    if (mintedCookie) res.cookies.set(GUEST_COOKIE_NAME, mintedCookie, guestCookieOptions());
    return res;
  }

  // Check if guest already has an active deck unlock (within last 24h)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existingPayment = await prisma.payment.findFirst({
    where: {
      guestSessionId: guest.id,
      type: "CARD_UNLOCK",
      status: "SUCCEEDED",
      createdAt: { gte: twentyFourHoursAgo },
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });

  if (existingPayment) {
    const res = NextResponse.json({ ok: true, alreadyUnlocked: true });
    if (mintedCookie) res.cookies.set(GUEST_COOKIE_NAME, mintedCookie, guestCookieOptions());
    return res;
  }

  // Create a payment record + Stripe PaymentIntent
  const payment = await prisma.payment.create({
    data: {
      guestSessionId: guest.id,
      type: "CARD_UNLOCK",
      amountCents: env.CARD_UNLOCK_PRICE_CENTS,
      currency: env.CARD_UNLOCK_CURRENCY,
      status: "PENDING",
    },
  });

  let clientSecret: string;
  let paymentIntentId: string;
  try {
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.create({
      amount: payment.amountCents,
      currency: payment.currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        paymentId: payment.id,
        guestSessionId: guest.id,
        type: "deck_unlock",
      },
    });
    if (!intent.client_secret) {
      throw new Error("stripe_no_client_secret");
    }
    clientSecret = intent.client_secret;
    paymentIntentId = intent.id;
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) {
      const res = NextResponse.json({ error: "STRIPE_NOT_CONFIGURED" }, { status: 503 });
      if (mintedCookie) res.cookies.set(GUEST_COOKIE_NAME, mintedCookie, guestCookieOptions());
      return res;
    }
    logger.error({ err, paymentId: payment.id }, "guest_deck_pay_intent_failed");
    const res = NextResponse.json({ error: "STRIPE_ERROR" }, { status: 502 });
    if (mintedCookie) res.cookies.set(GUEST_COOKIE_NAME, mintedCookie, guestCookieOptions());
    return res;
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: { stripePaymentIntentId: paymentIntentId },
  });

  logger.info({ paymentId: payment.id, guestId: guest.id }, "guest.deck_pay_intent");
  const res = NextResponse.json({
    ok: true,
    paymentId: payment.id,
    clientSecret,
  });
  if (mintedCookie) res.cookies.set(GUEST_COOKIE_NAME, mintedCookie, guestCookieOptions());
  return res;
}
