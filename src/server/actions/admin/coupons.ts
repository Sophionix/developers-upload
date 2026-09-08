"use server";

import { Prisma } from "@/generated/prisma/client";
import { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { requireRole } from "@/lib/rbac";
import { logAdminAction } from "@/lib/audit";
import { invalidateTag } from "@/lib/cache";
import { decodeCursor, paginateKeyset } from "@/lib/pagination";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { syncCouponToStripe } from "@/lib/stripe";
import { toCouponDto, type CouponDto } from "@/lib/dto/billing";
import {
  createCouponSchema,
  deleteCouponSchema,
  listCouponsSchema,
  updateCouponSchema,
  type CreateCouponInput,
  type DeleteCouponInput,
  type ListCouponsInput,
  type UpdateCouponInput,
} from "@/lib/validation/admin-billing";

const COUPONS_TAG = "coupons";
const COUPON_SELECT = {
  id: true,
  code: true,
  type: true,
  percentOff: true,
  amountOffCents: true,
  currency: true,
  startsAt: true,
  endsAt: true,
  maxRedemptions: true,
  redeemedCount: true,
  appliesToPlanId: true,
  stripeCouponId: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.CouponSelect;

async function assertSuperAdmin(): Promise<{ userId: string }> {
  await requireUser();
  const { userId } = await requireRole([UserRole.SUPER_ADMIN]);
  return { userId };
}

export async function adminListCoupons(
  input: ListCouponsInput,
): Promise<{ items: CouponDto[]; nextCursor: string | null }> {
  await assertSuperAdmin();
  const {
    cursor,
    take = 20,
    isActive,
    search,
  } = listCouponsSchema.parse(input);
  const decoded = decodeCursor(cursor);

  const where: Prisma.CouponWhereInput = {
    ...(isActive !== undefined && { isActive }),
    ...(search && { code: { contains: search.toUpperCase() } }),
    ...(decoded && {
      OR: [
        { createdAt: { lt: decoded.createdAt } },
        { createdAt: decoded.createdAt, id: { lt: decoded.id } },
      ],
    }),
  };

  const rows = await prisma.coupon.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    select: COUPON_SELECT,
  });

  const page = paginateKeyset(rows, take, false);
  return {
    items: page.rows.map(toCouponDto),
    nextCursor: page.nextCursor,
  };
}

export async function adminCreateCoupon(
  input: CreateCouponInput,
): Promise<CouponDto> {
  const { userId } = await assertSuperAdmin();
  const data = createCouponSchema.parse(input);

  const existing = await prisma.coupon.findUnique({
    where: { code: data.code },
    select: { id: true },
  });
  if (existing) throw new ConflictError("code_taken");

  if (data.appliesToPlanId) {
    const plan = await prisma.pricingPlan.findUnique({
      where: { id: data.appliesToPlanId },
      select: { id: true },
    });
    if (!plan) throw new NotFoundError("plan_not_found");
  }

  const row = await prisma.coupon.create({
    data: {
      code: data.code,
      type: data.type,
      percentOff: data.percentOff ?? null,
      amountOffCents: data.amountOffCents ?? null,
      currency: data.currency,
      startsAt: data.startsAt ?? null,
      endsAt: data.endsAt ?? null,
      maxRedemptions: data.maxRedemptions ?? null,
      appliesToPlanId: data.appliesToPlanId ?? null,
      stripeCouponId: data.stripeCouponId ?? null,
      isActive: data.isActive,
    },
    select: COUPON_SELECT,
  });

  const stripeCouponId = await syncCouponToStripe(row);
  await prisma.coupon.update({ where: { id: row.id }, data: { stripeCouponId } });
  await invalidateTag(COUPONS_TAG);
  await logAdminAction({
    actorId: userId,
    action: "CREATE",
    entity: "Coupon",
    entityId: row.id,
    meta: { code: row.code, type: row.type },
  });
  return toCouponDto(row);
}

