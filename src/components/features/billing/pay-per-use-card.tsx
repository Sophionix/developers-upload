"use client";

import { cn } from "@/lib/ui/cn";

type PayPerUseCardProps = {
  /** Invoked when the card is activated (e.g. start the unlock flow). */
  onClick: () => void;
  className?: string;
};

/**
 * Guest "Pay Per Use" subscription offer. Shared between the Subscriptions page
 * and the dashboard deck modal so both stay in sync.
 */
export function PayPerUseCard({ onClick, className }: PayPerUseCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Pay Per Use — unlock a deck"
      className={cn(
        "group relative w-full max-w-[696px] cursor-pointer rounded-[24.727px] border border-white/[0.38] bg-[rgba(26,1,1,0.58)] p-6 text-left shadow-[0px_4.71px_40px_0px_rgba(0,0,0,0.15)] transition-colors hover:border-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black md:p-8",
        className,
      )}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-8">
        <div className="min-w-0 flex-1">
          <h2
            className="text-[clamp(1.5rem,3vw,1.95rem)] font-bold leading-[1.2] text-white"
            style={{ fontFamily: "var(--font-roboto-medium), system-ui, sans-serif" }}
          >
            Pay Per Use
          </h2>
          <p
            className="mt-4 max-w-[596px] text-lg font-normal leading-[1.4] text-white"
            style={{ fontFamily: "var(--font-roboto-ui), system-ui, sans-serif" }}
          >
            Our Pay-Per-Use system gives you full flexibility—no subscriptions, no recurring fees.
            Simply make a one-time payment whenever you want a card reading and access your session
            instantly. Pay only when you need clarity or guidance
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-1 md:items-end">
          <div className="flex items-start gap-0.5">
            <span className="font-display text-[40px] leading-[1.2] text-white">$1.99</span>
          </div>
          <p
            className="text-xl font-medium leading-[1.2] text-[#e5e5e5]"
            style={{ fontFamily: "var(--font-roboto-medium), system-ui, sans-serif" }}
          >
            Pay each time
          </p>
        </div>
      </div>
    </button>
  );
}
