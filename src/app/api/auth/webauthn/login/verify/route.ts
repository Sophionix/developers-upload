import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { redis } from "@/lib/redis";
import { verifyAuthentication } from "@/lib/webauthn";

export const runtime = "nodejs";

const bodySchema = z.object({
  response: z.any(),
});

const WA_CHAL_COOKIE = "wa-chal";
const SESSION_TTL_DAYS = 30;

// WHY: Auth.js v5 cookie name constants — mirrors src/lib/auth/index.ts
function authSessionCookieName(): string {
  return process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!env.FEATURE_WEBAUTHN) return new NextResponse(null, { status: 404 });

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown";
  const rlIp = await rateLimit({ key: `wa:login-verify:ip:${ip}`, limit: 20, windowSec: 60 });
  if (!rlIp.ok) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });

  const chalId = req.cookies.get(WA_CHAL_COOKIE)?.value;
  if (!chalId) return NextResponse.json({ error: "CHALLENGE_MISSING" }, { status: 400 });

  const recordRaw = await redis.get(`webauthn:chal:${chalId}`);
  if (!recordRaw) return NextResponse.json({ error: "CHALLENGE_EXPIRED" }, { status: 400 });

  let record: { userId: string | null; challenge: string };
  try {
    record = JSON.parse(recordRaw) as { userId: string | null; challenge: string };
  } catch {
    return NextResponse.json({ error: "CHALLENGE_CORRUPT" }, { status: 400 });
  }

  const credId = parsed.data.response?.id as string | undefined;
  if (!credId) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });

  const authenticator = await prisma.authenticator.findUnique({
    where: { credentialId: credId },
    include: { user: { select: { id: true, status: true } } },
  });
  if (!authenticator) return NextResponse.json({ error: "UNKNOWN_CREDENTIAL" }, { status: 400 });
  if (authenticator.user.status !== "ACTIVE") {
    return NextResponse.json({ error: "ACCOUNT_DEACTIVATED" }, { status: 403 });
  }

  const rlUser = await rateLimit({ key: `wa:login-verify:user:${authenticator.userId}`, limit: 10, windowSec: 60 });
  if (!rlUser.ok) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });

  const credential = {
    id: authenticator.credentialId,
    publicKey: new Uint8Array(authenticator.publicKey),
    counter: authenticator.counter,
    ...(authenticator.transports
      ? { transports: authenticator.transports.split(",").filter(Boolean) as never }
      : {}),
  };

  let result;
  try {
    result = await verifyAuthentication(record.challenge, credential, parsed.data.response);
  } catch (err) {
    logger.warn({ err, userId: authenticator.userId }, "webauthn.login.verify_failed");
    return NextResponse.json({ error: "VERIFICATION_FAILED" }, { status: 400 });
  }

  if (!result.verified || !result.authenticationInfo) {
    return NextResponse.json({ error: "VERIFICATION_FAILED" }, { status: 400 });
  }

  const newCounter = result.authenticationInfo.newCounter;
  // Clone detection: accept 0→0 (some authenticators never increment) but reject regressions.
  if (authenticator.counter > 0 && newCounter <= authenticator.counter) {
    logger.error(
      { userId: authenticator.userId, stored: authenticator.counter, received: newCounter },
      "webauthn.clone_detected",
    );
    return NextResponse.json({ error: "CLONE_DETECTED" }, { status: 401 });
  }

  const sessionToken = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.authenticator.update({
      where: { id: authenticator.id },
      data: { counter: newCounter, lastUsedAt: new Date() },
    }),
    prisma.session.create({
      data: {
        sessionToken,
        userId: authenticator.userId,
        expires,
        ip: ip === "unknown" ? null : ip,
        userAgent: req.headers.get("user-agent"),
      },
    }),
  ]);
  await redis.del(`webauthn:chal:${chalId}`);

  logger.info({ userId: authenticator.userId }, "webauthn.login.verified");
  const res = NextResponse.json({ ok: true });
  res.cookies.set(authSessionCookieName(), sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
  res.cookies.set(WA_CHAL_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
