"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { invalidateTag } from "@/lib/cache";
import { logger } from "@/lib/logger";
import { RateLimitedError } from "@/lib/errors";
import {
  completeOnboardingSchema,
  updatePreferencesSchema,
  updateNotificationPrefsSchema,
  registerFcmTokenSchema,
  revokeFcmTokenSchema,
  type CompleteOnboardingInput,
  type UpdatePreferencesInput,
  type UpdateNotificationPrefsInput,
  type RegisterFcmTokenInput,
  type RevokeFcmTokenInput,
} from "@/lib/validation/preferences";


async function enforceRate(
  key: string,
  limit: number,
  windowSec: number,
): Promise<void> {
  const result = await rateLimit({ key, limit, windowSec });
  if (!result.ok) throw new RateLimitedError();
}

function normalizeHex(color: string | undefined): string | undefined {
  if (!color) return color;
  return color.startsWith("#") ? color : `#${color}`;
}

const FCM_STALE_MS = 1000 * 60 * 60 * 24 * 90;

export async function completeOnboarding(
  input: CompleteOnboardingInput,
): Promise<{ ok: true }> {
  const user = await requireUser();
  const data = completeOnboardingSchema.parse(input);
  await enforceRate(`onboarding:${user.id}`, 10, 60);

  const accentColor = normalizeHex(data.accentColor);

  await prisma.$transaction(async (tx) => {
    await tx.userPreference.upsert({
      where: { userId: user.id },
      update: {
        ...(data.theme !== undefined && { theme: data.theme }),
        ...(accentColor !== undefined && { accentColor }),
        ...(data.tone !== undefined && { tone: data.tone }),
        ...(data.dailyCardAtHour !== undefined && {
          dailyCardAtHour: data.dailyCardAtHour,
        }),
      },
      create: {
        userId: user.id,
        theme: data.theme ?? "AUTO",
        accentColor: accentColor ?? null,
        tone: data.tone ?? "NEUTRAL",
        dailyCardAtHour: data.dailyCardAtHour ?? null,
      },
    });
    await tx.notificationPreference.upsert({
      where: { userId: user.id },
      update: {
        ...(data.remindersEnabled !== undefined && {
          remindersEnabled: data.remindersEnabled,
        }),
        ...(data.channel !== undefined && { channel: data.channel }),
        ...(data.scheduleCron !== undefined && {
          scheduleCron: data.scheduleCron,
        }),
        ...(data.weeklyNewsletter !== undefined && {
          weeklyNewsletter: data.weeklyNewsletter,
        }),
      },
      create: {
        userId: user.id,
        remindersEnabled: data.remindersEnabled ?? true,
        channel: data.channel ?? "PUSH",
        scheduleCron: data.scheduleCron ?? null,
        weeklyNewsletter: data.weeklyNewsletter ?? true,
        promotional: false,
      },
    });
    await tx.user.update({
      where: { id: user.id },
      data: { hasCompletedOnboarding: true },
    });
  });

  await invalidateTag(`prefs:${user.id}`);
  return { ok: true };
}

export async function updatePreferences(
  input: UpdatePreferencesInput,
): Promise<{ ok: true }> {
  const user = await requireUser();
  const data = updatePreferencesSchema.parse(input);
  await enforceRate(`prefs:${user.id}`, 30, 60);

  const accentColor =
    data.accentColor === undefined ? undefined : normalizeHex(data.accentColor);

  await prisma.userPreference.upsert({
    where: { userId: user.id },
    update: {
      ...(data.theme !== undefined && { theme: data.theme }),
      ...(accentColor !== undefined && { accentColor }),
      ...(data.tone !== undefined && { tone: data.tone }),
      ...(data.dailyCardAtHour !== undefined && {
        dailyCardAtHour: data.dailyCardAtHour,
      }),
    },
    create: {
      userId: user.id,
      theme: data.theme ?? "AUTO",
      accentColor: accentColor ?? null,
      tone: data.tone ?? "NEUTRAL",
      dailyCardAtHour: data.dailyCardAtHour ?? null,
    },
  });

  await invalidateTag(`prefs:${user.id}`);
  return { ok: true };
}

export async function updateNotificationPrefs(
  input: UpdateNotificationPrefsInput,
): Promise<{ ok: true }> {
  const user = await requireUser();
  const data = updateNotificationPrefsSchema.parse(input);
  await enforceRate(`notif-prefs:${user.id}`, 30, 60);

  await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    update: {
      ...(data.remindersEnabled !== undefined && {
        remindersEnabled: data.remindersEnabled,
      }),
      ...(data.channel !== undefined && { channel: data.channel }),
      ...(data.scheduleCron !== undefined && {
        scheduleCron: data.scheduleCron,
      }),
      ...(data.weeklyNewsletter !== undefined && {
        weeklyNewsletter: data.weeklyNewsletter,
      }),
      ...(data.promotional !== undefined && { promotional: data.promotional }),
    },
    create: {
      userId: user.id,
      remindersEnabled: data.remindersEnabled ?? true,
      channel: data.channel ?? "PUSH",
      scheduleCron: data.scheduleCron ?? null,
      weeklyNewsletter: data.weeklyNewsletter ?? true,
      promotional: data.promotional ?? false,
    },
  });

  await invalidateTag(`prefs:${user.id}`);
  return { ok: true };
}

export async function registerFcmToken(
  input: RegisterFcmTokenInput,
): Promise<{ ok: true }> {
  const user = await requireUser();
  const data = registerFcmTokenSchema.parse(input);
  await enforceRate(`fcm-register:${user.id}`, 60, 60);

  const now = new Date();
  await prisma.fcmToken.upsert({
    where: { token: data.token },
    update: {
      userId: user.id,
      ...(data.deviceId !== undefined && { deviceId: data.deviceId }),
      ...(data.platform !== undefined && { platform: data.platform }),
      lastSeenAt: now,
    },
    create: {
      userId: user.id,
      token: data.token,
      deviceId: data.deviceId ?? null,
      platform: data.platform ?? null,
    },
  });

  if (data.deviceId) {
    const cutoff = new Date(now.getTime() - FCM_STALE_MS);
    await prisma.fcmToken
      .deleteMany({
        where: {
          userId: user.id,
          deviceId: data.deviceId,
          lastSeenAt: { lt: cutoff },
          token: { not: data.token },
        },
      })
      .catch((err) => logger.warn({ err }, "fcm_prune_failed"));
  }

  return { ok: true };
}

export async function revokeFcmToken(
  input: RevokeFcmTokenInput,
): Promise<{ ok: true }> {
  const user = await requireUser();
  const data = revokeFcmTokenSchema.parse(input);
  await prisma.fcmToken.deleteMany({
    where: { token: data.token, userId: user.id },
  });
  return { ok: true };
}
