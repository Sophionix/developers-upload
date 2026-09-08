"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { withCache } from "@/lib/cache";
import { decodeCursor, paginateCursor } from "@/lib/pagination";
import {
  RateLimitedError,
  NotFoundError,
  EntitlementRequiredError,
} from "@/lib/errors";
import { userHasCardEntitlement } from "@/lib/entitlements";
import { bumpEngagementSignal, incrementCardUsageOnDraw } from "@/lib/engagement";
import {
  toCardListDto,
  toCardDetailDto,
  type CardListDto,
  type CardDetailDto,
} from "@/lib/dto/card";
import type { Prisma } from "@/generated/prisma/client";
import {
  listDecksSchema,
  listCardsSchema,
  getCardSchema,
  drawRandomFromDeckSchema,
  saveCardSchema,
  saveCardGroupSchema,
  listSavedCardsSchema,
  type ListDecksInput,
  type ListCardsInput,
  type GetCardInput,
  type DrawRandomFromDeckInput,
  type SaveCardInput,
  type SaveCardGroupInput,
  type ListSavedCardsInput,
} from "@/lib/validation/content";
import { randomUUID } from "node:crypto";

const DEFAULT_TAKE = 20;
const DECK_DRAW_EXCLUDE_HOURS = 24;
const CARDS_CACHE_TAG = "cards";
const DECKS_CACHE_TAG = "cards";
const CACHE_TTL_SEC = 60;

async function enforceRate(
  key: string,
  limit: number,
  windowSec: number,
): Promise<void> {
  const r = await rateLimit({ key, limit, windowSec });
  if (!r.ok) throw new RateLimitedError();
}

export interface DeckListDto {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  sortOrder: number;
  createdAt: Date;
}

export async function listDecks(
  input: ListDecksInput = {},
): Promise<{ items: DeckListDto[]; nextCursor: string | null }> {
  const { cursor, take = DEFAULT_TAKE } = listDecksSchema.parse(input);
  const key = `cache:v1:decks:${cursor ?? "first"}:${take}`;
  return withCache(key, DECKS_CACHE_TAG, CACHE_TTL_SEC, async () => {
    const decoded = decodeCursor(cursor);
    const rows = await prisma.deck.findMany({
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
        coverUrl: true,
        sortOrder: true,
        createdAt: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }, { id: "asc" }],
      take: take + 1,
    });
    return paginateCursor(rows, take);
  });
}

interface CardScalarRow {
  id: string;
  deckId: string;
  title: string;
  message: string;
  prompt: string | null;
  imageUrl: string | null;
  iconKey: string | null;
  accessType: "FREE" | "PREMIUM";
  sortOrder: number;
  createdAt: Date;
}

async function fetchThemesAndTagsForCards(
  cardIds: string[],
): Promise<{
  byCardThemes: Map<string, string[]>;
  byCardTags: Map<string, string[]>;
}> {
  if (cardIds.length === 0) {
    return { byCardThemes: new Map(), byCardTags: new Map() };
  }
  const [themes, tags] = await Promise.all([
    prisma.cardTheme.findMany({
      where: { cardId: { in: cardIds } },
      select: { cardId: true, themeId: true },
    }),
    prisma.cardTag.findMany({
      where: { cardId: { in: cardIds } },
      select: { cardId: true, tagId: true },
    }),
  ]);
  const byCardThemes = new Map<string, string[]>();
  for (const t of themes) {
    const list = byCardThemes.get(t.cardId) ?? [];
    list.push(t.themeId);
    byCardThemes.set(t.cardId, list);
  }
  const byCardTags = new Map<string, string[]>();
  for (const t of tags) {
    const list = byCardTags.get(t.cardId) ?? [];
    list.push(t.tagId);
    byCardTags.set(t.cardId, list);
  }
  return { byCardThemes, byCardTags };
}

