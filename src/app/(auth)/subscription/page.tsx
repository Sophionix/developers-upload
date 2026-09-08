"use client";

import * as React from "react";
import Link from "next/link";
import { AuthRightColumn } from "@/components/features/auth";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { ArrowLeft, Loader2 } from "@/lib/ui/icons";
import { listPublicPlans } from "@/server/actions/billing";
import { createCheckoutSession } from "@/server/actions/billing";
import type { PlanDto } from "@/lib/dto/billing";

function formatPrice(priceCents: number, currency: string): string {
  const amount = (priceCents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const symbol = currency.toUpperCase() === "USD" ? "$" : `${currency.toUpperCase()} `;
  return `${symbol}${amount}`;
}

function intervalLabel(intervalMonths: number): string {
  if (intervalMonths === 12) return "Yearly";
  if (intervalMonths === 1) return "Monthly";
  return `Every ${intervalMonths} months`;
}

export default function SubscriptionPage() {
  const [plans, setPlans] = React.useState<PlanDto[] | null>(null);
  const [checkoutPlanId, setCheckoutPlanId] = React.useState<string | null>(null);

  React.useEffect(() => {
    listPublicPlans()
      .then(setPlans)
      .catch(() => setPlans([]));
  }, []);

  const startCheckout = React.useCallback(async (planId: string) => {
    setCheckoutPlanId(planId);
    try {
      // Real Stripe Checkout: redirect to Stripe's hosted payment page, which
      // handles card / Google Pay / Apple Pay. Subscription is activated by the
      // Stripe webhook on checkout.session.completed / customer.subscription.*.
      const { url } = await createCheckoutSession({ planId });
      // Hard full-page navigation to Stripe's hosted checkout. Use href (not
      // router.push / location.assign) so Next's in-flight RSC navigation can't
      // cancel it in dev — this must leave the SPA entirely.
      window.location.href = url;
      return;
    } catch (err) {
      const code = err instanceof Error ? err.message : "checkout_failed";
      const message =
        code === "subscription_already_active"
          ? "You already have an active subscription."
          : code === "plan_not_synced_to_stripe"
            ? "This plan isn't available for purchase yet."
            : "Couldn't start checkout. Please try again.";
      toast.error(message);
      setCheckoutPlanId(null);
    }
  }, []);

  return (
    <AuthRightColumn
      align="top"
      leading={
        <Button
          asChild
          variant="outline"
          size="icon-sm"
          aria-label="Go back"
          className="border-white/40 bg-transparent text-white hover:bg-white/10"
        >
          <Link href="/profile">
            <ArrowLeft className="size-4" strokeWidth={2.6} />
          </Link>
        </Button>
      }
      footer={
        <p className="pb-2 text-base font-bold text-white underline decoration-solid underline-offset-2 sm:text-[18px] lg:text-[22px]">
          <Link href="/dashboard" className="hover:text-white/90">
            Maybe Later
          </Link>
        </p>
      }
    >
      <div className="flex h-full flex-col justify-between gap-6 sm:gap-10">
        <div className="space-y-4 pt-2 sm:space-y-6 sm:pt-8">
          <h1 className="font-display text-center text-3xl leading-none text-white sm:text-4xl lg:text-[40px]">
            Subscription Plans
          </h1>
          <p className="text-base font-light text-white/95 sm:text-[18px]">
            Select Plan and enjoy all app tools
          </p>

          {plans === null ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-8 animate-spin text-white/80" />
            </div>
          ) : plans.length === 0 ? (
            <p className="py-10 text-center text-base text-white/80">
              No plans are available right now. Please check back later.
            </p>
          ) : (
            <div className="space-y-4">
              {plans.map((plan) => {
                const busy = checkoutPlanId === plan.id;
                const anyBusy = checkoutPlanId !== null;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    disabled={anyBusy}
                    onClick={() => void startCheckout(plan.id)}
                    className="relative w-full rounded-[19px] bg-link px-5 pb-6 pt-7 text-left transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70 sm:px-7 sm:pb-8 sm:pt-9"
                  >
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                      <p className="text-2xl font-bold leading-[1.2] text-white sm:text-[31px]">
                        {plan.name}
                      </p>
                      <div className="text-right">
                        <p className="text-3xl font-bold leading-[1.2] text-white sm:text-[35px]">
                          {formatPrice(plan.priceCents, plan.currency)}/
                        </p>
                        <p className="text-lg font-medium leading-[1.2] text-[#e5e5e5] sm:text-[20px]">
                          {intervalLabel(plan.intervalMonths)}
                        </p>
                      </div>
                    </div>
                    {plan.description ? (
                      <p className="text-sm leading-[1.4] text-white sm:text-[18px]">
                        {plan.description}
                      </p>
                    ) : null}
                    {busy ? (
                      <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white">
                        <Loader2 className="size-4 animate-spin" />
                        Redirecting to secure checkout…
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AuthRightColumn>
  );
}
