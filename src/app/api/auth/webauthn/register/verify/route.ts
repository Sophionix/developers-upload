import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import {
  deleteChallenge,
  readChallenge,
  verifyRegistration,
} from "@/lib/webauthn";

export const runtime = "nodejs";

const bodySchema = z.object({
  response: z.any(),
  deviceName: z.string().trim().min(1).max(120).optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!env.FEATURE_WEBAUTHN) return new NextResponse(null, { status: 404 });

  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const ip =
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ||
    "unknown";
  const rl = await rateLimit({
    key: `wa:reg-verify:${ip}`,
    limit: 20,
    windowSec: 60,
  });
  if (!rl.ok)
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });

  const expectedChallenge = await readChallenge(session.user.id);
  if (!expectedChallenge)
    return NextResponse.json({ error: "CHALLENGE_EXPIRED" }, { status: 400 });

  let result;
  try {
    result = await verifyRegistration(expectedChallenge, parsed.data.response);
  } catch (err) {
    logger.warn(
      { err, userId: session.user.id },
      "webauthn.register.verify_failed",
    );
    return NextResponse.json({ error: "VERIFICATION_FAILED" }, { status: 400 });
  }

  if (!result.verified || !result.registrationInfo) {
    return NextResponse.json({ error: "VERIFICATION_FAILED" }, { status: 400 });
  }

  const credentialId = Buffer.from(
    result.registrationInfo.credentialID,
  ).toString("base64url");
  const transports = Array.isArray(parsed.data.response?.response?.transports)
    ? (parsed.data.response.response.transports as string[]).join(",")
    : null;

  await prisma.authenticator.create({
    data: {
      userId: session.user.id,
      credentialId,
      publicKey: Buffer.from(result.registrationInfo.credentialPublicKey),
      counter: result.registrationInfo.counter,
      transports,
      deviceName: parsed.data.deviceName ?? null,
    },
  });
  await deleteChallenge(session.user.id);
  logger.info(
    { userId: session.user.id, credentialId },
    "webauthn.register.verified",
  );
  return NextResponse.json({ ok: true });
}
