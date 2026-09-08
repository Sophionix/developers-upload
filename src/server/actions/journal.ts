"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { invalidateTag } from "@/lib/cache";
import { logger } from "@/lib/logger";
import { NotFoundError, RateLimitedError, ValidationError } from "@/lib/errors";
import { encodeCursor, decodeCursor } from "@/lib/pagination";
import { sanitizeJournalHtml } from "@/lib/sanitize";
import {
  createJournalEntrySchema,
  updateJournalEntrySchema,
  autosaveJournalDraftSchema,
  deleteJournalEntrySchema,
  getJournalEntrySchema,
  listTagSuggestionsSchema,
  listJournalEntriesSchema,
  getJournalCalendarSchema,
  searchJournalSchema,
  requestJournalExportSchema,
  type CreateJournalEntryInput,
  type UpdateJournalEntryInput,
  type AutosaveJournalDraftInput,
  type DeleteJournalEntryInput,
  type GetJournalEntryInput,
  type ListTagSuggestionsInput,
  type ListJournalEntriesInput,
  type GetJournalCalendarInput,
  type SearchJournalInput,
  type RequestJournalExportInput,
} from "@/lib/validation/journal";
import type {
  JournalEntryDto,
  JournalEntryListItemDto,
  JournalListPageDto,
  JournalCalendarDayDto,
  JournalSearchPageDto,
  JournalTagDto,
  TagSuggestionDto,
} from "@/lib/dto/journal";
import type { Mood, Prisma } from "@/generated/prisma/client";

const SNIPPET_LEN = 200;

async function enforceRate(
  key: string,
  limit: number,
  windowSec: number,
): Promise<void> {
  const result = await rateLimit({ key, limit, windowSec });
  if (!result.ok) throw new RateLimitedError();
}

function slugifyTag(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function makeSnippet(plain: string): string {
  const trimmed = plain.trim();
  if (trimmed.length <= SNIPPET_LEN) return trimmed;
  return `${trimmed.slice(0, SNIPPET_LEN).trimEnd()}…`;
}

async function upsertTagsAndLink(
  tx: Prisma.TransactionClient,
  entryId: string,
  names: string[] | undefined,
  replace: boolean,
): Promise<void> {
  if (names === undefined) return;

  const unique = Array.from(
    new Map(
      names
        .map((n) => {
          const slug = slugifyTag(n);
          return [slug, { slug, name: n.trim().slice(0, 80) }] as const;
        })
        .filter(([slug]) => slug.length > 0),
    ).values(),
  );

  if (replace) {
    await tx.journalEntryTag.deleteMany({ where: { entryId } });
  }

  if (unique.length === 0) return;

  const slugs = unique.map((t) => t.slug);
  const existing = await tx.tag.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true },
  });
  const existingBySlug = new Map(existing.map((t) => [t.slug, t.id]));

  const missing = unique.filter((t) => !existingBySlug.has(t.slug));
  if (missing.length > 0) {
    await tx.tag.createMany({
      data: missing.map((t) => ({ slug: t.slug, name: t.name })),
      skipDuplicates: true,
    });
    const refetched = await tx.tag.findMany({
      where: { slug: { in: missing.map((t) => t.slug) } },
      select: { id: true, slug: true },
    });
    for (const t of refetched) existingBySlug.set(t.slug, t.id);
  }

  const links = unique
    .map((t) => existingBySlug.get(t.slug))
    .filter((id): id is string => typeof id === "string")
    .map((tagId) => ({ entryId, tagId }));

  if (links.length > 0) {
    await tx.journalEntryTag.createMany({
      data: links,
      skipDuplicates: true,
    });
  }
}

async function loadTagsForEntries(
  entryIds: string[],
): Promise<Map<string, JournalTagDto[]>> {
  const out = new Map<string, JournalTagDto[]>();
  if (entryIds.length === 0) return out;
  const rows = await prisma.journalEntryTag.findMany({
    where: { entryId: { in: entryIds } },
    select: {
      entryId: true,
      tag: { select: { id: true, slug: true, name: true } },
    },
  });
  for (const r of rows) {
    const list = out.get(r.entryId) ?? [];
    list.push(r.tag);
    out.set(r.entryId, list);
  }
  return out;
}

