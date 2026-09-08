import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { SubscriptionTier } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

const AUDIENCE_HARD_CAP = 100_000;

const subscriptionTierEnum = z.enum([
  SubscriptionTier.FREE,
  SubscriptionTier.TRIAL,
  SubscriptionTier.PREMIUM,
]);

export const campaignSegmentSchema = z
  .object({
    tier: z.array(subscriptionTierEnum).min(1).max(3).optional(),
    lastMoodMin: z.number().int().min(1).max(10).optional(),
    lastMoodMax: z.number().int().min(1).max(10).optional(),
    journaledWithinDays: z.number().int().min(1).max(365).optional(),
    hasActiveSubscription: z.boolean().optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      v.lastMoodMin !== undefined &&
      v.lastMoodMax !== undefined &&
      v.lastMoodMin > v.lastMoodMax
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "lastMoodMin_gt_lastMoodMax",
        path: ["lastMoodMax"],
      });
    }
  });

export type CampaignSegment = z.infer<typeof campaignSegmentSchema>;

const ACTIVE_SUB_STATUSES = ["ACTIVE", "TRIALING", "PAST_DUE"] as const;

function buildWhere(filter: CampaignSegment): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = { deletedAt: null };

  if (filter.tier || filter.hasActiveSubscription) {
    where.subscription = {
      ...(filter.tier && { tier: { in: filter.tier } }),
      ...(filter.hasActiveSubscription && {
        status: { in: [...ACTIVE_SUB_STATUSES] },
      }),
    };
  }

  if (filter.journaledWithinDays) {
    const since = new Date(
      Date.now() - filter.journaledWithinDays * 86_400_000,
    );
    where.journalEntries = {
      some: { createdAt: { gte: since }, deletedAt: null },
    };
  }

  return where;
}

export async function resolveCampaignAudience(
  filter: CampaignSegment,
  options: { cap?: number } = {},
): Promise<string[]> {
  const cap = Math.min(options.cap ?? AUDIENCE_HARD_CAP, AUDIENCE_HARD_CAP);
  const where = buildWhere(filter);

  const rows = await prisma.user.findMany({
    where,
    select: { id: true },
    take: cap,
    orderBy: { id: "asc" },
  });

  return rows.map((r) => r.id);
}

export async function countCampaignAudience(
  filter: CampaignSegment,
  options: { cap?: number } = {},
): Promise<number> {
  const cap = Math.min(options.cap ?? AUDIENCE_HARD_CAP, AUDIENCE_HARD_CAP);
  const ids = await resolveCampaignAudience(filter, { cap });
  return ids.length;
}
