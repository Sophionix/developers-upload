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

/**
 * Creates a Stripe Checkout session (hosted redirect) for the guest deck unlock.
 * Mirrors the logged-in card-unlock checkout — the browser is redirected to
 * Stripe's hosted payment page, and returns to the dashboard with the session
 * id so we can confirm the payment and start the draw.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawCookie = req.cookies.get(GUEST_COOKIE_NAME)?.value ?? null;
  let guest = await resolveGuestSession(rawCookie);
  let mintedCookie: string | null = null;
  if (!guest) {
    const created = await createGuestSession(req);
    guest = created.record;
    mintedCookie = created.cookieRaw;
  }

  const withCookie = (res: NextResponse): NextResponse => {
    if (mintedCookie) res.cookies.set(GUEST_COOKIE_NAME, mintedCookie, guestCookieOptions());
    return res;
  };

  const rl = await rateLimit({ key: `guest:deck-checkout:${guest.id}`, limit: 10, windowSec: 3600 });
  if (!rl.ok) {
    return withCookie(NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 }));
  }

  // Pay-per-use: every deck access is a fresh payment, so we always create a new
  // Stripe Checkout session (no "already unlocked" short-circuit).
  const payment = await prisma.payment.create({
    data: {
      guestSessionId: guest.id,
      type: "CARD_UNLOCK",
      amountCents: env.CARD_UNLOCK_PRICE_CENTS,
      currency: env.CARD_UNLOCK_CURRENCY,
      status: "PENDING",
    },
  });

  const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  let checkoutUrl: string;
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: payment.currency.toLowerCase(),
            product_data: {
              name: "Sophionix Oracle — Deck Unlock",
              description:
                "One-time Pay-Per-Use access to draw and reveal cards from the Sophionix Oracle deck.",
            },
            unit_amount: payment.amountCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/guest/dashboard?paid={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/guest/dashboard?paid=cancel`,
      payment_intent_data: {
        metadata: {
          paymentId: payment.id,
          guestSessionId: guest.id,
          type: "deck_unlock",
        },
      },
      metadata: {
        paymentId: payment.id,
        guestSessionId: guest.id,
        type: "deck_unlock",
      },
    });

    if (!session.url) throw new Error("stripe_session_no_url");
    checkoutUrl = session.url;
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) {
      return withCookie(
        NextResponse.json({ error: "STRIPE_NOT_CONFIGURED" }, { status: 503 }),
      );
    }
    logger.error({ err, paymentId: payment.id }, "guest_deck_checkout_failed");
    return withCookie(NextResponse.json({ error: "STRIPE_ERROR" }, { status: 502 }));
  }

  logger.info({ paymentId: payment.id, guestId: guest.id }, "guest.deck_checkout_created");
  return withCookie(NextResponse.json({ ok: true, url: checkoutUrl }));
}