export async function adminUpdateCoupon(
  input: UpdateCouponInput,
): Promise<CouponDto> {
  const { userId } = await assertSuperAdmin();
  const { id, ...changes } = updateCouponSchema.parse(input);

  const existing = await prisma.coupon.findUnique({
    where: { id },
    select: { id: true, type: true, redeemedCount: true },
  });
  if (!existing) throw new NotFoundError("coupon_not_found");

  if (
    changes.maxRedemptions !== undefined &&
    changes.maxRedemptions !== null &&
    changes.maxRedemptions < existing.redeemedCount
  ) {
    throw new ValidationError("maxRedemptions_below_redeemed");
  }

  if (changes.appliesToPlanId) {
    const plan = await prisma.pricingPlan.findUnique({
      where: { id: changes.appliesToPlanId },
      select: { id: true },
    });
    if (!plan) throw new NotFoundError("plan_not_found");
  }

  const data: Prisma.CouponUpdateInput = {
    ...(changes.percentOff !== undefined && { percentOff: changes.percentOff }),
    ...(changes.amountOffCents !== undefined && {
      amountOffCents: changes.amountOffCents,
    }),
    ...(changes.startsAt !== undefined && { startsAt: changes.startsAt }),
    ...(changes.endsAt !== undefined && { endsAt: changes.endsAt }),
    ...(changes.maxRedemptions !== undefined && {
      maxRedemptions: changes.maxRedemptions,
    }),
    ...(changes.appliesToPlanId !== undefined && {
      plan:
        changes.appliesToPlanId === null
          ? { disconnect: true }
          : { connect: { id: changes.appliesToPlanId } },
    }),
    ...(changes.stripeCouponId !== undefined && {
      stripeCouponId: changes.stripeCouponId,
    }),
    ...(changes.isActive !== undefined && { isActive: changes.isActive }),
  };

  const row = await prisma.coupon.update({
    where: { id },
    data,
    select: COUPON_SELECT,
  });

  const stripeCouponId = await syncCouponToStripe(row);
  await prisma.coupon.update({ where: { id: row.id }, data: { stripeCouponId } });
  await invalidateTag(COUPONS_TAG);
  await logAdminAction({
    actorId: userId,
    action: "UPDATE",
    entity: "Coupon",
    entityId: row.id,
    meta: { changedKeys: Object.keys(data) },
  });
  return toCouponDto(row);
}

export async function adminDeleteCoupon(
  input: DeleteCouponInput,
): Promise<{ ok: true }> {
  const { userId } = await assertSuperAdmin();
  const { id } = deleteCouponSchema.parse(input);

  const existing = await prisma.coupon.findUnique({
    where: { id },
    select: { id: true, isActive: true },
  });
  if (!existing) throw new NotFoundError("coupon_not_found");

  if (existing.isActive) {
    await prisma.coupon.update({
      where: { id },
      data: { isActive: false },
    });
  }

  await invalidateTag(COUPONS_TAG);
  await logAdminAction({
    actorId: userId,
    action: "DELETE",
    entity: "Coupon",
    entityId: id,
    meta: { softDelete: true },
  });
  return { ok: true };
}

export interface RedeemableCoupon {
  id: string;
  code: string;
  type: CouponDto["type"];
  percentOff: number | null;
  amountOffCents: number | null;
  currency: string;
  appliesToPlanId: string | null;
  remaining: number | null;
}

export async function assertCouponRedeemable(
  code: string,
): Promise<RedeemableCoupon> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) throw new ValidationError("code_required");

  const row = await prisma.coupon.findUnique({
    where: { code: normalized },
    select: {
      id: true,
      code: true,
      type: true,
      percentOff: true,
      amountOffCents: true,
      currency: true,
      appliesToPlanId: true,
      startsAt: true,
      endsAt: true,
      maxRedemptions: true,
      redeemedCount: true,
      isActive: true,
    },
  });
  if (!row) throw new NotFoundError("coupon_not_found");
  if (!row.isActive) throw new ConflictError("coupon_inactive");

  const now = new Date();
  if (row.startsAt && row.startsAt > now)
    throw new ConflictError("coupon_not_started");
  if (row.endsAt && row.endsAt <= now)
    throw new ConflictError("coupon_expired");

  const remaining =
    row.maxRedemptions === null ? null : row.maxRedemptions - row.redeemedCount;
  if (remaining !== null && remaining <= 0) {
    throw new ConflictError("coupon_exhausted");
  }

  return {
    id: row.id,
    code: row.code,
    type: row.type,
    percentOff: row.percentOff,
    amountOffCents: row.amountOffCents,
    currency: row.currency,
    appliesToPlanId: row.appliesToPlanId,
    remaining,
  };
}
