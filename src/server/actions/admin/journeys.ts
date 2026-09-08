"use server";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { logAdminAction } from "@/lib/audit";
import { invalidateTag } from "@/lib/cache";
import { decodeCursor, paginateKeyset } from "@/lib/pagination";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import type {
  AdminJourneyDayDto,
  AdminJourneyListDto,
} from "@/lib/dto/admin-content";
import {
  createJourneySchema,
  deleteJourneyDaySchema,
  deleteJourneySchema,
  listJourneyDaysSchema,
  listJourneysSchema,
  reorderJourneyDaysSchema,
  updateJourneySchema,
  upsertJourneyDaySchema,
  type CreateJourneyInput,
  type DeleteJourneyDayInput,
  type DeleteJourneyInput,
  type ListJourneyDaysInput,
  type ListJourneysInput,
  type ReorderJourneyDaysInput,
  type UpdateJourneyInput,
  type UpsertJourneyDayInput,
} from "@/lib/validation/admin-content";
import {
  assertContentAdmin,
  isPrismaKnownError,
  slugify,
} from "./_content-helpers";

const JOURNEYS_TAG = "journeys";
const JOURNEY_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  durationDays: true,
  accessType: true,
  thumbnailUrl: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.JourneySelect;

const DAY_SELECT = {
  id: true,
  journeyId: true,
  dayIndex: true,
  cardId: true,
  promptText: true,
  quote: true,
  audioUrl: true,
} satisfies Prisma.JourneyDaySelect;

export async function adminListJourneys(
  input: ListJourneysInput,
): Promise<{ items: AdminJourneyListDto[]; nextCursor: string | null }> {
  await assertContentAdmin();
  const {
    cursor,
    take = 20,
    isActive,
    accessType,
    search,
  } = listJourneysSchema.parse(input);
  const decoded = decodeCursor(cursor);

  const where: Prisma.JourneyWhereInput = {
    ...(isActive !== undefined && { isActive }),
    ...(accessType && { accessType }),
    ...(search && {
      OR: [{ title: { contains: search } }, { slug: { contains: search } }],
    }),
    ...(decoded && {
      OR: [
        { createdAt: { lt: decoded.createdAt } },
        { createdAt: decoded.createdAt, id: { lt: decoded.id } },
      ],
    }),
  };

  const rows = await prisma.journey.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    select: JOURNEY_SELECT,
  });

  const page = paginateKeyset(rows, take, false);
  return { items: page.rows, nextCursor: page.nextCursor };
}

export async function adminCreateJourney(
  input: CreateJourneyInput,
): Promise<AdminJourneyListDto> {
  const { userId } = await assertContentAdmin();
  const data = createJourneySchema.parse(input);
  const finalSlug = data.slug ?? slugify(data.title);

  try {
    const row = await prisma.journey.create({
      data: {
        slug: finalSlug,
        title: data.title,
        description: data.description,
        durationDays: data.durationDays,
        accessType: data.accessType,
        thumbnailUrl: data.thumbnailUrl ?? null,
        isActive: data.isActive,
      },
      select: JOURNEY_SELECT,
    });
    await invalidateTag(JOURNEYS_TAG);
    await logAdminAction({
      actorId: userId,
      action: "CREATE",
      entity: "Journey",
      entityId: row.id,
      meta: { slug: row.slug },
    });
    return row;
  } catch (err) {
    if (isPrismaKnownError(err, "P2002")) throw new ConflictError("slug_taken");
    throw err;
  }
}

export async function adminUpdateJourney(
  input: UpdateJourneyInput,
): Promise<AdminJourneyListDto> {
  const { userId } = await assertContentAdmin();
  const { id, ...changes } = updateJourneySchema.parse(input);

  const data: Prisma.JourneyUpdateInput = {
    ...(changes.slug !== undefined && { slug: changes.slug }),
    ...(changes.title !== undefined && { title: changes.title }),
    ...(changes.description !== undefined && {
      description: changes.description,
    }),
    ...(changes.durationDays !== undefined && {
      durationDays: changes.durationDays,
    }),
    ...(changes.accessType !== undefined && { accessType: changes.accessType }),
    ...(changes.thumbnailUrl !== undefined && {
      thumbnailUrl: changes.thumbnailUrl,
    }),
    ...(changes.isActive !== undefined && { isActive: changes.isActive }),
  };

  try {
    const row = await prisma.journey.update({
      where: { id },
      data,
      select: JOURNEY_SELECT,
    });
    await invalidateTag(JOURNEYS_TAG);
    await logAdminAction({
      actorId: userId,
      action: "UPDATE",
      entity: "Journey",
      entityId: row.id,
      meta: { changedKeys: Object.keys(data) },
    });
    return row;
  } catch (err) {
    if (isPrismaKnownError(err, "P2025"))
      throw new NotFoundError("journey_not_found");
    if (isPrismaKnownError(err, "P2002")) throw new ConflictError("slug_taken");
    throw err;
  }
}

