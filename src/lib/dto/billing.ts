import type { CouponType, PlanVisibility } from "@/generated/prisma/enums";

export interface PlanDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  intervalMonths: number;
  trialDays: number;
  features: unknown;
  visibility: PlanVisibility;
  stripePriceId: string | null;
  stripeProductId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlanRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  intervalMonths: number;
  trialDays: number;
  features: unknown;
  visibility: PlanVisibility;
  stripePriceId: string | null;
  stripeProductId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toPlanDto(row: PlanRow): PlanDto {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    priceCents: row.priceCents,
    currency: row.currency,
    intervalMonths: row.intervalMonths,
    trialDays: row.trialDays,
    features: row.features,
    visibility: row.visibility,
    stripePriceId: row.stripePriceId,
    stripeProductId: row.stripeProductId,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export interface CouponDto {
  id: string;
  code: string;
  type: CouponType;
  percentOff: number | null;
  amountOffCents: number | null;
  currency: string;
  startsAt: Date | null;
  endsAt: Date | null;
  maxRedemptions: number | null;
  redeemedCount: number;
  remaining: number | null;
  appliesToPlanId: string | null;
  stripeCouponId: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface CouponRow {
  id: string;
  code: string;
  type: CouponType;
  percentOff: number | null;
  amountOffCents: number | null;
  currency: string;
  startsAt: Date | null;
  endsAt: Date | null;
  maxRedemptions: number | null;
  redeemedCount: number;
  appliesToPlanId: string | null;
  stripeCouponId: string | null;
  isActive: boolean;
  createdAt: Date;
}

export function toCouponDto(row: CouponRow): CouponDto {
  const remaining =
    row.maxRedemptions === null
      ? null
      : Math.max(0, row.maxRedemptions - row.redeemedCount);
  return {
    id: row.id,
    code: row.code,
    type: row.type,
    percentOff: row.percentOff,
    amountOffCents: row.amountOffCents,
    currency: row.currency,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    maxRedemptions: row.maxRedemptions,
    redeemedCount: row.redeemedCount,
    remaining,
    appliesToPlanId: row.appliesToPlanId,
    stripeCouponId: row.stripeCouponId,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}
