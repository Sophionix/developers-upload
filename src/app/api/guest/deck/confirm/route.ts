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
  paymentIntentId: z.string().min(1),
});

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

  const { paymentIntentId } = parsed.data;

  try {
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (intent.status !== "succeeded") {
      return NextResponse.json(
        { error: "PAYMENT_NOT_SUCCEEDED", status: intent.status },
        { status: 402 },
      );
    }

    const payment = await prisma.payment.findFirst({
      where: { stripePaymentIntentId: paymentIntentId, guestSessionId: guest.id },
      select: { id: true, status: true },
    });

    if (!payment) {
      return NextResponse.json({ error: "PAYMENT_NOT_FOUND" }, { status: 404 });
    }

    if (payment.status !== "SUCCEEDED") {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "SUCCEEDED" },
      });
      logger.info({ paymentId: payment.id, guestId: guest.id }, "guest.deck_payment_confirmed");
    }

    const res = NextResponse.json({ ok: true, unlocked: true });
    res.cookies.set(GUEST_COOKIE_NAME, rawCookie!, guestCookieOptions());
    return res;
  } catch (err) {
    logger.error({ err, paymentIntentId, guestId: guest.id }, "guest_deck_confirm_failed");
    return NextResponse.json({ error: "STRIPE_ERROR" }, { status: 502 });
  }
}
