/**
 * Reconcile PricingPlan Stripe ids with the CURRENT Stripe account.
 *
 * Safe to run on every deploy (idempotent): for each active plan, it checks
 * whether the stored stripePriceId still resolves on the account behind
 * STRIPE_SECRET_KEY AND still matches the plan's current priceCents/currency/
 * intervalMonths. If both hold, nothing happens. Otherwise (missing, belongs
 * to a different account, or the DB price was edited) syncPlanToStripe
 * re-links the plan to the right Product/Price — archiving a stale Price and
 * creating a fresh one, since Stripe Prices are immutable — and the DB is
 * updated.
 *
 * This is what makes switching Stripe accounts (or editing a plan's price in
 * the DB / next deploy's data migration) self-correct on deploy instead of
 * requiring a manual Stripe dashboard edit.
 *
 * Run: node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/reconcile-stripe-plans.ts
 */
import { prisma } from "@/lib/db";
import { getStripe, syncPlanToStripe, StripeNotConfiguredError } from "@/lib/stripe";

async function priceMatchesPlan(
  priceId: string | null,
  plan: { priceCents: number; currency: string; intervalMonths: number },
): Promise<boolean> {
  if (!priceId) return false;
  try {
    const p = await getStripe().prices.retrieve(priceId);
    if (!p || p.active === false) return false;
    const interval = plan.intervalMonths === 12 ? "year" : "month";
    const intervalCount = plan.intervalMonths === 12 ? 1 : plan.intervalMonths;
    return (
      p.unit_amount === plan.priceCents &&
      p.currency === plan.currency.toLowerCase() &&
      p.recurring?.interval === interval &&
      p.recurring?.interval_count === intervalCount
    );
  } catch {
    return false; // No such price on this account.
  }
}

async function main() {
  let stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) {
      console.log("Stripe not configured — skipping reconcile.");
      return;
    }
    throw err;
  }

  const acct = await stripe.accounts.retrieve();
  console.log(
    `Reconciling against Stripe account ${acct.id} | ${(acct.settings?.dashboard?.display_name as string) ?? "?"}`,
  );

  const plans = await prisma.pricingPlan.findMany({
    where: { isActive: true },
    select: {
      id: true, name: true, description: true, priceCents: true,
      currency: true, intervalMonths: true, isActive: true,
      stripeProductId: true, stripePriceId: true,
    },
  });

  let fixed = 0;
  for (const p of plans) {
    if (await priceMatchesPlan(p.stripePriceId, p)) {
      console.log(`  ok: ${p.name} (${p.stripePriceId})`);
      continue;
    }
    const { stripeProductId, stripePriceId } = await syncPlanToStripe(p);
    await prisma.pricingPlan.update({
      where: { id: p.id },
      data: { stripeProductId, stripePriceId },
    });
    console.log(`  fixed: ${p.name} -> ${stripePriceId}`);
    fixed++;
  }
  console.log(`\nReconcile done. plans=${plans.length} fixed=${fixed}`);
}

main().then(
  () => process.exit(0),
  (err) => { console.error("RECONCILE FAILED:", err?.message ?? err); process.exit(1); },
);
