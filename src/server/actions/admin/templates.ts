"use server";

import { Prisma } from "@/generated/prisma/client";
import { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { requireRole } from "@/lib/rbac";
import { logAdminAction } from "@/lib/audit";
import { invalidateTag } from "@/lib/cache";
import { decodeCursor, paginateKeyset } from "@/lib/pagination";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { extractVars } from "@/emails/render";
import {
  toTemplateDto,
  type TemplateDto,
} from "@/lib/dto/admin-campaigns";
import {
  createTemplateSchema,
  deleteTemplateSchema,
  listTemplatesSchema,
  updateTemplateSchema,
  type CreateTemplateInput,
  type DeleteTemplateInput,
  type ListTemplatesInput,
  type UpdateTemplateInput,
} from "@/lib/validation/admin-campaigns";

const TEMPLATES_TAG = "notification-templates";

const TEMPLATE_SELECT = {
  id: true,
  slug: true,
  type: true,
  subject: true,
  title: true,
  body: true,
  variables: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.NotificationTemplateSelect;

async function assertContentOrSuperAdmin(): Promise<{ userId: string }> {
  await requireUser();
  const { userId } = await requireRole([
    UserRole.SUPER_ADMIN,
    UserRole.CONTENT_MANAGER,
  ]);
  return { userId };
}

function assertVariableSubset(
  text: string,
  declared: string[],
  fieldLabel: string,
): void {
  const referenced = extractVars(text);
  const undeclared = referenced.filter((v) => !declared.includes(v));
  if (undeclared.length > 0) {
    throw new ValidationError(
      `${fieldLabel}_undeclared_vars:${undeclared.join(",")}`,
    );
  }
}

export async function adminListTemplates(
  input: ListTemplatesInput,
): Promise<{ items: TemplateDto[]; nextCursor: string | null }> {
  await assertContentOrSuperAdmin();
  const { cursor, take = 20, type, search } = listTemplatesSchema.parse(input);
  const decoded = decodeCursor(cursor);

  const where: Prisma.NotificationTemplateWhereInput = {
    ...(type && { type }),
    ...(search && {
      OR: [{ slug: { contains: search } }, { title: { contains: search } }],
    }),
    ...(decoded && {
      OR: [
        { createdAt: { lt: decoded.createdAt } },
        { createdAt: decoded.createdAt, id: { lt: decoded.id } },
      ],
    }),
  };

  const rows = await prisma.notificationTemplate.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    select: TEMPLATE_SELECT,
  });

  const page = paginateKeyset(rows, take, false);
  return {
    items: page.rows.map(toTemplateDto),
    nextCursor: page.nextCursor,
  };
}

export async function adminCreateTemplate(
  input: CreateTemplateInput,
): Promise<TemplateDto> {
  const { userId } = await assertContentOrSuperAdmin();
  const data = createTemplateSchema.parse(input);

  if (data.type === "EMAIL" && !data.subject) {
    throw new ValidationError("email_subject_required");
  }

  assertVariableSubset(data.body, data.variables, "body");
  if (data.subject) assertVariableSubset(data.subject, data.variables, "subject");
  if (data.title) assertVariableSubset(data.title, data.variables, "title");

  const existing = await prisma.notificationTemplate.findUnique({
    where: { slug: data.slug },
    select: { id: true },
  });
  if (existing) throw new ConflictError("slug_taken");

  const row = await prisma.notificationTemplate.create({
    data: {
      slug: data.slug,
      type: data.type,
      subject: data.subject ?? null,
      title: data.title ?? null,
      body: data.body,
      variables: data.variables as Prisma.InputJsonValue,
    },
    select: TEMPLATE_SELECT,
  });

  await invalidateTag(TEMPLATES_TAG);
  await logAdminAction({
    actorId: userId,
    action: "CREATE",
    entity: "NotificationTemplate",
    entityId: row.id,
    meta: { slug: row.slug, type: row.type },
  });
  return toTemplateDto(row);
}

export async function adminUpdateTemplate(
  input: UpdateTemplateInput,
): Promise<TemplateDto> {
  const { userId } = await assertContentOrSuperAdmin();
  const { id, ...changes } = updateTemplateSchema.parse(input);

  const existing = await prisma.notificationTemplate.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      subject: true,
      title: true,
      body: true,
      variables: true,
    },
  });
  if (!existing) throw new NotFoundError("template_not_found");

  const nextVariables =
    changes.variables ??
    (Array.isArray(existing.variables)
      ? (existing.variables as unknown[]).filter(
          (v): v is string => typeof v === "string",
        )
      : []);

  const nextBody = changes.body ?? existing.body;
  const nextSubject =
    changes.subject === undefined ? existing.subject : changes.subject;
  const nextTitle = changes.title === undefined ? existing.title : changes.title;

  assertVariableSubset(nextBody, nextVariables, "body");
  if (nextSubject) assertVariableSubset(nextSubject, nextVariables, "subject");
  if (nextTitle) assertVariableSubset(nextTitle, nextVariables, "title");

  if (changes.slug && changes.slug !== existing.slug) {
    const clash = await prisma.notificationTemplate.findUnique({
      where: { slug: changes.slug },
      select: { id: true },
    });
    if (clash && clash.id !== id) throw new ConflictError("slug_taken");
  }

  const data: Prisma.NotificationTemplateUpdateInput = {
    ...(changes.slug !== undefined && { slug: changes.slug }),
    ...(changes.type !== undefined && { type: changes.type }),
    ...(changes.subject !== undefined && { subject: changes.subject }),
    ...(changes.title !== undefined && { title: changes.title }),
    ...(changes.body !== undefined && { body: changes.body }),
    ...(changes.variables !== undefined && {
      variables: changes.variables as Prisma.InputJsonValue,
    }),
  };

  const row = await prisma.notificationTemplate.update({
    where: { id },
    data,
    select: TEMPLATE_SELECT,
  });

  await invalidateTag(TEMPLATES_TAG);
  await logAdminAction({
    actorId: userId,
    action: "UPDATE",
    entity: "NotificationTemplate",
    entityId: row.id,
    meta: { changedKeys: Object.keys(data) },
  });
  return toTemplateDto(row);
}

export async function adminDeleteTemplate(
  input: DeleteTemplateInput,
): Promise<{ ok: true }> {
  const { userId } = await assertContentOrSuperAdmin();
  const { id } = deleteTemplateSchema.parse(input);

  const existing = await prisma.notificationTemplate.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError("template_not_found");

  const linkedCampaigns = await prisma.notificationCampaign.count({
    where: { templateId: id },
  });
  if (linkedCampaigns > 0) throw new ConflictError("template_in_use");

  await prisma.notificationTemplate.delete({ where: { id } });

  await invalidateTag(TEMPLATES_TAG);
  await logAdminAction({
    actorId: userId,
    action: "DELETE",
    entity: "NotificationTemplate",
    entityId: id,
    meta: { hardDelete: true },
  });
  return { ok: true };
}
