import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { generateRegistration, storeChallenge } from "@/lib/webauthn";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!env.FEATURE_WEBAUTHN) return new NextResponse(null, { status: 404 });

  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const ip =
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ||
    "unknown";
  const rl = await rateLimit({
    key: `wa:reg-opts:${ip}`,
    limit: 20,
    windowSec: 60,
  });
  if (!rl.ok)
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      fullName: true,
      authenticators: { select: { credentialId: true, transports: true } },
    },
  });
  if (!user)
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const options = await generateRegistration({
    id: user.id,
    email: user.email,
    name: user.fullName,
    existingAuthenticators: user.authenticators,
  });
  await storeChallenge(user.id, options.challenge);
  logger.info({ userId: user.id }, "webauthn.register.options");
  return NextResponse.json(options);
}
