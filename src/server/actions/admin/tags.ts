"use server";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { logAdminAction } from "@/lib/audit";
import { invalidateTag } from "@/lib/cache";
import { decodeCursor, paginateKeyset } from "@/lib/pagination";
import { ConflictError, NotFoundError } from "@/lib/errors";
import type { AdminTaxonomyDto } from "@/lib/dto/admin-content";
import {
  createTagSchema,
  deleteTagSchema,
  listTagsSchema,
  updateTagSchema,
  type CreateTagInput,
  type DeleteTagInput,
  type ListTagsInput,
  type UpdateTagInput,
} from "@/lib/validation/admin-content";
import {
  assertContentAdmin,
  isPrismaKnownError,
  slugify,
} from "./_content-helpers";

const TAGS_TAG = "tags";
const TAG_SELECT = {
  id: true,
  slug: true,
  name: true,
  createdAt: true,
} satisfies Prisma.TagSelect;

export async function adminListTags(
  input: ListTagsInput,
): Promise<{ items: AdminTaxonomyDto[]; nextCursor: string | null }> {
  await assertContentAdmin();
  const { cursor, take = 20, search } = listTagsSchema.parse(input);
  const decoded = decodeCursor(cursor);

  const where: Prisma.TagWhereInput = {
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

  const rows = await prisma.tag.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    select: TAG_SELECT,
  });

  const page = paginateKeyset(rows, take, false);
  return { items: page.rows, nextCursor: page.nextCursor };
}

export async function adminCreateTag(
  input: CreateTagInput,
): Promise<AdminTaxonomyDto> {
  const { userId } = await assertContentAdmin();
  const data = createTagSchema.parse(input);
  const finalSlug = data.slug ?? slugify(data.name);

  try {
    const row = await prisma.tag.create({
      data: { slug: finalSlug, name: data.name },
      select: TAG_SELECT,
    });
    await invalidateTag(TAGS_TAG);
    await logAdminAction({
      actorId: userId,
      action: "CREATE",
      entity: "Tag",
      entityId: row.id,
      meta: { slug: row.slug },
    });
    return row;
  } catch (err) {
    if (isPrismaKnownError(err, "P2002")) throw new ConflictError("slug_taken");
    throw err;
  }
}

export async function adminUpdateTag(
  input: UpdateTagInput,
): Promise<AdminTaxonomyDto> {
  const { userId } = await assertContentAdmin();
  const { id, ...changes } = updateTagSchema.parse(input);

  const data: Prisma.TagUpdateInput = {
    ...(changes.slug !== undefined && { slug: changes.slug }),
    ...(changes.name !== undefined && { name: changes.name }),
  };

  try {
    const row = await prisma.tag.update({
      where: { id },
      data,
      select: TAG_SELECT,
    });
    await invalidateTag(TAGS_TAG);
    await logAdminAction({
      actorId: userId,
      action: "UPDATE",
      entity: "Tag",
      entityId: row.id,
      meta: { changedKeys: Object.keys(data) },
    });
    return row;
  } catch (err) {
    if (isPrismaKnownError(err, "P2025"))
      throw new NotFoundError("tag_not_found");
    if (isPrismaKnownError(err, "P2002")) throw new ConflictError("slug_taken");
    throw err;
  }
}

export async function adminDeleteTag(
  input: DeleteTagInput,
): Promise<{ ok: true }> {
  const { userId } = await assertContentAdmin();
  const { id } = deleteTagSchema.parse(input);

  const existing = await prisma.tag.findUnique({
    where: { id },
    select: {
      id: true,
      _count: { select: { cards: true, entries: true } },
    },
  });
  if (!existing) throw new NotFoundError("tag_not_found");
  if (existing._count.cards > 0 || existing._count.entries > 0) {
    throw new ConflictError("tag_in_use");
  }

  await prisma.tag.delete({ where: { id } });

  await invalidateTag(TAGS_TAG);
  await logAdminAction({
    actorId: userId,
    action: "DELETE",
    entity: "Tag",
    entityId: id,
  });
  return { ok: true };
}
