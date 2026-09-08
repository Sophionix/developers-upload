import { ConflictError } from "@/lib/errors";
import { assertCouponRedeemable, type RedeemableCoupon } from "@/server/actions/admin/coupons";
import { validateCouponSchema, type ValidateCouponInput } from "@/lib/validation/billing";

export { assertCouponRedeemable, type RedeemableCoupon };

export interface PublicCouponDto {
  valid: true;
  code: string;
  discountType: "PERCENTAGE" | "FLAT";
  percentOff: number | null;
  amountOffCents: number | null;
  currency: string;
  appliesToPlanId: string | null;
}

export async function validateCouponPublic(
  input: ValidateCouponInput,
): Promise<PublicCouponDto> {
  const { code, planId } = validateCouponSchema.parse(input);
  const row = await assertCouponRedeemable(code);
  if (row.appliesToPlanId && planId && row.appliesToPlanId !== planId) {
    throw new ConflictError("coupon_not_applicable_to_plan");
  }
  return {
    valid: true,
    code: row.code,
    discountType: row.type,
    percentOff: row.percentOff,
    amountOffCents: row.amountOffCents,
    currency: row.currency,
    appliesToPlanId: row.appliesToPlanId,
  };
}
