const REDACT_KEYS = new Set([
  "password", "token", "authorization", "cookie", "set-cookie",
  "totpsecret", "totpsecretenc", "privatekey",
]);

function redact(obj: unknown): unknown {
  if (typeof obj !== "object" || obj === null) return obj;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (REDACT_KEYS.has(k.toLowerCase())) {
      out[k] = "[REDACTED]";
    } else if (typeof v === "object" && v !== null && !(v instanceof Error)) {
      out[k] = redact(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function format(meta: unknown, msg: string): string {
  if (meta && typeof meta === "object" && Object.keys(meta as object).length > 0) {
    return `${msg} ${JSON.stringify(redact(meta))}`;
  }
  return msg;
}

export const logger = {
  info(meta: unknown, msg?: string) {
    if (typeof meta === "string") { console.info(meta); return; }
    console.info(format(meta, msg ?? ""));
  },
  warn(meta: unknown, msg?: string) {
    if (typeof meta === "string") { console.warn(meta); return; }
    console.warn(format(meta, msg ?? ""));
  },
  error(meta: unknown, msg?: string) {
    if (typeof meta === "string") { console.error(meta); return; }
    console.error(format(meta, msg ?? ""));
  },
  debug(meta: unknown, msg?: string) {
    if (typeof meta === "string") { console.debug(meta); return; }
    console.debug(format(meta, msg ?? ""));
  },
  child(_bindings: Record<string, unknown>) {
    return logger;
  },
};

export function withRequestId(_requestId: string) {
  return logger;
}
