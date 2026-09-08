"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PayPerUseCard } from "@/components/features/billing";

/**
 * Guest Subscriptions. The "Pay Per Use" card routes into the real guest deck
 * unlock flow (Stripe-backed) instead of a mock payment overlay. Guests draw a
 * deck and pay the one-time 99¢ unlock via Stripe on the deck page.
 */
export default function GuestBillingPage() {
  const router = useRouter();

  const goToDeck = React.useCallback(() => {
    router.push("/guest/cards");
  }, [router]);

  return (
    <div className="relative min-h-full">
      <h1 className="mb-8 font-display text-[clamp(1.75rem,4vw,2.1875rem)] leading-tight text-white md:mb-10">
        Subscriptions
      </h1>

      <PayPerUseCard onClick={goToDeck} />
    </div>
  );
}
