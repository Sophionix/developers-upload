"use server";

import { Prisma } from "@/generated/prisma/client";
import { UserRole, AccountStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { requireRole } from "@/lib/rbac";
import { logAdminAction } from "@/lib/audit";
import { invalidateTag } from "@/lib/cache";
import { decodeCursor, paginateKeyset } from "@/lib/pagination";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { newToken } from "@/lib/crypto";
import { revoke as revokeSessionToken } from "@/lib/session-blocklist";
import { sendEmail } from "@/lib/mailer";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import {
  toAdminUserListDto,
  toAdminUserDetailDto,
  type AdminUserListDto,
  type AdminUserDetailDto,
} from "@/lib/dto/admin-user";
import {
  assignRoleSchema,
  deactivateUserSchema,
  getUserSchema,
  hardDeleteUserSchema,
  listUsersSchema,
  reactivateUserSchema,
  resetUserPasswordSchema,
  softDeleteUserSchema,
  type AssignRoleInput,
  type DeactivateUserInput,
  type GetUserInput,
  type HardDeleteUserInput,
  type ListUsersInput,
  type ReactivateUserInput,
  type ResetUserPasswordInput,
  type SoftDeleteUserInput,
} from "@/lib/validation/admin-users";

const USERS_TAG = "users";
const RESET_TTL_MINUTES = 60;

const LIST_SELECT = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  status: true,
  emailVerifiedAt: true,
  lastLoginAt: true,
  createdAt: true,
  deletedAt: true,
  subscription: { select: { tier: true, status: true } },
} satisfies Prisma.UserSelect;

const DETAIL_SELECT = {
  ...LIST_SELECT,
  avatarUrl: true,
  timezone: true,
  locale: true,
  hasCompletedOnboarding: true,
  consentTermsAt: true,
  totpEnabled: true,
  lastLoginIp: true,
  stripeCustomerId: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

async function assertSuperAdmin(): Promise<{ userId: string }> {
  await requireUser();
  const { userId } = await requireRole([UserRole.SUPER_ADMIN]);
  return { userId };
}

export async function adminListUsers(
  input: ListUsersInput,
): Promise<{ items: AdminUserListDto[]; nextCursor: string | null }> {
  await assertSuperAdmin();
  const parsed = listUsersSchema.parse(input);
  const { cursor, take = 20, status, role, search, createdFrom, createdTo } =
    parsed;
  const decoded = decodeCursor(cursor);

  const where: Prisma.UserWhereInput = {
    ...(status && { status }),
    ...(role && { role }),
    ...(search && {
      OR: [
        { email: { startsWith: search } },
        { fullName: { startsWith: search } },
      ],
    }),
    ...((createdFrom || createdTo) && {
      createdAt: {
        ...(createdFrom && { gte: createdFrom }),
        ...(createdTo && { lte: createdTo }),
      },
    }),
    ...(decoded && {
      OR: [
        { createdAt: { lt: decoded.createdAt } },
        { createdAt: decoded.createdAt, id: { lt: decoded.id } },
      ],
    }),
  };

  // PERF: ensure index on (createdAt, id) exists in schema.prisma for keyset pagination;
  // current @@index([createdAt]) does not include id, so the id tiebreaker on cursor
  // comparisons may cause a filesort pass on large user tables.
  const rows = await prisma.user.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    select: LIST_SELECT,
  });

  const page = paginateKeyset(rows, take, false);
  return {
    items: page.rows.map(toAdminUserListDto),
    nextCursor: page.nextCursor,
  };
}

export async function adminGetUser(
  input: GetUserInput,
): Promise<AdminUserDetailDto> {
  await assertSuperAdmin();
  const { id } = getUserSchema.parse(input);
  const row = await prisma.user.findUnique({
    where: { id },
    select: DETAIL_SELECT,
  });
  if (!row) throw new NotFoundError("user_not_found");
  return toAdminUserDetailDto(row);
}

