import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { withRequestId } from "@/lib/logger";
import { sha256Hex } from "@/lib/crypto";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { getRequestId, okJson, errJson, zodErrJson } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  const log = withRequestId(getRequestId(req));
  const body = await req.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) return zodErrJson(parsed);

  const tokenHash = sha256Hex(parsed.data.token);

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });
  if (!user) return errJson("INVALID_TOKEN", 400);

  const record = await prisma.emailVerificationToken.findFirst({
    where: { userId: user.id, tokenHash },
    select: { id: true, userId: true, usedAt: true, expiresAt: true },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return errJson("INVALID_TOKEN", 400);
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);

  log.info({ userId: record.userId }, "password_reset_completed");
  return okJson();
}
