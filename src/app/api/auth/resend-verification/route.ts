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

const VERIFY_TTL_HOURS = 24;

export async function POST(req: Request): Promise<NextResponse> {
  const log = withRequestId(getRequestId(req));
  const ip = getIp(req);
  const body = await req.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) return zodErrJson(parsed);
  const { email } = parsed.data;

  const ipRl = await rateLimit({
    key: `resend-verify:ip:${ip}`,
    limit: 5,
    windowSec: 60,
  });
  if (!ipRl.ok) return rateLimitedJson(ipRl.resetAt);
  const emailRl = await rateLimit({
    key: `resend-verify:email:${email}`,
    limit: 3,
    windowSec: 900,
  });
  if (!emailRl.ok) return rateLimitedJson(emailRl.resetAt);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerifiedAt: true },
  });

  if (user && !user.emailVerifiedAt) {
    const expiresAt = new Date(Date.now() + VERIFY_TTL_HOURS * 60 * 60 * 1000);
    let resentOtp: string | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { raw, hash: tokenHash } = newOtpCode();
      try {
        await prisma.emailVerificationToken.create({
          data: { userId: user.id, tokenHash, expiresAt },
        });
        resentOtp = raw;
        break;
      } catch (err) {
        const code = (err as { code?: string } | null)?.code;
        if (code === "P2002" && attempt < 4) continue;
        log.error({ err, email }, "resend_verification_failed");
        break;
      }
    }
    if (resentOtp) {
      await sendEmail({ to: email, templateKey: "verify_email", vars: { otp: resentOtp } }).catch(() => {});
    }
  } else {
    log.info({ email }, "resend_verification_noop_generic_success");
  }

  return okJson();
}
