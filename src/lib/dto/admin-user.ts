import type {
  AccountStatus,
  SubscriptionStatus,
  SubscriptionTier,
  UserRole,
} from "@/generated/prisma/enums";

export interface AdminUserListRow {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: AccountStatus;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  deletedAt: Date | null;
  subscription: {
    tier: SubscriptionTier;
    status: SubscriptionStatus;
  } | null;
}

export interface AdminUserListDto {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: AccountStatus;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  deletedAt: Date | null;
  subscriptionTier: SubscriptionTier | null;
  subscriptionStatus: SubscriptionStatus | null;
}

export function toAdminUserListDto(row: AdminUserListRow): AdminUserListDto {
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    role: row.role,
    status: row.status,
    emailVerifiedAt: row.emailVerifiedAt,
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt,
    deletedAt: row.deletedAt,
    subscriptionTier: row.subscription?.tier ?? null,
    subscriptionStatus: row.subscription?.status ?? null,
  };
}

export interface AdminUserDetailRow extends AdminUserListRow {
  avatarUrl: string | null;
  timezone: string | null;
  locale: string | null;
  hasCompletedOnboarding: boolean;
  consentTermsAt: Date | null;
  totpEnabled: boolean;
  lastLoginIp: string | null;
  stripeCustomerId: string | null;
  updatedAt: Date;
}

export interface AdminUserDetailDto extends AdminUserListDto {
  avatarUrl: string | null;
  timezone: string | null;
  locale: string | null;
  hasCompletedOnboarding: boolean;
  consentTermsAt: Date | null;
  totpEnabled: boolean;
  lastLoginIp: string | null;
  stripeCustomerId: string | null;
  updatedAt: Date;
}

export function toAdminUserDetailDto(
  row: AdminUserDetailRow,
): AdminUserDetailDto {
  return {
    ...toAdminUserListDto(row),
    avatarUrl: row.avatarUrl,
    timezone: row.timezone,
    locale: row.locale,
    hasCompletedOnboarding: row.hasCompletedOnboarding,
    consentTermsAt: row.consentTermsAt,
    totpEnabled: row.totpEnabled,
    lastLoginIp: row.lastLoginIp,
    stripeCustomerId: row.stripeCustomerId,
    updatedAt: row.updatedAt,
  };
}
