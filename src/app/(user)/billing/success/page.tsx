"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "@/lib/ui/icons";
import { getCurrentSubscription } from "@/server/actions/billing";
import type { CurrentSubscriptionDto } from "@/lib/dto/subscription";

/**
 * Stripe Checkout success landing (STRIPE_CHECKOUT_SUCCESS_URL).
 * Activation happens asynchronously via the Stripe webhook, so we poll the
 * current subscription a few times before falling back to a "processing" note.
 */
export default function BillingSuccessPage() {
  const [sub, setSub] = React.useState<CurrentSubscriptionDto | null>(null);
  const [settled, setSettled] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    let tries = 0;

    const poll = async () => {
      tries += 1;
      try {
        const current = await getCurrentSubscription();
        if (cancelled) return;
        const active =
          current.tier !== "FREE" &&
          (current.status === "ACTIVE" || current.status === "TRIALING");
        if (active) {
          setSub(current);
          setSettled(true);
          return;
        }
      } catch {
        /* keep polling */
      }
      if (cancelled) return;
      if (tries >= 6) {
        setSettled(true);
        return;
      }
      setTimeout(poll, 2000);
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, []);

  const active =
    sub?.tier &&
    sub.tier !== "FREE" &&
    (sub.status === "ACTIVE" || sub.status === "TRIALING");

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 py-16 text-center">
      {!settled ? (
        <>
          <Loader2 className="size-12 animate-spin text-white/80" />
          <div>
            <h1 className="font-display text-2xl text-white">Finalizing your payment…</h1>
            <p className="mt-2 text-sm text-white/70">
              This only takes a moment. Please don&apos;t close this window.
            </p>
          </div>
        </>
      ) : active ? (
        <>
          <div className="flex size-20 items-center justify-center rounded-full bg-green-500 shadow-[0_0_24px_rgba(34,197,94,0.45)]">
            <Check className="size-10 text-white" strokeWidth={3} />
          </div>
          <div>
            <h1 className="font-display text-2xl text-white">You&apos;re subscribed!</h1>
            <p className="mt-2 text-sm text-white/70">
              Your {sub?.planName ?? "Premium"} plan is now active. Enjoy full access.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="brand" size="lg">
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/billing">View Billing</Link>
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex size-20 items-center justify-center rounded-full bg-green-500/80">
            <Check className="size-10 text-white" strokeWidth={3} />
          </div>
          <div>
            <h1 className="font-display text-2xl text-white">Payment received</h1>
            <p className="mt-2 max-w-sm text-sm text-white/70">
              Thanks! Your payment went through. Your subscription is being
              activated and will appear shortly — you can check your billing page
              in a minute.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="brand" size="lg">
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/billing">View Billing</Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
