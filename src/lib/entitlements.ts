import { prisma } from "@/lib/db";
import type { CardAccessType } from "@/generated/prisma/enums";

export interface PremiumStatus {
  active: boolean;
}

export async function getUserPremiumStatus(
  userId: string,
): Promise<PremiumStatus> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: {
      tier: true,
      status: true,
      currentPeriodEnd: true,
      grantExpiresAt: true,
      grantedByAdminId: true,
    },
  });
  if (!sub) return { active: false };

  const now = Date.now();
  const statusOk = sub.status === "ACTIVE" || sub.status === "TRIALING";
  const tierOk = sub.tier === "PREMIUM" || sub.tier === "TRIAL";
  if (!statusOk || !tierOk) return { active: false };

  if (sub.grantedByAdminId) {
    if (!sub.grantExpiresAt || sub.grantExpiresAt.getTime() > now) {
      return { active: true };
    }
    return { active: false };
  }

  if (sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() <= now) {
    return { active: false };
  }
  return { active: true };
}

export async function userHasCardEntitlement(
  userId: string,
  card: { id: string; accessType: CardAccessType },
): Promise<boolean> {
  if (card.accessType === "FREE") return true;
  const premium = await getUserPremiumStatus(userId);
  if (premium.active) return true;
  const unlock = await prisma.cardUnlock.findUnique({
    where: { userId_cardId: { userId, cardId: card.id } },
    select: { status: true },
  });
  return unlock?.status === "SUCCEEDED";
}

export async function userHasJourneyEntitlement(
  userId: string,
  journey: { accessType: CardAccessType | "FREE" | "PREMIUM" },
): Promise<boolean> {
  if (journey.accessType === "FREE") return true;
  const premium = await getUserPremiumStatus(userId);
  return premium.active;
}
