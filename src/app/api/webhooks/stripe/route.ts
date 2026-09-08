import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { emitMetric } from "@/lib/metrics";
import { verifyWebhookSignature } from "@/lib/stripe";
import {
  handleChargeRefunded,
  handleCheckoutSessionCompleted,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
  handlePaymentIntentFailed,
  handlePaymentIntentSucceeded,
  handleSubscriptionDeleted,
  handleSubscriptionUpserted,
} from "@/lib/stripe-handlers";

export const runtime = "nodejs";

const HANDLERS: Record<string, (event: Stripe.Event) => Promise<void>> = {
  "checkout.session.completed": handleCheckoutSessionCompleted,
  "customer.subscription.created": handleSubscriptionUpserted,
  "customer.subscription.updated": handleSubscriptionUpserted,
  "customer.subscription.deleted": handleSubscriptionDeleted,
  "invoice.paid": handleInvoicePaid,
  "invoice.payment_failed": handleInvoicePaymentFailed,
  "payment_intent.succeeded": handlePaymentIntentSucceeded,
  "payment_intent.payment_failed": handlePaymentIntentFailed,
  "charge.refunded": handleChargeRefunded,
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const t0 = Date.now();

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "MISSING_SIGNATURE" }, { status: 400 });
  }
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = verifyWebhookSignature(rawBody, sig);
  } catch (err) {
    logger.warn({ err }, "stripe_webhook_signature_invalid");
    return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 400 });
  }

  try {
    await prisma.stripeWebhookEvent.create({
      data: { id: event.id, type: event.type },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
    }
    logger.error({ err, eventId: event.id }, "stripe_webhook_insert_failed");
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }

  const handler = HANDLERS[event.type];
  if (!handler) {
    logger.info({ type: event.type, id: event.id }, "stripe_webhook_unhandled");
    await prisma.stripeWebhookEvent
      .update({
        where: { id: event.id },
        data: { processedAt: new Date() },
      })
      .catch(() => undefined);
    return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
  }

  try {
    await handler(event);
    await prisma.stripeWebhookEvent.update({
      where: { id: event.id },
      data: { processedAt: new Date() },
    });
    void emitMetric("StripeWebhookDuration", Date.now() - t0, "Milliseconds", {
      event: event.type,
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      { err, eventId: event.id, type: event.type },
      "stripe_webhook_handler_failed",
    );
    await prisma.stripeWebhookEvent
      .update({
        where: { id: event.id },
        data: { error: message },
      })
      .catch(() => undefined);
    void emitMetric("StripeWebhookDuration", Date.now() - t0, "Milliseconds", {
      event: event.type,
    });
    return NextResponse.json({ error: "HANDLER_FAILED" }, { status: 500 });
  }
}
