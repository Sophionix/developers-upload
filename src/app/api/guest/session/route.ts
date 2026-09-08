import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import {
  GUEST_COOKIE_NAME,
  createGuestSession,
  guestCookieOptions,
  refreshGuestExpiry,
  resolveGuestSession,
} from "@/lib/guest-session";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown";
  const rl = await rateLimit({ key: `guest:session:${ip}`, limit: 10, windowSec: 60 });
  if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });

  const existingRaw = req.cookies.get(GUEST_COOKIE_NAME)?.value ?? null;
  const existing = await resolveGuestSession(existingRaw);

  if (existing && existingRaw) {
    await refreshGuestExpiry(existing.id);
    const res = NextResponse.json({ ok: true, refreshed: true });
    res.cookies.set(GUEST_COOKIE_NAME, existingRaw, guestCookieOptions());
    return res;
  }

  const { cookieRaw, record } = await createGuestSession(req);
  logger.info({ guestId: record.id }, "guest.session.created");
  const res = NextResponse.json({ ok: true, refreshed: false });
  res.cookies.set(GUEST_COOKIE_NAME, cookieRaw, guestCookieOptions());
  return res;
}
