import type { PaymentStatus } from "@/generated/prisma/enums";

export interface PaymentDto {
  id: string;
  userId: string | null;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  stripeInvoiceId: string | null;
  receiptUrl: string | null;
  cardUnlockId: string | null;
  subscriptionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentRow {
  id: string;
  userId: string | null;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  stripeInvoiceId: string | null;
  receiptUrl: string | null;
  cardUnlockId: string | null;
  subscriptionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toPaymentDto(row: PaymentRow): PaymentDto {
  return { ...row };
}

export interface BillingOverviewDto {
  activeSubscriptions: number;
  mrrCents: number;
  refundsLast30dCents: number;
  refundsLast30dCount: number;
}

export interface RefundResultDto {
  paymentId: string;
  status: PaymentStatus;
  refundId: string;
  refundedAmountCents: number;
}
