type Entry = { value: string; expiresAt: number | null };

const store = new Map<string, Entry>();

const CLEANUP_INTERVAL = 60_000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of store) {
      if (v.expiresAt !== null && v.expiresAt <= now) store.delete(k);
    }
  }, CLEANUP_INTERVAL);
  cleanupTimer.unref();
}

function isAlive(e: Entry | undefined): e is Entry {
  if (!e) return false;
  if (e.expiresAt !== null && e.expiresAt <= Date.now()) return false;
  return true;
}

function resolveExpiry(ttlMs: number | null): number | null {
  return ttlMs !== null ? Date.now() + ttlMs : null;
}

// All operations are synchronous within a single tick — no awaits between
// read and write, so Node's single-threaded model guarantees atomicity.
// The async signatures are kept for ioredis API compatibility.

export const memStore = {
  get(key: string): Promise<string | null> {
    const e = store.get(key);
    if (!isAlive(e)) { store.delete(key); return Promise.resolve(null); }
    return Promise.resolve(e.value);
  },

  set(key: string, value: string, ...args: Array<string | number>): Promise<string | null> {
    ensureCleanup();
    let ttlMs: number | null = null;
    let nx = false;

    for (let i = 0; i < args.length; i++) {
      const a = String(args[i]).toUpperCase();
      if (a === "EX") { ttlMs = Number(args[++i]) * 1000; }
      else if (a === "PX") { ttlMs = Number(args[++i]); }
      else if (a === "NX") { nx = true; }
    }

    if (nx && isAlive(store.get(key))) return Promise.resolve(null);

    store.set(key, { value, expiresAt: resolveExpiry(ttlMs) });
    return Promise.resolve("OK");
  },

  del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const k of keys) { if (store.delete(k)) count++; }
    return Promise.resolve(count);
  },

  exists(...keys: string[]): Promise<number> {
    let count = 0;
    for (const k of keys) { if (isAlive(store.get(k))) count++; }
    return Promise.resolve(count);
  },

  incr(key: string): Promise<number> {
    ensureCleanup();
    const e = store.get(key);
    const current = isAlive(e) ? parseInt(e.value, 10) || 0 : 0;
    const next = current + 1;
    store.set(key, { value: String(next), expiresAt: isAlive(e) ? e.expiresAt : null });
    return Promise.resolve(next);
  },

  expire(key: string, seconds: number): Promise<number> {
    const e = store.get(key);
    if (!isAlive(e)) return Promise.resolve(0);
    e.expiresAt = Date.now() + seconds * 1000;
    return Promise.resolve(1);
  },

  sadd(key: string, ...members: string[]): Promise<number> {
    ensureCleanup();
    const e = store.get(key);
    const set = new Set<string>(isAlive(e) ? JSON.parse(e.value) as string[] : []);
    let added = 0;
    for (const m of members) { if (!set.has(m)) { set.add(m); added++; } }
    store.set(key, { value: JSON.stringify([...set]), expiresAt: isAlive(e) ? e.expiresAt : null });
    return Promise.resolve(added);
  },

  smembers(key: string): Promise<string[]> {
    const e = store.get(key);
    if (!isAlive(e)) return Promise.resolve([]);
    return Promise.resolve(JSON.parse(e.value) as string[]);
  },

  eval(
    _script: string,
    _numKeys: number,
    ...args: Array<string | number>
  ): Promise<unknown> {
    const key = String(args[0]);
    const now = Number(args[1]);
    const windowMs = Number(args[2]);
    const limit = Number(args[3]);

    const windowKey = `_sliding:${key}`;
    const e = store.get(windowKey);
    let entries: number[] = isAlive(e) ? JSON.parse(e.value) as number[] : [];

    entries = entries.filter((t) => t > now - windowMs);

    if (entries.length < limit) {
      entries.push(now);
      store.set(windowKey, { value: JSON.stringify(entries), expiresAt: Date.now() + windowMs });
      return Promise.resolve([1, limit - entries.length]);
    }
    return Promise.resolve([0, 0]);
  },
};
