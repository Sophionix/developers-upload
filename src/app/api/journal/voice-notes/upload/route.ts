import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { withRequestId } from "@/lib/logger";
import { errJson, getRequestId, rateLimitedJson } from "@/lib/http";
import { requireUser, UnauthorizedError } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { voiceMimeEnum } from "@/lib/validation/journal";
import {
  putObject,
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

  const rl = await rateLimit({
    key: `voice-upload:${user.id}`,
    limit: 30,
    windowSec: 3600,
  });
  if (!rl.ok) return rateLimitedJson(rl.resetAt);

  if (!isStorageConfigured()) return errJson("STORAGE_NOT_CONFIGURED", 503);

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return errJson("INVALID_BODY", 400);
  }

  const file = formData.get("file");
  const entryId = formData.get("entryId");
  const durationMsRaw = formData.get("durationMs");
  const mimeRaw = formData.get("contentType");

  if (!(file instanceof File)) return errJson("MISSING_FILE", 400);
  if (typeof entryId !== "string" || !entryId) return errJson("MISSING_ENTRY_ID", 400);
  if (typeof durationMsRaw !== "string") return errJson("MISSING_DURATION", 400);
  if (typeof mimeRaw !== "string") return errJson("MISSING_CONTENT_TYPE", 400);

  const mimeParsed = voiceMimeEnum.safeParse(mimeRaw);
  if (!mimeParsed.success) return errJson("INVALID_MIME", 400);
  const mime = mimeParsed.data;

  const durationMs = Number.parseInt(durationMsRaw, 10);
  if (!Number.isFinite(durationMs) || durationMs <= 0)
    return errJson("INVALID_DURATION", 400);

  if (durationMs > env.UPLOAD_MAX_VOICE_DURATION_MS)
    return errJson("DURATION_EXCEEDED", 400);

  const sizeBytes = file.size;
  if (sizeBytes === 0) return errJson("EMPTY_FILE", 400);
  if (sizeBytes > env.UPLOAD_MAX_VOICE_BYTES) return errJson("SIZE_TOO_LARGE", 413);

  // Verify the journal entry belongs to this user
  const entry = await prisma.journalEntry.findFirst({
    where: { id: entryId, userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!entry) return errJson("NOT_FOUND", 404);

  const ext = MIME_TO_EXT[mime] ?? "bin";
  const id = randomBytes(12).toString("base64url");
  const path = `users/${user.id}/voice-notes/${id}.${ext}`;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await putObject(path, buffer, mime);

    const voiceNote = await prisma.voiceNote.create({
      data: {
        entryId: entry.id,
        storagePath: path,
        durationMs,
        mimeType: mime,
        sizeBytes,
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, id: voiceNote.id, path });
  } catch (err) {
    if (err instanceof StorageNotConfiguredError)
      return errJson("STORAGE_NOT_CONFIGURED", 503);
    log.error({ err }, "voice_upload_failed");
    return errJson("INTERNAL_ERROR", 500);
  }
}