export interface AdminUserStatsDto {
  totalJournalEntries: number;
  totalCardDraws: number;
  totalSavedCards: number;
  devices: Array<{
    id: string;
    platform: string | null;
    deviceId: string | null;
    lastSeenAt: Date;
  }>;
}

export async function adminGetUserStats(
  input: GetUserInput,
): Promise<AdminUserStatsDto> {
  await assertSuperAdmin();
  const { id } = getUserSchema.parse(input);

  const [totalJournalEntries, totalCardDraws, totalSavedCards, devices] =
    await Promise.all([
      prisma.journalEntry.count({
        where: { userId: id, deletedAt: null, isDraft: false },
      }),
      prisma.cardDraw.count({ where: { userId: id } }),
      prisma.savedCard.count({ where: { userId: id } }),
      prisma.fcmToken.findMany({
        where: { userId: id },
        select: {
          id: true,
          platform: true,
          deviceId: true,
          lastSeenAt: true,
        },
        orderBy: { lastSeenAt: "desc" },
        take: 10,
      }),
    ]);

  return { totalJournalEntries, totalCardDraws, totalSavedCards, devices };
}

async function blocklistActiveSessions(userId: string): Promise<number> {
  const sessions = await prisma.session.findMany({
    where: { userId, expires: { gt: new Date() } },
    select: { sessionToken: true },
  });
  for (const s of sessions) await revokeSessionToken(s.sessionToken);
  return sessions.length;
}

export async function adminDeactivateUser(
  input: DeactivateUserInput,
): Promise<{ ok: true }> {
  const { userId } = await assertSuperAdmin();
  const { id, reason } = deactivateUserSchema.parse(input);

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, status: true, role: true },
  });
  if (!target) throw new NotFoundError("user_not_found");

  if (target.role === UserRole.SUPER_ADMIN) {
    const remaining = await prisma.user.count({
      where: {
        role: UserRole.SUPER_ADMIN,
        status: AccountStatus.ACTIVE,
        deletedAt: null,
        id: { not: id },
      },
    });
    if (remaining === 0) throw new ConflictError("last_super_admin");
  }

  await prisma.user.update({
    where: { id },
    data: { status: AccountStatus.DEACTIVATED },
  });
  const revoked = await blocklistActiveSessions(id);

  await invalidateTag(USERS_TAG);
  await logAdminAction({
    actorId: userId,
    action: "UPDATE",
    entity: "User",
    entityId: id,
    targetUserId: id,
    meta: { op: "deactivate", reason: reason ?? null, sessionsRevoked: revoked },
  });
  return { ok: true };
}

export async function adminReactivateUser(
  input: ReactivateUserInput,
): Promise<{ ok: true }> {
  const { userId } = await assertSuperAdmin();
  const { id } = reactivateUserSchema.parse(input);

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, status: true, deletedAt: true },
  });
  if (!target) throw new NotFoundError("user_not_found");
  if (target.deletedAt) throw new ConflictError("user_deleted");

  await prisma.user.update({
    where: { id },
    data: { status: AccountStatus.ACTIVE },
  });

  await invalidateTag(USERS_TAG);
  await logAdminAction({
    actorId: userId,
    action: "UPDATE",
    entity: "User",
    entityId: id,
    targetUserId: id,
    meta: { op: "reactivate" },
  });
  return { ok: true };
}

export async function adminResetUserPassword(
  input: ResetUserPasswordInput,
): Promise<{ ok: true }> {
  const { userId } = await assertSuperAdmin();
  const { id } = resetUserPasswordSchema.parse(input);

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, fullName: true, status: true },
  });
  if (!target) throw new NotFoundError("user_not_found");

  const { raw, hash } = newToken();
  const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000);
  await prisma.passwordResetToken.create({
    data: { userId: target.id, tokenHash: hash, expiresAt },
  });

  const resetUrl = `${env.NEXT_PUBLIC_APP_URL}/reset-password?token=${raw}`;
  try {
    await sendEmail({
      to: target.email,
      templateKey: "admin_reset_password",
      vars: { resetUrl, fullName: target.fullName },
    });
  } catch (err) {
    logger.error({ err, targetId: id }, "admin_reset_email_failed");
  }

  await logAdminAction({
    actorId: userId,
    action: "UPDATE",
    entity: "User",
    entityId: id,
    targetUserId: id,
    meta: { op: "reset_password", expiresAt: expiresAt.toISOString() },
  });
  return { ok: true };
}

