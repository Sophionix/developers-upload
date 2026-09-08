import { z } from "zod";

const cursor = z.string().min(1).max(512);
const take = z.number().int().min(1).max(100);
const id = z.string().min(1).max(40);
const settingKey = z.string().min(1).max(80);
const flagKey = z.string().min(1).max(80);

export const getSettingSchema = z.object({ key: settingKey }).strict();
export type GetSettingInput = z.infer<typeof getSettingSchema>;

export const updateSettingSchema = z
  .object({ key: settingKey, value: z.unknown() })
  .strict();
export type UpdateSettingInput = z.infer<typeof updateSettingSchema>;

const auditAction = z.enum([
  "CREATE",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "LOGOUT",
  "GRANT",
  "REVOKE",
  "EXPORT",
  "IMPORT",
  "OVERRIDE",
]);

export const listAuditLogsSchema = z
  .object({
    cursor: cursor.optional(),
    take: take.optional(),
    actorId: id.optional(),
    entity: z.string().trim().min(1).max(60).optional(),
    action: auditAction.optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
  })
  .strict();
export type ListAuditLogsInput = z.infer<typeof listAuditLogsSchema>;

export const listFlagsSchema = z
  .object({
    cursor: cursor.optional(),
    take: take.optional(),
  })
  .strict();
export type ListFlagsInput = z.infer<typeof listFlagsSchema>;

export const upsertFlagSchema = z
  .object({
    key: flagKey,
    isEnabled: z.boolean(),
    rolloutPercentage: z.number().int().min(0).max(100).default(0),
  })
  .strict();
export type UpsertFlagInput = z.infer<typeof upsertFlagSchema>;

export const listAdminsSchema = z
  .object({
    cursor: cursor.optional(),
    take: take.optional(),
  })
  .strict();
export type ListAdminsInput = z.infer<typeof listAdminsSchema>;

export const createAdminSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(255),
    fullName: z.string().trim().min(1).max(120),
    role: z.enum(["SUPER_ADMIN", "CONTENT_MANAGER"]),
  })
  .strict();
export type CreateAdminInput = z.infer<typeof createAdminSchema>;
