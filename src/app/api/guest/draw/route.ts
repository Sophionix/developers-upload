import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { rateLimit } from '@/lib/rate-limit'
import {
  GUEST_COOKIE_NAME,
  createGuestSession,
  guestCookieOptions,
  resolveGuestSession
} from '@/lib/guest-session'

export const runtime = 'nodejs'

const bodySchema = z.object({
  deckId: z.string().min(1),
  count: z.number().int().min(1).max(2).default(1)
})

export async function POST (req: NextRequest): Promise<NextResponse> {
  const rawCookie = req.cookies.get(GUEST_COOKIE_NAME)?.value ?? null
  let guest = await resolveGuestSession(rawCookie)
  let mintedCookie: string | null = null
  if (!guest) {
    const created = await createGuestSession(req)
    guest = created.record
    mintedCookie = created.cookieRaw
  }

  // Verify guest has a fresh, paid deck unlock. Pay-per-use: the unlock is only
  // valid briefly after purchase (long enough to complete the draw just paid
  // for) — no day-long free access. Each new draw requires a new payment.
  const UNLOCK_WINDOW_MS = 15 * 60 * 1000
  const unlockCutoff = new Date(Date.now() - UNLOCK_WINDOW_MS)
  const unlock = await prisma.payment.findFirst({
    where: {
      guestSessionId: guest.id,
      type: 'CARD_UNLOCK',
      status: 'SUCCEEDED',
      createdAt: { gte: unlockCutoff }
    },
    select: { id: true },
    orderBy: { createdAt: 'desc' }
  })

  if (!unlock) {
    const res = NextResponse.json({ error: 'UNLOCK_REQUIRED' }, { status: 403 })
    if (mintedCookie)
      res.cookies.set(GUEST_COOKIE_NAME, mintedCookie, guestCookieOptions())
    return res
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    const res = NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
    if (mintedCookie)
      res.cookies.set(GUEST_COOKIE_NAME, mintedCookie, guestCookieOptions())
    return res
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    const res = NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
    if (mintedCookie)
      res.cookies.set(GUEST_COOKIE_NAME, mintedCookie, guestCookieOptions())
    return res
  }

  const { deckId, count } = parsed.data

  const rl = await rateLimit({
    key: `guest:draw:${guest.id}`,
    limit: 10,
    windowSec: 3600
  })
  if (!rl.ok) {
    const res = NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 })
    if (mintedCookie)
      res.cookies.set(GUEST_COOKIE_NAME, mintedCookie, guestCookieOptions())
    return res
  }

  // Draw random cards from the deck
  const candidates = await prisma.card.findMany({
    where: { deckId, isActive: true },
    select: {
      id: true,
      title: true,
      message: true,
      prompt: true,
      imageUrl: true
    }
  })

  if (candidates.length === 0) {
    const res = NextResponse.json({ error: 'NO_CARDS' }, { status: 404 })
    if (mintedCookie)
      res.cookies.set(GUEST_COOKIE_NAME, mintedCookie, guestCookieOptions())
    return res
  }

  const shuffled = [...candidates].sort(() => Math.random() - 0.5)
  const drawn = shuffled.slice(0, Math.min(count, shuffled.length))

  logger.info(
    { guestId: guest.id, deckId, count, cardIds: drawn.map(c => c.id) },
    'guest.draw'
  )

  const res = NextResponse.json({
    ok: true,
    cards: drawn.map(c => ({
      id: c.id,
      title: c.title,
      message: c.message,
      prompt: c.prompt,
      imageUrl: c.imageUrl
    }))
  })
  if (mintedCookie)
    res.cookies.set(GUEST_COOKIE_NAME, mintedCookie, guestCookieOptions())
  return res
}