export async function adminSoftDeleteUser(
  input: SoftDeleteUserInput,
): Promise<{ ok: true }> {
  const { userId } = await assertSuperAdmin();
  const { id, reason } = softDeleteUserSchema.parse(input);
  if (id === userId) throw new ConflictError("cannot_delete_self");

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, deletedAt: true },
  });
  if (!target) throw new NotFoundError("user_not_found");
  if (target.deletedAt) throw new ConflictError("already_deleted");

  if (target.role === UserRole.SUPER_ADMIN) {
    const remaining = await prisma.user.count({
      where: {
        role: UserRole.SUPER_ADMIN,
        status: AccountStatus.ACTIVE,
        deletedAt: null,
        id: { not: id },
      },
    });
    if (remaining === 0) throw new ConflictError("last_super_admin");
  }

  await prisma.user.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      status: AccountStatus.PENDING_DELETION,
    },
  });
  const revoked = await blocklistActiveSessions(id);

  await invalidateTag(USERS_TAG);
  await logAdminAction({
    actorId: userId,
    action: "DELETE",
    entity: "User",
    entityId: id,
    targetUserId: id,
    meta: { softDelete: true, reason: reason ?? null, sessionsRevoked: revoked },
  });
  return { ok: true };
}

export async function adminHardDeleteUser(
  input: HardDeleteUserInput,
): Promise<{ ok: true }> {
  const { userId } = await assertSuperAdmin();
  const { id, confirmation } = hardDeleteUserSchema.parse(input);
  if (id === userId) throw new ConflictError("cannot_delete_self");
  if (confirmation !== `DELETE-${id}`) {
    throw new ValidationError("confirmation_mismatch");
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  });
  if (!target) throw new NotFoundError("user_not_found");

  if (target.role === UserRole.SUPER_ADMIN) {
    const remaining = await prisma.user.count({
      where: {
        role: UserRole.SUPER_ADMIN,
        status: AccountStatus.ACTIVE,
        deletedAt: null,
        id: { not: id },
      },
    });
    if (remaining === 0) throw new ConflictError("last_super_admin");
  }

  await blocklistActiveSessions(id);
  await prisma.user.delete({ where: { id } });

  // WHY: Firebase orphan cleanup is async; enqueue when worker lands.
  logger.info({ targetId: id }, "user_hard_delete_firebase_cleanup_pending");

  await invalidateTag(USERS_TAG);
  await logAdminAction({
    actorId: userId,
    action: "DELETE",
    entity: "User",
    entityId: id,
    targetUserId: id,
    meta: { hardDelete: true },
  });
  return { ok: true };
}

export async function adminAssignRole(
  input: AssignRoleInput,
): Promise<{ ok: true }> {
  const { userId } = await assertSuperAdmin();
  const { id, role } = assignRoleSchema.parse(input);

  await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!target) throw new NotFoundError("user_not_found");
    if (target.role === role) return;

    if (
      target.role === UserRole.SUPER_ADMIN &&
      role !== UserRole.SUPER_ADMIN
    ) {
      const remaining = await tx.user.count({
        where: {
          role: UserRole.SUPER_ADMIN,
          status: AccountStatus.ACTIVE,
          deletedAt: null,
          id: { not: id },
        },
      });
      if (remaining === 0) throw new ConflictError("last_super_admin");
    }

    await tx.user.update({ where: { id }, data: { role } });
  });

  await invalidateTag(USERS_TAG);
  await logAdminAction({
    actorId: userId,
    action: role === UserRole.USER ? "REVOKE" : "GRANT",
    entity: "User",
    entityId: id,
    targetUserId: id,
    meta: { role },
  });
  return { ok: true };
}

