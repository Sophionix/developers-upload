import { auth } from "@/lib/auth";
import type { UserRole, AccountStatus } from "@/generated/prisma/client";

export class UnauthorizedError extends Error {
  readonly code = "UNAUTHORIZED" as const;
  constructor(message = "unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  hasCompletedOnboarding: boolean;
}

export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  const u = session?.user;
  if (!u?.id || !u.email) throw new UnauthorizedError();
  return {
    id: u.id,
    email: u.email,
    role: u.role as UserRole,
    status: u.status as AccountStatus,
    hasCompletedOnboarding: Boolean(u.hasCompletedOnboarding),
  };
}
