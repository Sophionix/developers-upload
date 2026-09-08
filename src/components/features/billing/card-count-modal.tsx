"use client";

import * as React from "react";
import { X } from "@/lib/ui/icons";

/**
 * Brand-styled "Cards" modal — Figma Sophionix Final UI (guest dashboard flow).
 * Lets the guest pick how many cards to draw (One / Two) after a successful
 * Pay-Per-Use purchase. Shares the brown header + orange pill button styling
 * used by `ThankYouModal`.
 */
export function CardCountModal({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (count: 1 | 2) => void;
}) {
  const overlayRef = React.useRef<HTMLDivElement>(null);

  return (
    <div
      ref={overlayRef}
      role="presentation"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(40,0,0,0.55)] backdrop-blur-[12px]"
      style={{ opacity: 0.95 }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="relative mx-4 w-full max-w-[434px] overflow-hidden rounded-[30px] border border-white/70 bg-black/45 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex h-16 shrink-0 items-center justify-center bg-[#690f04] bg-btn-brand px-10">
          <h2 className="font-display text-center text-xl text-white">Cards</h2>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="size-5" strokeWidth={2.5} />
          </button>
        </div>

        <div className="space-y-3 px-6 pb-6 pt-5">
          <button
            type="button"
            onClick={() => onSelect(1)}
            className="relative flex h-[60px] w-full items-center justify-center overflow-hidden rounded-[30px] bg-[#690f04] bg-btn-brand text-xl font-bold capitalize text-white transition hover:brightness-110 active:brightness-95"
          >
            One Card
          </button>
          <button
            type="button"
            onClick={() => onSelect(2)}
            className="relative flex h-[60px] w-full items-center justify-center overflow-hidden rounded-[30px] bg-[#690f04] bg-btn-brand text-xl font-bold capitalize text-white transition hover:brightness-110 active:brightness-95"
          >
            Two Cards
          </button>
        </div>
      </div>
    </div>
  );
}
