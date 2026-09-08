"use server";

import { Prisma } from "@/generated/prisma/client";
import { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { requireRole } from "@/lib/rbac";
import { decodeCursor, paginateKeyset } from "@/lib/pagination";
import {
  listAuditLogsSchema,
  type ListAuditLogsInput,
} from "@/lib/validation/admin-system";
import type { AuditLogDto } from "@/lib/dto/admin-system";

async function assertSuperAdmin(): Promise<void> {
  await requireUser();
  await requireRole([UserRole.SUPER_ADMIN]);
}

const DEFAULT_RANGE_DAYS = 30;

export async function adminListAuditLogs(
  input: ListAuditLogsInput,
): Promise<{ items: AuditLogDto[]; nextCursor: string | null }> {
  await assertSuperAdmin();
  const parsed = listAuditLogsSchema.parse(input);
  const { cursor, take = 50, actorId, entity, action, dateFrom, dateTo } =
    parsed;
  const decoded = decodeCursor(cursor);

  const defaultFrom = new Date();
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - DEFAULT_RANGE_DAYS);
  const fromDate = dateFrom ?? defaultFrom;

  const where: Prisma.AdminAuditLogWhereInput = {
    ...(actorId && { actorId }),
    ...(entity && { entity }),
    ...(action && { action }),
    createdAt: {
      gte: fromDate,
      ...(dateTo && { lte: dateTo }),
    },
    ...(decoded && {
      OR: [
        { createdAt: { lt: decoded.createdAt } },
        { createdAt: decoded.createdAt, id: { lt: decoded.id } },
      ],
    }),
  };

  const rows = await prisma.adminAuditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    select: {
      id: true,
      actorId: true,
      action: true,
      entity: true,
      entityId: true,
      targetUserId: true,
      meta: true,
      ip: true,
      createdAt: true,
    },
  });

  const page = paginateKeyset(rows, take, false);
  return {
    items: page.rows.map((r) => ({
      id: r.id,
      actorId: r.actorId,
      action: r.action,
      entity: r.entity,
      entityId: r.entityId,
      targetUserId: r.targetUserId,
      meta: r.meta,
      ip: r.ip,
      createdAt: r.createdAt,
    })),
    nextCursor: page.nextCursor,
  };
}
