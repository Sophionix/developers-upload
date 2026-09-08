import type { AuditAction, UserRole } from "@/generated/prisma/enums";

export interface SettingDto {
  key: string;
  value: unknown;
  updatedAt: Date;
  updatedBy: string | null;
}

export interface FeatureFlagDto {
  key: string;
  isEnabled: boolean;
  rolloutPercentage: number;
  updatedAt: Date;
}

export interface AuditLogDto {
  id: string;
  actorId: string;
  action: AuditAction;
  entity: string;
  entityId: string | null;
  targetUserId: string | null;
  meta: unknown;
  ip: string | null;
  createdAt: Date;
}

export interface AdminListDto {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: string;
  totpEnabled: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}