export async function adminDeleteJourney(
  input: DeleteJourneyInput,
): Promise<{ ok: true }> {
  const { userId } = await assertContentAdmin();
  const { id } = deleteJourneySchema.parse(input);

  try {
    await prisma.journey.update({
      where: { id },
      data: { isActive: false },
      select: { id: true },
    });
  } catch (err) {
    if (isPrismaKnownError(err, "P2025"))
      throw new NotFoundError("journey_not_found");
    throw err;
  }

  await invalidateTag(JOURNEYS_TAG);
  await logAdminAction({
    actorId: userId,
    action: "DELETE",
    entity: "Journey",
    entityId: id,
    meta: { softDelete: true },
  });
  return { ok: true };
}

export async function adminListJourneyDays(
  input: ListJourneyDaysInput,
): Promise<{ items: AdminJourneyDayDto[] }> {
  await assertContentAdmin();
  const { journeyId } = listJourneyDaysSchema.parse(input);

  const journey = await prisma.journey.findUnique({
    where: { id: journeyId },
    select: { id: true },
  });
  if (!journey) throw new NotFoundError("journey_not_found");

  const rows = await prisma.journeyDay.findMany({
    where: { journeyId },
    orderBy: { dayIndex: "asc" },
    select: DAY_SELECT,
  });
  return { items: rows };
}

export async function adminUpsertJourneyDay(
  input: UpsertJourneyDayInput,
): Promise<AdminJourneyDayDto> {
  const { userId } = await assertContentAdmin();
  const data = upsertJourneyDaySchema.parse(input);

  const journey = await prisma.journey.findUnique({
    where: { id: data.journeyId },
    select: { id: true },
  });
  if (!journey) throw new NotFoundError("journey_not_found");

  if (data.cardId) {
    const card = await prisma.card.findUnique({
      where: { id: data.cardId },
      select: { id: true },
    });
    if (!card) throw new NotFoundError("card_not_found");
  }

  try {
    const row = await prisma.journeyDay.upsert({
      where: {
        journeyId_dayIndex: {
          journeyId: data.journeyId,
          dayIndex: data.dayIndex,
        },
      },
      create: {
        journeyId: data.journeyId,
        dayIndex: data.dayIndex,
        cardId: data.cardId ?? null,
        promptText: data.promptText ?? null,
        quote: data.quote ?? null,
        audioUrl: data.audioUrl ?? null,
      },
      update: {
        cardId: data.cardId ?? null,
        promptText: data.promptText ?? null,
        quote: data.quote ?? null,
        audioUrl: data.audioUrl ?? null,
      },
      select: DAY_SELECT,
    });
    await invalidateTag(JOURNEYS_TAG);
    await logAdminAction({
      actorId: userId,
      action: "UPDATE",
      entity: "JourneyDay",
      entityId: row.id,
      meta: { journeyId: row.journeyId, dayIndex: row.dayIndex },
    });
    return row;
  } catch (err) {
    if (isPrismaKnownError(err, "P2002"))
      throw new ConflictError("day_index_taken");
    throw err;
  }
}

export async function adminDeleteJourneyDay(
  input: DeleteJourneyDayInput,
): Promise<{ ok: true }> {
  const { userId } = await assertContentAdmin();
  const { id } = deleteJourneyDaySchema.parse(input);

  try {
    const row = await prisma.journeyDay.delete({
      where: { id },
      select: { id: true, journeyId: true },
    });
    await invalidateTag(JOURNEYS_TAG);
    await logAdminAction({
      actorId: userId,
      action: "DELETE",
      entity: "JourneyDay",
      entityId: row.id,
      meta: { journeyId: row.journeyId },
    });
    return { ok: true };
  } catch (err) {
    if (isPrismaKnownError(err, "P2025"))
      throw new NotFoundError("journey_day_not_found");
    throw err;
  }
}

export async function adminReorderJourneyDays(
  input: ReorderJourneyDaysInput,
): Promise<{ ok: true }> {
  const { userId } = await assertContentAdmin();
  const { journeyId, orderedIds } = reorderJourneyDaysSchema.parse(input);

  const uniqueIds = new Set(orderedIds);
  if (uniqueIds.size !== orderedIds.length) {
    throw new ValidationError("duplicate_day_ids");
  }

  const days = await prisma.journeyDay.findMany({
    where: { id: { in: orderedIds } },
    select: { id: true, journeyId: true },
  });
  if (days.length !== orderedIds.length) {
    throw new NotFoundError("journey_day_not_found");
  }
  if (days.some((d) => d.journeyId !== journeyId)) {
    throw new ValidationError("journey_mismatch");
  }

  const offset = orderedIds.length + 1000;
  await prisma.$transaction(async (tx) => {
    // Two-phase: move all rows out of the [1..N] range to avoid unique clashes.
    await Promise.all(
      orderedIds.map((id, idx) =>
        tx.journeyDay.update({
          where: { id },
          data: { dayIndex: offset + idx },
        }),
      ),
    );
    await Promise.all(
      orderedIds.map((id, idx) =>
        tx.journeyDay.update({
          where: { id },
          data: { dayIndex: idx + 1 },
        }),
      ),
    );
  });

  await invalidateTag(JOURNEYS_TAG);
  await logAdminAction({
    actorId: userId,
    action: "UPDATE",
    entity: "Journey",
    entityId: journeyId,
    meta: { reordered: orderedIds.length },
  });
  return { ok: true };
}
