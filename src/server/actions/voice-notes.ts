"use server";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { requireUser } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import {
  NotFoundError,
  RateLimitedError,
  ValidationError,
  StorageNotConfiguredError,
} from "@/lib/errors";
import { readObjectMetadata, isStorageConfigured } from "@/lib/storage";
import { enqueueStorageCleanup } from "@/lib/jobs/storage-cleanup";
import {
  attachVoiceNoteSchema,
  deleteVoiceNoteSchema,
  type AttachVoiceNoteInput,
  type DeleteVoiceNoteInput,
} from "@/lib/validation/journal";

const MIME_ALLOWLIST = new Set([
  "audio/mpeg",
  "audio/ogg",
  "audio/webm",
  "audio/wav",
  "audio/mp4",
  "audio/aac",
  "audio/flac",
  "audio/x-m4a",
]);

async function enforceRate(
  key: string,
  limit: number,
  windowSec: number,
): Promise<void> {
  const result = await rateLimit({ key, limit, windowSec });
  if (!result.ok) throw new RateLimitedError();
}

export async function attachVoiceNote(
  input: AttachVoiceNoteInput,
): Promise<{ id: string }> {
  const user = await requireUser();
  const data = attachVoiceNoteSchema.parse(input);
  await enforceRate(`voice-attach:${user.id}`, 20, 60);

  if (data.durationMs > env.UPLOAD_MAX_VOICE_DURATION_MS) {
    throw new ValidationError("duration_exceeded");
  }

  const requiredPrefix = `users/${user.id}/voice-notes/`;
  if (!data.path.startsWith(requiredPrefix)) {
    throw new ValidationError("path_mismatch");
  }

  const entry = await prisma.journalEntry.findFirst({
    where: { id: data.entryId, userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!entry) throw new NotFoundError();

  if (!isStorageConfigured()) throw new StorageNotConfiguredError();

  const meta = await readObjectMetadata(data.path);
  const validMime =
    meta.contentType === data.mime && MIME_ALLOWLIST.has(meta.contentType);
  const validSize = meta.size > 0 && meta.size <= env.UPLOAD_MAX_VOICE_BYTES;
  if (!validMime) throw new ValidationError("mime_mismatch");
  if (!validSize) throw new ValidationError("size_exceeded");

  const row = await prisma.voiceNote.create({
    data: {
      entryId: entry.id,
      storagePath: data.path,
      durationMs: data.durationMs,
      mimeType: data.mime,
      sizeBytes: meta.size,
    },
    select: { id: true },
  });
  return { id: row.id };
}

export async function deleteVoiceNote(
  input: DeleteVoiceNoteInput,
): Promise<{ ok: true }> {
  const user = await requireUser();
  const { id } = deleteVoiceNoteSchema.parse(input);
  await enforceRate(`voice-delete:${user.id}`, 30, 60);

  const row = await prisma.voiceNote.findFirst({
    where: { id, entry: { userId: user.id } },
    select: { id: true, storagePath: true },
  });
  if (!row) throw new NotFoundError();

  await prisma.voiceNote.delete({ where: { id: row.id } });
  await enqueueStorageCleanup({ path: row.storagePath });
  return { ok: true };
}
