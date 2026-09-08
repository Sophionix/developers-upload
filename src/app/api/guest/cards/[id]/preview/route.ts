import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  GUEST_COOKIE_NAME,
  createGuestSession,
  guestCookieOptions,
  resolveGuestSession,
} from "@/lib/guest-session";

export const runtime = "nodejs";

const TEASER_LEN = 40;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

  const rawCookie = req.cookies.get(GUEST_COOKIE_NAME)?.value ?? null;
  const guest = await resolveGuestSession(rawCookie);
  let mintedCookie: string | null = null;
  if (!guest) {
    const created = await createGuestSession(req);
    mintedCookie = created.cookieRaw;
  }

  const card = await prisma.card.findFirst({
    where: { id, guestPreview: true, isActive: true },
    select: { id: true, title: true, imageUrl: true, message: true },
  });
  if (!card) {
    const res = NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (mintedCookie) res.cookies.set(GUEST_COOKIE_NAME, mintedCookie, guestCookieOptions());
    return res;
  }

  const teaser =
    card.message.length > TEASER_LEN ? `${card.message.slice(0, TEASER_LEN)}…` : card.message;
  const blurredImageUrl = card.imageUrl ? `${card.imageUrl}?blur=1` : null;

  const res = NextResponse.json({
    id: card.id,
    title: card.title,
    imageUrl: card.imageUrl,
    blurredImageUrl,
    teaser,
  });
  if (mintedCookie) res.cookies.set(GUEST_COOKIE_NAME, mintedCookie, guestCookieOptions());
  return res;
}
