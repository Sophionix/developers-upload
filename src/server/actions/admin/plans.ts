"use server";

import { Prisma } from "@/generated/prisma/client";
import { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { requireRole } from "@/lib/rbac";
import { logAdminAction } from "@/lib/audit";
import { invalidateTag } from "@/lib/cache";
import { decodeCursor, paginateKeyset } from "@/lib/pagination";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { syncPlanToStripe } from "@/lib/stripe";
import { toPlanDto, type PlanDto } from "@/lib/dto/billing";
import {
  createPlanSchema,
  deletePlanSchema,
  listPlansSchema,
  updatePlanSchema,
  type CreatePlanInput,
  type DeletePlanInput,
  type ListPlansInput,
  type UpdatePlanInput,
} from "@/lib/validation/admin-billing";

const PLANS_TAG = "plans";
const PLAN_SELECT = {
  id: true,
  slug: true,
  name: true,
  description: true,
  priceCents: true,
  currency: true,
  intervalMonths: true,
  trialDays: true,
  features: true,
  visibility: true,
  stripePriceId: true,
  stripeProductId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PricingPlanSelect;

const PRICE_RELEVANT_FIELDS = [
  "priceCents",
  "currency",
  "intervalMonths",
  "trialDays",
  "slug",
  "name",
  "description",
  "visibility",
  "stripePriceId",
  "stripeProductId",
] as const;

async function assertSuperAdmin(): Promise<{ userId: string }> {
  await requireUser();
  const { userId } = await requireRole([UserRole.SUPER_ADMIN]);
  return { userId };
}

export async function adminListPlans(
  input: ListPlansInput,
): Promise<{ items: PlanDto[]; nextCursor: string | null }> {
  await assertSuperAdmin();
  const { cursor, take = 20, isActive, search } = listPlansSchema.parse(input);
  const decoded = decodeCursor(cursor);

  const where: Prisma.PricingPlanWhereInput = {
    ...(isActive !== undefined && { isActive }),
    ...(search && {
      OR: [{ name: { contains: search } }, { slug: { contains: search } }],
    }),
    ...(decoded && {
      OR: [
        { createdAt: { lt: decoded.createdAt } },
        { createdAt: decoded.createdAt, id: { lt: decoded.id } },
      ],
    }),
  };

  const rows = await prisma.pricingPlan.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    select: PLAN_SELECT,
  });

  const page = paginateKeyset(rows, take, false);
  return {
    items: page.rows.map(toPlanDto),
    nextCursor: page.nextCursor,
  };
}

export async function adminCreatePlan(
  input: CreatePlanInput,
): Promise<PlanDto> {
  const { userId } = await assertSuperAdmin();
  const data = createPlanSchema.parse(input);

  const existing = await prisma.pricingPlan.findUnique({
    where: { slug: data.slug },
    select: { id: true },
  });
  if (existing) throw new ConflictError("slug_taken");

  const row = await prisma.pricingPlan.create({
    data: {
      slug: data.slug,
      name: data.name,
      description: data.description ?? null,
      priceCents: data.priceCents,
      currency: data.currency,
      intervalMonths: data.intervalMonths,
      trialDays: data.trialDays,
      features: data.features as Prisma.InputJsonValue,
      visibility: data.visibility,
      stripePriceId: data.stripePriceId ?? null,
      stripeProductId: data.stripeProductId ?? null,
      isActive: data.isActive,
    },
    select: PLAN_SELECT,
  });

  const synced = await syncPlanToStripe(row);
  await prisma.pricingPlan.update({
    where: { id: row.id },
    data: { stripeProductId: synced.stripeProductId, stripePriceId: synced.stripePriceId },
  });
  await invalidateTag(PLANS_TAG);
  await logAdminAction({
    actorId: userId,
    action: "CREATE",
    entity: "PricingPlan",
    entityId: row.id,
    meta: { slug: row.slug, priceCents: row.priceCents },
  });
  return toPlanDto({ ...row, ...synced });
}

