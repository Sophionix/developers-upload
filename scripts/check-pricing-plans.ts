import { prisma } from "@/lib/db";

async function main() {
  const plans = await prisma.pricingPlan.findMany({
    select: {
      id: true,
      name: true,
      priceCents: true,
      currency: true,
      intervalMonths: true,
      isActive: true,
      stripeProductId: true,
      stripePriceId: true,
    },
    orderBy: { priceCents: "asc" },
  });
  console.log(`PricingPlan rows: ${plans.length}`);
  for (const p of plans) {
    console.log(
      `  ${p.name} | $${(p.priceCents / 100).toFixed(2)}/${p.intervalMonths}mo | active=${p.isActive} | price=${p.stripePriceId ?? "(none)"} | product=${p.stripeProductId ?? "(none)"}`,
    );
  }
}
main().then(() => process.exit(0), (e) => { console.error(e?.message ?? e); process.exit(1); });
