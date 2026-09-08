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

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: cardId } = await ctx.params;
  if (!cardId) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

  const rawCookie = req.cookies.get(GUEST_COOKIE_NAME)?.value ?? null;
  let guest = await resolveGuestSession(rawCookie);
  let mintedCookie: string | null = null;
  if (!guest) {
    const created = await createGuestSession(req);
    guest = created.record;
    mintedCookie = created.cookieRaw;
  }

  const rl = await rateLimit({ key: `guest:unlock-intent:${guest.id}`, limit: 5, windowSec: 3600 });
  if (!rl.ok) {
    const res = NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
    if (mintedCookie) res.cookies.set(GUEST_COOKIE_NAME, mintedCookie, guestCookieOptions());
    return res;
  }

  const card = await prisma.card.findFirst({
    where: { id: cardId, guestPreview: true, isActive: true },
    select: { id: true },
  });
  if (!card) {
    const res = NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (mintedCookie) res.cookies.set(GUEST_COOKIE_NAME, mintedCookie, guestCookieOptions());
    return res;
  }

  const unlock = await prisma.cardUnlock.upsert({
    where: { guestSessionId_cardId: { guestSessionId: guest.id, cardId } },
    create: {
      guestSessionId: guest.id,
      cardId,
      priceCents: env.CARD_UNLOCK_PRICE_CENTS,
      currency: env.CARD_UNLOCK_CURRENCY,
      status: "PENDING",
    },
    update: { status: "PENDING" },
    select: { id: true, priceCents: true, currency: true },
  });

  let clientSecret: string;
  let paymentIntentId: string;
  try {
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.create({
      amount: unlock.priceCents,
      currency: unlock.currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        cardUnlockId: unlock.id,
        guestSessionId: guest.id,
        cardId,
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
    logger.error({ err, unlockId: unlock.id }, "guest_unlock_intent_failed");
    const res = NextResponse.json({ error: "STRIPE_ERROR" }, { status: 502 });
    if (mintedCookie) res.cookies.set(GUEST_COOKIE_NAME, mintedCookie, guestCookieOptions());
    return res;
  }

  await prisma.cardUnlock.update({
    where: { id: unlock.id },
    data: { stripePaymentIntentId: paymentIntentId },
  });

  logger.info({ unlockId: unlock.id, guestId: guest.id, cardId }, "guest.unlock_intent");
  const res = NextResponse.json({
    ok: true,
    unlockId: unlock.id,
    clientSecret,
  });
  if (mintedCookie) res.cookies.set(GUEST_COOKIE_NAME, mintedCookie, guestCookieOptions());
  return res;
}
