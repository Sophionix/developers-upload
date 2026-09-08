import { z } from "zod";

const id = z.string().min(1).max(40);
const cursor = z.string().min(1).max(512);
const take = z.number().int().min(1).max(50);

const paymentStatus = z.enum([
  "PENDING",
  "SUCCEEDED",
  "FAILED",
  "REFUNDED",
]);

export const listPaymentsSchema = z
  .object({
    cursor: cursor.optional(),
    take: take.optional(),
    status: paymentStatus.optional(),
    userId: id.optional(),
    createdFrom: z.coerce.date().optional(),
    createdTo: z.coerce.date().optional(),
  })
  .strict();
export type ListPaymentsInput = z.infer<typeof listPaymentsSchema>;

export const refundPaymentSchema = z
  .object({
    paymentId: id,
    reason: z.enum(["duplicate", "fraudulent", "requested_by_customer"]),
    amountCents: z.number().int().min(1).max(100_000_000).optional(),
  })
  .strict();
export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>;

export const grantPremiumSchema = z
  .object({
    userId: id,
    expiresAt: z.coerce.date().optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.expiresAt && v.expiresAt.getTime() <= Date.now()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "expiresAt_must_be_in_future",
        path: ["expiresAt"],
      });
    }
  });
export type GrantPremiumInput = z.infer<typeof grantPremiumSchema>;

export const revokePremiumSchema = z.object({ userId: id }).strict();
export type RevokePremiumInput = z.infer<typeof revokePremiumSchema>;

export const extendTrialSchema = z
  .object({
    userId: id,
    days: z.number().int().min(1).max(365),
  })
  .strict();
export type ExtendTrialInput = z.infer<typeof extendTrialSchema>;
