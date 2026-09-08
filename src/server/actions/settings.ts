"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { RateLimitedError, InvalidPasswordError } from "@/lib/errors";

async function enforceRate(
  key: string,
  limit: number,
  windowSec: number,
): Promise<void> {
  const result = await rateLimit({ key, limit, windowSec });
  if (!result.ok) throw new RateLimitedError();
}

const changePasswordSchema = z
  .object({
    existingPassword: z.string().min(1),
    newPassword: z.string().min(8).max(128),
  })
  .strict();

export async function changePassword(input: {
  existingPassword: string;
  newPassword: string;
}): Promise<{ ok: true }> {
  const user = await requireUser();
  const data = changePasswordSchema.parse(input);
  await enforceRate(`change-pw:${user.id}`, 5, 300);

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!row?.passwordHash) throw new InvalidPasswordError();

  const valid = await bcrypt.compare(data.existingPassword, row.passwordHash);
  if (!valid) throw new InvalidPasswordError();

  const newHash = await bcrypt.hash(data.newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  });

  logger.info({ userId: user.id }, "password_changed");
  return { ok: true };
}

const submitFeedbackSchema = z
  .object({
    title: z.string().trim().min(1, "title_required").max(200),
    message: z.string().trim().min(1, "message_required").max(5000),
    photoKeys: z.array(z.string().max(500)).max(5).optional(),
  })
  .strict();

export async function submitFeedback(input: {
  title: string;
  message: string;
  photoKeys?: string[];
}): Promise<{ ok: true }> {
  const user = await requireUser();
  const data = submitFeedbackSchema.parse(input);
  await enforceRate(`feedback:${user.id}`, 3, 3600);

  // TODO: Persist to SupportTicket model once migration is created,
  // or send via email once SMTP is configured.
  logger.info(
    {
      userId: user.id,
      title: data.title,
      messageLength: data.message.length,
      photoCount: data.photoKeys?.length ?? 0,
    },
    "feedback_submitted",
  );

  return { ok: true };
}
