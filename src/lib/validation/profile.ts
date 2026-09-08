import { z } from "zod";

const sanitizedName = z
  .string()
  .trim()
  .min(1, "name_required")
  .max(120, "name_too_long")
  // Strip control chars; keep unicode letters/spaces/punctuation.
  .transform((v) => v.replace(/[\u0000-\u001F\u007F]/g, ""));

export const updateProfileSchema = z
  .object({
    fullName: sanitizedName.optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
    locale: z.string().trim().min(2).max(10).optional(),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "invalid_date").optional(),
    gender: z.enum(["male", "female", "other", "prefer_not"]).optional(),
    country: z.string().trim().min(2).max(4).optional(),
    state: z.string().trim().min(1).max(10).optional(),
    phone: z.string().trim().min(4).max(20).regex(/^\+?[\d\s-]+$/, "invalid_phone").optional(),
  })
  .strict();
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const setAvatarSchema = z
  .object({
    storagePath: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .regex(/^avatars\/[^/]+\/[A-Za-z0-9_.-]+$/, "invalid_storage_path"),
  })
  .strict();
export type SetAvatarInput = z.infer<typeof setAvatarSchema>;

export const requestEmailChangeSchema = z
  .object({
    newEmail: z.string().trim().toLowerCase().email().max(255),
  })
  .strict();
export type RequestEmailChangeInput = z.infer<typeof requestEmailChangeSchema>;

export const avatarUploadUrlSchema = z
  .object({
    contentType: z.enum(["image/png", "image/jpeg", "image/webp"]),
    sizeBytes: z.number().int().positive(),
    ext: z.enum(["png", "jpg", "jpeg", "webp"]),
  })
  .strict();
export type AvatarUploadUrlInput = z.infer<typeof avatarUploadUrlSchema>;

export const revokeSessionSchema = z
  .object({ id: z.string().min(1).max(64) })
  .strict();
