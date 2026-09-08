import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { sha256Hex } from "@/lib/crypto";
import type { GuestSession } from "@/generated/prisma/client";

export const GUEST_COOKIE_NAME = "soph_guest";

function hmac(id: string): string {
  return createHmac("sha256", env.GUEST_SESSION_SECRET).update(id).digest("base64url");
}

export function signGuestCookie(id: string): string {
  return `${id}.${hmac(id)}`;
}

export function verifyGuestCookie(raw: string | undefined): string | null {
  if (!raw) return null;
  const dot = raw.indexOf(".");
  if (dot <= 0) return null;
  const id = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = hmac(id);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? id : null;
}

function ttlMs(): number {
  return env.GUEST_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
}

function clientIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (!fwd) return null;
  const first = fwd.split(",")[0]?.trim();
  return first && first.length > 0 ? first : null;
}

export async function createGuestSession(req: NextRequest): Promise<{
  id: string;
  cookieRaw: string;
  record: GuestSession;
}> {
  const placeholderId = "pending";
  const record = await prisma.guestSession.create({
    data: {
      cookieHash: sha256Hex(`${placeholderId}.bootstrap.${Date.now()}.${Math.random()}`),
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
      expiresAt: new Date(Date.now() + ttlMs()),
    },
  });
  const cookieRaw = signGuestCookie(record.id);
  const updated = await prisma.guestSession.update({
    where: { id: record.id },
    data: { cookieHash: sha256Hex(cookieRaw) },
  });
  return { id: record.id, cookieRaw, record: updated };
}

export async function resolveGuestSession(cookieRaw: string | null): Promise<GuestSession | null> {
  if (!cookieRaw) return null;
  const id = verifyGuestCookie(cookieRaw);
  if (!id) return null;
  const record = await prisma.guestSession.findUnique({
    where: { cookieHash: sha256Hex(cookieRaw) },
  });
  if (!record) return null;
  if (record.id !== id) return null;
  if (record.claimedAt) return null;
  if (record.expiresAt.getTime() <= Date.now()) return null;
  return record;
}

export async function refreshGuestExpiry(id: string): Promise<GuestSession> {
  return prisma.guestSession.update({
    where: { id },
    data: { expiresAt: new Date(Date.now() + ttlMs()) },
  });
}

export function guestCookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: env.GUEST_SESSION_TTL_DAYS * 24 * 60 * 60,
  };
}
