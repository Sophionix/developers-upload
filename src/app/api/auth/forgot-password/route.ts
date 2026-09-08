import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRequestId } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { newOtpCode } from "@/lib/crypto";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import {
  getIp,
  getRequestId,
  okJson,
  zodErrJson,
  rateLimitedJson,
} from "@/lib/http";
import { sendEmail } from "@/lib/mailer";

export const runtime = "nodejs";

const RESET_TTL_MINUTES = 60;

export async function POST(req: Request): Promise<NextResponse> {
  const log = withRequestId(getRequestId(req));
  const ip = getIp(req);
  const body = await req.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) return zodErrJson(parsed);
  const { email } = parsed.data;

  const ipRl = await rateLimit({
    key: `forgot:ip:${ip}`,
    limit: 5,
    windowSec: 60,
  });
  if (!ipRl.ok) return rateLimitedJson(ipRl.resetAt);
  const emailRl = await rateLimit({
    key: `forgot:email:${email}`,
    limit: 3,
    windowSec: 900,
  });
  if (!emailRl.ok) return rateLimitedJson(emailRl.resetAt);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, status: true },
  });

  if (user && user.status === "ACTIVE") {
    const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000);
    let otpCode: string | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { raw, hash: tokenHash } = newOtpCode();
      try {
        await prisma.emailVerificationToken.create({
          data: { userId: user.id, tokenHash, expiresAt },
        });
        otpCode = raw;
        break;
      } catch (err) {
        const code = (err as { code?: string } | null)?.code;
        if (code === "P2002" && attempt < 4) continue;
        log.error({ err, email }, "forgot_password_otp_failed");
        break;
      }
    }
    if (otpCode) {
      await sendEmail({ to: email, templateKey: "reset_password", vars: { otp: otpCode } }).catch(() => {});
    }
  } else {
    log.info({ email }, "forgot_password_noop_generic_success");
  }

  return okJson();
}
