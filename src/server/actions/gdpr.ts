"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { requireUser } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { revoke as revokeSessionToken } from "@/lib/session-blocklist";
import { RateLimitedError, DeletionStateError } from "@/lib/errors";

async function enforceRate(
  key: string,
  limit: number,
  windowSec: number,
): Promise<void> {
  const result = await rateLimit({ key, limit, windowSec });
  if (!result.ok) throw new RateLimitedError();
}

const requestExportSchema = z
  .object({ format: z.enum(["CSV", "PDF"]).default("CSV") })
  .strict()
  .optional();

const DAY_MS = 86_400_000;

export async function requestDataExport(input?: {
  format?: "CSV" | "PDF";
}): Promise<{ exportRequestId: string }> {
  const user = await requireUser();
  const parsed = requestExportSchema.parse(input);
  const format = parsed?.format ?? "CSV";
  await enforceRate(`export:${user.id}`, 5, 60);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await prisma.exportRequest.findFirst({
    where: {
      userId: user.id,
      createdAt: { gt: since },
      status: { not: "FAILED" },
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  if (recent) throw new RateLimitedError();

  const row = await prisma.exportRequest.create({
    data: {
      userId: user.id,
      scope: "JOURNAL_FULL",
      format,
      status: "QUEUED",
    },
    select: { id: true },
  });
  return { exportRequestId: row.id };
}

const requestDeletionSchema = z
  .object({ reason: z.string().trim().max(500).optional() })
  .strict()
  .optional();

export async function requestAccountDeletion(input?: {
  reason?: string;
}): Promise<{ id: string; scheduledAt: Date }> {
  const user = await requireUser();
  const parsed = requestDeletionSchema.parse(input);
  await enforceRate(`gdpr-delete:${user.id}`, 3, 3600);

  const existing = await prisma.dataDeletionRequest.findUnique({
    where: { userId: user.id },
    select: { id: true, scheduledAt: true, processedAt: true },
  });
  if (existing && existing.processedAt === null) {
    return { id: existing.id, scheduledAt: existing.scheduledAt };
  }

  const scheduledAt = new Date(
    Date.now() + env.GDPR_DELETION_GRACE_DAYS * DAY_MS,
  );

  const result = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { status: "PENDING_DELETION" },
    });
    const row = existing
      ? await tx.dataDeletionRequest.update({
          where: { userId: user.id },
          data: {
            scheduledAt,
            processedAt: null,
            reason: parsed?.reason ?? null,
            requestedAt: new Date(),
          },
          select: { id: true, scheduledAt: true },
        })
      : await tx.dataDeletionRequest.create({
          data: {
            userId: user.id,
            scheduledAt,
            reason: parsed?.reason ?? null,
          },
          select: { id: true, scheduledAt: true },
        });

    const sessions = await tx.session.findMany({
      where: { userId: user.id },
      select: { sessionToken: true },
    });
    await tx.session.deleteMany({ where: { userId: user.id } });
    return { row, tokens: sessions.map((s) => s.sessionToken) };
  });

  for (const t of result.tokens) await revokeSessionToken(t);

  return { id: result.row.id, scheduledAt: result.row.scheduledAt };
}

export async function cancelAccountDeletion(): Promise<{ ok: true }> {
  const user = await requireUser();
  await enforceRate(`gdpr-cancel:${user.id}`, 5, 3600);

  const existing = await prisma.dataDeletionRequest.findUnique({
    where: { userId: user.id },
    select: { id: true, scheduledAt: true, processedAt: true },
  });
  if (
    !existing ||
    existing.processedAt !== null ||
    existing.scheduledAt <= new Date()
  ) {
    throw new DeletionStateError();
  }

  await prisma.$transaction(async (tx) => {
    await tx.dataDeletionRequest.delete({ where: { userId: user.id } });
    await tx.user.update({
      where: { id: user.id },
      data: { status: "ACTIVE" },
    });
  });

  return { ok: true };
}
