"use server";

import { Prisma } from "@/generated/prisma/client";
import { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { requireRole } from "@/lib/rbac";
import { logAdminAction } from "@/lib/audit";
import { invalidateTag } from "@/lib/cache";
import { NotFoundError } from "@/lib/errors";
import {
  getSettingSchema,
  updateSettingSchema,
  type GetSettingInput,
  type UpdateSettingInput,
} from "@/lib/validation/admin-system";
import {
  SETTING_REGISTRY,
  validateSettingValue,
} from "@/lib/setting-registry";
import type { SettingDto } from "@/lib/dto/admin-system";

const SETTINGS_TAG = "settings";

async function assertSuperAdmin(): Promise<{ userId: string }> {
  await requireUser();
  const { userId } = await requireRole([UserRole.SUPER_ADMIN]);
  return { userId };
}

function toDto(row: {
  key: string;
  value: Prisma.JsonValue;
  updatedAt: Date;
  updatedBy: string | null;
}): SettingDto {
  return {
    key: row.key,
    value: row.value,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  };
}

export async function adminGetSettings(): Promise<SettingDto[]> {
  await assertSuperAdmin();
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: Object.keys(SETTING_REGISTRY) } },
    orderBy: { key: "asc" },
  });
  return rows.map(toDto);
}

export async function adminGetSetting(
  input: GetSettingInput,
): Promise<SettingDto> {
  await assertSuperAdmin();
  const { key } = getSettingSchema.parse(input);
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  if (!row) throw new NotFoundError("setting_not_found");
  return toDto(row);
}

export async function adminUpdateSetting(
  input: UpdateSettingInput,
): Promise<SettingDto> {
  const { userId } = await assertSuperAdmin();
  const { key, value } = updateSettingSchema.parse(input);
  const validated = validateSettingValue(key, value);

  const row = await prisma.systemSetting.upsert({
    where: { key },
    create: {
      key,
      value: validated as Prisma.InputJsonValue,
      updatedBy: userId,
    },
    update: {
      value: validated as Prisma.InputJsonValue,
      updatedBy: userId,
    },
  });

  await invalidateTag(SETTINGS_TAG);
  await logAdminAction({
    actorId: userId,
    action: "UPDATE",
    entity: "SystemSetting",
    entityId: key,
    meta: { key },
  });
  return toDto(row);
}
