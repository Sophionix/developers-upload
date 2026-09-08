import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRequestId } from "@/lib/logger";
import { requireRole, ForbiddenError } from "@/lib/rbac";
import { hasMfa } from "@/lib/mfa";
import { getRequestId, okJson, errJson } from "@/lib/http";
import { UserRole } from "@/generated/prisma/enums";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  const log = withRequestId(getRequestId(req));
  try {
    const { userId } = await requireRole([UserRole.SUPER_ADMIN, UserRole.CONTENT_MANAGER]);

    if (!(await hasMfa(userId))) {
      return errJson("MFA_REQUIRED", 403);
    }

    await prisma.user.update({
      where: { id: userId },
      data: { totpSecretEnc: null, totpEnabled: false },
    });

    log.info({ userId }, "admin_2fa_disabled");
    return okJson();
  } catch (err) {
    if (err instanceof ForbiddenError) return errJson(err.code, err.code === "UNAUTHENTICATED" ? 401 : 403);
    throw err;
  }
}
