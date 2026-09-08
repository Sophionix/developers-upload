"use server";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { logAdminAction } from "@/lib/audit";
import { invalidateTag } from "@/lib/cache";
import { decodeCursor, paginateKeyset } from "@/lib/pagination";
import { ConflictError, NotFoundError } from "@/lib/errors";
import type { AdminDeckDto } from "@/lib/dto/admin-content";
import {
  createDeckSchema,
  deleteDeckSchema,
  listDecksSchema,
  updateDeckSchema,
  type CreateDeckInput,
  type DeleteDeckInput,
  type ListDecksInput,
  type UpdateDeckInput,
} from "@/lib/validation/admin-content";
import {
  assertContentAdmin,
  isPrismaKnownError,
  slugify,
} from "./_content-helpers";

const CARDS_TAG = "cards";
const DECK_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  coverUrl: true,
  sortOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DeckSelect;

export async function adminListDecks(
  input: ListDecksInput,
): Promise<{ items: AdminDeckDto[]; nextCursor: string | null }> {
  await assertContentAdmin();
  const { cursor, take = 20, isActive, search } = listDecksSchema.parse(input);
  const decoded = decodeCursor(cursor);

  const where: Prisma.DeckWhereInput = {
    ...(isActive !== undefined && { isActive }),
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

  const rows = await prisma.deck.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    select: DECK_SELECT,
  });

  const page = paginateKeyset(rows, take, false);
  return { items: page.rows, nextCursor: page.nextCursor };
}

export async function adminCreateDeck(
  input: CreateDeckInput,
): Promise<AdminDeckDto> {
  const { userId } = await assertContentAdmin();
  const data = createDeckSchema.parse(input);
  const finalSlug = data.slug ?? slugify(data.title);

  try {
    const row = await prisma.deck.create({
      data: {
        slug: finalSlug,
        title: data.title,
        description: data.description ?? null,
        coverUrl: data.coverUrl ?? null,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
      },
      select: DECK_SELECT,
    });
    await invalidateTag(CARDS_TAG);
    await logAdminAction({
      actorId: userId,
      action: "CREATE",
      entity: "Deck",
      entityId: row.id,
      meta: { slug: row.slug },
    });
    return row;
  } catch (err) {
    if (isPrismaKnownError(err, "P2002")) throw new ConflictError("slug_taken");
    throw err;
  }
}

export async function adminUpdateDeck(
  input: UpdateDeckInput,
): Promise<AdminDeckDto> {
  const { userId } = await assertContentAdmin();
  const { id, ...changes } = updateDeckSchema.parse(input);

  const data: Prisma.DeckUpdateInput = {
    ...(changes.slug !== undefined && { slug: changes.slug }),
    ...(changes.title !== undefined && { title: changes.title }),
    ...(changes.description !== undefined && {
      description: changes.description,
    }),
    ...(changes.coverUrl !== undefined && { coverUrl: changes.coverUrl }),
    ...(changes.sortOrder !== undefined && { sortOrder: changes.sortOrder }),
    ...(changes.isActive !== undefined && { isActive: changes.isActive }),
  };

  try {
    const row = await prisma.deck.update({
      where: { id },
      data,
      select: DECK_SELECT,
    });
    await invalidateTag(CARDS_TAG);
    await logAdminAction({
      actorId: userId,
      action: "UPDATE",
      entity: "Deck",
      entityId: row.id,
      meta: { changedKeys: Object.keys(data) },
    });
    return row;
  } catch (err) {
    if (isPrismaKnownError(err, "P2025")) throw new NotFoundError("deck_not_found");
    if (isPrismaKnownError(err, "P2002")) throw new ConflictError("slug_taken");
    throw err;
  }
}

export async function adminDeleteDeck(
  input: DeleteDeckInput,
): Promise<{ ok: true }> {
  const { userId } = await assertContentAdmin();
  const { id } = deleteDeckSchema.parse(input);

  const existing = await prisma.deck.findUnique({
    where: { id },
    select: { id: true, isActive: true, _count: { select: { cards: true } } },
  });
  if (!existing) throw new NotFoundError("deck_not_found");

  if (existing.isActive && existing._count.cards > 0) {
    throw new ConflictError("reassign_required");
  }

  if (existing.isActive) {
    await prisma.deck.update({ where: { id }, data: { isActive: false } });
  }

  await invalidateTag(CARDS_TAG);
  await logAdminAction({
    actorId: userId,
    action: "DELETE",
    entity: "Deck",
    entityId: id,
    meta: { softDelete: true },
  });
  return { ok: true };
}
