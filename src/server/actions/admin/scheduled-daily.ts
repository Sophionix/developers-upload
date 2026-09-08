"use server";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { logAdminAction } from "@/lib/audit";
import { invalidateTag } from "@/lib/cache";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { AdminScheduledDailyCardDto } from "@/lib/dto/admin-content";
import {
  listScheduledDailyCardsSchema,
  scheduleDailyCardSchema,
  unscheduleDailyCardSchema,
  type ListScheduledDailyCardsInput,
  type ScheduleDailyCardInput,
  type UnscheduleDailyCardInput,
} from "@/lib/validation/admin-content";
import { assertContentAdmin, isPrismaKnownError } from "./_content-helpers";

const SCHEDULED_TAG = "scheduled-daily";
const SCHEDULED_SELECT = {
  id: true,
  date: true,
  cardId: true,
  isGlobal: true,
  createdAt: true,
} satisfies Prisma.ScheduledDailyCardSelect;

function parseUtcDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function todayUtcMidnight(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export async function adminListScheduledDailyCards(
  input: ListScheduledDailyCardsInput,
): Promise<{ items: AdminScheduledDailyCardDto[] }> {
  await assertContentAdmin();
  const { month } = listScheduledDailyCardsSchema.parse(input);

  const [yearStr, monthStr] = month.split("-");
  const year = Number.parseInt(yearStr ?? "", 10);
  const monthNum = Number.parseInt(monthStr ?? "", 10);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(monthNum) ||
    monthNum < 1 ||
    monthNum > 12
  ) {
    throw new ValidationError("invalid_month");
  }

  const start = new Date(Date.UTC(year, monthNum - 1, 1));
  const end = new Date(Date.UTC(year, monthNum, 1));

  const rows = await prisma.scheduledDailyCard.findMany({
    where: { date: { gte: start, lt: end } },
    orderBy: { date: "asc" },
    select: SCHEDULED_SELECT,
  });
  return { items: rows };
}

export async function adminScheduleDailyCard(
  input: ScheduleDailyCardInput,
): Promise<AdminScheduledDailyCardDto> {
  const { userId } = await assertContentAdmin();
  const { date, cardId } = scheduleDailyCardSchema.parse(input);

  const target = parseUtcDate(date);
  const today = todayUtcMidnight();
  if (target < today) {
    throw new ValidationError("cannot_schedule_past");
  }

  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: { id: true, isActive: true },
  });
  if (!card) throw new NotFoundError("card_not_found");
  if (!card.isActive) throw new ConflictError("card_inactive");

  try {
    const row = await prisma.scheduledDailyCard.upsert({
      where: { date: target },
      create: { date: target, cardId, isGlobal: true },
      update: { cardId },
      select: SCHEDULED_SELECT,
    });
    await invalidateTag(SCHEDULED_TAG);
    await logAdminAction({
      actorId: userId,
      action: "UPDATE",
      entity: "ScheduledDailyCard",
      entityId: row.id,
      meta: { date, cardId },
    });
    // Phase 10: enqueue push notification job for subscribers.
    logger.info({ date, cardId }, "daily_card_scheduled_push_enqueue_stub");
    return row;
  } catch (err) {
    if (isPrismaKnownError(err, "P2002"))
      throw new ConflictError("date_taken");
    throw err;
  }
}

export async function adminUnscheduleDailyCard(
  input: UnscheduleDailyCardInput,
): Promise<{ ok: true }> {
  const { userId } = await assertContentAdmin();
  const { date } = unscheduleDailyCardSchema.parse(input);

  const target = parseUtcDate(date);
  const today = todayUtcMidnight();
  if (target < today) {
    throw new ValidationError("cannot_modify_past");
  }

  try {
    const row = await prisma.scheduledDailyCard.delete({
      where: { date: target },
      select: { id: true },
    });
    await invalidateTag(SCHEDULED_TAG);
    await logAdminAction({
      actorId: userId,
      action: "DELETE",
      entity: "ScheduledDailyCard",
      entityId: row.id,
      meta: { date },
    });
    return { ok: true };
  } catch (err) {
    if (isPrismaKnownError(err, "P2025"))
      throw new NotFoundError("schedule_not_found");
    throw err;
  }
}
