import { createHmac } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { redis } from "@/lib/redis";

const TTL_SECONDS = 60 * 60 * 24 * 30;
const COOKIE_NAME = "mfa-verified";

function key(userId: string): string {
  return `mfa:verified:${userId}`;
}

function sign(userId: string): string {
  const secret = process.env.AUTH_SECRET ?? "dev-secret";
  const hmac = createHmac("sha256", secret).update(userId).digest("hex");
  return `${userId}.${hmac}`;
}

export async function markMfa(
  userId: string,
  ttlSeconds = TTL_SECONDS,
): Promise<void> {
  await redis.set(key(userId), String(Date.now()), "EX", ttlSeconds);
}

export async function hasMfa(userId: string): Promise<boolean> {
  return (await redis.exists(key(userId))) === 1;
}

export function hasMfaCookie(req: NextRequest, userId: string): boolean {
  const cookie = req.cookies.get(COOKIE_NAME);
  if (!cookie) return false;
  return cookie.value === sign(userId);
}

export function setMfaCookie(res: NextResponse, userId: string): void {
  res.cookies.set(COOKIE_NAME, sign(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearMfa(userId: string): Promise<void> {
  await redis.del(key(userId));
}

export function clearMfaCookie(res: NextResponse): void {
  res.cookies.delete(COOKIE_NAME);
}
