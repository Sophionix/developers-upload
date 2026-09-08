import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

// TEMPORARY one-shot admin utility, gated by CRON_SECRET. Remove after use —
// this is not a general-purpose user-management endpoint.
export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : null;
  if (!email) {
    return NextResponse.json({ error: "email_required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });
  if (!user) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.user.delete({ where: { id: user.id } });
  logger.warn({ userId: user.id, email }, "admin_delete_user_via_temp_route");

  return NextResponse.json({ ok: true, deleted: user.id });
}
