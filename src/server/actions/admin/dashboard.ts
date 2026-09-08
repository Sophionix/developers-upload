"use server";

import { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { requireRole } from "@/lib/rbac";
import { withCache } from "@/lib/cache";
import { decodeCursor, encodeCursor } from "@/lib/pagination";
import {
  activityFeedSchema,
  cardUsageSchema,
  cohortRangeSchema,
  rangeSchema,
  type ActivityFeedInput,
  type CardUsageInput,
  type CohortRangeInput,
  type RangeInput,
} from "@/lib/validation/admin-analytics";
import type {
  ActivityFeedDto,
  ActivityFeedItem,
  AdminOverviewDto,
  CardUsageDto,
  ChurnIndicatorsDto,
  DauWauMauDto,
  MoodTrendsDto,
  RetentionCohortDto,
  SubscriptionSummaryDto,
} from "@/lib/dto/admin-analytics";

const OVERVIEW_TAG = "admin-overview";
const ANALYTICS_TAG = "admin-analytics";

async function assertSuperAdmin(): Promise<{ userId: string }> {
  await requireUser();
  const { userId } = await requireRole([UserRole.SUPER_ADMIN]);
  return { userId };
}

function rangeStart(days: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return d;
}

export async function adminGetOverview(): Promise<AdminOverviewDto> {
  await assertSuperAdmin();
  return withCache("admin:overview:v1", OVERVIEW_TAG, 60, async () => {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const [totalUsers, activeSubscriptions, premiumUsers, latestStat, dailyCardDraws, totalJournalEntries] =
      await Promise.all([
        prisma.user.count({ where: { deletedAt: null } }),
        prisma.subscription.count({
          where: { status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } },
        }),
        prisma.subscription.count({
          where: { tier: "PREMIUM", status: { in: ["ACTIVE", "TRIALING"] } },
        }),
        prisma.dailyPlatformStat.findFirst({
          orderBy: { date: "desc" },
          select: { revenueCents: true },
        }),
        prisma.cardDraw.count({
          where: { createdAt: { gte: todayStart } },
        }),
        prisma.journalEntry.count({
          where: { deletedAt: null, isDraft: false },
        }),
      ]);
    const mrrCents = latestStat ? latestStat.revenueCents * 30 : 0;
    return { totalUsers, activeSubscriptions, premiumUsers, mrrCents, dailyCardDraws, totalJournalEntries };
  });
}

export async function adminGetSubscriptionSummary(): Promise<SubscriptionSummaryDto> {
  await assertSuperAdmin();
  return withCache(
    "admin:subs-summary:v1",
    ANALYTICS_TAG,
    60,
    async () => {
      const grouped = await prisma.subscription.groupBy({
        by: ["tier", "status"],
        _count: { _all: true },
      });
      const distribution = grouped.map((g) => ({
        tier: g.tier,
        status: g.status,
        count: g._count._all,
      }));
      const since = rangeStart(30);
      const stats = await prisma.dailyPlatformStat.findMany({
        where: { date: { gte: since } },
        select: { churnCount: true, paidConversions: true },
      });
      const totalChurn = stats.reduce((a, s) => a + s.churnCount, 0);
      const totalConversions = stats.reduce(
        (a, s) => a + s.paidConversions,
        0,
      );
      const denom = totalConversions + totalChurn;
      const churnRate30d = denom > 0 ? totalChurn / denom : 0;
      return { distribution, churnRate30d };
    },
  );
}

