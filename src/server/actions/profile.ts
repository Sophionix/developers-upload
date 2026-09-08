"use server";

import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { requireUser } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { sha256Hex } from "@/lib/crypto";
import { revoke as revokeSessionToken } from "@/lib/session-blocklist";
import {
  readObjectMetadata,
  deleteObject,
  isStorageConfigured,
  publicUrl,
  StorageNotConfiguredError,
} from "@/lib/storage";
import {
  updateProfileSchema,
  setAvatarSchema,
  requestEmailChangeSchema,
  revokeSessionSchema,
  type UpdateProfileInput,
  type SetAvatarInput,
  type RequestEmailChangeInput,
} from "@/lib/validation/profile";
import { RateLimitedError, InvalidUploadError, NotFoundError } from "@/lib/errors";

const AVATAR_MIME_ALLOWLIST = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const EMAIL_VERIFY_TTL_HOURS = 24;
const SESSION_COOKIE_NAMES = [
  "__Secure-authjs.session-token",
  "authjs.session-token",
];

async function enforceRate(
  key: string,
  limit: number,
  windowSec: number,
): Promise<void> {
  const result = await rateLimit({ key, limit, windowSec });
  if (!result.ok) throw new RateLimitedError();
}

export interface ProfileDto {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  role: string;
  status: string;
  hasCompletedOnboarding: boolean;
  timezone: string | null;
  locale: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
  country: string | null;
  state: string | null;
  phone: string | null;
}

export async function getProfile(): Promise<ProfileDto> {
  const user = await requireUser();
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      fullName: true,
      avatarUrl: true,
      role: true,
      status: true,
      hasCompletedOnboarding: true,
      timezone: true,
      locale: true,
      dateOfBirth: true,
      gender: true,
      country: true,
      state: true,
      phone: true,
    },
  });
  if (!row) throw new NotFoundError();
  return row;
}

export async function updateProfile(
  input: UpdateProfileInput,
): Promise<{ ok: true }> {
  const user = await requireUser();
  const data = updateProfileSchema.parse(input);
  await enforceRate(`profile:${user.id}`, 20, 60);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(data.fullName !== undefined && { fullName: data.fullName }),
      ...(data.timezone !== undefined && { timezone: data.timezone }),
      ...(data.locale !== undefined && { locale: data.locale }),
      ...(data.dateOfBirth !== undefined && {
        dateOfBirth: new Date(data.dateOfBirth),
      }),
      ...(data.gender !== undefined && { gender: data.gender }),
      ...(data.country !== undefined && { country: data.country }),
      ...(data.state !== undefined && { state: data.state }),
      ...(data.phone !== undefined && { phone: data.phone }),
    },
  });
  return { ok: true };
}

export async function setAvatar(
  input: SetAvatarInput,
): Promise<{ ok: true; avatarUrl: string }> {
  const user = await requireUser();
  const { storagePath } = setAvatarSchema.parse(input);
  await enforceRate(`avatar:${user.id}`, 10, 60);

  const requiredPrefix = `avatars/${user.id}/`;
  if (!storagePath.startsWith(requiredPrefix))
    throw new InvalidUploadError("path_mismatch");

  if (!isStorageConfigured()) throw new StorageNotConfiguredError();

  const meta = await readObjectMetadata(storagePath);
  const validMime =
    meta.contentType && AVATAR_MIME_ALLOWLIST.has(meta.contentType);
  const validSize = meta.size > 0 && meta.size <= env.UPLOAD_MAX_AVATAR_BYTES;
  if (!validMime || !validSize) {
    void deleteObject(storagePath);
    throw new InvalidUploadError(
      validMime ? "size_exceeded" : "mime_not_allowed",
    );
  }

  const avatarUrl = publicUrl(storagePath);
  await prisma.user.update({
    where: { id: user.id },
    data: { avatarUrl },
  });
  return { ok: true, avatarUrl };
}

export async function requestEmailChange(
  input: RequestEmailChangeInput,
): Promise<{ ok: true }> {
  const user = await requireUser();
  const { newEmail } = requestEmailChangeSchema.parse(input);
  await enforceRate(`email-change:${user.id}`, 3, 3600);

  if (newEmail === user.email) return { ok: true };

  const existing = await prisma.user.findUnique({
    where: { email: newEmail },
    select: { id: true },
  });
  if (existing) {
    logger.info(
      { userId: user.id },
      "email_change_target_taken_generic_success",
    );
    return { ok: true };
  }

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = sha256Hex(rawToken);
  const expires = new Date(
    Date.now() + EMAIL_VERIFY_TTL_HOURS * 60 * 60 * 1000,
  );

  await prisma.verificationToken.create({
    data: { identifier: newEmail, token: tokenHash, expires },
  });

  // TODO: wire verification handler that, after re-auth proof, flips User.email to newEmail.
  const link = `${env.NEXT_PUBLIC_APP_URL}/verify-email-change?token=${rawToken}`;
  logger.info({ userId: user.id, newEmail, link }, "would-email-change");
  return { ok: true };
}

export interface ActiveSessionDto {
  id: string;
  ip: string | null;
  userAgent: string | null;
  expires: Date;
  current: boolean;
}

async function readCurrentSessionToken(): Promise<string | null> {
  const store = await cookies();
  for (const name of SESSION_COOKIE_NAMES) {
    const v = store.get(name)?.value;
    if (v) return v;
  }
  return null;
}

export async function listActiveSessions(): Promise<ActiveSessionDto[]> {
  const user = await requireUser();
  const currentToken = await readCurrentSessionToken();
  const rows = await prisma.session.findMany({
    where: { userId: user.id, expires: { gt: new Date() } },
    select: {
      id: true,
      sessionToken: true,
      ip: true,
      userAgent: true,
      expires: true,
    },
    orderBy: { expires: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    ip: r.ip,
    userAgent: r.userAgent,
    expires: r.expires,
    current: currentToken !== null && r.sessionToken === currentToken,
  }));
}

export async function revokeSession(input: {
  id: string;
}): Promise<{ ok: true }> {
  const user = await requireUser();
  const { id } = revokeSessionSchema.parse(input);
  await enforceRate(`session-revoke:${user.id}`, 10, 60);

  const row = await prisma.session.findUnique({
    where: { id },
    select: { id: true, userId: true, sessionToken: true },
  });
  if (!row || row.userId !== user.id) throw new NotFoundError();

  await prisma.session.delete({ where: { id: row.id } });
  await revokeSessionToken(row.sessionToken);
  return { ok: true };
}
