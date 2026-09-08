"use server";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { logAdminAction } from "@/lib/audit";
import { invalidateTag } from "@/lib/cache";
import { decodeCursor, paginateKeyset } from "@/lib/pagination";
import { ConflictError, NotFoundError } from "@/lib/errors";
import type { AdminTaxonomyDto } from "@/lib/dto/admin-content";
import {
  createThemeSchema,
  deleteThemeSchema,
  listThemesSchema,
  updateThemeSchema,
  type CreateThemeInput,
  type DeleteThemeInput,
  type ListThemesInput,
  type UpdateThemeInput,
} from "@/lib/validation/admin-content";
import {
  assertContentAdmin,
  isPrismaKnownError,
  slugify,
} from "./_content-helpers";

const THEMES_TAG = "themes";
const THEME_SELECT = {
  id: true,
  slug: true,
  name: true,
  createdAt: true,
} satisfies Prisma.ThemeSelect;

export async function adminListThemes(
  input: ListThemesInput,
): Promise<{ items: AdminTaxonomyDto[]; nextCursor: string | null }> {
  await assertContentAdmin();
  const { cursor, take = 20, search } = listThemesSchema.parse(input);
  const decoded = decodeCursor(cursor);

  const where: Prisma.ThemeWhereInput = {
    ...(search && {
      OR: [{ name: { contains: search } }, { slug: { contains: search } }],
    }),
    ...(decoded && {
      OR: [
        { createdAt: { lt: decoded.createdAt } },
        { createdAt: decoded.createdAt, id: { lt: decoded.id } },
      ],
    }),
  };

  const rows = await prisma.theme.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    select: THEME_SELECT,
  });

  const page = paginateKeyset(rows, take, false);
  return { items: page.rows, nextCursor: page.nextCursor };
}

export async function adminCreateTheme(
  input: CreateThemeInput,
): Promise<AdminTaxonomyDto> {
  const { userId } = await assertContentAdmin();
  const data = createThemeSchema.parse(input);
  const finalSlug = data.slug ?? slugify(data.name);

  try {
    const row = await prisma.theme.create({
      data: { slug: finalSlug, name: data.name },
      select: THEME_SELECT,
    });
    await invalidateTag(THEMES_TAG);
    await logAdminAction({
      actorId: userId,
      action: "CREATE",
      entity: "Theme",
      entityId: row.id,
      meta: { slug: row.slug },
    });
    return row;
  } catch (err) {
    if (isPrismaKnownError(err, "P2002")) throw new ConflictError("slug_taken");
    throw err;
  }
}

export async function adminUpdateTheme(
  input: UpdateThemeInput,
): Promise<AdminTaxonomyDto> {
  const { userId } = await assertContentAdmin();
  const { id, ...changes } = updateThemeSchema.parse(input);

  const data: Prisma.ThemeUpdateInput = {
    ...(changes.slug !== undefined && { slug: changes.slug }),
    ...(changes.name !== undefined && { name: changes.name }),
  };

  try {
    const row = await prisma.theme.update({
      where: { id },
      data,
      select: THEME_SELECT,
    });
    await invalidateTag(THEMES_TAG);
    await logAdminAction({
      actorId: userId,
      action: "UPDATE",
      entity: "Theme",
      entityId: row.id,
      meta: { changedKeys: Object.keys(data) },
    });
    return row;
  } catch (err) {
    if (isPrismaKnownError(err, "P2025"))
      throw new NotFoundError("theme_not_found");
    if (isPrismaKnownError(err, "P2002")) throw new ConflictError("slug_taken");
    throw err;
  }
}

export async function adminDeleteTheme(
  input: DeleteThemeInput,
): Promise<{ ok: true }> {
  const { userId } = await assertContentAdmin();
  const { id } = deleteThemeSchema.parse(input);

  const existing = await prisma.theme.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError("theme_not_found");

  await prisma.$transaction([
    prisma.cardTheme.deleteMany({ where: { themeId: id } }),
    prisma.promptTheme.deleteMany({ where: { themeId: id } }),
    prisma.theme.delete({ where: { id } }),
  ]);

  await invalidateTag(THEMES_TAG);
  await logAdminAction({
    actorId: userId,
    action: "DELETE",
    entity: "Theme",
    entityId: id,
  });
  return { ok: true };
}
