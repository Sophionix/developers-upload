"use client";

import * as React from "react";
import { Check } from "@/lib/ui/icons";

/* ─── Thank You ────────────────────────────────────────────── */
export function ThankYouModal({
  onClose,
  title = "Thank You",
  message = "You have been subscribed successfully",
  ctaLabel = "Continue",
}: {
  onClose: () => void;
  title?: string;
  message?: string;
  ctaLabel?: string;
}) {
  const overlayRef = React.useRef<HTMLDivElement>(null);

  return (
    <div
      ref={overlayRef}
      role="presentation"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(40,0,0,0.55)] backdrop-blur-[12px]"
      style={{ opacity: 0.95 }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="relative mx-4 flex w-full max-w-[434px] flex-col overflow-hidden rounded-[30px] border border-white/70 bg-black/45 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex h-16 shrink-0 items-center justify-center bg-[#690f04] bg-btn-brand px-10">
          <h2 className="font-display text-center text-xl text-white">{title}</h2>
        </div>

        <div className="flex flex-col items-center px-6 pb-6 pt-8">
          <div className="relative mb-6 flex size-[120px] items-center justify-center">
            <div
              aria-hidden
              className="absolute size-[120px] rounded-full bg-green-500/15 ring-2 ring-green-500/25"
            />
            <div
              aria-hidden
              className="absolute size-[96px] rounded-full bg-green-500/20 ring-1 ring-green-500/35"
            />
            <div className="relative flex size-20 items-center justify-center rounded-full bg-green-500 shadow-[0_0_24px_rgba(34,197,94,0.45)]">
              <Check className="size-10 text-white" strokeWidth={3} />
            </div>
          </div>

          <p className="mb-8 max-w-[213px] text-center text-[16px] font-light leading-[24px] text-white">
            {message}
          </p>

          <button
            type="button"
            onClick={onClose}
            className="relative flex h-[60px] w-full max-w-[393px] items-center justify-center overflow-hidden rounded-[30px] bg-[#690f04] bg-btn-brand text-xl font-bold capitalize text-white transition hover:brightness-110 active:brightness-95"
          >
            {ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
