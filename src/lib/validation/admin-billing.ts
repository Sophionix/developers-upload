import { z } from "zod";

const id = z.string().min(1).max(40);
const cursor = z.string().min(1).max(512);
const take = z.number().int().min(1).max(50);

const slug = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "invalid_slug");
const planName = z.string().trim().min(1).max(120);
const description = z.string().trim().max(2000);
const priceCents = z.number().int().min(0).max(100_000_000);
const currency = z
  .string()
  .trim()
  .length(3)
  .regex(/^[A-Z]{3}$/, "invalid_currency");
const intervalMonths = z.number().int().min(1).max(60);
const trialDays = z.number().int().min(0).max(365);
const visibility = z.enum(["PUBLIC", "INTERNAL", "TEST_ONLY"]);
const features = z.record(z.string(), z.unknown());
const stripeId = z.string().trim().min(1).max(64);

export const listPlansSchema = z
  .object({
    cursor: cursor.optional(),
    take: take.optional(),
    isActive: z.boolean().optional(),
    search: z.string().trim().min(1).max(80).optional(),
  })
  .strict();
export type ListPlansInput = z.infer<typeof listPlansSchema>;

export const createPlanSchema = z
  .object({
    slug,
    name: planName,
    description: description.optional(),
    priceCents,
    currency: currency.default("USD"),
    intervalMonths,
    trialDays: trialDays.default(0),
    features: features.default({}),
    visibility: visibility.default("PUBLIC"),
    stripePriceId: stripeId.optional(),
    stripeProductId: stripeId.optional(),
    isActive: z.boolean().default(true),
  })
  .strict();
export type CreatePlanInput = z.infer<typeof createPlanSchema>;

export const updatePlanSchema = z
  .object({
    id,
    slug: slug.optional(),
    name: planName.optional(),
    description: description.nullable().optional(),
    priceCents: priceCents.optional(),
    currency: currency.optional(),
    intervalMonths: intervalMonths.optional(),
    trialDays: trialDays.optional(),
    features: features.optional(),
    visibility: visibility.optional(),
    stripePriceId: stripeId.nullable().optional(),
    stripeProductId: stripeId.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;

export const deletePlanSchema = z.object({ id }).strict();
export type DeletePlanInput = z.infer<typeof deletePlanSchema>;

const couponCode = z
  .string()
  .trim()
  .min(3)
  .max(40)
  .regex(/^[A-Z0-9_-]+$/i, "invalid_code")
  .transform((s) => s.toUpperCase());
const couponType = z.enum(["PERCENTAGE", "FLAT"]);
const percentOff = z.number().int().min(1).max(100);
const amountOffCents = z.number().int().min(1).max(100_000_000);
const maxRedemptions = z.number().int().min(1).max(1_000_000);

export const listCouponsSchema = z
  .object({
    cursor: cursor.optional(),
    take: take.optional(),
    isActive: z.boolean().optional(),
    search: z.string().trim().min(1).max(80).optional(),
  })
  .strict();
export type ListCouponsInput = z.infer<typeof listCouponsSchema>;

export const createCouponSchema = z
  .object({
    code: couponCode,
    type: couponType,
    percentOff: percentOff.optional(),
    amountOffCents: amountOffCents.optional(),
    currency: currency.default("USD"),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().optional(),
    maxRedemptions: maxRedemptions.optional(),
    appliesToPlanId: id.optional(),
    stripeCouponId: stripeId.optional(),
    isActive: z.boolean().default(true),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.type === "PERCENTAGE" && v.percentOff === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "percentOff_required_for_percentage",
        path: ["percentOff"],
      });
    }
    if (v.type === "FLAT" && v.amountOffCents === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "amountOffCents_required_for_flat",
        path: ["amountOffCents"],
      });
    }
    if (v.startsAt && v.endsAt && v.endsAt <= v.startsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endsAt_must_be_after_startsAt",
        path: ["endsAt"],
      });
    }
  });
export type CreateCouponInput = z.infer<typeof createCouponSchema>;

export const updateCouponSchema = z
  .object({
    id,
    percentOff: percentOff.nullable().optional(),
    amountOffCents: amountOffCents.nullable().optional(),
    startsAt: z.coerce.date().nullable().optional(),
    endsAt: z.coerce.date().nullable().optional(),
    maxRedemptions: maxRedemptions.nullable().optional(),
    appliesToPlanId: id.nullable().optional(),
    stripeCouponId: stripeId.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;

export const deleteCouponSchema = z.object({ id }).strict();
export type DeleteCouponInput = z.infer<typeof deleteCouponSchema>;
