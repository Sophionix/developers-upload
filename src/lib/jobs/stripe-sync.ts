import { prisma } from "@/lib/db";
import { syncPlanToStripe, syncCouponToStripe } from "@/lib/stripe";

export async function syncPlanById(planId: string): Promise<void> {
  const plan = await prisma.pricingPlan.findUniqueOrThrow({
    where: { id: planId },
  });
  const synced = await syncPlanToStripe(plan);
  await prisma.pricingPlan.update({
    where: { id: planId },
    data: {
      stripeProductId: synced.stripeProductId,
      stripePriceId: synced.stripePriceId,
    },
  });
}

export async function syncCouponById(couponId: string): Promise<void> {
  const coupon = await prisma.coupon.findUniqueOrThrow({
    where: { id: couponId },
  });
  const stripeCouponId = await syncCouponToStripe(coupon);
  await prisma.coupon.update({
    where: { id: couponId },
    data: { stripeCouponId },
  });
}
