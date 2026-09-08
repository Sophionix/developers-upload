"use server";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { logAdminAction } from "@/lib/audit";
import { invalidateTag } from "@/lib/cache";
import { decodeCursor, paginateKeyset } from "@/lib/pagination";
import { NotFoundError, ValidationError } from "@/lib/errors";
import {
  toAdminCardDetailDto,
  toAdminCardListDto,
  type AdminCardDetailDto,
  type AdminCardListDto,
} from "@/lib/dto/admin-content";
import {
  createCardSchema,
  deleteCardSchema,
  listCardsSchema,
  updateCardSchema,
  type CreateCardInput,
  type DeleteCardInput,
  type ListCardsInput,
  type UpdateCardInput,
} from "@/lib/validation/admin-content";
import { assertContentAdmin, isPrismaKnownError } from "./_content-helpers";

const CARDS_TAG = "cards";
const CARD_LIST_SELECT = {
  id: true,
  deckId: true,
  title: true,
  imageUrl: true,
  iconKey: true,
  accessType: true,
  guestPreview: true,
  isActive: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CardSelect;

const CARD_DETAIL_SELECT = {
  ...CARD_LIST_SELECT,
  message: true,
  prompt: true,
} satisfies Prisma.CardSelect;

export async function adminListCards(
  input: ListCardsInput,
): Promise<{ items: AdminCardListDto[]; nextCursor: string | null }> {
  await assertContentAdmin();
  const {
    cursor,
    take = 20,
    deckId,
    accessType,
    isActive,
    search,
  } = listCardsSchema.parse(input);
  const decoded = decodeCursor(cursor);

  const where: Prisma.CardWhereInput = {
    ...(deckId && { deckId }),
    ...(accessType && { accessType }),
    ...(isActive !== undefined && { isActive }),
    ...(search && { title: { contains: search } }),
    ...(decoded && {
      OR: [
        { createdAt: { lt: decoded.createdAt } },
        { createdAt: decoded.createdAt, id: { lt: decoded.id } },
      ],
    }),
  };

  const rows = await prisma.card.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    select: CARD_LIST_SELECT,
  });

  const page = paginateKeyset(rows, take, false);
  return {
    items: page.rows.map(toAdminCardListDto),
    nextCursor: page.nextCursor,
  };
}

async function assertDeckExists(deckId: string): Promise<void> {
  const deck = await prisma.deck.findUnique({
    where: { id: deckId },
    select: { id: true },
  });
  if (!deck) throw new NotFoundError("deck_not_found");
}

async function assertThemesExist(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const found = await prisma.theme.count({ where: { id: { in: ids } } });
  if (found !== ids.length) throw new ValidationError("invalid_theme_ids");
}

async function assertTagsExist(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const found = await prisma.tag.count({ where: { id: { in: ids } } });
  if (found !== ids.length) throw new ValidationError("invalid_tag_ids");
}

export async function adminGetCard(
  cardId: string,
): Promise<AdminCardDetailDto> {
  await assertContentAdmin();
  const row = await prisma.card.findUnique({
    where: { id: cardId },
    select: CARD_DETAIL_SELECT,
  });
  if (!row) throw new NotFoundError("card_not_found");
  const themes = await prisma.cardTheme.findMany({
    where: { cardId },
    select: { themeId: true },
  });
  const tags = await prisma.cardTag.findMany({
    where: { cardId },
    select: { tagId: true },
  });
  return toAdminCardDetailDto(
    row,
    themes.map((t) => t.themeId),
    tags.map((t) => t.tagId),
  );
}

