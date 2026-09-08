import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export function getRequestId(req: Request): string {
  return req.headers.get("x-request-id") ?? randomUUID();
}

export function getIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  return fwd.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export function okJson(): NextResponse {
  return NextResponse.json({ ok: true });
}

export function errJson(
  code: string,
  status = 400,
  headersOrMessage?: Record<string, string> | string,
): NextResponse {
  const message =
    typeof headersOrMessage === "string" ? headersOrMessage : undefined;
  const headers =
    typeof headersOrMessage === "object" ? headersOrMessage : undefined;
  const init: ResponseInit = headers ? { status, headers } : { status };
  const body: Record<string, unknown> = { ok: false, code };
  if (message) body.message = message;
  return NextResponse.json(body, init);
}

export function zodErrJson(result: { error: { issues: Array<{ message: string; path: PropertyKey[] }> } }): NextResponse {
  const issue = result.error.issues[0];
  const field = issue?.path.length
    ? issue.path.map(String).join(".")
    : undefined;
  const raw = issue?.message ?? "Invalid input";
  const message = field ? `${field}: ${raw}` : raw;
  return errJson("INVALID_INPUT", 400, message);
}

export function rateLimitedJson(resetAt: number): NextResponse {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return errJson("RATE_LIMITED", 429, { "Retry-After": String(retryAfter) });
}
