import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma/enums";

export type Permission =
  | "admin:user:read"
  | "admin:user:write"
  | "admin:user:delete"
  | "admin:content:read"
  | "admin:content:write"
  | "admin:billing:read"
  | "admin:billing:write"
  | "admin:system:read"
  | "admin:system:write"
  | "admin:audit:read"
  | "admin:admin:manage";

export const PERMISSIONS: Record<Permission, UserRole[]> = {
  "admin:user:read": [UserRole.SUPER_ADMIN, UserRole.CONTENT_MANAGER],
  "admin:user:write": [UserRole.SUPER_ADMIN],
  "admin:user:delete": [UserRole.SUPER_ADMIN],
  "admin:content:read": [UserRole.SUPER_ADMIN, UserRole.CONTENT_MANAGER],
  "admin:content:write": [UserRole.SUPER_ADMIN, UserRole.CONTENT_MANAGER],
  "admin:billing:read": [UserRole.SUPER_ADMIN],
  "admin:billing:write": [UserRole.SUPER_ADMIN],
  "admin:system:read": [UserRole.SUPER_ADMIN],
  "admin:system:write": [UserRole.SUPER_ADMIN],
  "admin:audit:read": [UserRole.SUPER_ADMIN],
  "admin:admin:manage": [UserRole.SUPER_ADMIN],
};

export class ForbiddenError extends Error {
  readonly code: string;
  constructor(
    code: "UNAUTHENTICATED" | "FORBIDDEN_ROLE" | "FORBIDDEN_PERMISSION",
  ) {
    super(code);
    this.code = code;
    this.name = "ForbiddenError";
  }
}

export async function requireRole(
  roles: UserRole[],
): Promise<{ userId: string; role: UserRole }> {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("UNAUTHENTICATED");
  const role = session.user.role;
  if (!roles.includes(role)) throw new ForbiddenError("FORBIDDEN_ROLE");
  return { userId: session.user.id, role };
}

export async function requirePermission(
  action: Permission,
): Promise<{ userId: string; role: UserRole }> {
  return requireRole(PERMISSIONS[action]);
}

export function hasPermission(role: UserRole, action: Permission): boolean {
  return PERMISSIONS[action].includes(role);
}
