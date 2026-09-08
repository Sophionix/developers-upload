"use server";

import { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { requireRole } from "@/lib/rbac";
import { logAdminAction } from "@/lib/audit";
import { invalidateFlagCache } from "@/lib/feature-flags";
import {
  listFlagsSchema,
  upsertFlagSchema,
  type ListFlagsInput,
  type UpsertFlagInput,
} from "@/lib/validation/admin-system";
import type { FeatureFlagDto } from "@/lib/dto/admin-system";

async function assertSuperAdmin(): Promise<{ userId: string }> {
  await requireUser();
  const { userId } = await requireRole([UserRole.SUPER_ADMIN]);
  return { userId };
}

function toDto(row: {
  key: string;
  enabled: boolean;
  rolloutPct: number;
  updatedAt: Date;
}): FeatureFlagDto {
  return {
    key: row.key,
    isEnabled: row.enabled,
    rolloutPercentage: row.rolloutPct,
    updatedAt: row.updatedAt,
  };
}

export async function adminListFeatureFlags(
  input: ListFlagsInput,
): Promise<{ items: FeatureFlagDto[]; nextCursor: string | null }> {
  await assertSuperAdmin();
  const { take = 100 } = listFlagsSchema.parse(input);
  const rows = await prisma.featureFlag.findMany({
    orderBy: { key: "asc" },
    take,
  });
  return { items: rows.map(toDto), nextCursor: null };
}

export async function adminUpsertFeatureFlag(
  input: UpsertFlagInput,
): Promise<FeatureFlagDto> {
  const { userId } = await assertSuperAdmin();
  const { key, isEnabled, rolloutPercentage } = upsertFlagSchema.parse(input);

  const row = await prisma.featureFlag.upsert({
    where: { key },
    create: { key, enabled: isEnabled, rolloutPct: rolloutPercentage },
    update: { enabled: isEnabled, rolloutPct: rolloutPercentage },
  });

  await invalidateFlagCache(key);
  await logAdminAction({
    actorId: userId,
    action: "UPDATE",
    entity: "FeatureFlag",
    entityId: key,
    meta: { isEnabled, rolloutPercentage },
  });
  return toDto(row);
}
