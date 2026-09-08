import { redis } from "./redis";

export interface RateLimitArgs {
  key: string;
  limit: number;
  windowSec: number;
  now?: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

const SLIDING_WINDOW_LUA = `
local key   = KEYS[1]
local now   = tonumber(ARGV[1])
local win   = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])

redis.call('ZREMRANGEBYSCORE', key, '-inf', now - win)
local count = redis.call('ZCARD', key)

if count < limit then
  redis.call('ZADD', key, now, tostring(now) .. ':' .. tostring(math.random(1000000)))
  redis.call('PEXPIRE', key, win)
  return {1, limit - count - 1}
end
return {0, 0}
`;

export async function rateLimit(args: RateLimitArgs): Promise<RateLimitResult> {
  const now = args.now ?? Date.now();
  const windowMs = args.windowSec * 1000;
  const [ok, remaining] = (await redis.eval(
    SLIDING_WINDOW_LUA,
    1,
    `rl:${args.key}`,
    String(now),
    String(windowMs),
    String(args.limit),
  )) as [number, number];
  return { ok: ok === 1, remaining, resetAt: now + windowMs };
}
