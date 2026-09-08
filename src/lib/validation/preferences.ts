import { z } from "zod";

const hexColor = z.string().regex(/^#?[0-9a-fA-F]{6}$/, "invalid_hex_color");
const themeMode = z.enum(["LIGHT", "DARK", "AUTO"]);
const tone = z.enum(["FRIENDLY", "NEUTRAL", "MOTIVATIONAL"]);
const channel = z.enum(["PUSH", "EMAIL", "BOTH", "NONE"]);

// Simple 5-field cron validator: "m h dom mon dow" — each field is *, number, range, list, or step.
const cronField = /^(\*|\?|\d+(-\d+)?(\/\d+)?(,\d+(-\d+)?(\/\d+)?)*|\*\/\d+)$/;
const cronString = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((s) => {
    const parts = s.split(/\s+/);
    if (parts.length !== 5) return false;
    return parts.every((p) => cronField.test(p));
  }, "invalid_cron");

export const completeOnboardingSchema = z
  .object({
    theme: themeMode.optional(),
    accentColor: hexColor.optional(),
    tone: tone.optional(),
    dailyCardAtHour: z.number().int().min(0).max(23).optional(),
    remindersEnabled: z.boolean().optional(),
    channel: channel.optional(),
    scheduleCron: cronString.optional(),
    weeklyNewsletter: z.boolean().optional(),
  })
  .strict();
export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>;

export const updatePreferencesSchema = z
  .object({
    theme: themeMode.optional(),
    accentColor: hexColor.optional(),
    tone: tone.optional(),
    dailyCardAtHour: z.number().int().min(0).max(23).nullable().optional(),
  })
  .strict();
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;

export const updateNotificationPrefsSchema = z
  .object({
    remindersEnabled: z.boolean().optional(),
    channel: channel.optional(),
    scheduleCron: cronString.nullable().optional(),
    weeklyNewsletter: z.boolean().optional(),
    promotional: z.boolean().optional(),
  })
  .strict();
export type UpdateNotificationPrefsInput = z.infer<typeof updateNotificationPrefsSchema>;

export const registerFcmTokenSchema = z
  .object({
    token: z.string().trim().min(10).max(500),
    deviceId: z.string().trim().min(1).max(120).optional(),
    platform: z.enum(["web", "ios", "android"]).optional(),
  })
  .strict();
export type RegisterFcmTokenInput = z.infer<typeof registerFcmTokenSchema>;

export const revokeFcmTokenSchema = z
  .object({ token: z.string().trim().min(10).max(500) })
  .strict();
export type RevokeFcmTokenInput = z.infer<typeof revokeFcmTokenSchema>;
