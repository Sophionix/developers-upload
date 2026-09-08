import { z } from "zod";

const id = z.string().min(1).max(40);

const couponCode = z
  .string()
  .trim()
  .min(3)
  .max(40)
  .regex(/^[A-Z0-9_-]+$/i, "invalid_code")
  .transform((s) => s.toUpperCase());

export const validateCouponSchema = z
  .object({
    code: couponCode,
    planId: id.optional(),
  })
  .strict();
export type ValidateCouponInput = z.infer<typeof validateCouponSchema>;

export const createCheckoutSessionSchema = z
  .object({
    planId: id,
    couponCode: couponCode.optional(),
  })
  .strict();
export type CreateCheckoutSessionInput = z.infer<
  typeof createCheckoutSessionSchema
>;

export const createCardUnlockCheckoutSchema = z
  .object({
    cardId: id,
  })
  .strict();
export type CreateCardUnlockCheckoutInput = z.infer<
  typeof createCardUnlockCheckoutSchema
>;

export const createBillingPortalSessionSchema = z.object({}).strict();
export type CreateBillingPortalSessionInput = z.infer<
  typeof createBillingPortalSessionSchema
>;
