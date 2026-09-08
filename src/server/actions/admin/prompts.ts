"use server";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { logAdminAction } from "@/lib/audit";
import { invalidateTag } from "@/lib/cache";
import { decodeCursor, paginateKeyset } from "@/lib/pagination";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { AdminPromptDto } from "@/lib/dto/admin-content";
import {
  createPromptSchema,
  deletePromptSchema,
  listPromptsSchema,
  updatePromptSchema,
  type CreatePromptInput,
  type DeletePromptInput,
  type ListPromptsInput,
  type UpdatePromptInput,
} from "@/lib/validation/admin-content";
import { assertContentAdmin, isPrismaKnownError } from "./_content-helpers";

const PROMPTS_TAG = "prompts";
const PROMPT_SELECT = {
  id: true,
  text: true,
  type: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.JournalPromptSelect;

async function assertCategoriesExist(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const found = await prisma.category.count({ where: { id: { in: ids } } });
  if (found !== ids.length) throw new ValidationError("invalid_category_ids");
}

async function assertThemesExist(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const found = await prisma.theme.count({ where: { id: { in: ids } } });
  if (found !== ids.length) throw new ValidationError("invalid_theme_ids");
}

export async function adminListPrompts(
  input: ListPromptsInput,
): Promise<{ items: AdminPromptDto[]; nextCursor: string | null }> {
  await assertContentAdmin();
  const {
    cursor,
    take = 20,
    type,
    isActive,
    search,
  } = listPromptsSchema.parse(input);
  const decoded = decodeCursor(cursor);

  const where: Prisma.JournalPromptWhereInput = {
    ...(type && { type }),
    ...(isActive !== undefined && { isActive }),
    ...(search && { text: { contains: search } }),
    ...(decoded && {
      OR: [
        { createdAt: { lt: decoded.createdAt } },
        { createdAt: decoded.createdAt, id: { lt: decoded.id } },
      ],
    }),
  };

  const rows = await prisma.journalPrompt.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    select: {
      ...PROMPT_SELECT,
      categories: { select: { categoryId: true } },
      themes: { select: { themeId: true } },
    },
  });

  const page = paginateKeyset(rows, take, false);
  const items: AdminPromptDto[] = page.rows.map((r) => ({
    id: r.id,
    text: r.text,
    type: r.type,
    isActive: r.isActive,
    categoryIds: r.categories.map((c) => c.categoryId),
    themeIds: r.themes.map((t) => t.themeId),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
  return { items, nextCursor: page.nextCursor };
}

export async function adminCreatePrompt(
  input: CreatePromptInput,
): Promise<AdminPromptDto> {
  const { userId } = await assertContentAdmin();
  const data = createPromptSchema.parse(input);

  await assertCategoriesExist(data.categoryIds);
  await assertThemesExist(data.themeIds);

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.journalPrompt.create({
      data: { text: data.text, type: data.type, isActive: data.isActive },
      select: PROMPT_SELECT,
    });
    if (data.categoryIds.length > 0) {
      await tx.promptCategory.createMany({
        data: data.categoryIds.map((categoryId) => ({
          promptId: created.id,
          categoryId,
        })),
      });
    }
    if (data.themeIds.length > 0) {
      await tx.promptTheme.createMany({
        data: data.themeIds.map((themeId) => ({
          promptId: created.id,
          themeId,
        })),
      });
    }
    return created;
  });

  await invalidateTag(PROMPTS_TAG);
  await logAdminAction({
    actorId: userId,
    action: "CREATE",
    entity: "JournalPrompt",
    entityId: row.id,
    meta: { type: row.type },
  });
  return {
    ...row,
    categoryIds: data.categoryIds,
    themeIds: data.themeIds,
  };
}

export async function adminUpdatePrompt(
  input: UpdatePromptInput,
): Promise<AdminPromptDto> {
  const { userId } = await assertContentAdmin();
  const { id, ...changes } = updatePromptSchema.parse(input);

  const existing = await prisma.journalPrompt.findUnique({
    where: { id },
    select: {
      id: true,
      categories: { select: { categoryId: true } },
      themes: { select: { themeId: true } },
    },
  });
  if (!existing) throw new NotFoundError("prompt_not_found");

  const nextCategoryIds =
    changes.categoryIds ?? existing.categories.map((c) => c.categoryId);
  const nextThemeIds =
    changes.themeIds ?? existing.themes.map((t) => t.themeId);

  if (nextCategoryIds.length === 0 && nextThemeIds.length === 0) {
    throw new ValidationError("category_or_theme_required");
  }

  if (changes.categoryIds) await assertCategoriesExist(changes.categoryIds);
  if (changes.themeIds) await assertThemesExist(changes.themeIds);

  const data: Prisma.JournalPromptUpdateInput = {
    ...(changes.text !== undefined && { text: changes.text }),
    ...(changes.type !== undefined && { type: changes.type }),
    ...(changes.isActive !== undefined && { isActive: changes.isActive }),
  };

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.journalPrompt.update({
      where: { id },
      data,
      select: PROMPT_SELECT,
    });
    if (changes.categoryIds) {
      await tx.promptCategory.deleteMany({ where: { promptId: id } });
      if (changes.categoryIds.length > 0) {
        await tx.promptCategory.createMany({
          data: changes.categoryIds.map((categoryId) => ({
            promptId: id,
            categoryId,
          })),
        });
      }
    }
    if (changes.themeIds) {
      await tx.promptTheme.deleteMany({ where: { promptId: id } });
      if (changes.themeIds.length > 0) {
        await tx.promptTheme.createMany({
          data: changes.themeIds.map((themeId) => ({ promptId: id, themeId })),
        });
      }
    }
    return updated;
  });

  await invalidateTag(PROMPTS_TAG);
  await logAdminAction({
    actorId: userId,
    action: "UPDATE",
    entity: "JournalPrompt",
    entityId: row.id,
    meta: { changedKeys: Object.keys(changes) },
  });
  return {
    ...row,
    categoryIds: nextCategoryIds,
    themeIds: nextThemeIds,
  };
}

export async function adminDeletePrompt(
  input: DeletePromptInput,
): Promise<{ ok: true }> {
  const { userId } = await assertContentAdmin();
  const { id } = deletePromptSchema.parse(input);

  try {
    await prisma.journalPrompt.update({
      where: { id },
      data: { isActive: false },
      select: { id: true },
    });
  } catch (err) {
    if (isPrismaKnownError(err, "P2025"))
      throw new NotFoundError("prompt_not_found");
    throw err;
  }

  await invalidateTag(PROMPTS_TAG);
  await logAdminAction({
    actorId: userId,
    action: "DELETE",
    entity: "JournalPrompt",
    entityId: id,
    meta: { softDelete: true },
  });
  return { ok: true };
}
