import { redis } from "@/lib/redis";

const TTL_SECONDS = 60 * 60 * 24 * 30;

function key(token: string): string {
  return `session_blocklist:${token}`;
}

export async function revoke(token: string): Promise<void> {
  await redis.set(key(token), "1", "EX", TTL_SECONDS);
}

export async function isRevoked(token: string): Promise<boolean> {
  return (await redis.exists(key(token))) === 1;
}
