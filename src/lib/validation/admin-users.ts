import { z } from "zod";

const id = z.string().min(1).max(40);
const cursor = z.string().min(1).max(512);
const take = z.number().int().min(1).max(50);

const accountStatus = z.enum(["ACTIVE", "DEACTIVATED", "PENDING_DELETION"]);
const userRole = z.enum(["USER", "SUPER_ADMIN", "CONTENT_MANAGER"]);
const sortBy = z.enum(["createdAt", "lastLoginAt", "subscriptionTier"]);

export const listUsersSchema = z
  .object({
    cursor: cursor.optional(),
    take: take.optional(),
    status: accountStatus.optional(),
    role: userRole.optional(),
    search: z.string().trim().min(1).max(120).optional(),
    createdFrom: z.coerce.date().optional(),
    createdTo: z.coerce.date().optional(),
    sortBy: sortBy.default("createdAt"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();
export type ListUsersInput = z.infer<typeof listUsersSchema>;

export const getUserSchema = z.object({ id }).strict();
export type GetUserInput = z.infer<typeof getUserSchema>;

export const deactivateUserSchema = z
  .object({ id, reason: z.string().trim().max(500).optional() })
  .strict();
export type DeactivateUserInput = z.infer<typeof deactivateUserSchema>;

export const reactivateUserSchema = z.object({ id }).strict();
export type ReactivateUserInput = z.infer<typeof reactivateUserSchema>;

export const resetUserPasswordSchema = z.object({ id }).strict();
export type ResetUserPasswordInput = z.infer<typeof resetUserPasswordSchema>;

export const softDeleteUserSchema = z
  .object({ id, reason: z.string().trim().max(500).optional() })
  .strict();
export type SoftDeleteUserInput = z.infer<typeof softDeleteUserSchema>;

export const hardDeleteUserSchema = z
  .object({ id, confirmation: z.string().min(1).max(120) })
  .strict();
export type HardDeleteUserInput = z.infer<typeof hardDeleteUserSchema>;

export const assignRoleSchema = z.object({ id, role: userRole }).strict();
export type AssignRoleInput = z.infer<typeof assignRoleSchema>;
