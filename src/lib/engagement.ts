import { prisma } from "@/lib/db";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";

function yyyymmdd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

export async function incrementCardUsageOnDraw(cardId: string): Promise<void> {
  try {
    const today = startOfUtcDay(new Date());
    await prisma.cardUsageStat.upsert({
      where: { date_cardId: { date: today, cardId } },
      update: { draws: { increment: 1 } },
      create: { date: today, cardId, draws: 1 },
    });
  } catch (err) {
    logger.warn({ err, cardId }, "card_usage_stat_failed");
  }
}

export type EngagementKind = "draw" | "journal" | "mood" | "save";

export async function bumpEngagementSignal(
  userId: string,
  kind: EngagementKind,
): Promise<void> {
  try {
    const day = yyyymmdd(new Date());
    const dedupKey = `engagement:dedup:${userId}:${kind}:${day}`;
    const firstOfDay = await redis.set(dedupKey, "1", "EX", 60 * 60 * 36, "NX");
    if (firstOfDay !== "OK") return;
    const counterKey = `engagement:counter:${kind}:${day}`;
    await redis.incr(counterKey);
    await redis.expire(counterKey, 60 * 60 * 72);
  } catch (err) {
    logger.warn({ err, userId, kind }, "engagement_bump_failed");
  }
}