export async function listCards(
  input: ListCardsInput = {},
): Promise<{ items: CardListDto[]; nextCursor: string | null }> {
  const parsed = listCardsSchema.parse(input);
  const take = parsed.take ?? DEFAULT_TAKE;
  const key = `cache:v1:cards:${JSON.stringify({ ...parsed, take })}`;

  return withCache(key, CARDS_CACHE_TAG, CACHE_TTL_SEC, async () => {
    const decoded = decodeCursor(parsed.cursor);
    const where: Prisma.CardWhereInput = {
      isActive: true,
      ...(parsed.deckId && { deckId: parsed.deckId }),
      ...(parsed.accessType && { accessType: parsed.accessType }),
      ...(parsed.themeId && { themes: { some: { themeId: parsed.themeId } } }),
      ...(parsed.tagId && { tags: { some: { tagId: parsed.tagId } } }),
      ...(decoded && {
        OR: [
          { createdAt: { lt: decoded.createdAt } },
          { createdAt: decoded.createdAt, id: { gt: decoded.id } },
        ],
      }),
    };

    // PERF: ensure index on (isActive, sortOrder, createdAt, id) exists in schema.prisma
    // Current indexes cover (deckId, accessType, isActive) and (accessType, isActive, sortOrder)
    // but not the keyset cursor columns (createdAt, id) — MySQL may filesort on large tables.
    const rows = await prisma.card.findMany({
      where,
      select: {
        id: true,
        deckId: true,
        title: true,
        imageUrl: true,
        iconKey: true,
        accessType: true,
        sortOrder: true,
        createdAt: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }, { id: "asc" }],
      take: take + 1,
    });

    const { items, nextCursor } = paginateCursor(rows, take);
    const { byCardThemes, byCardTags } = await fetchThemesAndTagsForCards(
      items.map((r) => r.id),
    );
    return {
      items: items.map((r) =>
        toCardListDto(
          r,
          byCardThemes.get(r.id) ?? [],
          byCardTags.get(r.id) ?? [],
        ),
      ),
      nextCursor,
    };
  });
}

export async function getCard(input: GetCardInput): Promise<CardDetailDto> {
  const user = await requireUser();
  const { id } = getCardSchema.parse(input);

  const row = await prisma.card.findUnique({
    where: { id },
    select: {
      id: true,
      deckId: true,
      title: true,
      message: true,
      prompt: true,
      imageUrl: true,
      iconKey: true,
      accessType: true,
      sortOrder: true,
      createdAt: true,
      isActive: true,
    },
  });
  if (!row || !row.isActive) throw new NotFoundError();

  const entitled = await userHasCardEntitlement(user.id, {
    id: row.id,
    accessType: row.accessType,
  });
  if (!entitled) throw new EntitlementRequiredError();

  const { byCardThemes, byCardTags } = await fetchThemesAndTagsForCards([
    row.id,
  ]);
  return toCardDetailDto(
    row as CardScalarRow,
    byCardThemes.get(row.id) ?? [],
    byCardTags.get(row.id) ?? [],
  );
}

export async function drawRandomFromDeck(
  input: DrawRandomFromDeckInput,
): Promise<CardDetailDto> {
  const user = await requireUser();
  const { deckId } = drawRandomFromDeckSchema.parse(input);
  await enforceRate(`draw-deck:${user.id}`, 60, 60);

  const excludeSince = new Date(
    Date.now() - DECK_DRAW_EXCLUDE_HOURS * 60 * 60 * 1000,
  );
  const recent = await prisma.cardDraw.findMany({
    where: { userId: user.id, createdAt: { gte: excludeSince } },
    select: { cardId: true },
  });
  const excludeIds = recent.map((r) => r.cardId);

  const candidates = await prisma.card.findMany({
    where: {
      deckId,
      isActive: true,
      accessType: "FREE",
      ...(excludeIds.length > 0 && { id: { notIn: excludeIds } }),
    },
    select: { id: true },
  });
  const pool =
    candidates.length > 0
      ? candidates
      : await prisma.card.findMany({
          where: { deckId, isActive: true, accessType: "FREE" },
          select: { id: true },
        });
  if (pool.length === 0) throw new NotFoundError();
  const picked = pool[Math.floor(Math.random() * pool.length)];
  if (!picked) throw new NotFoundError();

  await prisma.cardDraw.create({
    data: { userId: user.id, cardId: picked.id, source: "DECK_RANDOM" },
  });
  await incrementCardUsageOnDraw(picked.id);
  await bumpEngagementSignal(user.id, "draw");

  return getCard({ id: picked.id });
}

