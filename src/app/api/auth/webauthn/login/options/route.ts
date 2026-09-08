import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { redis } from "@/lib/redis";
import { generateAuthentication } from "@/lib/webauthn";

export const runtime = "nodejs";

const bodySchema = z.object({ email: z.string().email().optional() });

const WA_CHAL_COOKIE = "wa-chal";
const WA_CHAL_TTL_SEC = 300;

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!env.FEATURE_WEBAUTHN) return new NextResponse(null, { status: 404 });

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown";
  const rl = await rateLimit({ key: `wa:login-opts:${ip}`, limit: 20, windowSec: 60 });
  if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });

  let userId: string | null = null;
  let allowCredentials: { credentialId: string; transports: string | null }[] = [];
  if (parsed.data.email) {
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, authenticators: { select: { credentialId: true, transports: true } } },
    });
    if (user) {
      userId = user.id;
      allowCredentials = user.authenticators;
    }
  }

  const options = await generateAuthentication(allowCredentials);
  const chalId = randomBytes(16).toString("base64url");
  await redis.set(
    `webauthn:chal:${chalId}`,
    JSON.stringify({ userId, challenge: options.challenge }),
    "EX",
    WA_CHAL_TTL_SEC,
  );

  logger.info({ chalId, hasUser: Boolean(userId) }, "webauthn.login.options");
  const res = NextResponse.json(options);
  res.cookies.set(WA_CHAL_COOKIE, chalId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: WA_CHAL_TTL_SEC,
  });
  return res;
}
