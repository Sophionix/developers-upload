"use server";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { logAdminAction } from "@/lib/audit";
import { invalidateTag } from "@/lib/cache";
import { ConflictError, NotFoundError } from "@/lib/errors";
import type { AdminTaxonomyDto } from "@/lib/dto/admin-content";
import {
  createCategorySchema,
  deleteCategorySchema,
  listCategoriesSchema,
  updateCategorySchema,
  type CreateCategoryInput,
  type DeleteCategoryInput,
  type ListCategoriesInput,
  type UpdateCategoryInput,
} from "@/lib/validation/admin-content";
import {
  assertContentAdmin,
  isPrismaKnownError,
  slugify,
} from "./_content-helpers";

const CATEGORIES_TAG = "categories";
const CATEGORY_SELECT = {
  id: true,
  slug: true,
  name: true,
} satisfies Prisma.CategorySelect;

export async function adminListCategories(
  input: ListCategoriesInput,
): Promise<{ items: AdminTaxonomyDto[]; nextCursor: string | null }> {
  await assertContentAdmin();
  const { cursor, take = 20, search } = listCategoriesSchema.parse(input);

  const where: Prisma.CategoryWhereInput = {
    ...(search && {
      OR: [{ name: { contains: search } }, { slug: { contains: search } }],
    }),
    ...(cursor && { id: { lt: cursor } }),
  };

  const rows = await prisma.category.findMany({
    where,
    orderBy: [{ id: "desc" }],
    take: take + 1,
    select: CATEGORY_SELECT,
  });

  const hasNext = rows.length > take;
  const trimmed = hasNext ? rows.slice(0, take) : rows;
  const last = trimmed[trimmed.length - 1];
  const nextCursor = hasNext && last ? last.id : null;

  return { items: trimmed, nextCursor };
}

export async function adminCreateCategory(
  input: CreateCategoryInput,
): Promise<AdminTaxonomyDto> {
  const { userId } = await assertContentAdmin();
  const data = createCategorySchema.parse(input);
  const finalSlug = data.slug ?? slugify(data.name);

  try {
    const row = await prisma.category.create({
      data: { slug: finalSlug, name: data.name },
      select: CATEGORY_SELECT,
    });
    await invalidateTag(CATEGORIES_TAG);
    await logAdminAction({
      actorId: userId,
      action: "CREATE",
      entity: "Category",
      entityId: row.id,
      meta: { slug: row.slug },
    });
    return row;
  } catch (err) {
    if (isPrismaKnownError(err, "P2002")) throw new ConflictError("slug_taken");
    throw err;
  }
}

export async function adminUpdateCategory(
  input: UpdateCategoryInput,
): Promise<AdminTaxonomyDto> {
  const { userId } = await assertContentAdmin();
  const { id, ...changes } = updateCategorySchema.parse(input);

  const data: Prisma.CategoryUpdateInput = {
    ...(changes.slug !== undefined && { slug: changes.slug }),
    ...(changes.name !== undefined && { name: changes.name }),
  };

  try {
    const row = await prisma.category.update({
      where: { id },
      data,
      select: CATEGORY_SELECT,
    });
    await invalidateTag(CATEGORIES_TAG);
    await logAdminAction({
      actorId: userId,
      action: "UPDATE",
      entity: "Category",
      entityId: row.id,
      meta: { changedKeys: Object.keys(data) },
    });
    return row;
  } catch (err) {
    if (isPrismaKnownError(err, "P2025"))
      throw new NotFoundError("category_not_found");
    if (isPrismaKnownError(err, "P2002")) throw new ConflictError("slug_taken");
    throw err;
  }
}

export async function adminDeleteCategory(
  input: DeleteCategoryInput,
): Promise<{ ok: true }> {
  const { userId } = await assertContentAdmin();
  const { id } = deleteCategorySchema.parse(input);

  const existing = await prisma.category.findUnique({
    where: { id },
    select: { id: true, _count: { select: { prompts: true } } },
  });
  if (!existing) throw new NotFoundError("category_not_found");
  if (existing._count.prompts > 0) throw new ConflictError("category_in_use");

  await prisma.category.delete({ where: { id } });

  await invalidateTag(CATEGORIES_TAG);
  await logAdminAction({
    actorId: userId,
    action: "DELETE",
    entity: "Category",
    entityId: id,
  });
  return { ok: true };
}