export async function adminUpdatePlan(
  input: UpdatePlanInput,
): Promise<PlanDto> {
  const { userId } = await assertSuperAdmin();
  const { id, ...changes } = updatePlanSchema.parse(input);

  const existing = await prisma.pricingPlan.findUnique({
    where: { id },
    select: { id: true, slug: true },
  });
  if (!existing) throw new NotFoundError("plan_not_found");

  if (changes.slug && changes.slug !== existing.slug) {
    const clash = await prisma.pricingPlan.findUnique({
      where: { slug: changes.slug },
      select: { id: true },
    });
    if (clash && clash.id !== id) throw new ConflictError("slug_taken");
  }

  const data: Prisma.PricingPlanUpdateInput = {
    ...(changes.slug !== undefined && { slug: changes.slug }),
    ...(changes.name !== undefined && { name: changes.name }),
    ...(changes.description !== undefined && {
      description: changes.description,
    }),
    ...(changes.priceCents !== undefined && { priceCents: changes.priceCents }),
    ...(changes.currency !== undefined && { currency: changes.currency }),
    ...(changes.intervalMonths !== undefined && {
      intervalMonths: changes.intervalMonths,
    }),
    ...(changes.trialDays !== undefined && { trialDays: changes.trialDays }),
    ...(changes.features !== undefined && {
      features: changes.features as Prisma.InputJsonValue,
    }),
    ...(changes.visibility !== undefined && { visibility: changes.visibility }),
    ...(changes.stripePriceId !== undefined && {
      stripePriceId: changes.stripePriceId,
    }),
    ...(changes.stripeProductId !== undefined && {
      stripeProductId: changes.stripeProductId,
    }),
    ...(changes.isActive !== undefined && { isActive: changes.isActive }),
  };

  const row = await prisma.pricingPlan.update({
    where: { id },
    data,
    select: PLAN_SELECT,
  });

  const priceRelevantChanged = PRICE_RELEVANT_FIELDS.some(
    (k) => (changes as Record<string, unknown>)[k] !== undefined,
  );
  if (priceRelevantChanged) {
    const synced = await syncPlanToStripe(row);
    await prisma.pricingPlan.update({
      where: { id: row.id },
      data: { stripeProductId: synced.stripeProductId, stripePriceId: synced.stripePriceId },
    });
  }
  await invalidateTag(PLANS_TAG);
  await logAdminAction({
    actorId: userId,
    action: "UPDATE",
    entity: "PricingPlan",
    entityId: row.id,
    meta: {
      changedKeys: Object.keys(data),
      syncEnqueued: priceRelevantChanged,
    },
  });
  return toPlanDto(row);
}

const ACTIVE_SUB_STATUSES = ["ACTIVE", "TRIALING", "PAST_DUE"] as const;

export async function adminDeletePlan(
  input: DeletePlanInput,
): Promise<{ ok: true }> {
  const { userId } = await assertSuperAdmin();
  const { id } = deletePlanSchema.parse(input);

  const existing = await prisma.pricingPlan.findUnique({
    where: { id },
    select: { id: true, isActive: true },
  });
  if (!existing) throw new NotFoundError("plan_not_found");

  const activeSub = await prisma.subscription.findFirst({
    where: { planId: id, status: { in: [...ACTIVE_SUB_STATUSES] } },
    select: { id: true },
  });
  if (activeSub) throw new ConflictError("plan_has_active_subscriptions");

  if (existing.isActive) {
    await prisma.pricingPlan.update({
      where: { id },
      data: { isActive: false },
    });
  }

  await invalidateTag(PLANS_TAG);
  await logAdminAction({
    actorId: userId,
    action: "DELETE",
    entity: "PricingPlan",
    entityId: id,
    meta: { softDelete: true },
  });
  return { ok: true };
}

