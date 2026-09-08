"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { decodeCursor, paginateCursor } from "@/lib/pagination";
import {
  RateLimitedError,
  NotFoundError,
  EntitlementRequiredError,
} from "@/lib/errors";
import { userHasJourneyEntitlement } from "@/lib/entitlements";
import {
  toJourneyListDto,
  toJourneyDetailDto,
  type JourneyListDto,
  type JourneyDetailDto,
  type EnrollmentProgressDto,
} from "@/lib/dto/journey";
import {
  listJourneysSchema,
  getJourneySchema,
  enrollInJourneySchema,
  getEnrollmentProgressSchema,
  advanceJourneyDaySchema,
  type ListJourneysInput,
  type GetJourneyInput,
  type EnrollInJourneyInput,
  type GetEnrollmentProgressInput,
  type AdvanceJourneyDayInput,
} from "@/lib/validation/journeys";

const DEFAULT_TAKE = 20;

async function enforceRate(
  key: string,
  limit: number,
  windowSec: number,
): Promise<void> {
  const r = await rateLimit({ key, limit, windowSec });
  if (!r.ok) throw new RateLimitedError();
}

export async function listJourneys(
  input: ListJourneysInput = {},
): Promise<{ items: JourneyListDto[]; nextCursor: string | null }> {
  const { cursor, take = DEFAULT_TAKE } = listJourneysSchema.parse(input);
  const decoded = decodeCursor(cursor);
  const rows = await prisma.journey.findMany({
    where: {
      isActive: true,
      ...(decoded && {
        OR: [
          { createdAt: { lt: decoded.createdAt } },
          { createdAt: decoded.createdAt, id: { gt: decoded.id } },
        ],
      }),
    },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      durationDays: true,
      accessType: true,
      thumbnailUrl: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: take + 1,
  });
  const { items, nextCursor } = paginateCursor(rows, take);
  return { items: items.map(toJourneyListDto), nextCursor };
}

export async function getJourney(
  input: GetJourneyInput,
): Promise<JourneyDetailDto> {
  const { id } = getJourneySchema.parse(input);
  const row = await prisma.journey.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      durationDays: true,
      accessType: true,
      thumbnailUrl: true,
      createdAt: true,
      isActive: true,
      days: {
        select: {
          id: true,
          dayIndex: true,
          cardId: true,
          promptText: true,
          quote: true,
          audioUrl: true,
        },
        orderBy: { dayIndex: "asc" },
      },
    },
  });
  if (!row || !row.isActive) throw new NotFoundError();
  return toJourneyDetailDto(row, row.days);
}

export async function enrollInJourney(
  input: EnrollInJourneyInput,
): Promise<EnrollmentProgressDto> {
  const user = await requireUser();
  const { journeyId } = enrollInJourneySchema.parse(input);
  await enforceRate(`journey-enroll:${user.id}`, 20, 60);

  const journey = await prisma.journey.findUnique({
    where: { id: journeyId },
    select: {
      id: true,
      isActive: true,
      accessType: true,
      durationDays: true,
    },
  });
  if (!journey || !journey.isActive) throw new NotFoundError();

  const entitled = await userHasJourneyEntitlement(user.id, {
    accessType: journey.accessType,
  });
  if (!entitled) throw new EntitlementRequiredError();

  const existing = await prisma.journeyEnrollment.findUnique({
    where: { userId_journeyId: { userId: user.id, journeyId } },
    select: {
      journeyId: true,
      startedAt: true,
      currentDay: true,
      completedAt: true,
    },
  });
  if (existing) {
    return {
      journeyId: existing.journeyId,
      startedAt: existing.startedAt,
      currentDay: existing.currentDay,
      completedAt: existing.completedAt,
      durationDays: journey.durationDays,
    };
  }
  const created = await prisma.journeyEnrollment.create({
    data: { userId: user.id, journeyId },
    select: {
      journeyId: true,
      startedAt: true,
      currentDay: true,
      completedAt: true,
    },
  });
  return { ...created, durationDays: journey.durationDays };
}

export async function getEnrollmentProgress(
  input: GetEnrollmentProgressInput,
): Promise<EnrollmentProgressDto> {
  const user = await requireUser();
  const { journeyId } = getEnrollmentProgressSchema.parse(input);
  const row = await prisma.journeyEnrollment.findUnique({
    where: { userId_journeyId: { userId: user.id, journeyId } },
    select: {
      journeyId: true,
      startedAt: true,
      currentDay: true,
      completedAt: true,
      journey: { select: { durationDays: true } },
    },
  });
  if (!row) throw new NotFoundError();
  return {
    journeyId: row.journeyId,
    startedAt: row.startedAt,
    currentDay: row.currentDay,
    completedAt: row.completedAt,
    durationDays: row.journey.durationDays,
  };
}

function yyyymmdd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function advanceJourneyDay(
  input: AdvanceJourneyDayInput,
): Promise<EnrollmentProgressDto> {
  const user = await requireUser();
  const { journeyId } = advanceJourneyDaySchema.parse(input);
  await enforceRate(`journey-advance:${user.id}`, 30, 60);

  // WHY: idempotent per UTC day — sliding-window limit of 1/day acts as the guard
  const dayKey = `journey-advance-day:${user.id}:${journeyId}:${yyyymmdd(new Date())}`;
  const firstAdvance = await rateLimit({
    key: dayKey,
    limit: 1,
    windowSec: 24 * 60 * 60,
  });

  return prisma.$transaction(async (tx) => {
    const enrollment = await tx.journeyEnrollment.findUnique({
      where: { userId_journeyId: { userId: user.id, journeyId } },
      select: {
        id: true,
        startedAt: true,
        currentDay: true,
        completedAt: true,
        journey: { select: { durationDays: true } },
      },
    });
    if (!enrollment) throw new NotFoundError();

    const duration = enrollment.journey.durationDays;
    if (enrollment.completedAt || !firstAdvance.ok) {
      return {
        journeyId,
        startedAt: enrollment.startedAt,
        currentDay: enrollment.currentDay,
        completedAt: enrollment.completedAt,
        durationDays: duration,
      };
    }

    const isLast = enrollment.currentDay >= duration;
    const updated = await tx.journeyEnrollment.update({
      where: { id: enrollment.id },
      data: isLast
        ? { completedAt: new Date() }
        : { currentDay: Math.min(enrollment.currentDay + 1, duration) },
      select: {
        journeyId: true,
        startedAt: true,
        currentDay: true,
        completedAt: true,
      },
    });
    return { ...updated, durationDays: duration };
  });
}

