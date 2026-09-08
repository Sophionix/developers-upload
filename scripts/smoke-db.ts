import { prisma } from "@/lib/db";

async function main() {
  const rows = await prisma.$queryRaw<Array<{ n: number }>>`SELECT 1 AS n`;
  console.log("smoke: SELECT 1 =>", rows);
  const counts = {
    decks: await prisma.deck.count(),
    cards: await prisma.card.count(),
    plans: await prisma.pricingPlan.count(),
    templates: await prisma.notificationTemplate.count(),
    settings: await prisma.systemSetting.count(),
  };
  console.log("smoke: counts", counts);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
