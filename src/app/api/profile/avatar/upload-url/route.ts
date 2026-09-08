import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { withRequestId } from "@/lib/logger";
import { errJson, zodErrJson, getRequestId, rateLimitedJson } from "@/lib/http";
import { requireUser, UnauthorizedError } from "@/lib/auth/guards";
import { avatarUploadUrlSchema } from "@/lib/validation/profile";
import {
  issueUploadUrl,
  isStorageConfigured,
  StorageNotConfiguredError,
} from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const log = withRequestId(requestId);

  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof UnauthorizedError) return errJson("UNAUTHORIZED", 401);
    throw err;
  }

  const body = await req.json().catch(() => null);
  const parsed = avatarUploadUrlSchema.safeParse(body);
  if (!parsed.success) return zodErrJson(parsed);

  const { contentType, sizeBytes, ext } = parsed.data;
  if (sizeBytes > env.UPLOAD_MAX_AVATAR_BYTES)
    return errJson("SIZE_TOO_LARGE", 413);

  const rl = await rateLimit({
    key: `avatar-upload-url:${user.id}`,
    limit: 10,
    windowSec: 3600,
  });
  if (!rl.ok) return rateLimitedJson(rl.resetAt);

  if (!isStorageConfigured()) {
    return errJson("STORAGE_NOT_CONFIGURED", 503);
  }

  const id = randomBytes(12).toString("base64url");
  const path = `avatars/${user.id}/${id}.${ext}`;

  try {
    const result = await issueUploadUrl({
      path,
      contentType,
      maxBytes: env.UPLOAD_MAX_AVATAR_BYTES,
      ttlSec: env.UPLOAD_URL_TTL,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof StorageNotConfiguredError)
      return errJson("STORAGE_NOT_CONFIGURED", 503);
    log.error({ err }, "avatar_upload_url_failed");
    return errJson("INTERNAL_ERROR", 500);
  }
}
