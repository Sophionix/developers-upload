import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { withRequestId } from "@/lib/logger";
import { errJson, zodErrJson, getRequestId, rateLimitedJson } from "@/lib/http";
import { requireUser, UnauthorizedError } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { voiceNoteUploadUrlSchema } from "@/lib/validation/journal";
import {
  issueUploadUrl,
  isStorageConfigured,
  StorageNotConfiguredError,
} from "@/lib/storage";

const MIME_TO_EXT: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
  "audio/wav": "wav",
  "audio/mp4": "mp4",
  "audio/aac": "aac",
  "audio/flac": "flac",
  "audio/x-m4a": "m4a",
};

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
  const parsed = voiceNoteUploadUrlSchema.safeParse(body);
  if (!parsed.success) return zodErrJson(parsed);

  const { contentType, sizeBytes, entryId } = parsed.data;
  if (sizeBytes > env.UPLOAD_MAX_VOICE_BYTES)
    return errJson("SIZE_TOO_LARGE", 413);

  const rl = await rateLimit({
    key: `voice-upload-url:${user.id}`,
    limit: 30,
    windowSec: 3600,
  });
  if (!rl.ok) return rateLimitedJson(rl.resetAt);

  if (entryId) {
    const entry = await prisma.journalEntry.findFirst({
      where: { id: entryId, userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!entry) return errJson("NOT_FOUND", 404);
  }

  if (!isStorageConfigured()) return errJson("STORAGE_NOT_CONFIGURED", 503);

  const ext = MIME_TO_EXT[contentType] ?? "bin";
  const id = randomBytes(12).toString("base64url");
  const path = `users/${user.id}/voice-notes/${id}.${ext}`;

  try {
    const result = await issueUploadUrl({
      path,
      contentType,
      maxBytes: env.UPLOAD_MAX_VOICE_BYTES,
      ttlSec: env.UPLOAD_URL_TTL,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof StorageNotConfiguredError)
      return errJson("STORAGE_NOT_CONFIGURED", 503);
    log.error({ err }, "voice_upload_url_failed");
    return errJson("INTERNAL_ERROR", 500);
  }
}
