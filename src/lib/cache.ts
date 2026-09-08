import { revalidateTag } from "next/cache";
import { redis } from "./redis";
import { logger } from "./logger";

export async function withCache<T>(
  key: string,
  tag: string,
  ttlSec: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = await redis.get(key);
  if (hit !== null) {
    try {
      return JSON.parse(hit) as T;
    } catch (err) {
      logger.warn({ err, key }, "cache_parse_failed");
    }
  }
  const fresh = await loader();
  await redis.set(key, JSON.stringify(fresh), "EX", ttlSec);
  await redis.sadd(`cache:tag:${tag}`, key);
  return fresh;
}

export async function invalidateTag(tag: string): Promise<void> {
  const tagKey = `cache:tag:${tag}`;
  const keys = await redis.smembers(tagKey);
  for (const k of keys) {
    await redis.del(k);
  }
  await redis.del(tagKey);
  revalidateTag(tag, "default");
}