export async function adminCreateCard(
  input: CreateCardInput,
): Promise<AdminCardDetailDto> {
  const { userId } = await assertContentAdmin();
  const data = createCardSchema.parse(input);

  await assertDeckExists(data.deckId);
  await assertThemesExist(data.themeIds);
  await assertTagsExist(data.tagIds);

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.card.create({
      data: {
        deckId: data.deckId,
        title: data.title,
        message: data.message,
        prompt: data.prompt ?? null,
        imageUrl: data.imageUrl ?? null,
        iconKey: data.iconKey ?? null,
        accessType: data.accessType,
        guestPreview: data.guestPreview,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
      },
      select: CARD_DETAIL_SELECT,
    });
    if (data.themeIds.length > 0) {
      await tx.cardTheme.createMany({
        data: data.themeIds.map((themeId) => ({ cardId: created.id, themeId })),
      });
    }
    if (data.tagIds.length > 0) {
      await tx.cardTag.createMany({
        data: data.tagIds.map((tagId) => ({ cardId: created.id, tagId })),
      });
    }
    return created;
  });

  await invalidateTag(CARDS_TAG);
  await logAdminAction({
    actorId: userId,
    action: "CREATE",
    entity: "Card",
    entityId: row.id,
    meta: { deckId: row.deckId, accessType: row.accessType },
  });
  return toAdminCardDetailDto(row, data.themeIds, data.tagIds);
}

export async function adminUpdateCard(
  input: UpdateCardInput,
): Promise<AdminCardDetailDto> {
  const { userId } = await assertContentAdmin();
  const { id, ...changes } = updateCardSchema.parse(input);

  const existing = await prisma.card.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError("card_not_found");

  if (changes.deckId) await assertDeckExists(changes.deckId);
  if (changes.themeIds) await assertThemesExist(changes.themeIds);
  if (changes.tagIds) await assertTagsExist(changes.tagIds);

  const data: Prisma.CardUpdateInput = {
    ...(changes.deckId !== undefined && {
      deck: { connect: { id: changes.deckId } },
    }),
    ...(changes.title !== undefined && { title: changes.title }),
    ...(changes.message !== undefined && { message: changes.message }),
    ...(changes.prompt !== undefined && { prompt: changes.prompt }),
    ...(changes.imageUrl !== undefined && { imageUrl: changes.imageUrl }),
    ...(changes.iconKey !== undefined && { iconKey: changes.iconKey }),
    ...(changes.accessType !== undefined && { accessType: changes.accessType }),
    ...(changes.guestPreview !== undefined && {
      guestPreview: changes.guestPreview,
    }),
    ...(changes.isActive !== undefined && { isActive: changes.isActive }),
    ...(changes.sortOrder !== undefined && { sortOrder: changes.sortOrder }),
  };

  const { row, themeIds, tagIds } = await prisma.$transaction(async (tx) => {
    const updated = await tx.card.update({
      where: { id },
      data,
      select: CARD_DETAIL_SELECT,
    });
    if (changes.themeIds) {
      await tx.cardTheme.deleteMany({ where: { cardId: id } });
      if (changes.themeIds.length > 0) {
        await tx.cardTheme.createMany({
          data: changes.themeIds.map((themeId) => ({ cardId: id, themeId })),
        });
      }
    }
    if (changes.tagIds) {
      await tx.cardTag.deleteMany({ where: { cardId: id } });
      if (changes.tagIds.length > 0) {
        await tx.cardTag.createMany({
          data: changes.tagIds.map((tagId) => ({ cardId: id, tagId })),
        });
      }
    }
    const themes = await tx.cardTheme.findMany({
      where: { cardId: id },
      select: { themeId: true },
    });
    const tags = await tx.cardTag.findMany({
      where: { cardId: id },
      select: { tagId: true },
    });
    return {
      row: updated,
      themeIds: themes.map((t) => t.themeId),
      tagIds: tags.map((t) => t.tagId),
    };
  });

  await invalidateTag(CARDS_TAG);
  await logAdminAction({
    actorId: userId,
    action: "UPDATE",
    entity: "Card",
    entityId: row.id,
    meta: { changedKeys: Object.keys(changes) },
  });
  return toAdminCardDetailDto(row, themeIds, tagIds);
}

export async function adminDeleteCard(
  input: DeleteCardInput,
): Promise<{ ok: true }> {
  const { userId } = await assertContentAdmin();
  const { id } = deleteCardSchema.parse(input);

  try {
    await prisma.card.update({
      where: { id },
      data: { isActive: false },
      select: { id: true },
    });
  } catch (err) {
    if (isPrismaKnownError(err, "P2025"))
      throw new NotFoundError("card_not_found");
    throw err;
  }

  await invalidateTag(CARDS_TAG);
  await logAdminAction({
    actorId: userId,
    action: "DELETE",
    entity: "Card",
    entityId: id,
    meta: { softDelete: true },
  });
  return { ok: true };
}

