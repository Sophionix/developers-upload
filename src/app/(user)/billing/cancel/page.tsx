"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { X } from "@/lib/ui/icons";

/**
 * Stripe Checkout cancel landing (STRIPE_CHECKOUT_CANCEL_URL). Reached when the
 * user backs out of Stripe's hosted checkout without paying. No charge was made.
 */
export default function BillingCancelPage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 py-16 text-center">
      <div className="flex size-20 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
        <X className="size-10 text-white/80" strokeWidth={2.5} />
      </div>
      <div>
        <h1 className="font-display text-2xl text-white">Checkout canceled</h1>
        <p className="mt-2 max-w-sm text-sm text-white/70">
          No payment was made. You can pick a plan again whenever you&apos;re
          ready.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild variant="brand" size="lg">
          <Link href="/subscription">Back to Plans</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
