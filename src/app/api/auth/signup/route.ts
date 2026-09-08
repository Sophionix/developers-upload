import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { withRequestId } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { newOtpCode } from "@/lib/crypto";
import { signupSchema } from "@/lib/validation/auth";
import {
  getIp,
  getRequestId,
  okJson,
  errJson,
  zodErrJson,
  rateLimitedJson,
} from "@/lib/http";
import { sendEmail } from "@/lib/mailer";
import { claimGuestUnlocks } from "@/server/actions/guest";
import { GUEST_COOKIE_NAME } from "@/lib/guest-session";

export const runtime = "nodejs";

const VERIFY_TTL_HOURS = 24;

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const log = withRequestId(requestId);
  const ip = getIp(req);

  const body = await req.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrJson(parsed);
  }
  const { fullName, email, password } = parsed.data;

  const ipRl = await rateLimit({
    key: `signup:ip:${ip}`,
    limit: 5,
    windowSec: 60,
  });
  if (!ipRl.ok) return rateLimitedJson(ipRl.resetAt);
  const emailRl = await rateLimit({
    key: `signup:email:${email}`,
    limit: 3,
    windowSec: 900,
  });
  if (!emailRl.ok) return rateLimitedJson(emailRl.resetAt);

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerifiedAt: true },
  });
  if (existing) {
    if (!existing.emailVerifiedAt) {
      const expiresAt = new Date(Date.now() + VERIFY_TTL_HOURS * 60 * 60 * 1000);
      let resentOtp: string | null = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const { raw, hash: tokenHash } = newOtpCode();
        try {
          await prisma.emailVerificationToken.create({
            data: { userId: existing.id, tokenHash, expiresAt },
          });
          resentOtp = raw;
          break;
        } catch (err) {
          const code = (err as { code?: string } | null)?.code;
          if (code === "P2002" && attempt < 4) continue;
          log.error({ err, email }, "signup_resend_otp_failed");
          break;
        }
      }
      if (resentOtp) {
        await sendEmail({ to: email, templateKey: "verify_email", vars: { otp: resentOtp } }).catch(() => {});
      }
    } else {
      // Product choice: surface an explicit "account already exists" instead of
      // generic enumeration-protected success, so users are told to log in.
      log.info({ email }, "signup_duplicate_email_already_verified");
      return errJson("EMAIL_ALREADY_EXISTS", 409);
    }
    return okJson();
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const expiresAt = new Date(Date.now() + VERIFY_TTL_HOURS * 60 * 60 * 1000);
  const guestCookieRaw =
    req.headers
      .get("cookie")
      ?.match(new RegExp(`${GUEST_COOKIE_NAME}=([^;]+)`))?.[1] ?? null;

  let otpCode: string | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { raw, hash: tokenHash } = newOtpCode();
    try {
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            fullName,
            passwordHash,
            consentTermsAt: new Date(),
            status: "ACTIVE",
            preferences: { create: {} },
            notificationPrefs: { create: {} },
            subscription: { create: { tier: "FREE", status: "ACTIVE" } },
            emailVerifications: { create: { tokenHash, expiresAt } },
          },
          select: { id: true },
        });
        await claimGuestUnlocks({ guestCookieRaw, newUserId: user.id, tx });
      });
      otpCode = raw;
      break;
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === "P2002" && attempt < 4) continue;
      log.error({ err, email }, "signup_failed");
      return errJson("INTERNAL_ERROR", 500);
    }
  }

  if (otpCode) {
    await sendEmail({ to: email, templateKey: "verify_email", vars: { otp: otpCode } }).catch(() => {});
  }

  return okJson();
}