export async function createJournalEntry(
  input: CreateJournalEntryInput,
): Promise<{ id: string }> {
  const user = await requireUser();
  const data = createJournalEntrySchema.parse(input);
  await enforceRate(`journal-create:${user.id}`, 20, 60);

  const { html, plain } = sanitizeJournalHtml(data.bodyHtml);

  const created = await prisma.$transaction(async (tx) => {
    const entry = await tx.journalEntry.create({
      data: {
        userId: user.id,
        title: data.title ?? null,
        bodyHtml: html,
        bodyPlain: plain,
        cardId: data.cardId ?? null,
        drawId: data.drawId ?? null,
        moodCheckInId: data.moodCheckInId ?? null,
        isDraft: data.isDraft ?? false,
      },
      select: { id: true },
    });
    await tx.journalEntryVersion.create({
      data: { entryId: entry.id, bodyHtml: html },
    });
    await upsertTagsAndLink(tx, entry.id, data.tags, false);
    return entry;
  });

  await invalidateTag(`journal:${user.id}`);
  return { id: created.id };
}

export async function updateJournalEntry(
  input: UpdateJournalEntryInput,
): Promise<{ ok: true }> {
  const user = await requireUser();
  const data = updateJournalEntrySchema.parse(input);
  await enforceRate(`journal-update:${user.id}`, 60, 60);

  const existing = await prisma.journalEntry.findFirst({
    where: { id: data.id, userId: user.id, deletedAt: null },
    select: { id: true, bodyHtml: true },
  });
  if (!existing) throw new NotFoundError();

  let nextHtml: string | undefined;
  let nextPlain: string | undefined;
  const bodyChanged =
    data.bodyHtml !== undefined && data.bodyHtml !== existing.bodyHtml;
  if (data.bodyHtml !== undefined) {
    const sanitized = sanitizeJournalHtml(data.bodyHtml);
    nextHtml = sanitized.html;
    nextPlain = sanitized.plain;
  }

  await prisma.$transaction(async (tx) => {
    await tx.journalEntry.update({
      where: { id: existing.id },
      data: {
        ...(data.title !== undefined && { title: data.title ?? null }),
        ...(nextHtml !== undefined && { bodyHtml: nextHtml }),
        ...(nextPlain !== undefined && { bodyPlain: nextPlain }),
        ...(data.cardId !== undefined && { cardId: data.cardId }),
        ...(data.moodCheckInId !== undefined && {
          moodCheckInId: data.moodCheckInId,
        }),
        ...(data.isDraft !== undefined && { isDraft: data.isDraft }),
      },
    });
    if (bodyChanged && nextHtml !== undefined) {
      await tx.journalEntryVersion.create({
        data: { entryId: existing.id, bodyHtml: nextHtml },
      });
    }
    await upsertTagsAndLink(tx, existing.id, data.tags, true);
  });

  await invalidateTag(`journal:${user.id}`);
  return { ok: true };
}

