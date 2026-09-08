import Redis from "ioredis";
import { memStore } from "./memory-store";
import { logger } from "./logger";

type RedisLike = typeof memStore;

function createClient(): RedisLike {
  const url = process.env.REDIS_URL;
  if (!url) return memStore;

  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  });

  client.on("error", (err) => logger.error({ err }, "redis_error"));
  client.on("connect", () => logger.info("redis_connected"));

  return client as unknown as RedisLike;
}

const g = globalThis as unknown as { _redis?: RedisLike };
export const redis: RedisLike = (g._redis ??= createClient());
