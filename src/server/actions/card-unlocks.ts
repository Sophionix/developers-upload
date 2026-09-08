"use server";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { requireUser } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import {
  ConflictError,
  NotFoundError,
  RateLimitedError,
} from "@/lib/errors";
import { getStripe, getOrCreateStripeCustomer } from "@/lib/stripe";
import {
  createCardUnlockCheckoutSchema,
  type CreateCardUnlockCheckoutInput,
} from "@/lib/validation/billing";

async function resolveUnlockPrice(): Promise<{
  amountCents: number;
  currency: string;
}> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: "card_unlock_price_cents" },
    select: { value: true },
  });
  const raw = row?.value as unknown;
  const cents =
    typeof raw === "number" && Number.isFinite(raw) && raw > 0
      ? Math.floor(raw)
      : env.CARD_UNLOCK_PRICE_CENTS;
  return { amountCents: cents, currency: env.CARD_UNLOCK_CURRENCY };
}

interface CardUnlockCheckoutResult {
  sessionId: string;
  url: string;
  cardUnlockId: string;
}

export async function createCardUnlockCheckout(
  input: CreateCardUnlockCheckoutInput,
): Promise<CardUnlockCheckoutResult> {
  const user = await requireUser();
  const { cardId } = createCardUnlockCheckoutSchema.parse(input);

  const rl = await rateLimit({
    key: `card-unlock-checkout:${user.id}`,
    limit: 10,
    windowSec: 60,
  });
  if (!rl.ok) throw new RateLimitedError();

  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: { id: true, title: true, isActive: true, accessType: true },
  });
  if (!card || !card.isActive) throw new NotFoundError("card_not_found");
  if (card.accessType === "FREE") throw new ConflictError("card_is_free");

  const existing = await prisma.cardUnlock.findUnique({
    where: { userId_cardId: { userId: user.id, cardId } },
    select: { id: true, status: true },
  });
  if (existing?.status === "SUCCEEDED") {
    throw new ConflictError("already_unlocked");
  }

  const { amountCents, currency } = await resolveUnlockPrice();

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

  const unlock = existing
    ? await prisma.cardUnlock.update({
        where: { id: existing.id },
        data: { status: "PENDING", priceCents: amountCents, currency },
        select: { id: true },
      })
    : await prisma.cardUnlock.create({
        data: {
          userId: user.id,
          cardId,
          priceCents: amountCents,
          currency,
          status: "PENDING",
        },
        select: { id: true },
      });

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: `Card unlock: ${card.title}`,
            description:
              "Unlock this premium reflection card forever — keep its affirmation, prompt, and guidance in your collection for unlimited access, any time.",
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    success_url: env.STRIPE_CHECKOUT_SUCCESS_URL,
    cancel_url: env.STRIPE_CHECKOUT_CANCEL_URL,
    client_reference_id: user.id,
    customer: stripeCustomerId,
    payment_intent_data: {
      metadata: {
        userId: user.id,
        cardId,
        cardUnlockId: unlock.id,
      },
    },
    metadata: {
      userId: user.id,
      cardId,
      cardUnlockId: unlock.id,
    },
  });

  if (!session.url) throw new NotFoundError("stripe_session_no_url");
  return { sessionId: session.id, url: session.url, cardUnlockId: unlock.id };
}
