import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRequestId } from "@/lib/logger";
import { sha256Hex } from "@/lib/crypto";
import { verifyEmailSchema } from "@/lib/validation/auth";
import { getRequestId, okJson, errJson, zodErrJson } from "@/lib/http";
import { redis } from "@/lib/redis";
import { LOGIN_FAIL_KEY } from "@/lib/auth/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  const log = withRequestId(getRequestId(req));
  const body = await req.json().catch(() => null);
  const parsed = verifyEmailSchema.safeParse(body);
  if (!parsed.success) return zodErrJson(parsed);

  const tokenHash = sha256Hex(parsed.data.code);
  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });
  if (!user) return errJson("INVALID_TOKEN", 400);
  const record = await prisma.emailVerificationToken.findFirst({
    where: { userId: user.id, tokenHash },
    select: { id: true, userId: true, usedAt: true, expiresAt: true },
  });
  if (!record) return errJson("INVALID_TOKEN", 400);

  if (record.usedAt) {
    log.info({ userId: record.userId }, "verify_email_already_used");
    return okJson();
  }
  if (record.expiresAt < new Date()) return errJson("TOKEN_EXPIRED", 400);

  if (parsed.data.intent === "reset") {
    // Reset-password flow: this endpoint only checks the OTP is valid.
    // The token stays unused so /api/auth/reset-password can consume it
    // once the user actually sets a new password.
    log.info({ userId: record.userId }, "reset_otp_verified");
    return okJson();
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    }),
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  // Verifying the OTP proves ownership of the account — clear any brute-force
  // counter so the immediate post-verify auto-signin isn't blocked by unrelated
  // prior failed login attempts.
  await redis.del(LOGIN_FAIL_KEY(parsed.data.email)).catch(() => {});

  log.info({ userId: record.userId }, "email_verified");
  return okJson();
}
