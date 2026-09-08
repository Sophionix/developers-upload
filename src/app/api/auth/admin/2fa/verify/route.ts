import { NextResponse } from "next/server";
import { verifySync } from "otplib";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { withRequestId } from "@/lib/logger";
import { aesGcmDecrypt, sha256Hex } from "@/lib/crypto";
import { requireRole, ForbiddenError } from "@/lib/rbac";
import { rateLimit } from "@/lib/rate-limit";
import { markMfa, setMfaCookie } from "@/lib/mfa";
import { totpVerifySchema } from "@/lib/validation/auth";
import { getRequestId, errJson, zodErrJson, rateLimitedJson } from "@/lib/http";
import { UserRole } from "@/generated/prisma/enums";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  const log = withRequestId(getRequestId(req));
  try {
    const { userId } = await requireRole([UserRole.SUPER_ADMIN, UserRole.CONTENT_MANAGER]);

    const rl = await rateLimit({ key: `2fa:verify:${userId}`, limit: 10, windowSec: 60 });
    if (!rl.ok) return rateLimitedJson(rl.resetAt);

    const body = await req.json().catch(() => null);
    const parsed = totpVerifySchema.safeParse(body);
    if (!parsed.success) return zodErrJson(parsed);
    const { code, intent } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { totpSecretEnc: true, totpEnabled: true },
    });
    if (!user) return errJson("NOT_FOUND", 404);

    let verified = false;

    if (intent === "email-otp") {
      const challenge = await prisma.adminTotpChallenge.findFirst({
        where: { userId, consumedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
      });
      if (!challenge) return errJson("INVALID_CODE", 400);
      if (challenge.codeHash === sha256Hex(code)) {
        await prisma.adminTotpChallenge.update({
          where: { id: challenge.id },
          data: { consumedAt: new Date() },
        });
        verified = true;
      }
    } else {
      if (!user.totpSecretEnc) return errJson("TOTP_NOT_SETUP", 400);
      const secret = aesGcmDecrypt(user.totpSecretEnc, env.TOTP_SECRET_KEY);
      verified = verifySync({ token: code, secret }).valid;
    }

    if (!verified) return errJson("INVALID_CODE", 400);

    if (intent === "enable") {
      await prisma.user.update({ where: { id: userId }, data: { totpEnabled: true } });
    }

    if (intent === "step-up" || intent === "email-otp") {
      await markMfa(userId);
    }

    log.info({ userId, intent }, "admin_2fa_verified");
    const res = NextResponse.json({ ok: true });
    setMfaCookie(res, userId);
    return res;
  } catch (err) {
    if (err instanceof ForbiddenError) return errJson(err.code, err.code === "UNAUTHENTICATED" ? 401 : 403);
    throw err;
  }
}
