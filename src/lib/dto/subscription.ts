import type {
  SubscriptionStatus,
  SubscriptionTier,
} from "@/generated/prisma/enums";

export interface CurrentSubscriptionDto {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  planId: string | null;
  planName: string | null;
  priceCents: number | null;
  currency: string | null;
  intervalMonths: number | null;
  trialEnd: Date | null;
}

export interface CurrentSubscriptionRow {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  planId: string | null;
  trialEnd: Date | null;
}

export interface CurrentSubscriptionPlan {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
  intervalMonths: number;
}

export function toCurrentSubscriptionDto(
  sub: CurrentSubscriptionRow | null,
  plan: CurrentSubscriptionPlan | null,
): CurrentSubscriptionDto {
  if (!sub) {
    return {
      tier: "FREE",
      status: "ACTIVE",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      planId: null,
      planName: null,
      priceCents: null,
      currency: null,
      intervalMonths: null,
      trialEnd: null,
    };
  }
  return {
    tier: sub.tier,
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    planId: sub.planId,
    planName: plan?.name ?? null,
    priceCents: plan?.priceCents ?? null,
    currency: plan?.currency ?? null,
    intervalMonths: plan?.intervalMonths ?? null,
    trialEnd: sub.trialEnd,
  };
}
