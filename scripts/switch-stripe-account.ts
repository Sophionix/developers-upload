/**
 * Switch the Stripe account the app uses (EdgeFirm -> The Apptitude).
 *
 * Products/Prices and Customer ids are account-specific: the ids stored in the
 * DB belong to the OLD account and do not exist on the new one. This script,
 * run with the NEW account's STRIPE_SECRET_KEY in env:
 *   1. Re-creates a Product + recurring Price on the new account for each active
 *      PricingPlan (via syncPlanToStripe, forcing fresh ids) and repoints the DB.
 *   2. Clears every user.stripeCustomerId so a fresh customer is created on the
 *      new account at next checkout ("No such customer" otherwise).
 *
 * Dry run:  node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/switch-stripe-account.ts
 * Apply:    ... scripts/switch-stripe-account.ts --apply
 *
 * Set DATABASE_URL to the target DB (local, then prod) before running.
 */
import { prisma } from "@/lib/db";
import { getStripe, syncPlanToStripe } from "@/lib/stripe";

const APPLY = process.argv.includes("--apply");

async function main() {
  // Confirm which account the current key points at.
  const acct = await getStripe().accounts.retrieve();
  const name =
    (acct.settings?.dashboard?.display_name as string | undefined) ?? "(unknown)";
  console.log(`Active Stripe account: ${acct.id} | ${name}`);

  const plans = await prisma.pricingPlan.findMany({
    where: { isActive: true },
    select: {
      id: true, name: true, description: true, priceCents: true,
      currency: true, intervalMonths: true, isActive: true,
      stripeProductId: true, stripePriceId: true,
    },
  });
  console.log(`\nActive plans: ${plans.length}`);

  for (const p of plans) {
    console.log(`\n- ${p.name} ($${(p.priceCents / 100).toFixed(2)}/${p.intervalMonths}mo)`);
    console.log(`    old product=${p.stripeProductId} price=${p.stripePriceId}`);
    // Force fresh creation on the new account by passing null ids.
    const { stripeProductId, stripePriceId } = await syncPlanToStripe({
      ...p, stripeProductId: null, stripePriceId: null,
    });
    console.log(`    new product=${stripeProductId} price=${stripePriceId}`);
    if (APPLY) {
      await prisma.pricingPlan.update({
        where: { id: p.id },
        data: { stripeProductId, stripePriceId },
      });
    }
  }

  const withCustomer = await prisma.user.count({
    where: { stripeCustomerId: { not: null } },
  });
  console.log(`\nUsers with a (stale EdgeFirm) stripeCustomerId: ${withCustomer}`);
  if (APPLY && withCustomer > 0) {
    const res = await prisma.user.updateMany({
      where: { stripeCustomerId: { not: null } },
      data: { stripeCustomerId: null },
    });
    console.log(`    cleared ${res.count} customer ids`);
  }

  console.log(APPLY ? "\nAPPLIED." : "\nDRY RUN — re-run with --apply to write changes.");
}

main().then(
  () => process.exit(0),
  (err) => { console.error("SWITCH FAILED:", err?.message ?? err); process.exit(1); },
);
