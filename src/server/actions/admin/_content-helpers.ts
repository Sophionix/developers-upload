import { UserRole } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth/guards";
import { requireRole } from "@/lib/rbac";

export async function assertContentAdmin(): Promise<{ userId: string }> {
  await requireUser();
  const { userId } = await requireRole([
    UserRole.SUPER_ADMIN,
    UserRole.CONTENT_MANAGER,
  ]);
  return { userId };
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function isPrismaKnownError(
  err: unknown,
  code: string,
): err is { code: string } {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === code
  );
}
