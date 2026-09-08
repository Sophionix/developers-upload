interface CursorPayload {
  createdAt: string;
  id: string;
}

const toBase64Url = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const fromBase64Url = (s: string) => Buffer.from(s, "base64url").toString("utf8");

export function encodeCursor(c: { createdAt: Date; id: string }): string {
  return toBase64Url(JSON.stringify({ createdAt: c.createdAt.toISOString(), id: c.id } satisfies CursorPayload));
}

export function decodeCursor(s?: string): { createdAt: Date; id: string } | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(s)) as Partial<CursorPayload>;
    if (!parsed.createdAt || !parsed.id) return null;
    return { createdAt: new Date(parsed.createdAt), id: parsed.id };
  } catch {
    return null;
  }
}

export function paginateCursor<T extends { createdAt: Date; id: string }>(
  rows: T[],
  take: number,
): { items: T[]; nextCursor: string | null } {
  if (rows.length <= take) return { items: rows, nextCursor: null };
  const items = rows.slice(0, take);
  const last = items[items.length - 1];
  return { items, nextCursor: last ? encodeCursor(last) : null };
}

export function paginateKeyset<T extends { createdAt: Date; id: string }>(
  rows: T[],
  take: number,
  hasPrev: boolean,
): { rows: T[]; nextCursor: string | null; prevCursor: string | null } {
  const hasNext = rows.length > take;
  const trimmed = hasNext ? rows.slice(0, take) : rows;
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  return {
    rows: trimmed,
    nextCursor: hasNext && last ? encodeCursor(last) : null,
    prevCursor: hasPrev && first ? encodeCursor(first) : null,
  };
}
