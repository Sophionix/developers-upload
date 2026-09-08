import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withCache } from "@/lib/cache";
import {
  GUEST_COOKIE_NAME,
  createGuestSession,
  guestCookieOptions,
  resolveGuestSession,
} from "@/lib/guest-session";

export const runtime = "nodejs";

const CACHE_TTL_SEC = 300;

async function fetchGuestDeck() {
  return await prisma.deck.findFirst({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      coverUrl: true,
      sortOrder: true,
      createdAt: true,
      _count: { select: { cards: { where: { isActive: true } } } },
    },
  });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const rawCookie = req.cookies.get(GUEST_COOKIE_NAME)?.value ?? null;
  const guest = await resolveGuestSession(rawCookie);
  let mintedCookie: string | null = null;
  if (!guest) {
    const created = await createGuestSession(req);
    mintedCookie = created.cookieRaw;
  }

  const deck = await withCache(
    "cache:v1:guest:deck",
    "guest:deck",
    CACHE_TTL_SEC,
    fetchGuestDeck,
  );

  const res = NextResponse.json({ deck });
  if (mintedCookie)
    res.cookies.set(GUEST_COOKIE_NAME, mintedCookie, guestCookieOptions());
  return res;
}