export async function autosaveJournalDraft(
  input: AutosaveJournalDraftInput,
): Promise<{ id: string }> {
  const user = await requireUser();
  const data = autosaveJournalDraftSchema.parse(input);
  await enforceRate(`journal-autosave:${user.id}`, 30, 60);

  const { html, plain } = sanitizeJournalHtml(data.bodyHtml);

  if (data.id) {
    const existing = await prisma.journalEntry.findFirst({
      where: { id: data.id, userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError();
    await prisma.journalEntry.update({
      where: { id: existing.id },
      data: {
        ...(data.title !== undefined && { title: data.title ?? null }),
        bodyHtml: html,
        bodyPlain: plain,
        ...(data.cardId !== undefined && { cardId: data.cardId }),
        isDraft: true,
      },
    });
    return { id: existing.id };
  }

  const created = await prisma.journalEntry.create({
    data: {
      userId: user.id,
      title: data.title ?? null,
      bodyHtml: html,
      bodyPlain: plain,
      cardId: data.cardId ?? null,
      isDraft: true,
    },
    select: { id: true },
  });
  return { id: created.id };
}

export async function deleteJournalEntry(
  input: DeleteJournalEntryInput,
): Promise<{ ok: true }> {
  const user = await requireUser();
  const { id } = deleteJournalEntrySchema.parse(input);
  await enforceRate(`journal-delete:${user.id}`, 30, 60);

  const existing = await prisma.journalEntry.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError();

  await prisma.journalEntry.update({
    where: { id: existing.id },
    data: { deletedAt: new Date() },
  });
  await invalidateTag(`journal:${user.id}`);
  return { ok: true };
}

export async function getJournalEntry(
  input: GetJournalEntryInput,
): Promise<JournalEntryDto> {
  const user = await requireUser();
  const { id } = getJournalEntrySchema.parse(input);

  const row = await prisma.journalEntry.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    select: {
      id: true,
      title: true,
      bodyHtml: true,
      bodyPlain: true,
      cardId: true,
      drawId: true,
      moodCheckInId: true,
      isDraft: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!row) throw new NotFoundError();

  const [tagRows, voiceRows] = await Promise.all([
    prisma.journalEntryTag.findMany({
      where: { entryId: row.id },
      select: { tag: { select: { id: true, slug: true, name: true } } },
    }),
    prisma.voiceNote.findMany({
      where: { entryId: row.id },
      select: {
        id: true,
        storagePath: true,
        durationMs: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return {
    ...row,
    tags: tagRows.map((t) => t.tag),
    voiceNotes: voiceRows,
  };
}

export async function listTagSuggestions(
  input: ListTagSuggestionsInput,
): Promise<TagSuggestionDto[]> {
  await requireUser();
  const { prefix } = listTagSuggestionsSchema.parse(input);
  const slug = slugifyTag(prefix);
  if (!slug) return [];

  const rows = await prisma.tag.findMany({
    where: { slug: { startsWith: slug } },
    select: { id: true, slug: true, name: true },
    take: 10,
    orderBy: { slug: "asc" },
  });
  return rows;
}

export async function listJournalEntries(
  input: ListJournalEntriesInput,
): Promise<JournalListPageDto> {
  const user = await requireUser();
  const data = listJournalEntriesSchema.parse(input);

  const take = data.take;
  const cursor = decodeCursor(data.cursor);

  const titleQ = data.titleContains?.trim();
  const tagTokens = data.tagTokens?.length
    ? Array.from(new Set(data.tagTokens.map((t) => t.trim()).filter(Boolean)))
    : [];

  const tagTokenClauses: Prisma.JournalEntryWhereInput[] = tagTokens.map(
    (token) => {
      const slug = slugifyTag(token);
      const tagOr: Prisma.TagWhereInput[] = [
        { name: { contains: token } },
      ];
      if (slug.length > 0) tagOr.unshift({ slug });
      return {
        tags: {
          some: {
            tag: { OR: tagOr },
          },
        },
      };
    },
  );

  const where: Prisma.JournalEntryWhereInput = {
    userId: user.id,
    deletedAt: null,
    ...(data.includeDrafts ? {} : { isDraft: false }),
    ...(data.cardId && { cardId: data.cardId }),
    ...(data.moods && data.moods.length > 0
      ? { moodCheckIn: { mood: { in: data.moods as Mood[] } } }
      : {}),
    ...(data.from || data.to
      ? {
          createdAt: {
            ...(data.from && { gte: new Date(data.from) }),
            ...(data.to && { lte: new Date(data.to) }),
          },
        }
      : {}),
    ...(data.tagIds && data.tagIds.length > 0
      ? { tags: { some: { tagId: { in: data.tagIds } } } }
      : {}),
    ...(titleQ
      ? { title: { contains: titleQ } }
      : {}),
    ...(tagTokenClauses.length > 0 ? { AND: tagTokenClauses } : {}),
    ...(cursor && {
      OR: [
        { createdAt: { lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, id: { lt: cursor.id } },
      ],
    }),
  };

  const rows = await prisma.journalEntry.findMany({
    where,
    select: {
      id: true,
      title: true,
      bodyPlain: true,
      cardId: true,
      moodCheckInId: true,
      isDraft: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
  });

  const hasNext = rows.length > take;
  const page = hasNext ? rows.slice(0, take) : rows;
  const last = page[page.length - 1];
  const nextCursor =
    hasNext && last
      ? encodeCursor({ createdAt: last.createdAt, id: last.id })
      : null;

  const tagsByEntry = await loadTagsForEntries(page.map((r) => r.id));

  const items: JournalEntryListItemDto[] = page.map((r) => ({
    id: r.id,
    title: r.title,
    snippet: makeSnippet(r.bodyPlain),
    cardId: r.cardId,
    moodCheckInId: r.moodCheckInId,
    isDraft: r.isDraft,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    tags: tagsByEntry.get(r.id) ?? [],
  }));

  return { items, nextCursor };
}

export async function getJournalCalendar(
  input: GetJournalCalendarInput,
): Promise<JournalCalendarDayDto[]> {
  const user = await requireUser();
  const { month } = getJournalCalendarSchema.parse(input);

  const [yearStr, monthStr] = month.split("-");
  const year = Number.parseInt(yearStr ?? "", 10);
  const m = Number.parseInt(monthStr ?? "", 10);
  if (!Number.isFinite(year) || !Number.isFinite(m) || m < 1 || m > 12) {
    throw new ValidationError("invalid_month");
  }
  const start = new Date(Date.UTC(year, m - 1, 1));
  const end = new Date(
    Date.UTC(m === 12 ? year + 1 : year, m === 12 ? 0 : m, 1),
  );

  const rows = await prisma.$queryRaw<Array<{ d: Date; c: bigint }>>`
    SELECT DATE(createdAt) AS d, COUNT(*) AS c
    FROM JournalEntry
    WHERE userId = ${user.id}
      AND deletedAt IS NULL
      AND isDraft = false
      AND createdAt >= ${start}
      AND createdAt < ${end}
    GROUP BY DATE(createdAt)
    ORDER BY d ASC
  `;

  return rows.map((r) => {
    const d = r.d instanceof Date ? r.d : new Date(r.d);
    return {
      date: d.toISOString().slice(0, 10),
      count: Number(r.c),
    };
  });
}

export async function searchJournal(
  input: SearchJournalInput,
): Promise<JournalSearchPageDto> {
  const user = await requireUser();
  const data = searchJournalSchema.parse(input);
  await enforceRate(`journal-search:${user.id}`, 60, 60);

  const take = data.take;
  const cursor = decodeCursor(data.cursor);
  const q = data.q.trim();

  type Row = {
    id: string;
    title: string | null;
    bodyPlain: string;
    createdAt: Date;
  };

  let rows: Row[];
  if (q.length >= 3) {
    const cursorCreatedAt =
      cursor?.createdAt ?? new Date("9999-12-31T23:59:59Z");
    const cursorId = cursor?.id ?? "~";
    rows = await prisma.$queryRaw<Row[]>`
      SELECT id, title, bodyPlain, createdAt
      FROM JournalEntry
      WHERE userId = ${user.id}
        AND deletedAt IS NULL
        AND isDraft = false
        AND MATCH(bodyPlain) AGAINST (${q} IN NATURAL LANGUAGE MODE)
        AND (createdAt < ${cursorCreatedAt}
             OR (createdAt = ${cursorCreatedAt} AND id < ${cursorId}))
      ORDER BY createdAt DESC, id DESC
      LIMIT ${take + 1}
    `;
  } else {
    rows = await prisma.journalEntry.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        isDraft: false,
        bodyPlain: { startsWith: q },
        ...(cursor && {
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } },
          ],
        }),
      },
      select: { id: true, title: true, bodyPlain: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
    });
  }

  const hasNext = rows.length > take;
  const page = hasNext ? rows.slice(0, take) : rows;
  const last = page[page.length - 1];
  const nextCursor =
    hasNext && last
      ? encodeCursor({ createdAt: last.createdAt, id: last.id })
      : null;

  return {
    items: page.map((r) => ({
      id: r.id,
      title: r.title,
      snippet: makeSnippet(r.bodyPlain),
      createdAt: r.createdAt,
    })),
    nextCursor,
  };
}

export async function requestJournalExport(
  input: RequestJournalExportInput,
): Promise<{ exportRequestId: string }> {
  const user = await requireUser();
  const data = requestJournalExportSchema.parse(input);
  await enforceRate(`journal-export:${user.id}`, 5, 60);

  const filters: Record<string, unknown> = {};
  if (data.tagIds) filters.tagIds = data.tagIds;
  if (data.cardId) filters.cardId = data.cardId;
  if (data.moods) filters.moods = data.moods;
  if (data.from) filters.from = data.from;
  if (data.to) filters.to = data.to;

  const hasFilters = Object.keys(filters).length > 0;
  const row = await prisma.exportRequest.create({
    data: {
      userId: user.id,
      scope: "JOURNAL_FULL",
      format: data.format,
      status: "QUEUED",
      ...(hasFilters && { filters: filters as Prisma.InputJsonValue }),
    },
    select: { id: true },
  });

  logger.info(
    { userId: user.id, exportRequestId: row.id, format: data.format },
    "journal_export_enqueue_stub",
  );
  return { exportRequestId: row.id };
}
