import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withCache } from "@/lib/cache";
import {
  GUEST_COOKIE_NAME,
  createGuestSession,
  guestCookieOptions,
  resolveGuestSession,
} from "@/lib/guest-session";

export const runtime = "nodejs";

const PAGE_SIZE = 20;
const CACHE_TTL_SEC = 300;

interface SortCursor {
  sortOrder: number;
  id: string;
}

function encodeCursor(c: SortCursor): string {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
}

function decodeCursor(raw: string | null): SortCursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<SortCursor>;
    if (typeof parsed.sortOrder !== "number" || typeof parsed.id !== "string") return null;
    return { sortOrder: parsed.sortOrder, id: parsed.id };
  } catch {
    return null;
  }
}

const querySchema = z.object({ cursor: z.string().optional() });

async function fetchPage(cursor: SortCursor | null) {
  const rows = await prisma.card.findMany({
    where: { guestPreview: true, isActive: true },
    select: { id: true, deckId: true, title: true, imageUrl: true, accessType: true, sortOrder: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    take: PAGE_SIZE + 1,
    ...(cursor
      ? {
          cursor: { id: cursor.id },
          skip: 1,
        }
      : {}),
  });
  const hasMore = rows.length > PAGE_SIZE;
  const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const last = items[items.length - 1];
  const nextCursor = hasMore && last ? encodeCursor({ sortOrder: last.sortOrder, id: last.id }) : null;
  return {
    items: items.map((c) => ({
      id: c.id,
      deckId: c.deckId,
      title: c.title,
      imageUrl: c.imageUrl,
      accessType: c.accessType,
    })),
    nextCursor,
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({ cursor: url.searchParams.get("cursor") ?? undefined });
  if (!parsed.success) return NextResponse.json({ error: "INVALID_QUERY" }, { status: 400 });
  const cursor = decodeCursor(parsed.data.cursor ?? null);

  const rawCookie = req.cookies.get(GUEST_COOKIE_NAME)?.value ?? null;
  const guest = await resolveGuestSession(rawCookie);
  let mintedCookie: string | null = null;
  if (!guest) {
    const created = await createGuestSession(req);
    mintedCookie = created.cookieRaw;
  }

  const cacheKey = `cache:v1:cards:guest:${cursor ? encodeCursor(cursor) : "start"}`;
  const payload = await withCache(cacheKey, "cards:guest", CACHE_TTL_SEC, () => fetchPage(cursor));

  const res = NextResponse.json(payload);
  if (mintedCookie) res.cookies.set(GUEST_COOKIE_NAME, mintedCookie, guestCookieOptions());
  return res;
}
