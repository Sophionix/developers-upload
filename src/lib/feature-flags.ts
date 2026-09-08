import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";

const FLAG_TTL_SECONDS = 30;
const flagCacheKey = (key: string) => `flag:${key}`;

interface FlagRecord {
  enabled: boolean;
  rolloutPct: number;
}

async function loadFlag(key: string): Promise<FlagRecord | null> {
  const cacheKey = flagCacheKey(key);
  const hit = await redis.get(cacheKey);
  if (hit !== null) {
    try {
      return JSON.parse(hit) as FlagRecord;
    } catch (err) {
      logger.warn({ err, key }, "flag_cache_parse_failed");
    }
  }
  const row = await prisma.featureFlag.findUnique({
    where: { key },
    select: { enabled: true, rolloutPct: true },
  });
  const value: FlagRecord | null = row
    ? { enabled: row.enabled, rolloutPct: row.rolloutPct }
    : null;
  await redis.set(
    cacheKey,
    JSON.stringify(value),
    "EX",
    FLAG_TTL_SECONDS,
  );
  return value;
}

// WHY: stable bucket per (flag, user) via sha256 mod 100 — same user always resolves
// to the same rollout bucket so rollouts are monotonic.
function rolloutBucket(key: string, userId: string): number {
  const h = createHash("sha256").update(`${key}:${userId}`).digest();
  return h.readUInt32BE(0) % 100;
}

export async function isFlagEnabled(
  key: string,
  userId?: string,
): Promise<boolean> {
  const flag = await loadFlag(key);
  if (!flag || !flag.enabled) return false;
  if (flag.rolloutPct >= 100) return true;
  if (flag.rolloutPct <= 0) return false;
  if (!userId) return false;
  return rolloutBucket(key, userId) < flag.rolloutPct;
}

export async function invalidateFlagCache(key: string): Promise<void> {
  await redis.del(flagCacheKey(key));
  logger.info({ key }, "flag_cache_invalidated");
}
