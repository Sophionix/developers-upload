import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getStripe } from "@/lib/stripe";
import {
  GUEST_COOKIE_NAME,
  guestCookieOptions,
  resolveGuestSession,
} from "@/lib/guest-session";

export const runtime = "nodejs";

const bodySchema = z.object({
  sessionId: z.string().min(1),
});

/**
 * Confirms a completed guest deck-unlock Checkout session. Retrieves the session
 * from Stripe, verifies it was paid, and marks the matching Payment SUCCEEDED so
 * the guest can proceed into the draw experience.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawCookie = req.cookies.get(GUEST_COOKIE_NAME)?.value ?? null;
  const guest = await resolveGuestSession(rawCookie);
  if (!guest) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const { sessionId } = parsed.data;

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.metadata?.guestSessionId !== guest.id) {
      return NextResponse.json({ error: "SESSION_MISMATCH" }, { status: 403 });
    }
    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "PAYMENT_NOT_PAID", status: session.payment_status },
        { status: 402 },
      );
    }

    const paymentId = session.metadata?.paymentId;
    if (!paymentId) {
      return NextResponse.json({ error: "PAYMENT_NOT_FOUND" }, { status: 404 });
    }

    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, guestSessionId: guest.id },
      select: { id: true, status: true },
    });
    if (!payment) {
      return NextResponse.json({ error: "PAYMENT_NOT_FOUND" }, { status: 404 });
    }

    if (payment.status !== "SUCCEEDED") {
      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null);
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "SUCCEEDED",
          stripeStatus: session.payment_status,
          ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
        },
      });
      logger.info(
        { paymentId: payment.id, guestId: guest.id },
        "guest.deck_checkout_confirmed",
      );
    }

    const res = NextResponse.json({ ok: true, unlocked: true });
    res.cookies.set(GUEST_COOKIE_NAME, rawCookie!, guestCookieOptions());
    return res;
  } catch (err) {
    logger.error({ err, sessionId, guestId: guest.id }, "guest_deck_checkout_confirm_failed");
    return NextResponse.json({ error: "STRIPE_ERROR" }, { status: 502 });
  }
}
