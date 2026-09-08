"use server";

import { Prisma } from "@/generated/prisma/client";
import { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { requireRole } from "@/lib/rbac";
import { logAdminAction } from "@/lib/audit";
import { invalidateTag } from "@/lib/cache";
import { decodeCursor, paginateKeyset } from "@/lib/pagination";
import { ConflictError } from "@/lib/errors";
import { newToken } from "@/lib/crypto";
import { redis } from "@/lib/redis";
import { sendEmail } from "@/lib/mailer";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import {
  createAdminSchema,
  listAdminsSchema,
  type CreateAdminInput,
  type ListAdminsInput,
} from "@/lib/validation/admin-system";
import type { AdminListDto } from "@/lib/dto/admin-system";

const USERS_TAG = "users";
const INVITE_TTL_DAYS = 7;
const MUST_ENROLL_TTL_DAYS = 30;

// WHY: schema has no `mustEnroll2fa` column; Redis flag carries the intent
// until first login, where admin 2FA middleware consumes it.
const mustEnrollKey = (userId: string) => `admin:must-enroll-2fa:${userId}`;

async function assertSuperAdmin(): Promise<{ userId: string }> {
  await requireUser();
  const { userId } = await requireRole([UserRole.SUPER_ADMIN]);
  return { userId };
}

const ADMIN_SELECT = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  status: true,
  totpEnabled: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export async function adminListAdmins(
  input: ListAdminsInput,
): Promise<{ items: AdminListDto[]; nextCursor: string | null }> {
  await assertSuperAdmin();
  const { cursor, take = 50 } = listAdminsSchema.parse(input);
  const decoded = decodeCursor(cursor);

  const rows = await prisma.user.findMany({
    where: {
      role: { in: [UserRole.SUPER_ADMIN, UserRole.CONTENT_MANAGER] },
      deletedAt: null,
      ...(decoded && {
        OR: [
          { createdAt: { lt: decoded.createdAt } },
          { createdAt: decoded.createdAt, id: { lt: decoded.id } },
        ],
      }),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    select: ADMIN_SELECT,
  });

  const page = paginateKeyset(rows, take, false);
  return {
    items: page.rows.map((r) => ({
      id: r.id,
      email: r.email,
      fullName: r.fullName,
      role: r.role,
      status: r.status,
      totpEnabled: r.totpEnabled,
      lastLoginAt: r.lastLoginAt,
      createdAt: r.createdAt,
    })),
    nextCursor: page.nextCursor,
  };
}

export async function adminCreateAdmin(
  input: CreateAdminInput,
): Promise<AdminListDto> {
  const { userId: actorId } = await assertSuperAdmin();
  const { email, fullName, role } = createAdminSchema.parse(input);

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });
  if (existing) {
    if (
      existing.role === UserRole.SUPER_ADMIN ||
      existing.role === UserRole.CONTENT_MANAGER
    ) {
      throw new ConflictError("already_admin");
    }
    throw new ConflictError("email_taken");
  }

  const { raw, hash } = newToken();
  const expiresAt = new Date(
    Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, fullName, role },
      select: ADMIN_SELECT,
    });
    await tx.emailVerificationToken.create({
      data: { userId: user.id, tokenHash: hash, expiresAt },
    });
    return user;
  });

  await redis.set(
    mustEnrollKey(created.id),
    "1",
    "EX",
    MUST_ENROLL_TTL_DAYS * 24 * 60 * 60,
  );

  const inviteUrl = `${env.NEXT_PUBLIC_APP_URL}/admin/accept-invite?token=${raw}`;
  try {
    await sendEmail({
      to: email,
      templateKey: "admin_invite",
      vars: { inviteUrl, fullName, role },
    });
  } catch (err) {
    logger.error({ err, targetId: created.id }, "admin_invite_email_failed");
  }

  await invalidateTag(USERS_TAG);
  await logAdminAction({
    actorId,
    action: "GRANT",
    entity: "User",
    entityId: created.id,
    targetUserId: created.id,
    meta: { op: "admin_invite", role, expiresAt: expiresAt.toISOString() },
  });

  return {
    id: created.id,
    email: created.email,
    fullName: created.fullName,
    role: created.role,
    status: created.status,
    totpEnabled: created.totpEnabled,
    lastLoginAt: created.lastLoginAt,
    createdAt: created.createdAt,
  };
}