export async function saveCard(input: SaveCardInput): Promise<{ ok: true }> {
  const user = await requireUser();
  const { cardId } = saveCardSchema.parse(input);
  await enforceRate(`save-card:${user.id}`, 60, 60);

  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: { id: true, isActive: true },
  });
  if (!card || !card.isActive) throw new NotFoundError();

  await prisma.savedCard.upsert({
    where: { userId_cardId: { userId: user.id, cardId } },
    update: {},
    create: { userId: user.id, cardId },
  });
  return { ok: true };
}

/**
 * Save a whole reading (1 or 2 cards drawn together) as one group. All cards
 * share a generated `savedGroupId` so the Saved Cards page renders the reading
 * as a single unit. Re-saving a card moves it into the newest reading's group.
 */
export async function saveCardGroup(
  input: SaveCardGroupInput,
): Promise<{ ok: true; savedGroupId: string }> {
  const user = await requireUser();
  const { cardIds } = saveCardGroupSchema.parse(input);
  await enforceRate(`save-card:${user.id}`, 60, 60);

  const uniqueIds = Array.from(new Set(cardIds));
  const cards = await prisma.card.findMany({
    where: { id: { in: uniqueIds }, isActive: true },
    select: { id: true },
  });
  if (cards.length !== uniqueIds.length) throw new NotFoundError();

  const savedGroupId = randomUUID();
  await prisma.$transaction(
    uniqueIds.map((cardId) =>
      prisma.savedCard.upsert({
        where: { userId_cardId: { userId: user.id, cardId } },
        update: { savedGroupId },
        create: { userId: user.id, cardId, savedGroupId },
      }),
    ),
  );
  return { ok: true, savedGroupId };
}

export async function unsaveCard(input: SaveCardInput): Promise<{ ok: true }> {
  const user = await requireUser();
  const { cardId } = saveCardSchema.parse(input);
  await prisma.savedCard.deleteMany({
    where: { userId: user.id, cardId },
  });
  return { ok: true };
}

export interface SavedCardDto extends CardListDto {
  savedAt: Date;
  savedGroupId: string | null;
  message: string;
  prompt: string | null;
}

export async function listSavedCards(
  input: ListSavedCardsInput = {},
): Promise<{ items: SavedCardDto[]; nextCursor: string | null }> {
  const user = await requireUser();
  const { cursor, take = DEFAULT_TAKE } = listSavedCardsSchema.parse(input);
  const decoded = decodeCursor(cursor);

  const rows = await prisma.savedCard.findMany({
    where: {
      userId: user.id,
      ...(decoded && {
        OR: [
          { createdAt: { lt: decoded.createdAt } },
          { createdAt: decoded.createdAt, cardId: { gt: decoded.id } },
        ],
      }),
    },
    select: {
      cardId: true,
      createdAt: true,
      savedGroupId: true,
      card: {
        select: {
          id: true,
          deckId: true,
          title: true,
          message: true,
          prompt: true,
          imageUrl: true,
          iconKey: true,
          accessType: true,
          sortOrder: true,
          createdAt: true,
          isActive: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { cardId: "asc" }],
    take: take + 1,
  });

  const rowsForCursor = rows.map((r) => ({
    ...r,
    id: r.cardId,
  }));
  const { items, nextCursor } = paginateCursor(rowsForCursor, take);
  const activeCardIds = items
    .filter((r) => r.card.isActive)
    .map((r) => r.card.id);
  const { byCardThemes, byCardTags } =
    await fetchThemesAndTagsForCards(activeCardIds);

  const dtos: SavedCardDto[] = items
    .filter((r) => r.card.isActive)
    .map((r) => ({
      ...toCardListDto(
        r.card,
        byCardThemes.get(r.card.id) ?? [],
        byCardTags.get(r.card.id) ?? [],
      ),
      savedAt: r.createdAt,
      savedGroupId: r.savedGroupId,
      message: r.card.message,
      prompt: r.card.prompt,
    }));
  return { items: dtos, nextCursor };
}
