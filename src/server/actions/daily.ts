"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { withCache } from "@/lib/cache";
import { RateLimitedError, NotFoundError } from "@/lib/errors";
import { getUserPremiumStatus } from "@/lib/entitlements";
import { bumpEngagementSignal } from "@/lib/engagement";
import { getCard } from "@/server/actions/content";
import type { CardDetailDto } from "@/lib/dto/card";
import type { Mood } from "@/generated/prisma/enums";
import {
  logMoodSchema,
  getMoodTrendsSchema,
  drawRandomCardSchema,
  type LogMoodInput,
  type GetMoodTrendsInput,
  type DrawRandomCardInput,
} from "@/lib/validation/content";

const MOOD_DEDUPE_WINDOW_SEC = 60;
const DAILY_CACHE_TTL_SEC = 60 * 60 * 12;

async function enforceRate(
  key: string,
  limit: number,
  windowSec: number,
): Promise<void> {
  const r = await rateLimit({ key, limit, windowSec });
  if (!r.ok) throw new RateLimitedError();
}

function yyyymmdd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

async function bumpCardUsage(cardId: string, kind: "draws"): Promise<void> {
  const today = startOfUtcDay(new Date());
  await prisma.cardUsageStat
    .upsert({
      where: { date_cardId: { date: today, cardId } },
      update: { [kind]: { increment: 1 } },
      create: { date: today, cardId, [kind]: 1 },
    })
;
}

async function pickRandomEntitledCard(opts: {
  userId: string;
  premium: boolean;
  filters?: { deckId?: string; themeId?: string; tagId?: string };
}): Promise<string | null> {
  const { userId, premium, filters } = opts;
  const unlocks = premium
    ? []
    : await prisma.cardUnlock.findMany({
        where: { userId, status: "SUCCEEDED" },
        select: { cardId: true },
      });
  const unlockedIds = unlocks.map((u) => u.cardId);

  const candidates = await prisma.card.findMany({
    where: {
      isActive: true,
      ...(filters?.deckId && { deckId: filters.deckId }),
      ...(filters?.themeId && {
        themes: { some: { themeId: filters.themeId } },
      }),
      ...(filters?.tagId && { tags: { some: { tagId: filters.tagId } } }),
      ...(!premium && {
        OR: [
          { accessType: "FREE" },
          ...(unlockedIds.length > 0 ? [{ id: { in: unlockedIds } }] : []),
        ],
      }),
    },
    select: { id: true },
  });
  if (candidates.length === 0) return null;
  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  return picked?.id ?? null;
}

export async function drawDailyCard(): Promise<CardDetailDto> {
  const user = await requireUser();
  await enforceRate(`draw-daily:${user.id}`, 30, 60);

  const today = startOfUtcDay(new Date());
  const key = `cache:v1:daily:${user.id}:${yyyymmdd(today)}`;
  const cardId = await withCache(
    key,
    `daily:${user.id}`,
    DAILY_CACHE_TTL_SEC,
    async () => {
      const scheduled = await prisma.scheduledDailyCard.findUnique({
        where: { date: today },
        select: { cardId: true, card: { select: { isActive: true } } },
      });
      let pickedId: string | null = null;
      let source: "SCHEDULED" | "DAILY" = "DAILY";
      if (scheduled && scheduled.card.isActive) {
        pickedId = scheduled.cardId;
        source = "SCHEDULED";
      } else {
        const premium = (await getUserPremiumStatus(user.id)).active;
        pickedId = await pickRandomEntitledCard({ userId: user.id, premium });
      }
      if (!pickedId) throw new NotFoundError();

      await prisma.$transaction(async (tx) => {
        await tx.cardDraw.create({
          data: { userId: user.id, cardId: pickedId, source },
        });
      });
      await bumpCardUsage(pickedId, "draws");
      await bumpEngagementSignal(user.id, "draw");
      return pickedId;
    },
  );

  return getCard({ id: cardId });
}

export async function drawRandomCard(
  input: DrawRandomCardInput = {},
): Promise<CardDetailDto> {
  const user = await requireUser();
  const parsed = drawRandomCardSchema.parse(input);
  await enforceRate(`draw-random:${user.id}`, 60, 60);

  const premium = (await getUserPremiumStatus(user.id)).active;
  const cardId = await pickRandomEntitledCard({
    userId: user.id,
    premium,
    filters: {
      ...(parsed.deckId !== undefined && { deckId: parsed.deckId }),
      ...(parsed.themeId !== undefined && { themeId: parsed.themeId }),
      ...(parsed.tagId !== undefined && { tagId: parsed.tagId }),
    },
  });
  if (!cardId) throw new NotFoundError();

  await prisma.cardDraw.create({
    data: { userId: user.id, cardId, source: "RANDOM" },
  });
  await bumpCardUsage(cardId, "draws");
  await bumpEngagementSignal(user.id, "draw");
  return getCard({ id: cardId });
}

export async function logMoodCheckIn(
  input: LogMoodInput,
): Promise<{ ok: true; deduped?: true; id: string }> {
  const user = await requireUser();
  const data = logMoodSchema.parse(input);
  await enforceRate(`mood:${user.id}`, 30, 60);

  const since = new Date(Date.now() - MOOD_DEDUPE_WINDOW_SEC * 1000);
  const recent = await prisma.moodCheckIn.findFirst({
    where: { userId: user.id, createdAt: { gte: since } },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  if (recent) return { ok: true, deduped: true, id: recent.id };

  const created = await prisma.moodCheckIn.create({
    data: {
      userId: user.id,
      mood: data.mood,
      note: data.note ?? null,
      linkedCardId: data.linkedCardId ?? null,
      linkedDrawId: data.linkedDrawId ?? null,
    },
    select: { id: true },
  });
  return { ok: true, id: created.id };
}

export interface MoodTrendPoint {
  date: string;
  moodDistribution: Record<Mood, number>;
}

const MOODS: Mood[] = [
  "JOYFUL",
  "CALM",
  "GRATEFUL",
  "NEUTRAL",
  "TIRED",
  "ANXIOUS",
  "SAD",
  "ANGRY",
  "STRESSED",
  "HOPEFUL",
];

function emptyDistribution(): Record<Mood, number> {
  const out = {} as Record<Mood, number>;
  for (const m of MOODS) out[m] = 0;
  return out;
}

export async function getMoodTrends(
  input: GetMoodTrendsInput,
): Promise<MoodTrendPoint[]> {
  const user = await requireUser();
  const { rangeDays } = getMoodTrendsSchema.parse(input);

  const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);
  const rows = await prisma.moodCheckIn.findMany({
    where: { userId: user.id, createdAt: { gte: since } },
    select: { mood: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const byDay = new Map<string, Record<Mood, number>>();
  for (const r of rows) {
    const day = yyyymmdd(r.createdAt);
    const bucket = byDay.get(day) ?? emptyDistribution();
    bucket[r.mood] += 1;
    byDay.set(day, bucket);
  }
  return Array.from(byDay.entries()).map(([date, moodDistribution]) => ({
    date,
    moodDistribution,
  }));
}
