import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import { withRequestId } from "@/lib/logger";
import { sha256Hex } from "@/lib/crypto";
import { requireRole, ForbiddenError } from "@/lib/rbac";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestId, okJson, errJson, rateLimitedJson } from "@/lib/http";
import { sendEmail } from "@/lib/mailer";
import { UserRole } from "@/generated/prisma/enums";

export const runtime = "nodejs";

const OTP_TTL_MINUTES = 10;

export async function POST(req: Request): Promise<NextResponse> {
  const _log = withRequestId(getRequestId(req));
  try {
    const { userId } = await requireRole([UserRole.SUPER_ADMIN, UserRole.CONTENT_MANAGER]);

    const rl = await rateLimit({ key: `2fa:email-otp:${userId}`, limit: 3, windowSec: 300 });
    if (!rl.ok) return rateLimitedJson(rl.resetAt);

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const codeHash = sha256Hex(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await prisma.adminTotpChallenge.create({
      data: { userId, codeHash, expiresAt },
    });

    const admin = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (admin) {
      await sendEmail({ to: admin.email, templateKey: "admin-2fa-otp", vars: { otp: code } }).catch(() => {});
    }
    return okJson();
  } catch (err) {
    if (err instanceof ForbiddenError) return errJson(err.code, err.code === "UNAUTHENTICATED" ? 401 : 403);
    throw err;
  }
}