export async function adminGetActivityFeed(
  input: ActivityFeedInput,
): Promise<ActivityFeedDto> {
  await assertSuperAdmin();
  const { cursor, take = 20 } = activityFeedSchema.parse(input);
  const decoded = decodeCursor(cursor);
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const cursorFilter = decoded
    ? {
        OR: [
          { createdAt: { lt: decoded.createdAt } },
          { createdAt: decoded.createdAt, id: { lt: decoded.id } },
        ],
      }
    : {};

  const [audits, payments] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where: { createdAt: { gte: since }, ...cursorFilter },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
      select: {
        id: true,
        actorId: true,
        action: true,
        entity: true,
        entityId: true,
        createdAt: true,
      },
    }),
    prisma.payment.findMany({
      where: { createdAt: { gte: since }, ...cursorFilter },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
      select: {
        id: true,
        userId: true,
        amountCents: true,
        currency: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  const items: ActivityFeedItem[] = [
    ...audits.map((a) => ({
      id: a.id,
      kind: "audit" as const,
      createdAt: a.createdAt,
      actorId: a.actorId,
      summary: `${a.action} ${a.entity}${a.entityId ? `:${a.entityId}` : ""}`,
    })),
    ...payments.map((p) => ({
      id: p.id,
      kind: "payment" as const,
      createdAt: p.createdAt,
      actorId: p.userId,
      summary: `payment ${p.status} ${p.amountCents}${p.currency}`,
    })),
  ]
    .sort((a, b) => {
      const d = b.createdAt.getTime() - a.createdAt.getTime();
      return d !== 0 ? d : b.id.localeCompare(a.id);
    })
    .slice(0, take + 1);

  const hasMore = items.length > take;
  const page = hasMore ? items.slice(0, take) : items;
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null;
  return { items: page, nextCursor };
}

export async function adminGetDauWauMau(
  input: RangeInput,
): Promise<DauWauMauDto> {
  await assertSuperAdmin();
  const { rangeDays } = rangeSchema.parse(input);
  return withCache(
    `admin:dau-wau-mau:${rangeDays}`,
    ANALYTICS_TAG,
    300,
    async () => {
      const since = rangeStart(rangeDays);
      const rows = await prisma.dailyPlatformStat.findMany({
        where: { date: { gte: since } },
        orderBy: { date: "asc" },
        select: { date: true, dau: true, wau: true, mau: true },
      });
      return {
        points: rows.map((r) => ({
          date: r.date.toISOString().slice(0, 10),
          dau: r.dau,
          wau: r.wau,
          mau: r.mau,
        })),
      };
    },
  );
}

export async function adminGetRetentionCohorts(
  input: CohortRangeInput,
): Promise<RetentionCohortDto> {
  await assertSuperAdmin();
  const { cohortMonths } = cohortRangeSchema.parse(input);
  return withCache(
    `admin:retention:${cohortMonths}`,
    ANALYTICS_TAG,
    300,
    async () => {
      const since = new Date();
      since.setUTCMonth(since.getUTCMonth() - cohortMonths);
      since.setUTCHours(0, 0, 0, 0);
      const rows = await prisma.retentionCohort.findMany({
        where: { cohortDate: { gte: since } },
        orderBy: [{ cohortDate: "asc" }, { dayOffset: "asc" }],
      });
      return {
        points: rows.map((r) => ({
          cohortDate: r.cohortDate.toISOString().slice(0, 10),
          dayOffset: r.dayOffset,
          size: r.size,
          retained: r.retained,
        })),
      };
    },
  );
}

export async function adminGetMoodTrends(
  input: RangeInput,
): Promise<MoodTrendsDto> {
  await assertSuperAdmin();
  const { rangeDays } = rangeSchema.parse(input);
  return withCache(
    `admin:mood-trends:${rangeDays}`,
    ANALYTICS_TAG,
    300,
    async () => {
      const since = rangeStart(rangeDays);
      const rows = await prisma.dailyPlatformStat.findMany({
        where: { date: { gte: since } },
        orderBy: { date: "asc" },
        select: { date: true, moodDistribution: true },
      });
      return {
        points: rows.map((r) => ({
          date: r.date.toISOString().slice(0, 10),
          distribution:
            r.moodDistribution && typeof r.moodDistribution === "object"
              ? (r.moodDistribution as Record<string, number>)
              : {},
        })),
      };
    },
  );
}

export async function adminGetCardUsage(
  input: CardUsageInput,
): Promise<CardUsageDto> {
  await assertSuperAdmin();
  const { rangeDays, top } = cardUsageSchema.parse(input);
  return withCache(
    `admin:card-usage:${rangeDays}:${top}`,
    ANALYTICS_TAG,
    300,
    async () => {
      const since = rangeStart(rangeDays);
      const grouped = await prisma.cardUsageStat.groupBy({
        by: ["cardId"],
        where: { date: { gte: since } },
        _sum: { draws: true, saves: true, unlocks: true },
        orderBy: { _sum: { draws: "desc" } },
        take: top,
      });
      const cardIds = grouped.map((g) => g.cardId);
      const cards = cardIds.length
        ? await prisma.card.findMany({
            where: { id: { in: cardIds } },
            select: { id: true, title: true },
          })
        : [];
      const nameById = new Map(cards.map((c) => [c.id, c.title]));
      return {
        rows: grouped.map((g) => ({
          cardId: g.cardId,
          cardName: nameById.get(g.cardId) ?? "(unknown)",
          draws: g._sum.draws ?? 0,
          saves: g._sum.saves ?? 0,
          unlocks: g._sum.unlocks ?? 0,
        })),
      };
    },
  );
}

export async function adminGetChurnIndicators(
  input: RangeInput,
): Promise<ChurnIndicatorsDto> {
  await assertSuperAdmin();
  const { rangeDays } = rangeSchema.parse(input);
  return withCache(
    `admin:churn:${rangeDays}`,
    ANALYTICS_TAG,
    300,
    async () => {
      const since = rangeStart(rangeDays);
      const agg = await prisma.dailyPlatformStat.aggregate({
        where: { date: { gte: since } },
        _sum: {
          churnCount: true,
          paidConversions: true,
          revenueCents: true,
        },
      });
      const cancellations = await prisma.subscription.count({
        where: {
          canceledAt: { gte: since },
        },
      });
      return {
        cancellations,
        churnCount: agg._sum.churnCount ?? 0,
        paidConversions: agg._sum.paidConversions ?? 0,
        revenueCents: agg._sum.revenueCents ?? 0,
      };
    },
  );
}

