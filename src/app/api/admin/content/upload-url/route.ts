import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { UserRole } from "@/generated/prisma/enums";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { withRequestId } from "@/lib/logger";
import { errJson, zodErrJson, getRequestId, rateLimitedJson } from "@/lib/http";
import { requireUser, UnauthorizedError } from "@/lib/auth/guards";
import { ForbiddenError, requireRole } from "@/lib/rbac";
import { adminUploadUrlSchema } from "@/lib/validation/admin-content";
import {
  issueUploadUrl,
  isStorageConfigured,
  publicUrl,
  StorageNotConfiguredError,
} from "@/lib/storage";

export const runtime = "nodejs";

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const log = withRequestId(requestId);

  let user;
  try {
    user = await requireUser();
    await requireRole([UserRole.SUPER_ADMIN, UserRole.CONTENT_MANAGER]);
  } catch (err) {
    if (err instanceof UnauthorizedError) return errJson("UNAUTHORIZED", 401);
    if (err instanceof ForbiddenError) return errJson(err.code, 403);
    throw err;
  }

  const body = await req.json().catch(() => null);
  const parsed = adminUploadUrlSchema.safeParse(body);
  if (!parsed.success) return zodErrJson(parsed);

  const { contentType, sizeBytes, kind } = parsed.data;
  if (sizeBytes > env.UPLOAD_MAX_CARD_ART_BYTES)
    return errJson("SIZE_TOO_LARGE", 413);

  const rl = await rateLimit({
    key: `admin-content-upload-url:${user.id}`,
    limit: 60,
    windowSec: 3600,
  });
  if (!rl.ok) return rateLimitedJson(rl.resetAt);

  if (!isStorageConfigured()) {
    return errJson("STORAGE_NOT_CONFIGURED", 503);
  }

  const ext = MIME_EXT[contentType] ?? "bin";
  const path = `admin/${kind}/${randomBytes(12).toString("base64url")}.${ext}`;

  try {
    const result = await issueUploadUrl({
      path,
      contentType,
      maxBytes: env.UPLOAD_MAX_CARD_ART_BYTES,
      ttlSec: env.UPLOAD_URL_TTL,
    });
    return NextResponse.json({ ok: true, ...result, publicUrl: publicUrl(path) });
  } catch (err) {
    if (err instanceof StorageNotConfiguredError)
      return errJson("STORAGE_NOT_CONFIGURED", 503);
    log.error({ err }, "admin_content_upload_url_failed");
    return errJson("INTERNAL_ERROR", 500);
  }
}
