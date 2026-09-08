import { NextResponse } from "next/server";
import { generateSecret, generateURI } from "otplib";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { withRequestId } from "@/lib/logger";
import { aesGcmEncrypt } from "@/lib/crypto";
import { requireRole, ForbiddenError } from "@/lib/rbac";
import { getRequestId, errJson } from "@/lib/http";
import { UserRole } from "@/generated/prisma/enums";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  const log = withRequestId(getRequestId(req));
  try {
    const { userId } = await requireRole([UserRole.SUPER_ADMIN, UserRole.CONTENT_MANAGER]);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) return errJson("NOT_FOUND", 404);

    const secret = generateSecret();
    const encrypted = aesGcmEncrypt(secret, env.TOTP_SECRET_KEY);
    const otpauth_url = generateURI({ issuer: env.TOTP_ISSUER, label: user.email, secret });

    await prisma.user.update({
      where: { id: userId },
      data: { totpSecretEnc: encrypted, totpEnabled: false },
    });

    log.info({ userId }, "admin_2fa_setup_initiated");
    return NextResponse.json({ ok: true, otpauth_url, qr: otpauth_url });
  } catch (err) {
    if (err instanceof ForbiddenError) return errJson(err.code, err.code === "UNAUTHENTICATED" ? 401 : 403);
    throw err;
  }
}
